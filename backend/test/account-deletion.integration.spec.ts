import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountDeletionService } from '../src/users/account-deletion.service';
import { Role } from '@prisma/client';
import { hashPassword } from '../src/common/security/password-hasher';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';
import {
  cleanupAccountFixture,
  createBarrier,
  createAccountFixture,
  snapshotDatabase,
} from './helpers/account-deletion.helper';

describe('Account deletion policy graph on PostgreSQL', () => {
  let prisma: PrismaService;
  let secondConnection: PrismaService;
  let service: AccountDeletionService;
  const fixtures: Awaited<ReturnType<typeof createAccountFixture>>[] = [];

  beforeAll(async () => {
    assertSafeTestDatabase();
    prisma = new PrismaService();
    secondConnection = new PrismaService();
    await prisma.$connect();
    await secondConnection.$connect();
    await clearTestDatabase(prisma);
    service = new AccountDeletionService(prisma);
  });

  afterEach(async () => {
    while (fixtures.length) {
      const fixture = fixtures.pop();
      if (fixture) await cleanupAccountFixture(prisma, fixture);
    }
  });

  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
    await secondConnection.$disconnect();
  });

  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'removes the current and historical %s graph and preserves unrelated rows',
    async (role) => {
      const fixture = await createAccountFixture(prisma, { role });
      fixtures.push(fixture);
      const before = await snapshotDatabase(prisma);
      const ownedClassroomIds = before.classrooms
        .filter((row) => row.ownerId === fixture.target.id)
        .map((row) => row.id);
      const expected = {
        users: before.users.filter((row) => row.id !== fixture.target.id),
        sessions: before.sessions.filter(
          (row) => row.userId !== fixture.target.id,
        ),
        classrooms: before.classrooms.filter(
          (row) => row.ownerId !== fixture.target.id,
        ),
        memberships: before.memberships.filter(
          (row) =>
            row.userId !== fixture.target.id &&
            !ownedClassroomIds.includes(row.classroomId),
        ),
        announcements: before.announcements.filter(
          (row) =>
            row.authorId !== fixture.target.id &&
            !ownedClassroomIds.includes(row.classroomId),
        ),
        receipts: before.receipts.filter(
          (row) => row.ownerId !== fixture.target.id,
        ),
        invites: before.invites,
      };

      await expect(
        service.deleteOwnAccount(fixture.target.id, fixture.sessions[0].id, {
          currentPassword: fixture.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        }),
      ).resolves.toBeUndefined();

      expect(await snapshotDatabase(prisma)).toEqual(expected);
    },
  );

  it('rechecks the last ADMIN in the transaction and leaves every table unchanged', async () => {
    const fixture = await createAccountFixture(prisma, {
      role: Role.ADMIN,
      adminCount: 1,
      empty: true,
    });
    fixtures.push(fixture);
    const before = await snapshotDatabase(prisma);

    await expect(
      service.deleteOwnAccount(fixture.target.id, fixture.sessions[0].id, {
        currentPassword: fixture.password,
        confirmationPhrase: 'EXCLUIR MINHA CONTA',
      }),
    ).rejects.toThrow('LAST_ADMIN_REQUIRED');

    expect(await snapshotDatabase(prisma)).toEqual(before);
  });

  it('releases the email for a new identity without retaining old sessions', async () => {
    const fixture = await createAccountFixture(prisma, { role: Role.PARENT });
    fixtures.push(fixture);
    const oldUserId = fixture.target.id;
    const oldSessionIds = fixture.sessions
      .filter((session) => session.userId === oldUserId)
      .map((session) => session.id);

    await service.deleteOwnAccount(oldUserId, fixture.sessions[0].id, {
      currentPassword: fixture.password,
      confirmationPhrase: 'EXCLUIR MINHA CONTA',
    });
    const replacement = await prisma.user.create({
      data: {
        name: 'Fresh identity',
        email: fixture.target.email,
        password: await hashPassword(fixture.password),
        role: Role.PARENT,
      },
    });
    fixture.userIds.push(replacement.id);

    expect(replacement.id).not.toBe(oldUserId);
    expect(
      await prisma.authSession.count({ where: { id: { in: oldSessionIds } } }),
    ).toBe(0);
  });

  it.each([
    'announcement',
    'membership',
    'classroom',
    'receipt',
    'session',
    'user',
  ])(
    'rolls back the full graph after the %s delete stage fails',
    async (stage) => {
      const fixture = await createAccountFixture(prisma, {
        role: Role.PROFESSOR,
      });
      fixtures.push(fixture);
      const before = await snapshotDatabase(prisma);
      const service = new AccountDeletionService(
        instrumentDeletion(prisma, { failAfter: stage }),
      );

      await expect(
        service.deleteOwnAccount(fixture.target.id, fixture.sessions[0].id, {
          currentPassword: fixture.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        }),
      ).rejects.toThrow('Não foi possível excluir a conta.');

      expect(await snapshotDatabase(prisma)).toEqual(before);
    },
  );

  it('rolls back when User lock acquisition hits the configured PostgreSQL timeout', async () => {
    const fixture = await createAccountFixture(prisma, { role: Role.PARENT });
    fixtures.push(fixture);
    const before = await snapshotDatabase(prisma);
    const heldUser = createBarrier();
    const holder = secondConnection.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id" FROM "User" WHERE "id" = ${fixture.target.id} FOR UPDATE
      `;
      await heldUser.pause();
    });
    try {
      await heldUser.entered;
      const service = new AccountDeletionService(
        instrumentDeletion(prisma, {
          beforeUserLock: async (tx) => {
            await tx.$executeRaw`SET LOCAL lock_timeout = '250ms'`;
          },
        }),
      );
      await expect(
        service.deleteOwnAccount(fixture.target.id, fixture.sessions[0].id, {
          currentPassword: fixture.password,
          confirmationPhrase: 'EXCLUIR MINHA CONTA',
        }),
      ).rejects.toThrow('Não foi possível excluir a conta.');
    } finally {
      heldUser.release();
      await holder;
    }
    expect(await snapshotDatabase(prisma)).toEqual(before);
  });
});

type DeletionInstrumentation = {
  failAfter?: string;
  beforeUserLock?: (tx: Prisma.TransactionClient) => Promise<void>;
};

function instrumentDeletion(
  prisma: PrismaService,
  hooks: DeletionInstrumentation,
): PrismaService {
  const stages: Record<string, string> = {
    announcement: 'announcement',
    userClassroom: 'membership',
    classroom: 'classroom',
    classroomDeletionReceipt: 'receipt',
    authSession: 'session',
    user: 'user',
  };
  const wrapTransaction = (tx: Prisma.TransactionClient) =>
    new Proxy(tx, {
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
            if (
              sql.includes('FROM "User"') &&
              sql.includes('FOR UPDATE') &&
              hooks.beforeUserLock
            )
              await hooks.beforeUserLock(target);
            return runQuery(...args);
          };
        }
        const model = String(key);
        const fail = hooks.failAfter === stages[model];
        if (!fail) return Reflect.get(target, key, target) as unknown;
        const delegate = Reflect.get(target, key, target) as object;
        const method = model === 'user' ? 'delete' : 'deleteMany';
        return new Proxy(delegate, {
          get(modelTarget, property) {
            const operation: unknown = Reflect.get(
              modelTarget,
              property,
              modelTarget,
            );
            if (property !== method || typeof operation !== 'function')
              return operation;
            const invoke = operation as (
              this: object,
              ...args: unknown[]
            ) => Promise<unknown>;
            return async (...args: unknown[]) => {
              await invoke.apply(modelTarget, args);
              throw new Error(`Synthetic ${model} stage fault`);
            };
          },
        });
      },
    });

  return new Proxy(prisma, {
    get(target, key) {
      if (key !== '$transaction')
        return Reflect.get(target, key, target) as unknown;
      const transaction = Reflect.get(target, key, target) as (
        this: PrismaService,
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) => Promise<unknown>;
      const runTransaction = transaction.bind(target) as (
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) => Promise<unknown>;
      return (
        work: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: unknown,
      ) =>
        runTransaction(
          (tx: Prisma.TransactionClient) => work(wrapTransaction(tx)),
          options,
        );
    },
  });
}
