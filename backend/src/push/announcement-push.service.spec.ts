import type { Prisma } from '@prisma/client';
import {
  AnnouncementPushService,
  type ClaimedAnnouncementDispatch,
  type ClaimedAnnouncementReceipt,
} from './announcement-push.service';
import { PushRegistrationService } from './push-registration.service';
import { PrismaService } from '../prisma/prisma.service';

const now = new Date('2026-10-06T12:00:00Z');
function setup() {
  const announcement = {
    id: '00000000-0000-4000-8000-000000000101',
    classroomId: 'classroom',
    classroom: { name: 'Current classroom name' },
    title: 'Current announcement title',
    authorId: 'author',
    notificationPending: true,
    expiresAt: new Date(now.getTime() + 10000),
  };
  const binding = {
    id: '00000000-0000-4000-8000-000000000102',
    userId: 'member',
    sessionId: 'session',
    installationId: '00000000-0000-4000-8000-000000000103',
    lifecycleVersion: 1,
    tokenRevision: 1,
    tokenFingerprint: 'a'.repeat(64),
    expoToken: 'ExpoPushToken[synthetic]',
    state: 'ACTIVE',
    platform: 'ANDROID',
    installation: {
      id: '00000000-0000-4000-8000-000000000103',
      lifecycleVersion: 1,
    },
    user: { id: 'member' },
    session: {
      id: 'session',
      userId: 'member',
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 60000),
    },
  };
  const row = {
    ...binding,
    id: '00000000-0000-4000-8000-000000000104',
    registrationId: binding.id,
    state: 'CLAIMED',
    claimVersion: 1,
    leaseUntil: new Date(now.getTime() + 60000),
    event: { announcementId: announcement.id, announcement },
    providerTicketId: 'synthetic-ticket',
    receiptDeadlineAt: new Date(now.getTime() + 24 * 3600000),
    nextReceiptCheckAt: now,
    receiptLeaseUntil: null,
    receiptChecks: 0,
  } as unknown as ClaimedAnnouncementDispatch;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    announcement: {
      findUnique: jest.fn().mockResolvedValue(announcement),
      update: jest.fn().mockResolvedValue(announcement),
    },
    pushRegistration: {
      findMany: jest.fn().mockResolvedValue([binding]),
      findUnique: jest.fn().mockResolvedValue(binding),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userClassroom: {
      findUnique: jest.fn().mockResolvedValue({ userId: 'member' }),
    },
    announcementPushEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'event' }),
    },
    announcementPushDispatch: {
      findUnique: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const locks = {
    withAnnouncementLocks: jest.fn(
      (
        _input: unknown,
        operation: (client: Prisma.TransactionClient) => Promise<unknown>,
      ) => operation(tx as unknown as Prisma.TransactionClient),
    ),
  };
  const service = new AnnouncementPushService(
    tx as unknown as PrismaService,
    locks as unknown as PushRegistrationService,
  );
  return { announcement, binding, row, tx, locks, service };
}
describe('business dispatch fencing and recovery', () => {
  it('does not backfill legacy/disabled publications or missing resources', async () => {
    const s = setup();
    s.tx.announcement.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...s.announcement, notificationPending: null })
      .mockResolvedValueOnce({ ...s.announcement, notificationPending: false });
    for (let i = 0; i < 3; i++)
      await s.service.materialize(s.announcement.id, now);
    expect(s.locks.withAnnouncementLocks).not.toHaveBeenCalled();
  });
  it('materializes only the frozen eligible binding once, retaining completed empty snapshots', async () => {
    const s = setup();
    await s.service.materialize(s.announcement.id, now);
    expect(s.tx.announcementPushDispatch.createMany).toHaveBeenCalledTimes(1);
    expect(s.tx.announcementPushEvent.create).toHaveBeenCalledTimes(1);
    expect(s.tx.announcement.update).toHaveBeenCalledWith({
      where: { id: s.announcement.id },
      data: { notificationPending: false },
    });
    s.tx.announcementPushEvent.findUnique.mockResolvedValue({ id: 'prior' });
    await s.service.materialize(s.announcement.id, now);
    expect(s.tx.announcementPushDispatch.createMany).toHaveBeenCalledTimes(1);
  });
  it('expired pending publications are consumed without fanout', async () => {
    const s = setup();
    s.announcement.expiresAt = now;
    await s.service.materialize(s.announcement.id, now);
    expect(s.tx.announcementPushEvent.create).not.toHaveBeenCalled();
    expect(s.tx.announcement.update).toHaveBeenCalled();
  });
  it('revalidation never admits a revoked or newly reassociated candidate', async () => {
    const s = setup();
    s.tx.pushRegistration.findUnique.mockResolvedValue({
      ...s.binding,
      userId: 'other',
    });
    await s.service.materialize(s.announcement.id, now);
    expect(s.tx.announcementPushDispatch.createMany).toHaveBeenCalledWith({
      data: [],
    });
  });
  it('only the winning claim increments its fence and returns a bounded immutable snapshot', async () => {
    const s = setup();
    s.tx.announcementPushDispatch.findMany.mockResolvedValue([
      s.row,
      { ...s.row, id: 'lost' },
    ]);
    s.tx.announcementPushDispatch.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    expect(await s.service.claim(now)).toHaveLength(1);
    expect(s.tx.announcementPushDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
  it.each(['deleted', 'stale-version', 'missing-lease', 'expired-lease'])(
    'cannot cross the send boundary for %s claims',
    async (fault) => {
      const s = setup();
      const current =
        fault === 'deleted'
          ? null
          : {
              ...s.row,
              ...(fault === 'stale-version'
                ? { claimVersion: 2 }
                : fault === 'missing-lease'
                  ? { leaseUntil: null }
                  : { leaseUntil: now }),
            };
      s.tx.announcementPushDispatch.findUnique.mockResolvedValue(current);
      expect(await s.service.authorize(s.row, now)).toBeNull();
      expect(s.tx.announcementPushDispatch.update).not.toHaveBeenCalled();
    },
  );
  it.each([
    'membership',
    'deleted-resource',
    'author',
    'ttl',
    'missing-binding',
    'different-session',
    'revision',
    'session-expiry',
  ])(
    'suppresses %s rather than retargeting the installation',
    async (fault) => {
      const s = setup();
      if (fault === 'membership')
        s.tx.userClassroom.findUnique.mockResolvedValue(null);
      if (fault === 'deleted-resource')
        s.tx.announcement.findUnique.mockResolvedValue(null);
      if (fault === 'author') s.announcement.authorId = 'member';
      if (fault === 'ttl')
        s.announcement.expiresAt = new Date(now.getTime() + 999);
      if (fault === 'missing-binding')
        s.tx.pushRegistration.findUnique.mockResolvedValue(null);
      if (fault === 'different-session')
        s.tx.pushRegistration.findUnique.mockResolvedValue({
          ...s.binding,
          sessionId: 'other',
        });
      if (fault === 'revision')
        s.tx.pushRegistration.findUnique.mockResolvedValue({
          ...s.binding,
          tokenRevision: 2,
        });
      if (fault === 'session-expiry') s.binding.session.expiresAt = now;
      expect(await s.service.authorize(s.row, now)).toBeNull();
      expect(s.tx.announcementPushDispatch.update).toHaveBeenCalledWith({
        where: { id: s.row.id },
        data: { state: 'SUPPRESSED', completedAt: now, leaseUntil: null },
      });
    },
  );
  it('returns only a current authorized token after committing the SENDING transition and short TTL', async () => {
    const s = setup();
    expect(await s.service.authorize(s.row, now)).toMatchObject({
      id: s.row.id,
      expoToken: s.binding.expoToken,
      ttl: 10,
      classroomName: 'Current classroom name',
      announcementTitle: 'Current announcement title',
      claimVersion: 1,
    });
    expect(s.tx.announcementPushDispatch.update).toHaveBeenCalledWith({
      where: { id: s.row.id },
      data: { state: 'SENDING', sendStartedAt: now, leaseUntil: null },
    });
  });
  it.each(['accepted', 'rejected', 'unknown'])(
    'records %s outcomes through SENDING-only CAS',
    async (kind) => {
      const s = setup();
      const snapshot = {
        id: s.row.id,
        announcementId: s.announcement.id,
        classroomName: s.announcement.classroom.name,
        announcementTitle: s.announcement.title,
        expoToken: s.binding.expoToken,
        ttl: 10,
        type: 'announcement-created' as const,
        claimVersion: 1,
      };
      await s.service.completeSend(
        snapshot,
        kind === 'accepted'
          ? { kind: 'accepted', ticketId: 'synthetic' }
          : kind === 'rejected'
            ? { kind: 'rejected', code: 'MESSAGE_RATE_EXCEEDED' }
            : null,
        now,
      );
      expect(s.tx.announcementPushDispatch.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: s.row.id, state: 'SENDING', claimVersion: 1 },
        }),
      );
      expect(s.locks.withAnnouncementLocks).not.toHaveBeenCalled();
    },
  );
  it('receipt claims fence concurrent workers and retries are bounded by deadline', async () => {
    const s = setup();
    s.tx.announcementPushDispatch.updateMany.mockResolvedValueOnce({
      count: 1,
    });
    const receipt = (await s.service.claimReceipts(now))[0];
    expect(receipt.receiptChecks).toBe(1);
    await s.service.completeReceipt(receipt, undefined, now);
    expect(s.tx.announcementPushDispatch.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          receiptLeaseUntil: null,
          nextReceiptCheckAt: new Date(now.getTime() + 60000),
        },
      }),
    );
  });
  it.each(['ok', 'invalid-device', 'other-error', 'late-stale-claim'])(
    'finalizes %s receipts under full business parents',
    async (kind) => {
      const s = setup();
      const receipt = {
        ...s.row,
        state: 'ACCEPTED',
        claimedReceiptLease: new Date(now.getTime() + 60000),
        receiptChecks: 1,
      } as ClaimedAnnouncementReceipt;
      if (kind === 'late-stale-claim')
        s.tx.announcementPushDispatch.findFirst.mockResolvedValue(null);
      await s.service.completeReceipt(
        receipt,
        kind === 'ok'
          ? { kind: 'ok' }
          : {
              kind: 'error',
              code:
                kind === 'invalid-device'
                  ? 'DEVICE_NOT_REGISTERED'
                  : 'PROVIDER_REJECTED',
            },
        now,
      );
      expect(s.locks.withAnnouncementLocks).toHaveBeenCalled();
      expect(s.tx.pushRegistration.updateMany).toHaveBeenCalledTimes(
        kind === 'invalid-device' ? 1 : 0,
      );
    },
  );
  it('expiry/redaction never deletes uniqueness tombstones or queues a resend', async () => {
    const s = setup();
    await s.service.expire(now);
    expect(s.tx.announcementPushDispatch.updateMany).toHaveBeenCalledTimes(3);
    expect(s.tx.announcementPushDispatch.createMany).not.toHaveBeenCalled();
  });
  it.each(['missing', 'current', 'stale'])(
    'permanent immediate rejection honors %s dispatch/binding fence',
    async (kind) => {
      const s = setup();
      const snapshot = {
        id: s.row.id,
        announcementId: s.announcement.id,
        classroomName: s.announcement.classroom.name,
        announcementTitle: s.announcement.title,
        expoToken: s.binding.expoToken,
        ttl: 10,
        type: 'announcement-created' as const,
        claimVersion: 1,
      };
      if (kind === 'missing')
        s.tx.announcementPushDispatch.findUnique.mockResolvedValue(null);
      if (kind === 'stale')
        s.tx.announcementPushDispatch.updateMany.mockResolvedValue({
          count: 0,
        });
      await s.service.completeSend(
        snapshot,
        { kind: 'rejected', code: 'DEVICE_NOT_REGISTERED' },
        now,
      );
      expect(s.tx.pushRegistration.updateMany).toHaveBeenCalledTimes(
        kind === 'current' ? 1 : 0,
      );
    },
  );
  it('rejects a reminder without expiresAt before taking locks or materializing', async () => {
    const previous = { ...process.env };
    try {
      Object.assign(process.env, {
        EXPO_PUSH_ENABLED: 'true',
        EXPO_PUSH_ACCESS_TOKEN: 'synthetic',
        ANNOUNCEMENT_PUSH_ENABLED: 'true',
        ANNOUNCEMENT_PUSH_REMINDERS_ENABLED: 'true',
      });
      const s = setup();
      s.tx.announcement.findUnique.mockResolvedValue({
        ...s.announcement,
        expiresAt: null,
      });
      await s.service.materializeReminder(s.announcement.id, now);
      expect(s.locks.withAnnouncementLocks).not.toHaveBeenCalled();
      expect(s.tx.announcementPushEvent.create).not.toHaveBeenCalled();
    } finally {
      process.env = previous;
    }
  });
});
