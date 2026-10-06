import {
  ConflictException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { isPushRegistrationEligible } from './push-registration.service';
import { PushRegistrationService } from './push-registration.service';
import { ExpoPushAdapter, type ExpoSendResult } from './expo-push.adapter';
import { createPushConfig } from './push.config';
import { PrismaService } from '../prisma/prisma.service';

const PUSH_UNAVAILABLE = 'PUSH_UNAVAILABLE';
const PUSH_BINDING_INACTIVE = 'PUSH_BINDING_INACTIVE';
const PUSH_TEST_IN_PROGRESS = 'PUSH_TEST_IN_PROGRESS';
const PUSH_TEST_RATE_LIMITED = 'PUSH_TEST_RATE_LIMITED';
const PUSH_TEST_OUTCOME_UNKNOWN = 'PUSH_TEST_OUTCOME_UNKNOWN';
const PUSH_PROVIDER_UNAVAILABLE = 'PUSH_PROVIDER_UNAVAILABLE';
const SEND_TIMEOUT_MS = 5000;
const SEND_LEASE_MS = 15_000;
const TEST_COOLDOWN_MS = 30_000;

type PushActor = { userId: string; sessionId: string };
type PushProof = { installationId: string; capability: string };
type AttemptSnapshot = {
  attemptId: string;
  installationId: string;
  registrationId: string;
  tokenRevision: number;
  tokenFingerprint: string;
  expoToken: string;
  reservedWindowEnd: Date;
  leaseUntil: Date;
};

export type PushTestAccepted = {
  attemptId: string;
  status: 'ACCEPTED';
  acceptedAt: string;
  nextTestAvailableAt: string;
};

export class PushTestRateLimitException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(PUSH_TEST_RATE_LIMITED, 429);
    this.name = 'PushTestRateLimitException';
  }
}

function currentUser(actor: PushActor) {
  return { id: actor.userId };
}

@Injectable()
export class PushTestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registrations: PushRegistrationService,
    private readonly expo: ExpoPushAdapter,
  ) {}

  async sendTest(
    actor: PushActor,
    proof: PushProof,
  ): Promise<PushTestAccepted> {
    if (!createPushConfig().enabled) {
      throw new ServiceUnavailableException(PUSH_UNAVAILABLE);
    }
    const attempt = await this.reserveAttempt(actor, proof);
    let dispatchEligible: boolean;
    try {
      dispatchEligible = await this.registrations.withAuthenticatedProofLocks(
        actor,
        proof,
        (_transaction, session, installation, registration) =>
          Promise.resolve(
            registration !== null &&
              registration.id === attempt.registrationId &&
              registration.tokenRevision === attempt.tokenRevision &&
              registration.tokenFingerprint === attempt.tokenFingerprint &&
              registration.expoToken === attempt.expoToken &&
              isPushRegistrationEligible({
                installation,
                registration,
                user: currentUser(actor),
                session,
              }),
          ),
      );
    } catch (error) {
      await this.markNotDispatched(attempt);
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(PUSH_PROVIDER_UNAVAILABLE);
    }
    if (!dispatchEligible) {
      await this.markNotDispatched(attempt);
      throw new ConflictException(PUSH_BINDING_INACTIVE);
    }

    let outcome: ExpoSendResult;
    try {
      outcome = await this.expo.send(attempt.expoToken, attempt.attemptId);
    } catch {
      await this.markUnknown(attempt);
      throw new ServiceUnavailableException(PUSH_TEST_OUTCOME_UNKNOWN);
    }

    if (outcome.kind === 'rejected') {
      await this.markRejected(attempt, outcome.code);
      if (outcome.code === 'MESSAGE_RATE_EXCEEDED') {
        throw new PushTestRateLimitException(
          Math.max(
            1,
            Math.ceil(
              (attempt.reservedWindowEnd.getTime() - Date.now()) / 1000,
            ),
          ),
        );
      }
      throw new ServiceUnavailableException(PUSH_PROVIDER_UNAVAILABLE);
    }

    const acceptedAt = new Date();
    try {
      const nextTestAvailableAt = await this.markAccepted(
        attempt,
        outcome,
        acceptedAt,
      );
      return {
        attemptId: attempt.attemptId,
        status: 'ACCEPTED',
        acceptedAt: acceptedAt.toISOString(),
        nextTestAvailableAt: nextTestAvailableAt.toISOString(),
      };
    } catch {
      // The provider may have accepted the send. Keep the persisted lease for the
      // worker to resolve as UNKNOWN rather than risking a second send.
      throw new ServiceUnavailableException(PUSH_TEST_OUTCOME_UNKNOWN);
    }
  }

  private async reserveAttempt(
    actor: PushActor,
    proof: PushProof,
  ): Promise<AttemptSnapshot> {
    return this.registrations.withAuthenticatedProofLocks(
      actor,
      proof,
      async (transaction, session, installation, registration) => {
        const now = new Date();
        if (
          registration?.state !== 'ACTIVE' ||
          !isPushRegistrationEligible({
            installation,
            registration,
            user: currentUser(actor),
            session,
            now,
          })
        ) {
          throw new ConflictException(PUSH_BINDING_INACTIVE);
        }
        if (
          installation.testLeaseUntil &&
          installation.testLeaseUntil.getTime() > now.getTime()
        ) {
          throw new ConflictException(PUSH_TEST_IN_PROGRESS);
        }
        if (
          installation.nextTestAvailableAt &&
          installation.nextTestAvailableAt.getTime() > now.getTime()
        ) {
          throw new PushTestRateLimitException(
            Math.max(
              1,
              Math.ceil(
                (installation.nextTestAvailableAt.getTime() - now.getTime()) /
                  1000,
              ),
            ),
          );
        }

        const expiredAt = new Date(now.getTime() - SEND_LEASE_MS);
        await transaction.pushTestAttempt.updateMany({
          where: {
            installationId: installation.id,
            state: 'SENDING',
            startedAt: { lte: expiredAt },
          },
          data: {
            state: 'UNKNOWN',
            failureCode: PUSH_TEST_OUTCOME_UNKNOWN,
            completedAt: now,
          },
        });

        const reservedWindowEnd = new Date(
          now.getTime() + SEND_TIMEOUT_MS + TEST_COOLDOWN_MS,
        );
        const leaseUntil = new Date(now.getTime() + SEND_LEASE_MS);
        const created = await transaction.pushTestAttempt.create({
          data: {
            installationId: installation.id,
            registrationId: registration.id,
            tokenRevision: registration.tokenRevision,
            tokenFingerprint: registration.tokenFingerprint!,
            state: 'SENDING',
            startedAt: now,
          },
          select: { id: true },
        });
        await transaction.pushInstallation.update({
          where: { id: installation.id },
          data: {
            lastTestStartedAt: now,
            nextTestAvailableAt: reservedWindowEnd,
            testLeaseUntil: leaseUntil,
          },
        });
        return {
          attemptId: created.id,
          installationId: installation.id,
          registrationId: registration.id,
          tokenRevision: registration.tokenRevision,
          tokenFingerprint: registration.tokenFingerprint!,
          expoToken: registration.expoToken!,
          reservedWindowEnd,
          leaseUntil,
        };
      },
    );
  }

  private async markUnknown(attempt: AttemptSnapshot): Promise<void> {
    try {
      await this.withAttemptLocks(attempt, async (transaction) => {
        const now = new Date();
        await transaction.pushTestAttempt.updateMany({
          where: { id: attempt.attemptId, state: 'SENDING' },
          data: {
            state: 'UNKNOWN',
            failureCode: PUSH_TEST_OUTCOME_UNKNOWN,
            completedAt: now,
          },
        });
        await this.releaseLease(
          transaction,
          attempt.installationId,
          attempt.leaseUntil,
        );
      });
    } catch {
      // Leave SENDING leased; the worker converts it to UNKNOWN after expiry.
    }
  }

  private async markNotDispatched(attempt: AttemptSnapshot): Promise<void> {
    try {
      await this.withAttemptLocks(attempt, async (transaction) => {
        const now = new Date();
        await transaction.pushTestAttempt.updateMany({
          where: { id: attempt.attemptId, state: 'SENDING' },
          data: {
            state: 'REJECTED',
            failureCode: PUSH_BINDING_INACTIVE,
            completedAt: now,
          },
        });
        await this.releaseLease(
          transaction,
          attempt.installationId,
          attempt.leaseUntil,
        );
      });
    } catch {
      // The lease expiry path remains conservative if finalization cannot commit.
    }
  }

  private async markRejected(
    attempt: AttemptSnapshot,
    code: string,
  ): Promise<void> {
    await this.withAttemptLocks(attempt, async (transaction) => {
      const now = new Date();
      const update = await transaction.pushTestAttempt.updateMany({
        where: { id: attempt.attemptId, state: 'SENDING' },
        data: {
          state: 'REJECTED',
          failureCode: code,
          completedAt: now,
        },
      });
      if (update.count === 0) return;
      if (code === 'DEVICE_NOT_REGISTERED') {
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
      await this.releaseLease(
        transaction,
        attempt.installationId,
        attempt.leaseUntil,
      );
    });
  }

  private async markAccepted(
    attempt: AttemptSnapshot,
    outcome: Extract<ExpoSendResult, { kind: 'accepted' }>,
    acceptedAt: Date,
  ): Promise<Date> {
    return this.withAttemptLocks(attempt, async (transaction) => {
      const nextTestAvailableAt = new Date(
        acceptedAt.getTime() + TEST_COOLDOWN_MS,
      );
      const update = await transaction.pushTestAttempt.updateMany({
        where: { id: attempt.attemptId, state: 'SENDING' },
        data: {
          state: 'ACCEPTED',
          providerTicketId: outcome.ticketId,
          acceptedAt,
          nextReceiptCheckAt: new Date(acceptedAt.getTime() + 15 * 60_000),
          receiptDeadlineAt: new Date(acceptedAt.getTime() + 24 * 60 * 60_000),
          receiptChecks: 0,
        },
      });
      if (update.count === 0) throw new Error('ATTEMPT_FINALIZED');

      const installation = await transaction.pushInstallation.findUnique({
        where: { id: attempt.installationId },
        select: { nextTestAvailableAt: true },
      });
      const availableAt =
        installation?.nextTestAvailableAt &&
        installation.nextTestAvailableAt.getTime() >
          nextTestAvailableAt.getTime()
          ? installation.nextTestAvailableAt
          : nextTestAvailableAt;
      await transaction.pushInstallation.updateMany({
        where: { id: attempt.installationId },
        data: { nextTestAvailableAt: availableAt, testLeaseUntil: null },
      });
      return availableAt;
    });
  }

  private async withAttemptLocks<T>(
    attempt: AttemptSnapshot,
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.registrations.withCapabilityLocks(
      attempt.installationId,
      operation,
    );
  }

  private async releaseLease(
    transaction: Prisma.TransactionClient,
    installationId: string,
    leaseUntil: Date,
  ): Promise<void> {
    await transaction.pushInstallation.updateMany({
      where: { id: installationId, testLeaseUntil: leaseUntil },
      data: { testLeaseUntil: null },
    });
  }
}
