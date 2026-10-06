import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountDeletionService } from '../src/users/account-deletion.service';
import { PushRegistrationService } from '../src/push/push-registration.service';
import { ClassroomsService } from '../src/classrooms/classrooms.service';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';
import {
  cleanupAccountFixture,
  createAccountFixture,
  createBarrier,
} from './helpers/account-deletion.helper';

type AsyncHook = () => void | Promise<void>;
type Hooks = {
  beforeGateAttempt?: (pid: number) => void | Promise<void>;
  afterGateAcquired?: AsyncHook;
  beforeUserLock?: AsyncHook;
  afterUserLock?: AsyncHook;
  beforeClassroomLocks?: AsyncHook;
  afterClassroomLocks?: AsyncHook;
  afterUserDelete?: AsyncHook;
  onTransactionStart?: () => void;
  onTransactionEnd?: () => void;
  onQueryError?: (sql: string, error: unknown) => void;
};

function signal() {
  let notify!: () => void;
  return {
    entered: new Promise<void>((resolve) => (notify = resolve)),
    arrive: () => notify(),
  };
}

function instrumentTransaction(
  tx: Prisma.TransactionClient,
  hooks: Hooks,
): Prisma.TransactionClient {
  return new Proxy(tx, {
    get(target, key) {
      if (key === '$queryRaw') {
        const query = Reflect.get(target, key, target) as (
          this: Prisma.TransactionClient,
          ...args: unknown[]
        ) => Promise<unknown>;
        const runQuery = query.bind(target) as (
          ...args: unknown[]
        ) => Promise<unknown>;
        return async (...args: unknown[]) => {
          const sql = Array.isArray(args[0]) ? args[0].join('') : '';
          const isGate = sql.includes('pg_advisory_xact_lock');
          const isUserLock =
            sql.includes('FROM "User"') && sql.includes('FOR UPDATE');
          const isClassroomLock =
            sql.includes('FROM "Classroom"') && sql.includes('FOR UPDATE');
          const before = isUserLock
            ? hooks.beforeUserLock
            : isClassroomLock
              ? hooks.beforeClassroomLocks
              : undefined;
          let beforeResult: void | Promise<void>;
          if (isGate && hooks.beforeGateAttempt) {
            const backend = await target.$queryRaw<Array<{ pid: number }>>`
              SELECT pg_backend_pid() AS pid
            `;
            beforeResult = hooks.beforeGateAttempt(Number(backend[0].pid));
          } else {
            beforeResult = before?.();
          }
          if (beforeResult) await beforeResult;
          let result: unknown;
          try {
            result = await runQuery(...args);
          } catch (error) {
            hooks.onQueryError?.(sql, error);
            throw error;
          }
          if (isGate) await hooks.afterGateAcquired?.();
          if (isUserLock) await hooks.afterUserLock?.();
          if (isClassroomLock) await hooks.afterClassroomLocks?.();
          return result;
        };
      }
      if (key === 'user' && hooks.afterUserDelete) {
        const delegate = Reflect.get(target, key, target) as object;
        return new Proxy(delegate, {
          get(model, method) {
            const operation: unknown = Reflect.get(model, method, model);
            if (method !== 'delete' || typeof operation !== 'function')
              return operation;
            const invoke = operation as (
              this: object,
              ...args: unknown[]
            ) => Promise<unknown>;
            const runOperation = invoke.bind(model) as (
              ...args: unknown[]
            ) => Promise<unknown>;
            return async (...args: unknown[]) => {
              const result: unknown = await runOperation(...args);
              await hooks.afterUserDelete?.();
              return result;
            };
          },
        });
      }
      return Reflect.get(target, key, target) as unknown;
    },
  });
}

function instrumentClient(prisma: PrismaService, hooks: Hooks): PrismaService {
  return new Proxy(prisma, {
    get(target, key) {
      if (key === '$transaction') {
        const transaction = Reflect.get(target, key, target) as (
          this: PrismaService,
          work: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: unknown,
        ) => Promise<unknown>;
        const runTransaction = transaction.bind(target) as (
          work: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: unknown,
        ) => Promise<unknown>;
        return async (
          work: (tx: Prisma.TransactionClient) => Promise<unknown>,
          options?: unknown,
        ) => {
          hooks.onTransactionStart?.();
          try {
            return await runTransaction(
              (tx: Prisma.TransactionClient) =>
                work(instrumentTransaction(tx, hooks)),
              options,
            );
          } finally {
            hooks.onTransactionEnd?.();
          }
        };
      }
      return Reflect.get(target, key, target) as unknown;
    },
  });
}

describe('Account deletion PostgreSQL concurrency', () => {
  let prisma: PrismaService;
  let secondConnection: PrismaService;

  beforeAll(async () => {
    assertSafeTestDatabase();
    prisma = new PrismaService();
    secondConnection = new PrismaService();
    await prisma.$connect();
    await secondConnection.$connect();
    await clearTestDatabase(prisma);
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
    await secondConnection.$disconnect();
  });

  async function fixture(options: {
    role: Role;
    adminCount?: 1 | 2;
    empty?: boolean;
  }) {
    return createAccountFixture(prisma, options);
  }

  async function clean(value: Awaited<ReturnType<typeof fixture>>) {
    await cleanupAccountFixture(prisma, value);
  }

  it('records transaction time across synthetic classroom and content sizes', async () => {
    const measurements: Array<{
      ownedClassrooms: number;
      announcements: number;
      externalMemberships: number;
      transactionMs: number;
      requestMs: number;
    }> = [];

    for (const ownedClassrooms of [1, 10, 50]) {
      const f = await fixture({ role: Role.PROFESSOR, empty: true });
      try {
        await prisma.classroom.createMany({
          data: Array.from({ length: ownedClassrooms }, (_, index) => ({
            name: `T060-${randomUUID()}-${index}`,
            ownerId: f.target.id,
          })),
        });
        const classrooms = await prisma.classroom.findMany({
          where: { ownerId: f.target.id },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        await prisma.userClassroom.createMany({
          data: classrooms.map(({ id }) => ({
            userId: f.thirdParty.id,
            classroomId: id,
          })),
        });
        await prisma.announcement.createMany({
          data: classrooms.flatMap(({ id }) =>
            Array.from({ length: 10 }, (_, index) => ({
              authorId: index === 0 ? f.target.id : f.thirdParty.id,
              classroomId: id,
              title: 'Synthetic account-deletion benchmark',
              content: 'Synthetic content only',
              expiresAt: new Date(Date.now() + 60_000),
            })),
          ),
        });

        let transactionStart = 0;
        let transactionEnd = 0;
        const service = new AccountDeletionService(
          instrumentClient(prisma, {
            onTransactionStart: () => (transactionStart = performance.now()),
            onTransactionEnd: () => (transactionEnd = performance.now()),
          }),
        );
        const requestStart = performance.now();
        await service.deleteOwnAccount(f.target.id, f.sessions[0].id, {
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        });
        const requestEnd = performance.now();
        measurements.push({
          ownedClassrooms,
          announcements: classrooms.length * 10,
          externalMemberships: classrooms.length,
          transactionMs: Number((transactionEnd - transactionStart).toFixed(2)),
          requestMs: Number((requestEnd - requestStart).toFixed(2)),
        });
      } finally {
        await clean(f);
      }
    }

    console.info(
      `[T060_ACCOUNT_DELETION_TIMINGS] ${JSON.stringify(measurements)}`,
    );
    expect(measurements.map((item) => item.ownedClassrooms)).toEqual([
      1, 10, 50,
    ]);
    expect(measurements.every((item) => item.transactionMs > 0)).toBe(true);
  });

  it('records advisory-gate wait under observed PostgreSQL contention', async () => {
    const ownerFixture = await fixture({ role: Role.PROFESSOR, empty: true });
    const otherFixture = await fixture({ role: Role.PARENT, empty: true });
    const heldGate = createBarrier();
    const waiterAttempt = signal();
    let waiterPid = 0;
    let gateAcquiredAt = 0;

    const ownerService = new AccountDeletionService(
      instrumentClient(prisma, { afterGateAcquired: () => heldGate.pause() }),
    );
    const waiterService = new AccountDeletionService(
      instrumentClient(secondConnection, {
        beforeGateAttempt: (pid) => {
          waiterPid = pid;
          waiterAttempt.arrive();
        },
        afterGateAcquired: () => {
          gateAcquiredAt = performance.now();
        },
      }),
    );
    let ownerDelete: Promise<void> | undefined;
    let waiterDelete: Promise<void> | undefined;

    try {
      ownerDelete = ownerService.deleteOwnAccount(
        ownerFixture.target.id,
        ownerFixture.sessions[0].id,
        {
          currentPassword: ownerFixture.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        },
      );
      await heldGate.entered;
      waiterDelete = waiterService.deleteOwnAccount(
        otherFixture.target.id,
        otherFixture.sessions[0].id,
        {
          currentPassword: otherFixture.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        },
      );
      await waiterAttempt.entered;

      const waitDeadline = performance.now() + 5000;
      let lockWaitStartedAt = 0;
      while (performance.now() < waitDeadline) {
        const activity = await prisma.$queryRaw<
          Array<{ wait_event_type: string | null }>
        >`
          SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${waiterPid}
        `;
        if (activity[0]?.wait_event_type === 'Lock') {
          lockWaitStartedAt = performance.now();
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (lockWaitStartedAt === 0)
        throw new Error(
          'PostgreSQL did not report the waiter blocked on a lock.',
        );

      heldGate.release();
      await Promise.all([ownerDelete, waiterDelete]);
      const lockWaitMs = Number(
        (gateAcquiredAt - lockWaitStartedAt).toFixed(2),
      );
      console.info(
        `[T060_ACCOUNT_DELETION_LOCK_WAIT] ${JSON.stringify({ lock: 'transactional advisory gate', lockWaitMs })}`,
      );
      expect(lockWaitMs).toBeGreaterThanOrEqual(0);
    } finally {
      heldGate.release();
      if (ownerDelete || waiterDelete)
        await Promise.allSettled(
          [ownerDelete, waiterDelete].filter(Boolean) as Promise<void>[],
        );
      await clean(ownerFixture);
      await clean(otherFixture);
    }
  });

  it('serializes two deletes of the same account into one success and one 401', async () => {
    const f = await fixture({ role: Role.PARENT, empty: true });
    const firstGate = createBarrier();
    const secondAttempt = signal();
    const first = new AccountDeletionService(
      instrumentClient(prisma, { afterGateAcquired: () => firstGate.pause() }),
    );
    const second = new AccountDeletionService(
      instrumentClient(secondConnection, {
        beforeGateAttempt: () => secondAttempt.arrive(),
      }),
    );
    try {
      const one = first.deleteOwnAccount(f.target.id, f.sessions[0].id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await firstGate.entered;
      const two = second.deleteOwnAccount(f.target.id, f.sessions[1].id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await secondAttempt.entered;
      firstGate.release();
      const outcomes = await Promise.allSettled([one, two]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = outcomes.find(
        (outcome) => outcome.status === 'rejected',
      );
      expect(rejected?.status).toBe('rejected');
      if (rejected?.status === 'rejected')
        expect(rejected.reason).toBeInstanceOf(UnauthorizedException);
      expect(
        await prisma.user.findUnique({ where: { id: f.target.id } }),
      ).toBeNull();
      expect(
        await prisma.classroomDeletionReceipt.count({
          where: { ownerId: f.target.id },
        }),
      ).toBe(0);
    } finally {
      firstGate.release();
      await clean(f);
    }
  });

  it('rechecks two ADMINs after the first commit so one remains', async () => {
    const f = await fixture({ role: Role.ADMIN, adminCount: 2, empty: true });
    const otherAdmin = await prisma.user.findFirstOrThrow({
      where: { id: { not: f.target.id }, role: Role.ADMIN },
    });
    const otherSession = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: otherAdmin.id,
        refreshTokenHash: 'synthetic-admin-session',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const firstGate = createBarrier();
    const secondAttempt = signal();
    const first = new AccountDeletionService(
      instrumentClient(prisma, { afterGateAcquired: () => firstGate.pause() }),
    );
    const second = new AccountDeletionService(
      instrumentClient(secondConnection, {
        beforeGateAttempt: () => secondAttempt.arrive(),
      }),
    );
    try {
      const one = first.deleteOwnAccount(f.target.id, f.sessions[0].id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await firstGate.entered;
      const two = second.deleteOwnAccount(otherAdmin.id, otherSession.id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await secondAttempt.entered;
      firstGate.release();
      await expect(one).resolves.toBeUndefined();
      await expect(two).rejects.toBeInstanceOf(ConflictException);
      expect(await prisma.user.count({ where: { role: Role.ADMIN } })).toBe(1);
    } finally {
      firstGate.release();
      await clean(f);
    }
  });

  it('rolls back the first ADMIN delete and lets the waiting ADMIN be evaluated against both rows', async () => {
    const f = await fixture({ role: Role.ADMIN, adminCount: 2, empty: true });
    const otherAdmin = await prisma.user.findFirstOrThrow({
      where: { id: { not: f.target.id }, role: Role.ADMIN },
    });
    const otherSession = await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: otherAdmin.id,
        refreshTokenHash: 'synthetic-admin-session',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const firstGate = createBarrier();
    const secondAttempt = signal();
    const queryFailures: string[] = [];
    const first = new AccountDeletionService(
      instrumentClient(prisma, {
        afterGateAcquired: () => firstGate.pause(),
        afterUserDelete: () => {
          throw new Error('synthetic rollback fault');
        },
        onQueryError: (sql, error) =>
          queryFailures.push(`${sql}: ${String(error)}`),
      }),
    );
    const second = new AccountDeletionService(
      instrumentClient(secondConnection, {
        beforeGateAttempt: () => secondAttempt.arrive(),
      }),
    );
    try {
      const one = first.deleteOwnAccount(f.target.id, f.sessions[0].id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await firstGate.entered;
      const two = second.deleteOwnAccount(otherAdmin.id, otherSession.id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await secondAttempt.entered;
      firstGate.release();
      const outcomes = await Promise.allSettled([one, two]);
      expect(outcomes[0].status).toBe('rejected');
      if (outcomes[0].status === 'rejected')
        expect(outcomes[0].reason).toBeInstanceOf(InternalServerErrorException);
      expect(outcomes[1]).toEqual({ status: 'fulfilled', value: undefined });
      expect(queryFailures).toEqual([]);
      expect(await prisma.user.count({ where: { role: Role.ADMIN } })).toBe(1);
      expect(
        await prisma.user.findUnique({ where: { id: f.target.id } }),
      ).not.toBeNull();
    } finally {
      firstGate.release();
      await clean(f);
    }
  });

  it('rejects a password snapshot changed after preflight and before the User lock', async () => {
    const f = await fixture({ role: Role.PARENT, empty: true });
    const deletion = new AccountDeletionService(
      instrumentClient(prisma, {
        beforeUserLock: async () => {
          await secondConnection.user.update({
            where: { id: f.target.id },
            data: { password: 'changed-after-preflight' },
          });
        },
      }),
    );
    try {
      await expect(
        deletion.deleteOwnAccount(f.target.id, f.sessions[0].id, {
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        }),
      ).rejects.toThrow('CREDENTIAL_CHANGED');
      expect(
        await prisma.user.findUnique({ where: { id: f.target.id } }),
      ).not.toBeNull();
      expect(
        await prisma.authSession.count({ where: { userId: f.target.id } }),
      ).toBe(f.sessions.length - 1);
      expect(
        await prisma.classroom.count({ where: { ownerId: f.target.id } }),
      ).toBe(0);
    } finally {
      await clean(f);
    }
  });

  it('uses the live role after preflight and blocks a newly last ADMIN', async () => {
    const f = await fixture({
      role: Role.PARENT,
      adminCount: 1,
      empty: true,
    });
    const existingAdmin = await prisma.user.findFirstOrThrow({
      where: { role: Role.ADMIN },
    });
    const deletion = new AccountDeletionService(
      instrumentClient(prisma, {
        beforeUserLock: async () => {
          await secondConnection.$transaction([
            secondConnection.user.update({
              where: { id: f.target.id },
              data: { role: Role.ADMIN },
            }),
            secondConnection.user.update({
              where: { id: existingAdmin.id },
              data: { role: Role.PROFESSOR },
            }),
          ]);
        },
      }),
    );
    try {
      await expect(
        deletion.deleteOwnAccount(f.target.id, f.sessions[0].id, {
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        }),
      ).rejects.toThrow('LAST_ADMIN_REQUIRED');
      expect(
        await prisma.user.findUnique({ where: { id: f.target.id } }),
      ).toMatchObject({ role: Role.ADMIN });
      expect(await prisma.user.count({ where: { role: Role.ADMIN } })).toBe(1);
      expect(
        await prisma.authSession.count({ where: { userId: f.target.id } }),
      ).toBe(f.sessions.length - 1);
    } finally {
      await clean(f);
    }
  });

  it('coordinates both account-delete and classroom-receipt lock orderings', async () => {
    const f = await fixture({ role: Role.PROFESSOR });
    const targetClassroom = f.classrooms[0];
    const deletionHasUser = createBarrier();
    const writerAttempt = signal();
    const deletion = new AccountDeletionService(
      instrumentClient(prisma, {
        afterUserLock: () => deletionHasUser.pause(),
      }),
    );
    const writer = new ClassroomsService(
      instrumentClient(secondConnection, {
        beforeUserLock: () => writerAttempt.arrive(),
      }),
    );
    try {
      const removeAccount = deletion.deleteOwnAccount(
        f.target.id,
        f.sessions[0].id,
        {
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        },
      );
      await deletionHasUser.entered;
      const removeClassroom = writer.delete(f.target.id, targetClassroom.id);
      await writerAttempt.entered;
      deletionHasUser.release();
      await expect(removeAccount).resolves.toBeUndefined();
      await expect(removeClassroom).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(
        await prisma.classroomDeletionReceipt.findUnique({
          where: { classroomId: targetClassroom.id },
        }),
      ).toBeNull();
    } finally {
      deletionHasUser.release();
      await clean(f);
    }
  });

  it.each(['idempotent', 'conflicting'] as const)(
    'preserves the %s receipt writer result while account deletion waits for User',
    async (kind) => {
      const f = await fixture({ role: Role.PROFESSOR, empty: true });
      const classroomId = randomUUID();
      const receiptOwner = kind === 'idempotent' ? f.target.id : f.external.id;
      await prisma.classroomDeletionReceipt.create({
        data: { classroomId, ownerId: receiptOwner },
      });
      const receiptWriterLock = createBarrier();
      const deletionAttempt = signal();
      const writer = new ClassroomsService(
        instrumentClient(secondConnection, {
          afterUserLock: () => receiptWriterLock.pause(),
        }),
      );
      const deletion = new AccountDeletionService(
        instrumentClient(prisma, {
          beforeUserLock: () => deletionAttempt.arrive(),
        }),
      );
      try {
        const removeClassroom = writer.delete(f.target.id, classroomId);
        await receiptWriterLock.entered;
        const removeAccount = deletion.deleteOwnAccount(
          f.target.id,
          f.sessions[0].id,
          {
            currentPassword: f.password,
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        );
        await deletionAttempt.entered;
        receiptWriterLock.release();
        const writerResult = await Promise.allSettled([removeClassroom]);
        await expect(removeAccount).resolves.toBeUndefined();
        if (kind === 'idempotent')
          expect(writerResult[0]).toEqual({
            status: 'fulfilled',
            value: undefined,
          });
        else if (writerResult[0].status === 'rejected')
          expect(writerResult[0].reason).toBeInstanceOf(NotFoundException);
        else
          throw new Error(
            'A receipt owned by another account must stay hidden.',
          );
        const receipt = await prisma.classroomDeletionReceipt.findUnique({
          where: { classroomId },
        });
        expect(receipt?.ownerId ?? null).toBe(
          kind === 'idempotent' ? null : f.external.id,
        );
      } finally {
        receiptWriterLock.release();
        await clean(f);
      }
    },
  );

  it.each(['ownership', 'membership', 'authorship'] as const)(
    'deletes %s committed while the relation writer owns its User foreign key lock',
    async (kind) => {
      const f = await fixture({ role: Role.PROFESSOR });
      const heldInsert = createBarrier();
      const userLockAttempt = signal();
      const writer = secondConnection.$transaction(async (tx) => {
        if (kind === 'ownership') {
          await tx.classroom.create({
            data: { name: `Race owned ${Date.now()}`, ownerId: f.target.id },
          });
        } else if (kind === 'membership') {
          const raceClassroom = await tx.classroom.create({
            data: {
              name: `Race external ${Date.now()}`,
              ownerId: f.external.id,
            },
          });
          await tx.userClassroom.create({
            data: { userId: f.target.id, classroomId: raceClassroom.id },
          });
        } else {
          const emptyExternal = await tx.classroom.create({
            data: {
              name: `Race external ${Date.now()}`,
              ownerId: f.external.id,
            },
          });
          await tx.announcement.create({
            data: {
              authorId: f.target.id,
              classroomId: emptyExternal.id,
              title: 'Synthetic race',
              content: 'Synthetic race',
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
        }
        await heldInsert.pause();
      });
      try {
        await heldInsert.entered;
        const deletion = new AccountDeletionService(
          instrumentClient(prisma, {
            beforeUserLock: () => userLockAttempt.arrive(),
          }),
        );
        const remove = deletion.deleteOwnAccount(
          f.target.id,
          f.sessions[0].id,
          {
            currentPassword: f.password,
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        );
        await userLockAttempt.entered;
        heldInsert.release();
        await writer;
        await expect(remove).resolves.toBeUndefined();
        if (kind === 'ownership')
          expect(
            await prisma.classroom.count({ where: { ownerId: f.target.id } }),
          ).toBe(0);
        if (kind === 'membership')
          expect(
            await prisma.userClassroom.count({
              where: { userId: f.target.id },
            }),
          ).toBe(0);
        if (kind === 'authorship')
          expect(
            await prisma.announcement.count({
              where: { authorId: f.target.id },
            }),
          ).toBe(0);
      } finally {
        heldInsert.release();
        await clean(f);
      }
    },
  );

  it.each(['ownership', 'membership', 'authorship'] as const)(
    'rejects a new %s reference after the account transaction wins the User lock',
    async (kind) => {
      const f = await fixture({ role: Role.PROFESSOR });
      const userLocked = createBarrier();
      const writerStarted = signal();
      const externalClassroom = await prisma.classroom.create({
        data: {
          name: `Race external ${Date.now()}`,
          ownerId: f.external.id,
        },
      });
      const deletion = new AccountDeletionService(
        instrumentClient(prisma, {
          afterUserLock: () => userLocked.pause(),
        }),
      );
      try {
        const remove = deletion.deleteOwnAccount(
          f.target.id,
          f.sessions[0].id,
          {
            currentPassword: f.password,
            confirmationPhrase: 'EXCLUIR MINHA CONTA',
          },
        );
        await userLocked.entered;
        const insertion = (async () => {
          writerStarted.arrive();
          if (kind === 'ownership')
            return secondConnection.classroom.create({
              data: {
                name: `Late owned ${Date.now()}`,
                ownerId: f.target.id,
              },
            });
          if (kind === 'membership')
            return secondConnection.userClassroom.create({
              data: {
                userId: f.target.id,
                classroomId: externalClassroom.id,
              },
            });
          return secondConnection.announcement.create({
            data: {
              authorId: f.target.id,
              classroomId: externalClassroom.id,
              title: 'Synthetic late race',
              content: 'Synthetic late race',
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
        })();
        await writerStarted.entered;
        userLocked.release();
        await expect(remove).resolves.toBeUndefined();
        await expect(insertion).rejects.toMatchObject({ code: 'P2003' });
      } finally {
        userLocked.release();
        await clean(f);
      }
    },
  );

  it('locks owned classrooms against third-party child inserts in both orders', async () => {
    const f = await fixture({ role: Role.PROFESSOR });
    const ownedClassroom = f.classrooms[1];
    const childInserted = createBarrier();
    const classroomLockAttempt = signal();
    const child = secondConnection.$transaction(async (tx) => {
      await tx.userClassroom.create({
        data: { userId: f.thirdParty.id, classroomId: ownedClassroom.id },
      });
      await childInserted.pause();
    });
    try {
      await childInserted.entered;
      const deletion = new AccountDeletionService(
        instrumentClient(prisma, {
          beforeClassroomLocks: () => classroomLockAttempt.arrive(),
        }),
      );
      const remove = deletion.deleteOwnAccount(f.target.id, f.sessions[0].id, {
        currentPassword: f.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      });
      await classroomLockAttempt.entered;
      childInserted.release();
      await child;
      await expect(remove).resolves.toBeUndefined();
      await expect(
        secondConnection.userClassroom.findUnique({
          where: {
            userId_classroomId: {
              userId: f.thirdParty.id,
              classroomId: ownedClassroom.id,
            },
          },
        }),
      ).resolves.toBeNull();
    } finally {
      childInserted.release();
      await clean(f);
    }

    const secondFixture = await fixture({ role: Role.PROFESSOR });
    const heldLocks = createBarrier();
    const lateInsertStarted = signal();
    const lateClassroom = secondFixture.classrooms[1];
    const deletionWins = new AccountDeletionService(
      instrumentClient(prisma, {
        afterClassroomLocks: () => heldLocks.pause(),
      }),
    );
    try {
      const remove = deletionWins.deleteOwnAccount(
        secondFixture.target.id,
        secondFixture.sessions[0].id,
        {
          currentPassword: secondFixture.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        },
      );
      await heldLocks.entered;
      const lateInsert = (async () => {
        lateInsertStarted.arrive();
        return secondConnection.userClassroom.create({
          data: {
            userId: secondFixture.thirdParty.id,
            classroomId: lateClassroom.id,
          },
        });
      })();
      await lateInsertStarted.entered;
      heldLocks.release();
      await expect(remove).resolves.toBeUndefined();
      await expect(lateInsert).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      heldLocks.release();
      await clean(secondFixture);
    }
  });

  it('serializes account deletion against push rotation and preserves other accounts', async () => {
    const f = await fixture({ role: Role.PROFESSOR, empty: true });
    const previousEnabled = process.env.EXPO_PUSH_ENABLED;
    const previousAccessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
    process.env.EXPO_PUSH_ENABLED = 'true';
    process.env.EXPO_PUSH_ACCESS_TOKEN = 'synthetic-backend-only-token';
    const push = new PushRegistrationService(prisma);
    const targetIdentity = {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
    const revokeIdentity = {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
    const otherIdentity = {
      installationId: randomUUID(),
      capability: randomBytes(32).toString('base64url'),
    };
    const targetActor = {
      userId: f.target.id,
      sessionId: f.sessions[0].id,
    };
    const otherActor = {
      userId: f.thirdParty.id,
      sessionId: f.sessions[2].id,
    };

    try {
      const targetBinding = await push.reserve(targetActor, targetIdentity);
      const revokeBinding = await push.reserve(targetActor, revokeIdentity);
      const otherBinding = await push.reserve(otherActor, otherIdentity);
      await push.activate(targetActor, targetIdentity, {
        bindingId: targetBinding.bindingId,
        lifecycleVersion: targetBinding.lifecycleVersion,
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-delete-race-old-01]',
        permission: 'GRANTED',
      });
      await push.activate(targetActor, revokeIdentity, {
        bindingId: revokeBinding.bindingId,
        lifecycleVersion: revokeBinding.lifecycleVersion,
        expectedTokenRevision: 0,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-delete-race-revoke-04]',
        permission: 'GRANTED',
      });
      await push.activate(otherActor, otherIdentity, {
        bindingId: otherBinding.bindingId,
        lifecycleVersion: otherBinding.lifecycleVersion,
        expectedTokenRevision: 0,
        platform: 'IOS',
        expoToken: 'ExpoPushToken[synthetic-delete-race-other-02]',
        permission: 'GRANTED',
      });
      const targetRegistration =
        await prisma.pushRegistration.findUniqueOrThrow({
          where: { id: targetBinding.bindingId },
        });
      await prisma.pushTestAttempt.create({
        data: {
          installationId: targetIdentity.installationId,
          registrationId: targetRegistration.id,
          tokenRevision: targetRegistration.tokenRevision,
          tokenFingerprint: createHash('sha256')
            .update('synthetic-delete-race-old-01')
            .digest('hex'),
        },
      });

      const deletion = new AccountDeletionService(prisma).deleteOwnAccount(
        f.target.id,
        f.sessions[0].id,
        {
          currentPassword: f.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        },
      );
      const rotation = push.activate(targetActor, targetIdentity, {
        bindingId: targetBinding.bindingId,
        lifecycleVersion: targetBinding.lifecycleVersion,
        expectedTokenRevision: 1,
        platform: 'ANDROID',
        expoToken: 'ExpoPushToken[synthetic-delete-race-next-03]',
        permission: 'GRANTED',
      });
      const revocation = push.revoke(revokeIdentity, {
        bindingId: revokeBinding.bindingId,
        lifecycleVersion: revokeBinding.lifecycleVersion,
        reason: 'USER_DISABLED',
      });
      const [deleteResult, rotationResult, revocationResult] =
        await Promise.allSettled([deletion, rotation, revocation]);

      expect(deleteResult.status).toBe('fulfilled');
      expect(revocationResult.status).toBe('fulfilled');
      if (rotationResult.status === 'rejected') {
        expect(rotationResult.reason).toBeInstanceOf(UnauthorizedException);
      }
      expect(
        await prisma.user.findUnique({ where: { id: f.target.id } }),
      ).toBeNull();
      expect(
        await prisma.pushRegistration.findUnique({
          where: { id: targetBinding.bindingId },
        }),
      ).toBeNull();
      expect(
        await prisma.pushRegistration.findUnique({
          where: { id: revokeBinding.bindingId },
        }),
      ).toBeNull();
      expect(
        await prisma.pushTestAttempt.count({
          where: { installationId: targetIdentity.installationId },
        }),
      ).toBe(0);
      expect(
        await prisma.pushRegistration.findUnique({
          where: { id: otherBinding.bindingId },
        }),
      ).toMatchObject({
        state: 'ACTIVE',
        expoToken: 'ExpoPushToken[synthetic-delete-race-other-02]',
      });
    } finally {
      if (previousEnabled === undefined) delete process.env.EXPO_PUSH_ENABLED;
      else process.env.EXPO_PUSH_ENABLED = previousEnabled;
      if (previousAccessToken === undefined)
        delete process.env.EXPO_PUSH_ACCESS_TOKEN;
      else process.env.EXPO_PUSH_ACCESS_TOKEN = previousAccessToken;
      await clean(f);
    }
  });
});
