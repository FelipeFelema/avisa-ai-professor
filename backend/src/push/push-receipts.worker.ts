import {
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { PushTestAttempt } from '@prisma/client';
import { ExpoPushAdapter, type ExpoReceiptResult } from './expo-push.adapter';
import { PushRegistrationService } from './push-registration.service';
import { PrismaService } from '../prisma/prisma.service';

const TICK_MS = 60_000;
const RECEIPT_LEASE_MS = 60_000;
const MAX_RECEIPTS_PER_REQUEST = 100;
const MAX_CLAIMS_PER_TICK = MAX_RECEIPTS_PER_REQUEST * 2;
const RECEIPT_BACKOFF_MS = [60_000, 2 * 60_000, 5 * 60_000, 15 * 60_000];
const SEND_LEASE_MS = 15_000;
const RETENTION_MS = 7 * 24 * 60 * 60_000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60_000;

type ReceiptAttempt = Pick<
  PushTestAttempt,
  | 'id'
  | 'installationId'
  | 'registrationId'
  | 'tokenRevision'
  | 'tokenFingerprint'
  | 'providerTicketId'
  | 'receiptDeadlineAt'
  | 'receiptLeaseUntil'
  | 'receiptChecks'
  | 'nextReceiptCheckAt'
>;
type ClaimedReceipt = ReceiptAttempt & { claimedLeaseUntil: Date };

@Injectable()
export class PushReceiptsWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private readonly activeRequests = new Set<AbortController>();
  private shuttingDown = false;
  private nextCleanupAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registrations: PushRegistrationService,
    private readonly expo: ExpoPushAdapter,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, TICK_MS);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const request of this.activeRequests) request.abort();
    await this.running?.catch(() => undefined);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.shuttingDown) return;
    if (this.running) return this.running;
    this.running = this.runTick(now);
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }

  private async runTick(now: Date): Promise<void> {
    await this.expireSendingLeases(now);
    await this.expireReceiptDeadlines(now);
    await this.deleteOldTerminalAttempts(now);
    if (now.getTime() >= this.nextCleanupAt) {
      await this.registrations.cleanupInactiveRegistrations(now);
      this.nextCleanupAt = now.getTime() + CLEANUP_INTERVAL_MS;
    }
    const claimed = await this.claimDueReceipts(now);
    for (
      let index = 0;
      index < claimed.length;
      index += MAX_RECEIPTS_PER_REQUEST * 2
    ) {
      if (this.shuttingDown) return;
      const wave = claimed.slice(index, index + MAX_RECEIPTS_PER_REQUEST * 2);
      const first = wave.slice(0, MAX_RECEIPTS_PER_REQUEST);
      const second = wave.slice(MAX_RECEIPTS_PER_REQUEST);
      await Promise.all([
        this.processReceiptBatch(first, now),
        second.length
          ? this.processReceiptBatch(second, now)
          : Promise.resolve(),
      ]);
    }
  }

  private async expireSendingLeases(now: Date): Promise<void> {
    const expiredAt = new Date(now.getTime() - SEND_LEASE_MS);
    const attempts = await this.prisma.pushTestAttempt.findMany({
      where: { state: 'SENDING', startedAt: { lte: expiredAt } },
      select: { id: true, installationId: true },
      take: 200,
    });
    for (const attempt of attempts) {
      await this.registrations.withCapabilityLocks(
        attempt.installationId,
        async (transaction) => {
          const updated = await transaction.pushTestAttempt.updateMany({
            where: {
              id: attempt.id,
              state: 'SENDING',
              startedAt: { lte: expiredAt },
            },
            data: {
              state: 'UNKNOWN',
              failureCode: 'PUSH_TEST_OUTCOME_UNKNOWN',
              completedAt: now,
            },
          });
          if (updated.count > 0) {
            await transaction.pushInstallation.updateMany({
              where: {
                id: attempt.installationId,
                testLeaseUntil: { lte: now },
              },
              data: { testLeaseUntil: null },
            });
          }
        },
      );
    }
  }

  private async expireReceiptDeadlines(now: Date): Promise<void> {
    await this.prisma.pushTestAttempt.updateMany({
      where: {
        state: 'ACCEPTED',
        receiptDeadlineAt: { lte: now },
      },
      data: {
        state: 'UNKNOWN',
        failureCode: 'PUSH_RECEIPT_DEADLINE_EXCEEDED',
        completedAt: now,
        nextReceiptCheckAt: null,
        receiptLeaseUntil: null,
      },
    });
  }

  private async deleteOldTerminalAttempts(now: Date): Promise<void> {
    await this.prisma.pushTestAttempt.deleteMany({
      where: {
        state: { in: ['PROVIDER_HANDOFF', 'REJECTED', 'UNKNOWN'] },
        completedAt: { lte: new Date(now.getTime() - RETENTION_MS) },
      },
    });
  }

  private async claimDueReceipts(now: Date): Promise<ClaimedReceipt[]> {
    const candidates = await this.prisma.pushTestAttempt.findMany({
      where: {
        state: 'ACCEPTED',
        providerTicketId: { not: null },
        nextReceiptCheckAt: { lte: now },
        receiptDeadlineAt: { gt: now },
        OR: [{ receiptLeaseUntil: null }, { receiptLeaseUntil: { lte: now } }],
      },
      orderBy: { nextReceiptCheckAt: 'asc' },
      take: MAX_CLAIMS_PER_TICK,
    });
    const claimed: ClaimedReceipt[] = [];
    const leaseUntil = new Date(now.getTime() + RECEIPT_LEASE_MS);
    for (const candidate of candidates as ReceiptAttempt[]) {
      const result = await this.prisma.pushTestAttempt.updateMany({
        where: {
          id: candidate.id,
          state: 'ACCEPTED',
          nextReceiptCheckAt: candidate.nextReceiptCheckAt,
          receiptLeaseUntil: candidate.receiptLeaseUntil,
        },
        data: {
          receiptLeaseUntil: leaseUntil,
          receiptChecks: { increment: 1 },
        },
      });
      if (result.count > 0) {
        claimed.push({
          ...candidate,
          receiptChecks: candidate.receiptChecks + 1,
          claimedLeaseUntil: leaseUntil,
        });
      }
    }
    return claimed;
  }

  private async processReceiptBatch(
    attempts: ClaimedReceipt[],
    now: Date,
  ): Promise<void> {
    if (attempts.length === 0 || this.shuttingDown) return;
    const controller = new AbortController();
    this.activeRequests.add(controller);
    try {
      const results = await this.expo.getReceipts(
        attempts.map(({ providerTicketId }) => providerTicketId!),
        controller.signal,
      );
      await Promise.all(
        attempts.map(async (attempt) => {
          const result = results[attempt.providerTicketId!];
          if (result) await this.completeReceipt(attempt, result, now);
          else await this.scheduleReceiptRetry(attempt, now);
        }),
      );
    } catch {
      if (this.shuttingDown) return;
      await Promise.all(
        attempts.map((attempt) => this.scheduleReceiptRetry(attempt, now)),
      );
    } finally {
      this.activeRequests.delete(controller);
    }
  }

  private async completeReceipt(
    attempt: ClaimedReceipt,
    result: ExpoReceiptResult,
    now: Date,
  ): Promise<void> {
    await this.registrations.withCapabilityLocks(
      attempt.installationId,
      async (transaction) => {
        const current = await transaction.pushTestAttempt.findUnique({
          where: { id: attempt.id },
          select: { state: true, receiptLeaseUntil: true },
        });
        if (
          current?.state !== 'ACCEPTED' ||
          current.receiptLeaseUntil?.getTime() !==
            attempt.claimedLeaseUntil.getTime()
        ) {
          return;
        }
        if (
          result.kind === 'error' &&
          result.code === 'DEVICE_NOT_REGISTERED'
        ) {
          await transaction.pushRegistration.updateMany({
            where: {
              id: attempt.registrationId,
              state: 'ACTIVE',
              tokenRevision: attempt.tokenRevision,
              tokenFingerprint: attempt.tokenFingerprint,
            },
            data: {
              state: 'INVALID',
              reason: 'TOKEN_INVALID',
              expoToken: null,
              tokenFingerprint: null,
              platform: null,
              invalidatedAt: now,
            },
          });
        }
        await transaction.pushTestAttempt.updateMany({
          where: {
            id: attempt.id,
            state: 'ACCEPTED',
            receiptLeaseUntil: attempt.claimedLeaseUntil,
          },
          data: {
            state: result.kind === 'ok' ? 'PROVIDER_HANDOFF' : 'REJECTED',
            failureCode: result.kind === 'error' ? result.code : null,
            completedAt: now,
            nextReceiptCheckAt: null,
            receiptDeadlineAt: null,
            receiptLeaseUntil: null,
          },
        });
      },
    );
  }

  private async scheduleReceiptRetry(
    attempt: ClaimedReceipt,
    now: Date,
  ): Promise<void> {
    const deadline = attempt.receiptDeadlineAt;
    if (!deadline || deadline.getTime() <= now.getTime()) return;
    const delay =
      RECEIPT_BACKOFF_MS[
        Math.min(attempt.receiptChecks - 1, RECEIPT_BACKOFF_MS.length - 1)
      ];
    const nextReceiptCheckAt = new Date(
      Math.min(now.getTime() + delay, deadline.getTime()),
    );
    await this.prisma.pushTestAttempt.updateMany({
      where: {
        id: attempt.id,
        state: 'ACCEPTED',
        receiptLeaseUntil: attempt.claimedLeaseUntil,
      },
      data: { nextReceiptCheckAt, receiptLeaseUntil: null },
    });
  }
}
