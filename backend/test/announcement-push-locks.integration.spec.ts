import { PrismaService } from '../src/prisma/prisma.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';
import {
  AnnouncementPushService,
  type ClaimedAnnouncementReceipt,
} from '../src/push/announcement-push.service';
import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('business notification PostgreSQL parent locks', () => {
  let prisma: PrismaService;
  let competing: PrismaService;
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    competing = new PrismaService();
    await Promise.all([prisma.$connect(), competing.$connect()]);
  });
  beforeEach(async () => clearTestDatabase(prisma));
  afterAll(async () => {
    if (prisma) {
      await clearTestDatabase(prisma);
      await Promise.all([prisma.$disconnect(), competing.$disconnect()]);
    }
  });

  it('blocks account-owner User-first mutation without taking classroom first', async () => {
    const fixture = await createAnnouncementPushFixture(prisma);
    const entered = deferred();
    const release = deferred();
    const competitorStarted = deferred<number>();
    const registrations = new PushRegistrationService(prisma);
    const operation = registrations.withAnnouncementLocks(
      {
        userIds: [fixture.owner.user.id, fixture.member.user.id],
        classroomId: fixture.classroom.id,
        sessionIds: [fixture.owner.session.id, fixture.member.session.id],
        installationIds: [
          fixture.ownerBinding.installation.id,
          fixture.memberBinding.installation.id,
        ],
      },
      async () => {
        entered.resolve();
        await release.promise;
      },
    );
    await entered.promise;
    const mutation = competing.$transaction(async (tx) => {
      const [backend] = await tx.$queryRaw<
        Array<{ pid: number }>
      >`SELECT pg_backend_pid() AS pid`;
      competitorStarted.resolve(backend.pid);
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${fixture.owner.user.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Classroom" WHERE "id"=${fixture.classroom.id} FOR UPDATE`;
    });
    try {
      const pid = await competitorStarted.promise;
      const deadline = Date.now() + 2000;
      let waiting = false;
      while (!waiting && Date.now() < deadline) {
        const rows = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT (wait_event_type='Lock') AS waiting FROM pg_stat_activity WHERE pid=${pid}
        `;
        waiting = rows[0]?.waiting === true;
        if (!waiting) await new Promise((done) => setTimeout(done, 5));
      }
      expect(waiting).toBe(true);
    } finally {
      release.resolve();
      await Promise.all([operation, mutation]);
    }
  });

  it.each(['fanout', 'authorize', 'receipt'] as const)(
    '%s versus owner-account deletion completes for both lock winners',
    async (phase) => {
      for (const first of ['business', 'deletion'] as const) {
        await clearTestDatabase(prisma);
        const f = await createAnnouncementPushFixture(prisma);
        expect(f.owner.user.id).not.toBe(f.author.user.id);
        const a = await prisma.announcement.create({
          data: {
            classroomId: f.classroom.id,
            authorId: f.author.user.id,
            title: 'Synthetic',
            content: 'Synthetic',
            notificationPending: true,
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        const locks = new PushRegistrationService(prisma);
        const business = new AnnouncementPushService(prisma, locks);
        if (phase !== 'fanout') await business.materialize(a.id);
        const claim =
          phase !== 'fanout'
            ? (await business.claim()).find(
                (r) => r.userId === f.owner.user.id,
              )!
            : null;
        let receipt: ClaimedAnnouncementReceipt | undefined;
        if (phase === 'receipt') {
          const now = new Date();
          await business.completeSend(
            (await business.authorize(claim!, now))!,
            { kind: 'accepted', ticketId: 'synthetic' },
            now,
          );
          receipt = (
            await business.claimReceipts(new Date(now.getTime() + 15 * 60000))
          )[0];
        }
        const entered = deferred(),
          release = deferred();
        const unmocked = new PushRegistrationService(prisma);
        const spy = jest
          .spyOn(locks, 'withAnnouncementLocks')
          .mockImplementation(
            (
              input: Parameters<
                PushRegistrationService['withAnnouncementLocks']
              >[0],
              operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
            ) =>
              unmocked.withAnnouncementLocks(input, async (tx) => {
                if (first === 'business') {
                  entered.resolve();
                  await release.promise;
                }
                return operation(tx);
              }),
          );
        const execute = () =>
          phase === 'fanout'
            ? business.materialize(a.id)
            : phase === 'authorize'
              ? business.authorize(claim!)
              : business.completeReceipt(receipt!, { kind: 'ok' }, new Date());
        const deleteOwner = () =>
          competing.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${f.owner.user.id} FOR UPDATE`;
              await tx.$queryRaw`SELECT "id" FROM "Classroom" WHERE "ownerId"=${f.owner.user.id} ORDER BY "id" ASC FOR UPDATE`;
              await tx.announcement.deleteMany({
                where: { authorId: f.owner.user.id },
              });
              await tx.userClassroom.deleteMany({
                where: { userId: f.owner.user.id },
              });
              await tx.classroom.deleteMany({
                where: { ownerId: f.owner.user.id },
              });
              await tx.authSession.deleteMany({
                where: { userId: f.owner.user.id },
              });
              await tx.user.delete({ where: { id: f.owner.user.id } });
              if (first === 'deletion') {
                entered.resolve();
                await release.promise;
              }
            },
            { timeout: 10000 },
          );
        const winner = first === 'business' ? execute() : deleteOwner();
        await entered.promise;
        let loserDone = false;
        const loser = (
          first === 'business' ? deleteOwner() : execute()
        ).finally(() => {
          loserDone = true;
        });
        try {
          await new Promise((done) => setTimeout(done, 40));
          expect(loserDone).toBe(false);
        } finally {
          release.resolve();
          await Promise.all([winner, loser]);
          spy.mockRestore();
        }
        expect(
          await prisma.announcement.findUnique({ where: { id: a.id } }),
        ).toBeNull();
        expect(await prisma.announcementPushDispatch.count()).toBe(0);
        expect(
          await prisma.pushRegistration.findUnique({
            where: { id: f.outsiderBinding.registration.id },
          }),
        ).toMatchObject({ state: 'ACTIVE' });
      }
    },
  );
  it.each([
    'leave',
    'logout',
    'revoke',
    'rotation',
    'reassociation',
    'announcement-deletion',
    'classroom-deletion',
  ] as const)(
    'final authorization versus %s respects both committed lock winners',
    async (mutation) => {
      for (const first of ['business', 'mutation'] as const) {
        await clearTestDatabase(prisma);
        const f = await createAnnouncementPushFixture(prisma);
        const a = await prisma.announcement.create({
          data: {
            classroomId: f.classroom.id,
            authorId: f.author.user.id,
            title: 'Synthetic',
            content: 'Synthetic',
            notificationPending: true,
            expiresAt: new Date(Date.now() + 3600000),
          },
        });
        const locks = new PushRegistrationService(prisma),
          unmocked = new PushRegistrationService(prisma),
          business = new AnnouncementPushService(prisma, locks);
        await business.materialize(a.id);
        const claim = (await business.claim()).find(
          (row) => row.userId === f.member.user.id,
        )!;
        const entered = deferred(),
          release = deferred();
        const spy = jest
          .spyOn(locks, 'withAnnouncementLocks')
          .mockImplementation(
            (
              input: Parameters<
                PushRegistrationService['withAnnouncementLocks']
              >[0],
              operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
            ) =>
              unmocked.withAnnouncementLocks(input, async (tx) => {
                const result = await operation(tx);
                if (first === 'business') {
                  entered.resolve();
                  await release.promise;
                }
                return result;
              }),
          );
        const change = () =>
          competing.$transaction(
            async (tx) => {
              if (mutation === 'leave')
                await tx.userClassroom.delete({
                  where: {
                    userId_classroomId: {
                      userId: f.member.user.id,
                      classroomId: f.classroom.id,
                    },
                  },
                });
              if (mutation === 'logout')
                await tx.authSession.update({
                  where: { id: f.member.session.id },
                  data: { revokedAt: new Date() },
                });
              if (mutation === 'revoke')
                await tx.pushRegistration.update({
                  where: { id: f.memberBinding.registration.id },
                  data: {
                    state: 'REVOKED',
                    reason: 'USER_DISABLED',
                    expoToken: null,
                    tokenFingerprint: null,
                    platform: null,
                  },
                });
              if (mutation === 'rotation') {
                const token = 'ExpoPushToken[syntheticRaceRotation]';
                await tx.pushRegistration.update({
                  where: { id: f.memberBinding.registration.id },
                  data: {
                    tokenRevision: { increment: 1 },
                    expoToken: token,
                    tokenFingerprint: createHash('sha256')
                      .update(token)
                      .digest('hex'),
                  },
                });
              }
              if (mutation === 'reassociation')
                await tx.pushRegistration.update({
                  where: { id: f.memberBinding.registration.id },
                  data: {
                    userId: f.outsider.user.id,
                    sessionId: f.outsider.session.id,
                  },
                });
              if (mutation === 'announcement-deletion')
                await tx.announcement.delete({ where: { id: a.id } });
              if (mutation === 'classroom-deletion')
                await tx.classroom.delete({ where: { id: f.classroom.id } });
              if (first === 'mutation') {
                entered.resolve();
                await release.promise;
              }
            },
            { timeout: 10000 },
          );
        const authorization =
          first === 'business' ? business.authorize(claim) : null;
        const changeFirst = first === 'mutation' ? change() : null;
        await entered.promise;
        const mutationRun = changeFirst ?? change();
        const authorizationRun = authorization ?? business.authorize(claim);
        try {
          await new Promise((done) => setTimeout(done, 20));
        } finally {
          release.resolve();
        }
        const [result] = await Promise.all([authorizationRun, mutationRun]);
        spy.mockRestore();
        if (first === 'mutation') expect(result).toBeNull();
        else expect(result).toMatchObject({ id: claim.id });
        // Once SENDING wins, subsequent mutation cannot retract authorized HTTP. It never retargets.
        expect(
          await prisma.pushRegistration.findUnique({
            where: { id: f.outsiderBinding.registration.id },
          }),
        ).toMatchObject({ state: 'ACTIVE' });
      }
    },
  );
});
