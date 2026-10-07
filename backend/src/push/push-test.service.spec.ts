import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { ExpoPushAdapter } from './expo-push.adapter';
import { PushRegistrationService } from './push-registration.service';
import {
  PushTestRateLimitException,
  PushTestService,
} from './push-test.service';

const actor = { userId: 'synthetic-user', sessionId: 'synthetic-session' };
const proof = {
  installationId: '00000000-0000-4000-8000-000000000421',
  capability: 'A'.repeat(43),
};
const now = new Date('2026-10-05T12:00:00.000Z');
const registration = {
  id: '00000000-0000-4000-8000-000000000422',
  installationId: proof.installationId,
  lifecycleVersion: 1,
  userId: actor.userId,
  sessionId: actor.sessionId,
  state: 'ACTIVE',
  platform: 'ANDROID',
  expoToken: 'ExpoPushToken[synthetic-test-destination-01]',
  tokenFingerprint: 'a'.repeat(64),
  tokenRevision: 2,
  reason: null,
  createdAt: now,
  updatedAt: now,
  activatedAt: now,
  invalidatedAt: null,
};

type ProofLockOperation = Parameters<
  PushRegistrationService['withAuthenticatedProofLocks']
>[2];
type CapabilityLockOperation = Parameters<
  PushRegistrationService['withCapabilityLocks']
>[1];

function partial(value: object): object {
  return expect.objectContaining(value) as object;
}

describe('PushTestService', () => {
  let service: PushTestService;
  let installation: Record<string, unknown>;
  let transaction: Record<string, Record<string, jest.Mock>>;
  let registrations: Record<string, jest.Mock>;
  let expo: Record<string, jest.Mock>;
  let previousEnabled: string | undefined;
  let previousAccessToken: string | undefined;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    previousEnabled = process.env.EXPO_PUSH_ENABLED;
    previousAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'synthetic-backend-secret';
    installation = {
      id: proof.installationId,
      lifecycleVersion: 1,
      secretHash: 'b'.repeat(64),
      nextTestAvailableAt: null,
      testLeaseUntil: null,
    };
    transaction = {
      pushTestAttempt: {
        create: jest
          .fn()
          .mockResolvedValue({ id: '00000000-0000-4000-8000-000000000423' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pushInstallation: {
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(installation, data);
          return undefined;
        }),
        updateMany: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          Object.assign(installation, data);
          return Promise.resolve({ count: 1 });
        }),
        findUnique: jest.fn(() =>
          Promise.resolve({
            nextTestAvailableAt: installation.nextTestAvailableAt,
          }),
        ),
      },
      pushRegistration: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    registrations = {
      withAuthenticatedProofLocks: jest.fn(
        (
          _actor: Parameters<
            PushRegistrationService['withAuthenticatedProofLocks']
          >[0],
          _proof: Parameters<
            PushRegistrationService['withAuthenticatedProofLocks']
          >[1],
          operation: ProofLockOperation,
        ) =>
          operation(
            transaction as unknown as Parameters<ProofLockOperation>[0],
            {
              id: actor.sessionId,
              userId: actor.userId,
              revokedAt: null,
              expiresAt: new Date(now.getTime() + 60_000),
            } as Parameters<ProofLockOperation>[1],
            installation as Parameters<ProofLockOperation>[2],
            registration as Parameters<ProofLockOperation>[3],
          ),
      ),
      withCapabilityLocks: jest.fn(
        (_id: string, operation: CapabilityLockOperation) =>
          operation(
            transaction as unknown as Parameters<CapabilityLockOperation>[0],
          ),
      ),
    };
    expo = {
      send: jest.fn().mockResolvedValue({
        kind: 'accepted',
        ticketId: 'synthetic-ticket-private',
      }),
    };
    service = new PushTestService(
      {} as PrismaService,
      registrations as unknown as PushRegistrationService,
      expo as unknown as ExpoPushAdapter,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    if (previousEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
    else process.env.EXPO_PUSH_ENABLED = previousEnabled;
    if (previousAccessToken === undefined)
      delete process.env.EXPO_PUSH_ACCESS_TOKEN;
    else process.env.EXPO_PUSH_ACCESS_TOKEN = previousAccessToken;
  });

  it('reserves one immutable snapshot before HTTP and only returns a ticket acceptance', async () => {
    const result = await service.sendTest(actor, proof);

    expect(transaction.pushTestAttempt.create).toHaveBeenCalledWith({
      data: partial({
        installationId: proof.installationId,
        registrationId: registration.id,
        tokenRevision: registration.tokenRevision,
        tokenFingerprint: registration.tokenFingerprint,
        state: 'SENDING',
        startedAt: now,
      }),
      select: { id: true },
    });
    expect(transaction.pushInstallation.update).toHaveBeenCalledWith({
      where: { id: proof.installationId },
      data: {
        lastTestStartedAt: now,
        nextTestAvailableAt: new Date(now.getTime() + 35_000),
        testLeaseUntil: new Date(now.getTime() + 15_000),
      },
    });
    expect(expo.send).toHaveBeenCalledWith(
      registration.expoToken,
      '00000000-0000-4000-8000-000000000423',
    );
    expect(result).toMatchObject({
      attemptId: '00000000-0000-4000-8000-000000000423',
      status: 'ACCEPTED',
      acceptedAt: now.toISOString(),
      nextTestAvailableAt: new Date(now.getTime() + 35_000).toISOString(),
    });
    expect(JSON.stringify(result)).not.toContain(registration.expoToken);
    expect(JSON.stringify(result)).not.toContain('synthetic-ticket-private');
    expect(transaction.pushTestAttempt.updateMany).toHaveBeenCalledWith(
      partial({
        data: partial({
          state: 'ACCEPTED',
          providerTicketId: 'synthetic-ticket-private',
          nextReceiptCheckAt: new Date(now.getTime() + 15 * 60_000),
          receiptDeadlineAt: new Date(now.getTime() + 24 * 60 * 60_000),
        }),
      }),
    );
  });

  it('keeps 30 seconds between accepts when the first ticket is accepted at t=5 seconds', async () => {
    expo.send.mockImplementationOnce(async () => {
      await jest.advanceTimersByTimeAsync(5000);
      return { kind: 'accepted', ticketId: 'synthetic-ticket-at-five-seconds' };
    });

    const result = await service.sendTest(actor, proof);
    expect(result.acceptedAt).toBe(
      new Date(now.getTime() + 5000).toISOString(),
    );
    expect(result.nextTestAvailableAt).toBe(
      new Date(now.getTime() + 35_000).toISOString(),
    );

    await jest.advanceTimersByTimeAsync(25_000);
    await expect(service.sendTest(actor, proof)).rejects.toBeInstanceOf(
      PushTestRateLimitException,
    );
    expect(expo.send).toHaveBeenCalledTimes(1);
  });

  it('blocks a second intent while one send lease is active', async () => {
    installation.testLeaseUntil = new Date(now.getTime() + 5000);

    await expect(service.sendTest(actor, proof)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.pushTestAttempt.create).not.toHaveBeenCalled();
    expect(expo.send).not.toHaveBeenCalled();
  });

  it('revalidates binding and session immediately before dispatch', async () => {
    let proofLockCall = 0;
    registrations.withAuthenticatedProofLocks.mockImplementation(
      (
        _actor: Parameters<
          PushRegistrationService['withAuthenticatedProofLocks']
        >[0],
        _proof: Parameters<
          PushRegistrationService['withAuthenticatedProofLocks']
        >[1],
        operation: ProofLockOperation,
      ) => {
        proofLockCall += 1;
        return operation(
          transaction as unknown as Parameters<ProofLockOperation>[0],
          {
            id: actor.sessionId,
            userId: actor.userId,
            revokedAt: null,
            expiresAt: new Date(now.getTime() + 60_000),
          } as Parameters<ProofLockOperation>[1],
          installation as Parameters<ProofLockOperation>[2],
          (proofLockCall === 1
            ? registration
            : {
                ...registration,
                state: 'REVOKED',
              }) as Parameters<ProofLockOperation>[3],
        );
      },
    );

    await expect(service.sendTest(actor, proof)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(registrations.withAuthenticatedProofLocks).toHaveBeenCalledTimes(2);
    expect(expo.send).not.toHaveBeenCalled();
    expect(transaction.pushTestAttempt.updateMany).toHaveBeenCalledWith(
      partial({
        data: partial({
          state: 'REJECTED',
          failureCode: 'PUSH_BINDING_INACTIVE',
        }),
      }),
    );
  });

  it('enforces the persisted cooldown and preserves it after a provider timeout', async () => {
    installation.nextTestAvailableAt = new Date(now.getTime() + 30_000);
    await expect(service.sendTest(actor, proof)).rejects.toBeInstanceOf(
      PushTestRateLimitException,
    );
    expect(expo.send).not.toHaveBeenCalled();

    installation.nextTestAvailableAt = null;
    expo.send.mockRejectedValueOnce(new Error('raw transport token cause'));
    await expect(service.sendTest(actor, proof)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(expo.send).toHaveBeenCalledTimes(1);
    expect(transaction.pushTestAttempt.updateMany).toHaveBeenCalledWith(
      partial({
        data: partial({
          state: 'UNKNOWN',
          failureCode: 'PUSH_TEST_OUTCOME_UNKNOWN',
        }),
      }),
    );
    expect(transaction.pushInstallation.updateMany).toHaveBeenCalledWith(
      partial({
        where: partial({
          id: proof.installationId,
          testLeaseUntil: new Date(now.getTime() + 15_000),
        }),
        data: { testLeaseUntil: null },
      }),
    );
    expect(installation.nextTestAvailableAt).toEqual(
      new Date(now.getTime() + 35_000),
    );
  });

  it('invalidates only the submitted token revision on DeviceNotRegistered', async () => {
    expo.send.mockResolvedValueOnce({
      kind: 'rejected',
      code: 'DEVICE_NOT_REGISTERED',
    });

    await expect(service.sendTest(actor, proof)).rejects.toMatchObject({
      message: 'PUSH_PROVIDER_UNAVAILABLE',
    });
    expect(transaction.pushRegistration.updateMany).toHaveBeenCalledWith({
      where: {
        id: registration.id,
        state: 'ACTIVE',
        tokenRevision: registration.tokenRevision,
        tokenFingerprint: registration.tokenFingerprint,
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
  });

  it('uses safe Retry-After cooldown for provider rate limiting', async () => {
    expo.send.mockResolvedValueOnce({
      kind: 'rejected',
      code: 'MESSAGE_RATE_EXCEEDED',
    });
    await expect(service.sendTest(actor, proof)).rejects.toMatchObject({
      retryAfterSeconds: 35,
      status: 429,
    });
  });
});
