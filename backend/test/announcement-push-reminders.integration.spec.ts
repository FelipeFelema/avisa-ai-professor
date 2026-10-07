import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { AnnouncementPushService } from '../src/push/announcement-push.service';
import { AnnouncementRemindersWorker } from '../src/push/announcement-reminders.worker';
import { AnnouncementPushWorker } from '../src/push/announcement-push.worker';
import { ExpoPushAdapter } from '../src/push/expo-push.adapter';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
  createAnnouncementPushBinding,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';

const day = 86400_000;
describe('durable announcement expiration reminders', () => {
  let prisma: PrismaService,
    service: AnnouncementPushService,
    previous: NodeJS.ProcessEnv;
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
  });
  beforeEach(async () => {
    previous = { ...process.env };
    Object.assign(process.env, {
      EXPO_PUSH_ENABLED: 'true',
      EXPO_PUSH_ACCESS_TOKEN: 'synthetic',
      ANNOUNCEMENT_PUSH_ENABLED: 'true',
      ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'true',
    });
    await clearTestDatabase(prisma);
    service = restart();
  });
  afterEach(() => {
    process.env = previous;
  });
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });
  function restart() {
    return new AnnouncementPushService(
      prisma,
      new PushRegistrationService(prisma),
    );
  }
  async function prepare(offset = day) {
    const f = await createAnnouncementPushFixture(prisma);
    const now = new Date();
    const announcement = await prisma.announcement.create({
      data: {
        classroomId: f.classroom.id,
        authorId: f.author.user.id,
        title: 'Private title sentinel',
        content: 'Private body sentinel',
        createdAt: new Date(now.getTime() - 2 * day),
        expiresAt: new Date(now.getTime() + offset),
        notificationPending: false,
      },
    });
    return { f, now, announcement };
  }
  it('selects at 24 hours, never earlier, and catches up only while active', async () => {
    const { now, announcement } = await prepare();
    const selector = new AnnouncementRemindersWorker(prisma, service);
    await selector.tick(new Date(now.getTime() - 1));
    expect(await prisma.announcementPushEvent.count()).toBe(0);
    await selector.tick(now);
    expect(
      await prisma.announcementPushEvent.count({ where: { kind: 'EXPIRING' } }),
    ).toBe(1);
    expect(await prisma.announcementPushDispatch.count()).toBe(2);
    await selector.tick(new Date(now.getTime() + 60000));
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    await prisma.announcementPushEvent.deleteMany();
    await selector.tick(new Date(announcement.expiresAt));
    expect(await prisma.announcementPushEvent.count()).toBe(0);
    await selector.onModuleDestroy();
  });
  it('two selectors/fanouts and restart preserve one event and one dispatch per installation', async () => {
    const { now, announcement } = await prepare();
    const a = new AnnouncementRemindersWorker(prisma, service),
      b = new AnnouncementRemindersWorker(prisma, restart());
    await Promise.all([a.tick(now), b.tick(now)]);
    await restart().materializeReminder(announcement.id, now);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    expect(await prisma.announcementPushDispatch.count()).toBe(2);
    await Promise.all([a.onModuleDestroy(), b.onModuleDestroy()]);
  });
  it.each(['expired', 'deleted', 'legacy', 'short-lived'])(
    'suppresses %s resources',
    async (kind) => {
      const { now, announcement } = await prepare();
      if (kind === 'expired')
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: { expiresAt: now },
        });
      if (kind === 'deleted')
        await prisma.announcement.delete({ where: { id: announcement.id } });
      if (kind === 'legacy')
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: { notificationPending: null },
        });
      if (kind === 'short-lived')
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: {
            createdAt: now,
            expiresAt: new Date(now.getTime() + day - 1),
          },
        });
      await service.materializeReminder(announcement.id, now);
      expect(await prisma.announcementPushEvent.count()).toBe(0);
    },
  );
  it('uses edited expiry, suppresses stale pending occurrences, and never repeats a previously used value', async () => {
    const { now, announcement } = await prepare();
    await service.materializeReminder(announcement.id, now);
    const rows = await service.claim(now);
    const later = new Date(now.getTime() + 2 * day);
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { expiresAt: later },
    });
    await restart().materializeReminder(announcement.id, now);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    for (const row of rows)
      expect(await service.authorize(row, now)).toBeNull();
    // Keep sessions valid for a controlled tomorrow tick.
    await prisma.authSession.updateMany({ data: { expiresAt: later } });
    await restart().materializeReminder(
      announcement.id,
      new Date(now.getTime() + day),
    );
    expect(await prisma.announcementPushEvent.count()).toBe(2);
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { expiresAt: announcement.expiresAt },
    });
    await restart().materializeReminder(announcement.id, now);
    expect(await prisma.announcementPushEvent.count()).toBe(2);
    expect(await prisma.announcementPushDispatch.count()).toBe(4);
  });
  it('rechecks expiry edited during preselection under the final resource lock', async () => {
    const { now, announcement } = await prepare();
    const registrations = new PushRegistrationService(prisma);
    const original = new PushRegistrationService(prisma);
    jest
      .spyOn(registrations, 'withAnnouncementLocks')
      .mockImplementationOnce(
        async (
          input: Parameters<
            PushRegistrationService['withAnnouncementLocks']
          >[0],
          operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) => {
          await prisma.announcement.update({
            where: { id: announcement.id },
            data: { expiresAt: new Date(now.getTime() + 3 * day) },
          });
          return original.withAnnouncementLocks(input, operation);
        },
      );
    await new AnnouncementPushService(
      prisma,
      registrations,
    ).materializeReminder(announcement.id, now);
    expect(await prisma.announcementPushEvent.count()).toBe(0);
  });
  it('takes current recipients independently of NEW, excluding outsider/author and including multiple devices', async () => {
    const { f, now, announcement } = await prepare();
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { notificationPending: true },
    });
    await service.materialize(announcement.id, now);
    await createAnnouncementPushBinding(prisma, f.member);
    await prisma.userClassroom.delete({
      where: {
        userId_classroomId: {
          userId: f.owner.user.id,
          classroomId: f.classroom.id,
        },
      },
    });
    await service.materializeReminder(announcement.id, now);
    const reminders = await prisma.announcementPushDispatch.findMany({
      where: { event: { kind: 'EXPIRING' } },
    });
    expect(reminders).toHaveLength(2);
    expect(reminders.every((r) => r.userId === f.member.user.id)).toBe(true);
    expect(new Set(reminders.map((r) => r.installationId)).size).toBe(2);
  });
  it.each([
    'membership',
    'session',
    'session-expiry',
    'token',
    'rotation',
    'account-change',
    'expiry',
    'deleted',
  ])('suppresses %s before final send authorization', async (kind) => {
    const { f, now, announcement } = await prepare();
    await service.materializeReminder(announcement.id, now);
    const row = (await service.claim(now)).find(
      (r) => r.userId === f.member.user.id,
    )!;
    if (kind === 'membership')
      await prisma.userClassroom.delete({
        where: {
          userId_classroomId: {
            userId: f.member.user.id,
            classroomId: f.classroom.id,
          },
        },
      });
    if (kind === 'session')
      await prisma.authSession.update({
        where: { id: f.member.session.id },
        data: { revokedAt: now },
      });
    if (kind === 'session-expiry')
      await prisma.authSession.update({
        where: { id: f.member.session.id },
        data: { expiresAt: now },
      });
    if (kind === 'token')
      await prisma.pushRegistration.update({
        where: { id: row.registrationId },
        data: { state: 'INVALID', expoToken: null, tokenFingerprint: null },
      });
    if (kind === 'rotation') {
      const token = 'ExpoPushToken[syntheticReminderRotation]';
      await prisma.pushRegistration.update({
        where: { id: row.registrationId },
        data: {
          tokenRevision: { increment: 1 },
          expoToken: token,
          tokenFingerprint: createHash('sha256').update(token).digest('hex'),
        },
      });
    }
    if (kind === 'account-change')
      await prisma.pushRegistration.update({
        where: { id: row.registrationId },
        data: { userId: f.outsider.user.id, sessionId: f.outsider.session.id },
      });
    if (kind === 'expiry')
      await prisma.announcement.update({
        where: { id: announcement.id },
        data: { expiresAt: now },
      });
    if (kind === 'deleted')
      await prisma.announcement.delete({ where: { id: announcement.id } });
    expect(await service.authorize(row, now)).toBeNull();
  });
  it.each(['accepted', 'timeout', 'rejected', 'persistence-failure'])(
    'two send workers plus restart never repeat %s submissions or alter the announcement',
    async (outcome) => {
      const { now, announcement } = await prepare();
      await service.materializeReminder(announcement.id, now);
      const send = jest
        .fn<
          ReturnType<ExpoPushAdapter['sendAnnouncement']>,
          Parameters<ExpoPushAdapter['sendAnnouncement']>
        >()
        .mockImplementation((_token, intent) => {
          expect(intent.type).toBe('announcement-expiring');
          if (outcome === 'timeout')
            return Promise.reject(new Error('synthetic timeout'));
          return Promise.resolve(
            outcome === 'rejected'
              ? { kind: 'rejected', code: 'MESSAGE_RATE_EXCEEDED' }
              : { kind: 'accepted', ticketId: 'synthetic-reminder' },
          );
        });
      const expo = { sendAnnouncement: send } as unknown as ExpoPushAdapter;
      const aService = restart(),
        bService = restart();
      if (outcome === 'persistence-failure') {
        jest
          .spyOn(aService, 'completeSend')
          .mockRejectedValue(new Error('synthetic persistence'));
        jest
          .spyOn(bService, 'completeSend')
          .mockRejectedValue(new Error('synthetic persistence'));
      }
      const a = new AnnouncementPushWorker(prisma, aService, expo),
        b = new AnnouncementPushWorker(prisma, bService, expo);
      await Promise.allSettled([a.tick(), b.tick()]);
      expect(send).toHaveBeenCalledTimes(2);
      await Promise.all([a.onModuleDestroy(), b.onModuleDestroy()]);
      await restart().expire(new Date(Date.now() + 16000));
      const restarted = new AnnouncementPushWorker(prisma, restart(), expo);
      await restarted.tick();
      await restarted.onModuleDestroy();
      await restart().materializeReminder(announcement.id, now);
      expect(send).toHaveBeenCalledTimes(2);
      expect(
        await prisma.announcement.findUnique({
          where: { id: announcement.id },
        }),
      ).toMatchObject({
        title: announcement.title,
        content: announcement.content,
        expiresAt: announcement.expiresAt,
      });
    },
  );
  it('disabling P1 stops pending reminders without blocking NEW; reenabling recovers only unsent work', async () => {
    const { now, announcement } = await prepare();
    await service.materializeReminder(announcement.id, now);
    process.env.ANNOUNCEMENT_PUSH_REMINDERS_ENABLED = 'false';
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { notificationPending: true },
    });
    const send = jest
      .fn<
        ReturnType<ExpoPushAdapter['sendAnnouncement']>,
        Parameters<ExpoPushAdapter['sendAnnouncement']>
      >()
      .mockResolvedValue({ kind: 'accepted', ticketId: 'synthetic' });
    const worker = new AnnouncementPushWorker(prisma, service, {
      sendAnnouncement: send,
    } as unknown as ExpoPushAdapter);
    await worker.tick();
    expect(send).toHaveBeenCalledTimes(2);
    expect(
      send.mock.calls.every((c) => c[1].type === 'announcement-created'),
    ).toBe(true);
    process.env.ANNOUNCEMENT_PUSH_REMINDERS_ENABLED = 'true';
    await worker.tick();
    await worker.onModuleDestroy();
    expect(send).toHaveBeenCalledTimes(4);
  });
  it('materialized earlier expirations do not starve a later due resource behind the selection limit', async () => {
    const { now, announcement } = await prepare();
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      const a = await prisma.announcement.create({
        data: {
          title: 'Synthetic',
          content: 'Synthetic',
          classroomId: announcement.classroomId,
          authorId: announcement.authorId,
          createdAt: announcement.createdAt,
          expiresAt: new Date(now.getTime() + day - 1000 + i),
          notificationPending: false,
        },
      });
      ids.push(a.id);
      await service.materializeReminder(a.id, now);
    }
    const selector = new AnnouncementRemindersWorker(prisma, service);
    await selector.tick(now);
    await selector.onModuleDestroy();
    expect(
      await prisma.announcementPushEvent.count({
        where: { announcementId: announcement.id },
      }),
    ).toBe(1);
  });
  it('a failed reminder fanout rolls back and restart snapshots exactly once', async () => {
    const { now, announcement } = await prepare();
    const registrations = new PushRegistrationService(prisma);
    const original = new PushRegistrationService(prisma);
    jest
      .spyOn(registrations, 'withAnnouncementLocks')
      .mockImplementationOnce(
        (
          input: Parameters<
            PushRegistrationService['withAnnouncementLocks']
          >[0],
          operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        ) =>
          original.withAnnouncementLocks(input, async (tx) => {
            await operation(tx);
            throw new Error('synthetic fanout rollback');
          }),
      );
    await expect(
      new AnnouncementPushService(prisma, registrations).materializeReminder(
        announcement.id,
        now,
      ),
    ).rejects.toThrow('PUSH_OPERATION_FAILED');
    expect(await prisma.announcementPushEvent.count()).toBe(0);
    expect(await prisma.announcementPushDispatch.count()).toBe(0);
    await restart().materializeReminder(announcement.id, now);
    await restart().materializeReminder(announcement.id, now);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    expect(await prisma.announcementPushDispatch.count()).toBe(2);
  });
});
