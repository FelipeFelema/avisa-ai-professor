import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';

const migrationName = '20261006190000_release_critical_notifications';

describe('announcement push additive migration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
  });
  beforeEach(async () => clearTestDatabase(prisma));
  afterAll(async () => {
    if (prisma) {
      await clearTestDatabase(prisma);
      await prisma.$disconnect();
    }
  });

  it('preserves a legacy announcement and leaves its new marker null', async () => {
    const namespace = `announcement_migration_${randomUUID().replaceAll('-', '')}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${namespace}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${namespace}"`);
      for (const statement of [
        'CREATE TABLE "User" ("id" TEXT PRIMARY KEY)',
        'CREATE TABLE "AuthSession" ("id" TEXT PRIMARY KEY)',
        'CREATE TABLE "PushInstallation" ("id" UUID PRIMARY KEY)',
        'CREATE TABLE "PushRegistration" ("id" UUID PRIMARY KEY)',
        'CREATE TABLE "Announcement" ("id" TEXT PRIMARY KEY, "title" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)',
        `INSERT INTO "Announcement" ("id", "title") VALUES ('legacy', 'preserved')`,
      ]) {
        await tx.$executeRawUnsafe(statement);
      }
      const sql = readFileSync(
        resolve(
          __dirname,
          '../prisma/migrations',
          migrationName,
          'migration.sql',
        ),
        'utf8',
      );
      for (const statement of sql
        .split(/;\s*(?:\r?\n|$)/)
        .filter((s) => s.trim())) {
        await tx.$executeRawUnsafe(statement);
      }
      await tx.$executeRaw`INSERT INTO "AnnouncementPushEvent" ("id", "announcementId", "kind", "snapshotAt") VALUES ('00000000-0000-4000-8000-000000000123'::uuid, 'legacy', 'NEW', CURRENT_TIMESTAMP)`;
      const followup = readFileSync(
        resolve(
          __dirname,
          '../prisma/migrations/20261007120000_announcement_expiration_occurrences/migration.sql',
        ),
        'utf8',
      );
      for (const statement of followup
        .split(/;\s*(?:\r?\n|$)/)
        .filter((s) => s.trim()))
        await tx.$executeRawUnsafe(statement);
      expect(
        await tx.$queryRaw`SELECT "occurrenceKey" FROM "AnnouncementPushEvent"`,
      ).toEqual([{ occurrenceKey: 'publication' }]);
      const legacy = await tx.$queryRaw<
        Array<{ title: string; notificationPending: boolean | null }>
      >`SELECT "title", "notificationPending" FROM "Announcement" WHERE "id"='legacy'`;
      expect(legacy).toEqual([
        { title: 'preserved', notificationPending: null },
      ]);
      await tx.$executeRawUnsafe(`DROP SCHEMA "${namespace}" CASCADE`);
    });
  });

  it('enforces event/installation uniqueness, counters and cascading privacy', async () => {
    const fixture = await createAnnouncementPushFixture(prisma);
    const announcement = await prisma.announcement.create({
      data: {
        title: 'Synthetic',
        content: 'Private synthetic content',
        authorId: fixture.author.user.id,
        classroomId: fixture.classroom.id,
        expiresAt: new Date(Date.now() + 86400_000),
        notificationPending: true,
      },
    });
    const event = await prisma.announcementPushEvent.create({
      data: {
        announcementId: announcement.id,
        kind: 'NEW',
        snapshotAt: new Date(),
      },
    });
    const binding = fixture.memberBinding.registration;
    const data = {
      eventId: event.id,
      installationId: binding.installationId,
      registrationId: binding.id,
      userId: binding.userId,
      sessionId: binding.sessionId,
      lifecycleVersion: binding.lifecycleVersion,
      tokenRevision: binding.tokenRevision,
      tokenFingerprint: binding.tokenFingerprint!,
    };
    await prisma.announcementPushDispatch.create({ data });
    await expect(
      prisma.announcementPushEvent.create({
        data: {
          announcementId: announcement.id,
          kind: 'NEW',
          snapshotAt: new Date(),
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(
      prisma.announcementPushDispatch.create({ data }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await expect(
      prisma.announcementPushDispatch.create({
        data: {
          ...data,
          installationId: fixture.ownerBinding.installation.id,
          tokenRevision: 0,
        },
      }),
    ).rejects.toMatchObject({ cause: { originalCode: '23514' } });
    await expect(
      prisma.announcementPushDispatch.updateMany({
        where: { eventId: event.id },
        data: { claimVersion: -1 },
      }),
    ).rejects.toMatchObject({ cause: { originalCode: '23514' } });
    await expect(
      prisma.announcementPushDispatch.updateMany({
        where: { eventId: event.id },
        data: { state: 'SENDING' },
      }),
    ).rejects.toMatchObject({ cause: { originalCode: '23514' } });
    await prisma.authSession.delete({ where: { id: binding.sessionId } });
    expect(await prisma.announcementPushDispatch.count()).toBe(0);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    expect(
      await prisma.pushRegistration.count({
        where: { id: fixture.outsiderBinding.registration.id },
      }),
    ).toBe(1);
    await prisma.announcement.delete({ where: { id: announcement.id } });
    expect(await prisma.announcementPushEvent.count()).toBe(0);
  });
  it('uniquely keys each expiry, retains NEW uniqueness and rejects invalid occurrence kinds', async () => {
    const f = await createAnnouncementPushFixture(prisma);
    const a = await prisma.announcement.create({
      data: {
        title: 'Synthetic',
        content: 'Synthetic',
        authorId: f.author.user.id,
        classroomId: f.classroom.id,
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });
    const event = {
      announcementId: a.id,
      kind: 'EXPIRING' as const,
      occurrenceKey: 'expiration:1791374400000',
      snapshotAt: new Date(),
    };
    await prisma.announcementPushEvent.create({ data: event });
    await expect(
      prisma.announcementPushEvent.create({ data: event }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await prisma.announcementPushEvent.create({
      data: { ...event, occurrenceKey: 'expiration:1791460800000' },
    });
    await expect(
      prisma.announcementPushEvent.create({
        data: { ...event, occurrenceKey: 'publication' },
      }),
    ).rejects.toMatchObject({ cause: { originalCode: '23514' } });
    await expect(
      prisma.announcementPushEvent.create({ data: { ...event, kind: 'NEW' } }),
    ).rejects.toMatchObject({ cause: { originalCode: '23514' } });
    expect(await prisma.announcementPushEvent.count()).toBe(2);
  });
});
