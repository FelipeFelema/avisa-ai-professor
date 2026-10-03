import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  createDeterministicBarrier,
  createProfilePasswordFixtures,
  createTransactionFaultInjector,
  PROFILE_PASSWORD_TEST_PASSWORD,
} from './helpers/profile-password.helper';
import { assertSafeTestDatabase } from './helpers/test-database.helper';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => Promise.resolve('synthetic-hash')),
}));

describe('profile/password test helpers', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://localhost:5432/avisa_ai_test';
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('refuses the development database before test cleanup can run', () => {
    expect(() =>
      assertSafeTestDatabase('postgresql://localhost:5432/avisa_ai'),
    ).toThrow(/local database whose name contains "test"/);
  });

  it('creates role, occupied-email, multi-session and legacy-hash fixtures', async () => {
    const prisma = {
      user: {
        create: jest.fn((args: Prisma.UserCreateArgs) =>
          Promise.resolve({
            id: args.data.id ?? 'synthetic-user-id',
            name: args.data.name,
            email: args.data.email,
            role: args.data.role ?? Role.PARENT,
            createdAt: new Date('2026-10-02T00:00:00.000Z'),
            updatedAt: new Date('2026-10-02T00:00:00.000Z'),
          }),
        ),
      },
      authSession: {
        create: jest.fn((args: Prisma.AuthSessionCreateArgs) =>
          Promise.resolve({
            id: args.data.id,
            userId: args.data.userId,
            expiresAt: args.data.expiresAt,
            revokedAt: args.data.revokedAt ?? null,
          }),
        ),
      },
    } as unknown as PrismaService;

    const fixtures = await createProfilePasswordFixtures(prisma, Role.ADMIN);
    const passwordHashCalls = (bcrypt.hash as jest.Mock).mock
      .calls as unknown as Array<[string, number]>;

    expect(fixtures.account.role).toBe(Role.ADMIN);
    expect(fixtures.account.email === fixtures.occupiedEmailOwner.email).toBe(
      false,
    );
    expect(
      fixtures.sessions.initiating.id === fixtures.sessions.otherActive.id,
    ).toBe(false);
    expect(fixtures.sessions.expired.expiresAt.getTime() < Date.now()).toBe(
      true,
    );
    expect(fixtures.sessions.revoked.revokedAt instanceof Date).toBe(true);
    expect(passwordHashCalls).toHaveLength(6);
    expect(
      passwordHashCalls
        .slice(0, 2)
        .every(
          ([password, cost]) =>
            password === PROFILE_PASSWORD_TEST_PASSWORD && cost === 10,
        ),
    ).toBe(true);
    expect(
      passwordHashCalls
        .slice(2)
        .every(([digest, cost]) => digest.length > 0 && cost === 10),
    ).toBe(true);
  });

  it.each(['after-user-write', 'after-session-revoke'] as const)(
    'injects a controlled failure at %s inside the transaction',
    async (point) => {
      const tx = {
        user: {
          update: jest.fn(() => Promise.resolve({ id: 'synthetic-user-id' })),
        },
        authSession: {
          updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
        },
      };
      const prisma = {
        $transaction: jest.fn(
          (operation: (client: typeof tx) => Promise<unknown>) =>
            Promise.resolve(operation(tx)),
        ),
      } as unknown as PrismaService;
      const fault = createTransactionFaultInjector(point);
      const faultingPrisma = fault.wrapPrisma(prisma);

      await expect(
        faultingPrisma.$transaction(async (transaction) => {
          if (point === 'after-user-write') {
            return transaction.user.update({
              where: { id: 'synthetic-user-id' },
              data: { name: 'Updated Synthetic User' },
            });
          }

          return transaction.authSession.updateMany({
            where: { userId: 'synthetic-user-id' },
            data: { revokedAt: new Date() },
          });
        }),
      ).rejects.toThrow('Injected profile/password transaction failure.');
      expect(fault.triggered).toBe(true);
    },
  );

  it('releases race participants deterministically without timed sleeps', async () => {
    const barrier = createDeterministicBarrier(2);
    const firstParticipant = barrier.wait();

    expect(barrier.arrivals).toBe(1);
    expect(barrier.isOpen).toBe(false);

    const secondParticipant = barrier.wait();
    await Promise.all([firstParticipant, secondParticipant]);

    expect(barrier.isOpen).toBe(true);
    expect(barrier.arrivals).toBe(2);
  });
});
