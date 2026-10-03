import { Role, type AuthSession, type User, type Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../src/prisma/prisma.service';
import { assertSafeTestDatabase } from './test-database.helper';

export const PROFILE_PASSWORD_TEST_PASSWORD = 'Synthetic profile password 2026';

export type SyntheticProfileUser = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'createdAt' | 'updatedAt'
>;

export type SyntheticSessionState = 'active' | 'expired' | 'revoked';

export type SyntheticProfileSession = Pick<
  AuthSession,
  'id' | 'userId' | 'expiresAt' | 'revokedAt'
>;

export type ProfilePasswordFixtures = {
  account: SyntheticProfileUser;
  occupiedEmailOwner: SyntheticProfileUser;
  sessions: {
    initiating: SyntheticProfileSession;
    otherActive: SyntheticProfileSession;
    expired: SyntheticProfileSession;
    revoked: SyntheticProfileSession;
  };
};

export async function createSyntheticProfileUser(
  prisma: PrismaService,
  options: { role?: Role; email?: string; name?: string } = {},
): Promise<SyntheticProfileUser> {
  assertSafeTestDatabase();
  const id = randomUUID();
  const password = await bcrypt.hash(PROFILE_PASSWORD_TEST_PASSWORD, 10);

  return prisma.user.create({
    data: {
      id,
      name: options.name ?? 'Synthetic Profile Test User',
      email: options.email ?? `profile-password-${id}@example.test`,
      password,
      role: options.role ?? Role.PARENT,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function createSyntheticProfileSession(
  prisma: PrismaService,
  userId: string,
  state: SyntheticSessionState = 'active',
): Promise<SyntheticProfileSession> {
  assertSafeTestDatabase();
  const id = randomUUID();
  const refreshToken = `synthetic-refresh-${id}`;
  const digest = createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(
    Date.now() + (state === 'expired' ? -60_000 : 24 * 60 * 60 * 1000),
  );

  return prisma.authSession.create({
    data: {
      id,
      userId,
      refreshTokenHash: await bcrypt.hash(digest, 10),
      expiresAt,
      revokedAt: state === 'revoked' ? new Date() : null,
    },
    select: { id: true, userId: true, expiresAt: true, revokedAt: true },
  });
}

export async function createProfilePasswordFixtures(
  prisma: PrismaService,
  role: Role = Role.PARENT,
): Promise<ProfilePasswordFixtures> {
  const account = await createSyntheticProfileUser(prisma, { role });
  const occupiedEmailOwner = await createSyntheticProfileUser(prisma);
  const sessions = {
    initiating: await createSyntheticProfileSession(prisma, account.id),
    otherActive: await createSyntheticProfileSession(prisma, account.id),
    expired: await createSyntheticProfileSession(prisma, account.id, 'expired'),
    revoked: await createSyntheticProfileSession(prisma, account.id, 'revoked'),
  };

  return { account, occupiedEmailOwner, sessions };
}

export type TransactionFaultPoint = 'after-user-write' | 'after-session-revoke';

export function createTransactionFaultInjector(
  point: TransactionFaultPoint,
  error = new Error('Injected profile/password transaction failure.'),
  beforeTransaction?: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  let triggered = false;

  // Prisma exposes transaction delegates dynamically, so the test proxy adapts that runtime shape.
  /* eslint-disable
    @typescript-eslint/no-unsafe-assignment,
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-return
  */
  function wrapTransactionClient(tx: Prisma.TransactionClient) {
    const txProperties = tx as unknown as Record<PropertyKey, unknown>;
    return new Proxy(txProperties, {
      get(target, property): unknown {
        const delegate = target[property];
        const method =
          point === 'after-user-write' && property === 'user'
            ? 'update'
            : point === 'after-session-revoke' && property === 'authSession'
              ? 'updateMany'
              : undefined;

        if (!method || !delegate) return delegate;

        const delegateProperties = delegate as Record<PropertyKey, unknown>;

        return new Proxy(delegateProperties, {
          get(delegateTarget, delegateProperty): unknown {
            const operation = delegateTarget[delegateProperty];
            if (
              delegateProperty !== method ||
              typeof operation !== 'function'
            ) {
              return operation;
            }

            return async (...args: unknown[]) => {
              const run = (
                operation as (...values: unknown[]) => Promise<unknown>
              ).bind(delegate);
              const result = await run(...args);
              if (!triggered) {
                triggered = true;
                throw error;
              }
              return result;
            };
          },
        });
      },
    });
  }

  function wrapPrisma(prisma: PrismaService): PrismaService {
    const prismaProperties = prisma as unknown as Record<PropertyKey, unknown>;
    return new Proxy(prismaProperties, {
      get(target, property): unknown {
        const value = target[property];
        if (property !== '$transaction' || typeof value !== 'function') {
          return typeof value === 'function'
            ? (value as (...args: unknown[]) => unknown).bind(prisma)
            : value;
        }

        const runTransaction = (value as (...args: unknown[]) => unknown).bind(
          prisma,
        );
        return (...args: unknown[]) => {
          const callback = args[0];
          if (typeof callback !== 'function') {
            return runTransaction(...args);
          }

          const wrappedCallback = async (tx: Prisma.TransactionClient) => {
            const wrappedTx = wrapTransactionClient(
              tx,
            ) as Prisma.TransactionClient;
            await beforeTransaction?.(wrappedTx);
            return (
              callback as (transaction: Prisma.TransactionClient) => unknown
            )(wrappedTx);
          };
          return runTransaction(wrappedCallback, ...args.slice(1));
        };
      },
    }) as unknown as PrismaService;
  }
  /* eslint-enable
    @typescript-eslint/no-unsafe-assignment,
    @typescript-eslint/no-unsafe-call,
    @typescript-eslint/no-unsafe-return
  */

  return {
    wrapPrisma,
    get triggered() {
      return triggered;
    },
  };
}

export function createDeterministicBarrier(parties = 2) {
  if (!Number.isInteger(parties) || parties < 1) {
    throw new Error('Barrier parties must be a positive integer.');
  }

  let arrivals = 0;
  let open!: () => void;
  let isOpen = false;
  const released = new Promise<void>((resolve) => {
    open = resolve;
  });

  return {
    async wait(): Promise<void> {
      arrivals += 1;
      if (arrivals >= parties) {
        isOpen = true;
        open();
      }
      await released;
    },
    release(): void {
      isOpen = true;
      open();
    },
    get arrivals() {
      return arrivals;
    },
    get isOpen() {
      return isOpen;
    },
  };
}
