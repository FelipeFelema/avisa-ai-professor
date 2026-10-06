import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  PushRegistrationService,
  isPushRegistrationEligible,
  type PushRegistrationEligibilityInput,
} from './push-registration.service';

const now = new Date('2026-10-05T12:00:00.000Z');
const installationId1 = '00000000-0000-4000-8000-000000000001';
const installationId2 = '00000000-0000-4000-8000-000000000002';
const userId = 'user-synthetic-001';
const sessionId = 'session-synthetic-001';

function eligibleInput(): PushRegistrationEligibilityInput {
  return {
    now,
    installation: { id: installationId1, lifecycleVersion: 2 },
    registration: {
      installationId: installationId1,
      lifecycleVersion: 2,
      userId,
      sessionId,
      platform: 'ANDROID' as const,
      expoToken: 'ExpoPushToken[synthetic-token-01]',
      tokenFingerprint: 'a'.repeat(64),
      tokenRevision: 1,
      state: 'ACTIVE' as const,
    },
    user: { id: userId },
    session: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 1000),
    },
  };
}

describe('push registration eligibility', () => {
  it('requires an active token on the current installation lifecycle and live owned session', () => {
    expect(isPushRegistrationEligible(eligibleInput())).toBe(true);

    const input = eligibleInput();
    Object.assign(input.registration, { state: 'RESERVED' });
    expect(isPushRegistrationEligible(input)).toBe(false);
  });

  it.each([
    ['missing token', { expoToken: null }],
    ['missing platform', { platform: null }],
    ['missing fingerprint', { tokenFingerprint: null }],
    ['zero token revision', { tokenRevision: 0 }],
    ['old lifecycle', { lifecycleVersion: 1 }],
  ])('rejects a registration with %s', (_label, change) => {
    const input = eligibleInput();
    Object.assign(input.registration, change);
    expect(isPushRegistrationEligible(input)).toBe(false);
  });

  it.each(['REVOKED', 'INVALID'] as const)(
    'does not treat a %s lifecycle as eligible again',
    (state) => {
      const input = eligibleInput();
      input.registration.state = state;
      expect(isPushRegistrationEligible(input)).toBe(false);
    },
  );

  it('requires an existing matching user and session that is neither revoked nor expired', () => {
    const missingUser = eligibleInput();
    missingUser.user = null;
    expect(isPushRegistrationEligible(missingUser)).toBe(false);

    const mismatchedOwner = eligibleInput();
    mismatchedOwner.session = {
      ...mismatchedOwner.session!,
      userId: 'another-synthetic-user',
    };
    expect(isPushRegistrationEligible(mismatchedOwner)).toBe(false);

    const revoked = eligibleInput();
    revoked.session = {
      ...revoked.session!,
      revokedAt: new Date(now.getTime() - 1),
    };
    expect(isPushRegistrationEligible(revoked)).toBe(false);

    const expired = eligibleInput();
    expired.session = { ...expired.session!, expiresAt: now };
    expect(isPushRegistrationEligible(expired)).toBe(false);
  });
});

describe('PushRegistrationService transaction locks', () => {
  let service: PushRegistrationService;
  let lockOrder: string[];
  let transaction: { $queryRaw: jest.Mock };
  let prisma: { $transaction: jest.Mock };

  beforeEach(() => {
    lockOrder = [];
    transaction = {
      $queryRaw: jest.fn((parts: TemplateStringsArray) => {
        const statement = parts.join('');
        const table = statement.match(/FROM "([^"]+)"/)?.[1] ?? 'unknown';
        lockOrder.push(table);

        if (table === 'AuthSession') {
          return Promise.resolve([
            {
              id: sessionId,
              userId,
              revokedAt: null,
              expiresAt: new Date(now.getTime() + 1000),
            },
          ]);
        }

        return Promise.resolve([{ id: installationId1 }]);
      }),
    };
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        Promise.resolve(callback(transaction)),
      ),
    };
    service = new PushRegistrationService(prisma as unknown as PrismaService);
  });

  it('locks User, AuthSession, installations by UUID, then registrations', async () => {
    const operation = jest.fn(() => Promise.resolve('done'));

    await expect(
      service.withAuthenticatedLocks(
        userId,
        sessionId,
        [installationId2, installationId1.toUpperCase(), installationId1],
        operation,
        now,
      ),
    ).resolves.toBe('done');

    expect(lockOrder).toEqual([
      'User',
      'AuthSession',
      'PushInstallation',
      'PushInstallation',
      'PushRegistration',
      'PushRegistration',
    ]);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('locks installation then registrations for capability-only work without later user/session locks', async () => {
    const operation = jest.fn(() => Promise.resolve('done'));

    await expect(
      service.withCapabilityLocks(installationId1, operation),
    ).resolves.toBe('done');

    expect(lockOrder).toEqual(['PushInstallation', 'PushRegistration']);
    expect(lockOrder).not.toContain('User');
    expect(lockOrder).not.toContain('AuthSession');
  });

  it('sanitizes database failures without exposing SQL or private values', async () => {
    const privateMarker = 'sql-token-private-sentinel';
    prisma.$transaction.mockRejectedValueOnce(new Error(privateMarker));

    try {
      await service.withCapabilityLocks(installationId1, () =>
        Promise.resolve(undefined),
      );
      throw new Error('expected the transaction to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      expect((error as Error).message).toBe('PUSH_OPERATION_FAILED');
      expect((error as Error).message).not.toContain(privateMarker);
    }
  });

  it('maps Prisma uniqueness failures to a generic conflict without database details', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('secret-column-value', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    try {
      await service.withCapabilityLocks(installationId1, () =>
        Promise.resolve(undefined),
      );
      throw new Error('expected the transaction to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('PUSH_BINDING_CONFLICT');
      expect((error as Error).message).not.toContain('secret-column-value');
    }
  });
});
