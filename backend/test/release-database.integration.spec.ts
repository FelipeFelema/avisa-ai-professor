import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountDeletionService } from '../src/users/account-deletion.service';
import { ClassroomsService } from '../src/classrooms/classrooms.service';
import { hashPassword } from '../src/common/security/password-hasher';
import { AnnouncementPushService } from '../src/push/announcement-push.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';

describe('release database migrations and privacy integrity', () => {
  let prisma: PrismaService;
  const migrations = resolve(__dirname, '../prisma/migrations');
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
  });
  beforeEach(async () => {
    assertAnnouncementPushTestDatabase();
    await clearTestDatabase(prisma);
  });
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it('has every migration applied with the unchanged checksum and no failed row', async () => {
    const applied = await prisma.$queryRaw<
      Array<{
        migration_name: string;
        checksum: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }>
    >`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;
    const dirs = readdirSync(migrations, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(
      applied.filter((r) => !r.rolled_back_at).map((r) => r.migration_name),
    ).toEqual(dirs);
    for (const row of applied.filter((r) => !r.rolled_back_at)) {
      expect(row.finished_at).not.toBeNull();
      const sql = readFileSync(
        resolve(migrations, row.migration_name, 'migration.sql'),
      );
      // Prisma accepts the same SQL with LF or CRLF; other content changes remain failures.
      const lf = sql.toString('utf8').replace(/\r\n/g, '\n');
      const candidates = [sql, lf, lf.replace(/\n/g, '\r\n')].map((value) =>
        createHash('sha256').update(value).digest('hex'),
      );
      expect(candidates).toContain(row.checksum);
    }
  });

  it.each([false, true])(
    'replays the full migration chain on isolated empty/representative pre-push schema (legacy=%s)',
    async (legacy) => {
      const namespace = `release012_${randomUUID().replaceAll('-', '')}`;
      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`CREATE SCHEMA "${namespace}"`);
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${namespace}"`);
          const dirs = readdirSync(migrations, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort();
          for (const dir of dirs) {
            const sql = readFileSync(
              resolve(migrations, dir, 'migration.sql'),
              'utf8',
            );
            for (const statement of sql
              .split(/;\s*(?:\r?\n|$)/)
              .filter((s) => s.trim()))
              await tx.$executeRawUnsafe(statement);
            if (
              legacy &&
              dir === '20260824_add_auth_sessions_and_deletion_receipts'
            ) {
              await tx.$executeRaw`INSERT INTO "User" (id,name,email,password,role,"updatedAt") VALUES ('legacy012','Preserved','legacy012@example.test','synthetic','PROFESSOR',NOW())`;
              await tx.$executeRaw`INSERT INTO "Classroom" (id,name,"ownerId","updatedAt") VALUES ('legacy012','Preserved','legacy012',NOW())`;
              await tx.$executeRaw`INSERT INTO "UserClassroom" ("userId","classroomId") VALUES ('legacy012','legacy012')`;
              await tx.$executeRaw`INSERT INTO "AuthSession" (id,"userId","refreshTokenHash","expiresAt","updatedAt") VALUES ('legacy012','legacy012','synthetic',NOW()+INTERVAL '7 days',NOW())`;
              await tx.$executeRaw`INSERT INTO "Announcement" (id,title,content,"expiresAt","authorId","classroomId","updatedAt") VALUES ('legacy012','Preserved','Preserved',NOW()+INTERVAL '7 days','legacy012','legacy012',NOW())`;
            }
          }
          const counts = await tx.$queryRaw<
            Array<{ users: number; registrations: number; events: number }>
          >`SELECT (SELECT COUNT(*)::int FROM "User") AS users, (SELECT COUNT(*)::int FROM "PushRegistration") AS registrations, (SELECT COUNT(*)::int FROM "AnnouncementPushEvent") AS events`;
          expect(counts).toEqual([
            { users: legacy ? 1 : 0, registrations: 0, events: 0 },
          ]);
          if (legacy) {
            expect(
              await tx.$queryRaw`SELECT title,content,"notificationPending" FROM "Announcement" WHERE id='legacy012'`,
            ).toEqual([
              {
                title: 'Preserved',
                content: 'Preserved',
                notificationPending: null,
              },
            ]);
            expect(
              await tx.$queryRaw`SELECT "refreshTokenHash" FROM "AuthSession" WHERE id='legacy012'`,
            ).toEqual([{ refreshTokenHash: 'synthetic' }]);
          }
          await tx.$executeRawUnsafe(`DROP SCHEMA "${namespace}" CASCADE`);
        },
        { timeout: 60000 },
      );
    },
  );

  it.each(['account', 'classroom'] as const)(
    'deletes %s through its service and leaves no live orphan recipient/ledger',
    async (kind) => {
      const f = await createAnnouncementPushFixture(prisma);
      const announcement = await prisma.announcement.create({
        data: {
          title: 'Synthetic',
          content: 'Synthetic',
          authorId: f.author.user.id,
          classroomId: f.classroom.id,
          expiresAt: new Date(Date.now() + 86400000),
          notificationPending: true,
        },
      });
      const service = new AnnouncementPushService(
        prisma,
        new PushRegistrationService(prisma),
      );
      await service.materialize(announcement.id);
      const row = (await service.claim()).find(
        (r) => r.userId === f.member.user.id,
      )!;
      const reg = f.memberBinding.registration;
      await prisma.pushTestAttempt.create({
        data: {
          installationId: reg.installationId,
          registrationId: reg.id,
          tokenRevision: reg.tokenRevision,
          tokenFingerprint: reg.tokenFingerprint!,
        },
      });
      if (kind === 'account') {
        await prisma.user.update({
          where: { id: f.member.user.id },
          data: { password: await hashPassword('Synthetic-test-password!') },
        });
        await new AccountDeletionService(prisma).deleteOwnAccount(
          f.member.user.id,
          f.member.session.id,
          {
            currentPassword: 'Synthetic-test-password!',
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        );
        expect(
          await prisma.pushRegistration.count({
            where: { userId: f.member.user.id },
          }),
        ).toBe(0);
        expect(await prisma.pushTestAttempt.count()).toBe(0);
        expect(
          await prisma.announcementPushDispatch.count({
            where: { userId: f.member.user.id },
          }),
        ).toBe(0);
        expect(
          await prisma.user.findUnique({ where: { id: f.outsider.user.id } }),
        ).not.toBeNull();
      } else {
        await new ClassroomsService(prisma).delete(
          f.owner.user.id,
          f.classroom.id,
        );
        expect(await prisma.announcementPushEvent.count()).toBe(0);
        expect(await prisma.announcementPushDispatch.count()).toBe(0);
        expect(
          await prisma.classroomDeletionReceipt.count({
            where: { classroomId: f.classroom.id },
          }),
        ).toBe(1);
        expect(
          await prisma.classroom.findUnique({
            where: { id: f.otherClassroom.id },
          }),
        ).not.toBeNull();
      }
      expect(await service.authorize(row)).toBeNull();
      expect(
        await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "PushRegistration" r LEFT JOIN "AuthSession" s ON s.id=r."sessionId" LEFT JOIN "User" u ON u.id=r."userId" WHERE s.id IS NULL OR u.id IS NULL`,
      ).toEqual([{ count: 0 }]);
    },
  );
});
