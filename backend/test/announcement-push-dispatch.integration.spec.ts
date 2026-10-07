import { PrismaService } from '../src/prisma/prisma.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { AnnouncementPushService } from '../src/push/announcement-push.service';
import {
  assertAnnouncementPushTestDatabase,
  createAnnouncementPushFixture,
} from './helpers/announcement-push.fixture';
import { clearTestDatabase } from './helpers/test-database.helper';
import { createHash } from 'node:crypto';
import { AnnouncementsService } from '../src/announcements/announcements.service';
import { AnnouncementPushWorker } from '../src/push/announcement-push.worker';
import { ExpoPushAdapter } from '../src/push/expo-push.adapter';
import { createPushConfig } from '../src/push/push.config';

describe('announcement durable claims and delivery authorization', () => {
  let prisma: PrismaService, service: AnnouncementPushService;
  beforeAll(async () => {
    assertAnnouncementPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AnnouncementPushService(
      prisma,
      new PushRegistrationService(prisma),
    );
  });
  beforeEach(async () => {
    await clearTestDatabase(prisma);
  });
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });
  async function prepare() {
    const f = await createAnnouncementPushFixture(prisma);
    const announcement = await prisma.announcement.create({
      data: {
        classroomId: f.classroom.id,
        authorId: f.author.user.id,
        title: 'Private title',
        content: 'Private content',
        expiresAt: new Date(Date.now() + 600000),
        notificationPending: true,
      },
    });
    await service.materialize(announcement.id);
    return { f, announcement };
  }
  it('concurrent materialization/claim wins once; stale pre-send leases recover after restart', async () => {
    const { announcement } = await prepare();
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { notificationPending: true },
    });
    await Promise.all([
      service.materialize(announcement.id),
      service.materialize(announcement.id),
    ]);
    expect(await prisma.announcementPushDispatch.count()).toBe(2);
    const now = new Date();
    const claims = await Promise.all([service.claim(now), service.claim(now)]);
    expect(claims.flat()).toHaveLength(2);
    expect(new Set(claims.flat().map((r) => r.id)).size).toBe(2);
    const recovered = await new AnnouncementPushService(
      prisma,
      new PushRegistrationService(prisma),
    ).claim(new Date(now.getTime() + 60001));
    expect(recovered).toHaveLength(2);
    expect(recovered.every((r) => r.claimVersion === 2)).toBe(true);
    expect(
      await service.authorize(
        claims.flat()[0],
        new Date(now.getTime() + 60001),
      ),
    ).toBeNull();
  });
  it.each([
    'membership',
    'session',
    'revocation',
    'rotation',
    'expiration',
  ] as const)('rechecks %s at the last durable send boundary', async (kind) => {
    const { f, announcement } = await prepare();
    const row = (await service.claim()).find(
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
        data: { revokedAt: new Date() },
      });
    if (kind === 'revocation')
      await prisma.pushRegistration.update({
        where: { id: f.memberBinding.registration.id },
        data: {
          state: 'REVOKED',
          reason: 'USER_DISABLED',
          expoToken: null,
          tokenFingerprint: null,
          platform: null,
        },
      });
    if (kind === 'rotation') {
      const expoToken = 'ExpoPushToken[syntheticRotation]';
      await prisma.pushRegistration.update({
        where: { id: f.memberBinding.registration.id },
        data: {
          tokenRevision: { increment: 1 },
          expoToken,
          tokenFingerprint: createHash('sha256')
            .update(expoToken)
            .digest('hex'),
        },
      });
    }
    if (kind === 'expiration')
      await prisma.announcement.update({
        where: { id: announcement.id },
        data: { expiresAt: new Date(0) },
      });
    expect(await service.authorize(row)).toBeNull();
    expect(
      await prisma.announcementPushDispatch.findUnique({
        where: { id: row.id },
      }),
    ).toMatchObject({ state: 'SUPPRESSED', sendStartedAt: null });
  });
  it('commits SENDING before submission; ambiguous crash and late acceptance never resend', async () => {
    await prepare();
    const now = new Date();
    const row = (await service.claim(now))[0];
    const snapshot = await service.authorize(row, now);
    expect(snapshot).not.toBeNull();
    expect(
      await prisma.announcementPushDispatch.findUnique({
        where: { id: row.id },
      }),
    ).toMatchObject({ state: 'SENDING', sendStartedAt: now });
    await service.expire(new Date(now.getTime() + 15001));
    await service.completeSend(
      snapshot!,
      { kind: 'accepted', ticketId: 'late' },
      new Date(now.getTime() + 16000),
    );
    expect(
      await prisma.announcementPushDispatch.findUnique({
        where: { id: row.id },
      }),
    ).toMatchObject({ state: 'UNKNOWN', providerTicketId: null });
    expect(
      (await service.claim(new Date(now.getTime() + 600000))).some(
        (r) => r.id === row.id,
      ),
    ).toBe(false);
  });
  it('accepted tickets are queried only; stale DeviceNotRegistered cannot invalidate a rotated binding', async () => {
    const { f } = await prepare();
    const now = new Date();
    const row = (await service.claim(now)).find(
      (r) => r.userId === f.member.user.id,
    )!;
    const snapshot = (await service.authorize(row, now))!;
    await service.completeSend(
      snapshot,
      { kind: 'accepted', ticketId: 'synthetic' },
      now,
    );
    const due = new Date(now.getTime() + 15 * 60000);
    const receipts = await service.claimReceipts(due);
    expect(receipts).toHaveLength(1);
    const rotated = 'ExpoPushToken[syntheticRotation]';
    await prisma.pushRegistration.update({
      where: { id: f.memberBinding.registration.id },
      data: {
        tokenRevision: { increment: 1 },
        expoToken: rotated,
        tokenFingerprint: createHash('sha256').update(rotated).digest('hex'),
      },
    });
    await service.completeReceipt(
      receipts[0],
      { kind: 'error', code: 'DEVICE_NOT_REGISTERED' },
      due,
    );
    expect(
      await prisma.pushRegistration.findUnique({
        where: { id: f.memberBinding.registration.id },
      }),
    ).toMatchObject({ state: 'ACTIVE', tokenRevision: 2 });
    expect(
      await prisma.announcementPushDispatch.findUnique({
        where: { id: row.id },
      }),
    ).toMatchObject({ state: 'REJECTED' });
    expect((await service.claim(due)).some((r) => r.id === row.id)).toBe(false);
  });
  it('invalidates only the current matching binding and retains uniqueness after receipt cleanup', async () => {
    const { f, announcement } = await prepare();
    const now = new Date();
    const row = (await service.claim(now)).find(
      (r) => r.userId === f.member.user.id,
    )!;
    await service.completeSend(
      (await service.authorize(row, now))!,
      { kind: 'accepted', ticketId: 'synthetic' },
      now,
    );
    const due = new Date(now.getTime() + 15 * 60000);
    const receipt = (await service.claimReceipts(due))[0];
    await service.completeReceipt(
      receipt,
      { kind: 'error', code: 'DEVICE_NOT_REGISTERED' },
      due,
    );
    expect(
      await prisma.pushRegistration.findUnique({
        where: { id: f.memberBinding.registration.id },
      }),
    ).toMatchObject({ state: 'INVALID', expoToken: null });
    await service.expire(new Date(due.getTime() + 8 * 24 * 60 * 60000));
    expect(
      await prisma.announcementPushDispatch.findUnique({
        where: { id: row.id },
      }),
    ).toMatchObject({ state: 'REJECTED', providerTicketId: null });
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { notificationPending: true },
    });
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushEvent.count()).toBe(1);
    expect(await prisma.announcementPushDispatch.count()).toBe(2);
  });
  it('deleted announcements cascade and no worker resurrects their event', async () => {
    const { announcement } = await prepare();
    const claim = (await service.claim())[0];
    await prisma.announcement.delete({ where: { id: announcement.id } });
    expect(await service.authorize(claim)).toBeNull();
    await service.materialize(announcement.id);
    expect(await prisma.announcementPushEvent.count()).toBe(0);
  });
  it.each([false, true])(
    'permanent send rejection invalidates only the matching current binding (rotated=%s)',
    async (rotated) => {
      const { f } = await prepare();
      const now = new Date();
      const row = (await service.claim(now)).find(
        (r) => r.userId === f.member.user.id,
      )!;
      const snapshot = (await service.authorize(row, now))!;
      if (rotated) {
        const token = 'ExpoPushToken[syntheticSendRotation]';
        await prisma.pushRegistration.update({
          where: { id: f.memberBinding.registration.id },
          data: {
            tokenRevision: { increment: 1 },
            expoToken: token,
            tokenFingerprint: createHash('sha256').update(token).digest('hex'),
          },
        });
      }
      await service.completeSend(
        snapshot,
        { kind: 'rejected', code: 'DEVICE_NOT_REGISTERED' },
        now,
      );
      expect(
        await prisma.pushRegistration.findUnique({
          where: { id: f.memberBinding.registration.id },
        }),
      ).toMatchObject({ state: rotated ? 'ACTIVE' : 'INVALID' });
      expect(
        await prisma.announcementPushDispatch.findUnique({
          where: { id: row.id },
        }),
      ).toMatchObject({ state: 'REJECTED' });
      expect(
        await prisma.pushRegistration.findUnique({
          where: { id: f.outsiderBinding.registration.id },
        }),
      ).toMatchObject({ state: 'ACTIVE' });
    },
  );
  it('a late accepted outcome after classroom deletion cannot resurrect any ledger row', async () => {
    const { f } = await prepare();
    const row = (await service.claim())[0];
    const snapshot = (await service.authorize(row))!;
    await prisma.classroom.delete({ where: { id: f.classroom.id } });
    await service.completeSend(snapshot, {
      kind: 'accepted',
      ticketId: 'late-synthetic',
    });
    expect(await prisma.announcementPushDispatch.count()).toBe(0);
    expect(await prisma.announcementPushEvent.count()).toBe(0);
  });
  it('kill switch/restart recovers requested publications once but never backfills disabled ones', async () => {
    const previous = { ...process.env };
    const send = jest
      .fn()
      .mockResolvedValue({ kind: 'accepted', ticketId: 'synthetic' });
    const worker = new AnnouncementPushWorker(prisma, service, {
      sendAnnouncement: send,
    } as unknown as ExpoPushAdapter);
    try {
      Object.assign(process.env, {
        EXPO_PUSH_ENABLED: 'true',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic-only',
        ANNOUNCEMENT_PUSH_ENABLED: 'false',
        ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'false',
      });
      const f = await createAnnouncementPushFixture(prisma);
      const api = new AnnouncementsService(prisma);
      const dto = {
        classroomId: f.classroom.id,
        title: 'Synthetic',
        content: 'Synthetic',
        durationInDays: 7,
      };
      const disabled = await api.create(f.author.user.id, dto);
      expect(createPushConfig().enabled).toBe(true);
      await worker.tick();
      expect(send).not.toHaveBeenCalled();
      process.env.ANNOUNCEMENT_PUSH_ENABLED = 'true';
      process.env.EXPO_PUSH_ENABLED = 'false';
      const pending = await api.create(f.author.user.id, dto);
      await worker.tick();
      expect(
        await prisma.announcement.findUnique({ where: { id: pending.id } }),
      ).toMatchObject({ notificationPending: true });
      process.env.EXPO_PUSH_ENABLED = 'true';
      await worker.tick();
      await worker.tick();
      expect(send).toHaveBeenCalledTimes(2);
      expect(await prisma.announcementPushEvent.findMany()).toHaveLength(1);
      expect(
        await prisma.announcement.findUnique({ where: { id: disabled.id } }),
      ).toMatchObject({ notificationPending: null });
      await worker.onModuleDestroy();
      const restarted = new AnnouncementPushWorker(prisma, service, {
        sendAnnouncement: send,
      } as unknown as ExpoPushAdapter);
      await restarted.tick();
      await restarted.onModuleDestroy();
      expect(send).toHaveBeenCalledTimes(2);
    } finally {
      await worker.onModuleDestroy();
      process.env = previous;
    }
  });
});
