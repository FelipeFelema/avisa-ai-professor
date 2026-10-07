import type { PushTestAttempt } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ExpoPushAdapter, type ExpoReceiptResult } from './expo-push.adapter';
import { PushRegistrationService } from './push-registration.service';
import { PushReceiptsWorker } from './push-receipts.worker';

const now = new Date('2026-10-05T12:00:00.000Z');
const attempt = {
  id: '00000000-0000-4000-8000-000000000521',
  installationId: '00000000-0000-4000-8000-000000000522',
  registrationId: '00000000-0000-4000-8000-000000000523',
  tokenRevision: 4,
  tokenFingerprint: 'a'.repeat(64),
  providerTicketId: 'synthetic-private-ticket',
  receiptDeadlineAt: new Date(now.getTime() + 24 * 60 * 60_000),
  receiptLeaseUntil: null,
  receiptChecks: 0,
  nextReceiptCheckAt: now,
} as PushTestAttempt;

function partial(value: object): object {
  return expect.objectContaining(value) as object;
}

describe('PushReceiptsWorker', () => {
  let worker: PushReceiptsWorker;
  let transaction: Record<string, Record<string, jest.Mock>>;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let registrations: Record<string, jest.Mock>;
  let expo: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    transaction = {
      pushTestAttempt: {
        findUnique: jest.fn().mockResolvedValue({
          state: 'ACCEPTED',
          receiptLeaseUntil: new Date(now.getTime() + 60_000),
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pushRegistration: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pushInstallation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      pushTestAttempt: {
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(where.state === 'SENDING' ? [] : [attempt]),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    registrations = {
      withCapabilityLocks: jest.fn(
        (_id: string, operation: (client: typeof transaction) => unknown) =>
          Promise.resolve(operation(transaction)),
      ),
      cleanupInactiveRegistrations: jest.fn().mockResolvedValue({
        registrationsDeleted: 0,
        installationsDeleted: 0,
      }),
    };
    expo = {
      getReceipts: jest.fn().mockResolvedValue({
        [attempt.providerTicketId!]: { kind: 'ok' },
      }),
    };
    worker = new PushReceiptsWorker(
      prisma as unknown as PrismaService,
      registrations as unknown as PushRegistrationService,
      expo as unknown as ExpoPushAdapter,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('claims a due receipt by a persisted lease and records only provider handoff', async () => {
    await worker.tick(now);

    expect(expo.getReceipts).toHaveBeenCalledTimes(1);
    expect(expo.getReceipts).toHaveBeenCalledWith(
      ['synthetic-private-ticket'],
      expect.any(AbortSignal),
    );
    expect(prisma.pushTestAttempt.updateMany).toHaveBeenCalledWith({
      where: partial({
        id: attempt.id,
        state: 'ACCEPTED',
        receiptLeaseUntil: null,
      }),
      data: {
        receiptLeaseUntil: new Date(now.getTime() + 60_000),
        receiptChecks: { increment: 1 },
      },
    });
    expect(transaction.pushTestAttempt.updateMany).toHaveBeenCalledWith({
      where: partial({
        id: attempt.id,
        state: 'ACCEPTED',
        receiptLeaseUntil: new Date(now.getTime() + 60_000),
      }),
      data: partial({
        state: 'PROVIDER_HANDOFF',
        completedAt: now,
        nextReceiptCheckAt: null,
      }),
    });
  });

  it('backs off a missing receipt after the initial check and leaves the lease recoverable', async () => {
    expo.getReceipts.mockResolvedValueOnce({});
    await worker.tick(now);

    expect(prisma.pushTestAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attempt.id,
        state: 'ACCEPTED',
        receiptLeaseUntil: new Date(now.getTime() + 60_000),
      },
      data: {
        nextReceiptCheckAt: new Date(now.getTime() + 60_000),
        receiptLeaseUntil: null,
      },
    });
  });

  it.each([
    [1, 2 * 60_000],
    [2, 5 * 60_000],
    [3, 15 * 60_000],
    [4, 15 * 60_000],
  ])(
    'uses the bounded receipt backoff after %i stored checks',
    async (checks, delay) => {
      const dueAttempt = { ...attempt, receiptChecks: checks };
      prisma.pushTestAttempt.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([dueAttempt]);
      expo.getReceipts.mockResolvedValueOnce({});

      await worker.tick(now);

      expect(prisma.pushTestAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          id: attempt.id,
          state: 'ACCEPTED',
          receiptLeaseUntil: new Date(now.getTime() + 60_000),
        },
        data: {
          nextReceiptCheckAt: new Date(now.getTime() + delay),
          receiptLeaseUntil: null,
        },
      });
    },
  );

  it('invalidates only the sent revision when a receipt says DeviceNotRegistered', async () => {
    expo.getReceipts.mockResolvedValueOnce({
      [attempt.providerTicketId!]: {
        kind: 'error',
        code: 'DEVICE_NOT_REGISTERED',
      },
    });
    await worker.tick(now);

    expect(transaction.pushRegistration.updateMany).toHaveBeenCalledWith({
      where: {
        id: attempt.registrationId,
        state: 'ACTIVE',
        tokenRevision: attempt.tokenRevision,
        tokenFingerprint: attempt.tokenFingerprint,
      },
      data: partial({
        state: 'INVALID',
        reason: 'TOKEN_INVALID',
        expoToken: null,
      }),
    });
  });

  it('continues after a receipt read failure, respects the deadline, and prunes only old terminal attempts', async () => {
    expo.getReceipts.mockRejectedValueOnce(new Error('raw provider response'));
    await worker.tick(now);
    expect(prisma.pushTestAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: attempt.id,
        state: 'ACCEPTED',
        receiptLeaseUntil: new Date(now.getTime() + 60_000),
      },
      data: {
        nextReceiptCheckAt: new Date(now.getTime() + 60_000),
        receiptLeaseUntil: null,
      },
    });
    expect(prisma.pushTestAttempt.deleteMany).toHaveBeenCalledWith({
      where: {
        state: { in: ['PROVIDER_HANDOFF', 'REJECTED', 'UNKNOWN'] },
        completedAt: { lte: new Date(now.getTime() - 7 * 24 * 60 * 60_000) },
      },
    });
  });

  it('turns an expired send lease into UNKNOWN without retrying the send', async () => {
    const later = new Date(now.getTime() + 20_000);
    const expiredSending = {
      id: '00000000-0000-4000-8000-000000000524',
      installationId: attempt.installationId,
    } as PushTestAttempt;
    prisma.pushTestAttempt.findMany
      .mockResolvedValueOnce([expiredSending])
      .mockResolvedValueOnce([]);

    await worker.tick(later);

    expect(transaction.pushTestAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        id: expiredSending.id,
        state: 'SENDING',
        startedAt: { lte: new Date(now.getTime() + 5000) },
      },
      data: {
        state: 'UNKNOWN',
        failureCode: 'PUSH_TEST_OUTCOME_UNKNOWN',
        completedAt: later,
      },
    });
    expect(expo.getReceipts).not.toHaveBeenCalled();
  });

  it('expires accepted attempts at the receipt deadline without another provider read', async () => {
    const deadline = new Date(now.getTime() + 24 * 60 * 60_000);
    prisma.pushTestAttempt.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await worker.tick(deadline);

    expect(prisma.pushTestAttempt.updateMany).toHaveBeenCalledWith({
      where: {
        state: 'ACCEPTED',
        receiptDeadlineAt: { lte: deadline },
      },
      data: {
        state: 'UNKNOWN',
        failureCode: 'PUSH_RECEIPT_DEADLINE_EXCEEDED',
        completedAt: deadline,
        nextReceiptCheckAt: null,
        receiptLeaseUntil: null,
      },
    });
    expect(expo.getReceipts).not.toHaveBeenCalled();
  });

  it('keeps receipt requests to two concurrent batches of at most 100 tickets', async () => {
    const candidates = Array.from({ length: 200 }, (_, index) => ({
      ...attempt,
      id: `synthetic-attempt-${index}`,
      registrationId: `synthetic-registration-${index}`,
      providerTicketId: `synthetic-ticket-${index}`,
    }));
    prisma.pushTestAttempt.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(candidates);
    let resolveBatches!: () => void;
    const batchGate = new Promise<void>((resolve) => {
      resolveBatches = resolve;
    });
    let markSecondBatch!: () => void;
    const secondBatchStarted = new Promise<void>((resolve) => {
      markSecondBatch = resolve;
    });
    let batchCount = 0;
    let activeCalls = 0;
    let maxActiveCalls = 0;
    const batchSizes: number[] = [];
    expo.getReceipts.mockImplementation((ticketIds: string[]) => {
      batchCount += 1;
      activeCalls += 1;
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
      batchSizes.push(ticketIds.length);
      if (batchCount === 2) markSecondBatch();
      return batchGate.then(() => {
        activeCalls -= 1;
        return {};
      });
    });
    const ticking = worker.tick(now);
    await secondBatchStarted;
    resolveBatches();
    await ticking;

    expect(batchCount).toBe(2);
    expect(batchSizes).toEqual([100, 100]);
    expect(maxActiveCalls).toBe(2);
  });

  it('aborts an active receipt request and waits for it during shutdown', async () => {
    let markStarted!: () => void;
    let aborted = false;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    expo.getReceipts.mockImplementation(
      (_ticketIds: string[], signal: AbortSignal | undefined) => {
        markStarted();
        return new Promise<Record<string, ExpoReceiptResult>>(
          (_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              aborted = true;
              reject(new Error('synthetic aborted request'));
            });
          },
        );
      },
    );
    const ticking = worker.tick(now);
    await started;

    await worker.onModuleDestroy();
    await ticking;

    expect(aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('starts at most one timer and cancels it on shutdown', async () => {
    worker.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);
    await worker.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
