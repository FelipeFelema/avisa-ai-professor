import { Role } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createAccountFixture,
  cleanupAccountFixture,
  snapshotDatabase,
  createBarrier,
  failAtStage,
} from './helpers/account-deletion.helper';
import {
  assertSafeTestDatabase,
  clearTestDatabase,
} from './helpers/test-database.helper';

describe('Account deletion fixture safety', () => {
  let prisma: PrismaService;
  beforeAll(async () => {
    assertSafeTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
    await clearTestDatabase(prisma);
  });
  afterAll(async () => {
    await clearTestDatabase(prisma);
    await prisma.$disconnect();
  });

  it.each(['avisa_ai', 'production', 'contest'])(
    'rejects unsafe database %s',
    (name) => {
      expect(() =>
        assertSafeTestDatabase(
          `postgresql://example:example@localhost:5432/${name}`,
        ),
      ).toThrow('Refusing');
    },
  );
  it('refuses fixture cleanup before touching Prisma on an unsafe connection', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://example:example@localhost:5432/avisa_ai';
    try {
      await expect(
        cleanupAccountFixture(prisma, { userIds: [], inviteIds: [] }),
      ).rejects.toThrow('Refusing');
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
  it.each([Role.PARENT, Role.PROFESSOR, Role.ADMIN])(
    'builds and disposes %s graphs without touching third parties',
    async (role) => {
      const fixture = await createAccountFixture(prisma, {
        role,
        adminCount: 2,
      });
      const snapshot = await snapshotDatabase(prisma);
      expect(snapshot.classrooms).toHaveLength(3);
      expect(snapshot.announcements).toHaveLength(5);
      expect(snapshot.sessions).toHaveLength(5);
      expect(JSON.stringify(snapshot)).not.toMatch(/password|refreshTokenHash/);
      await cleanupAccountFixture(prisma, fixture);
      expect((await snapshotDatabase(prisma)).users).toEqual([]);
    },
  );
  it('supports zero relations and exactly one ADMIN', async () => {
    const fixture = await createAccountFixture(prisma, {
      role: Role.ADMIN,
      adminCount: 1,
      empty: true,
    });
    expect(await prisma.user.count({ where: { role: Role.ADMIN } })).toBe(1);
    expect(await prisma.classroom.count()).toBe(0);
    await cleanupAccountFixture(prisma, fixture);
  });
  it('uses deterministic barriers and stage-specific fault injection', async () => {
    const barrier = createBarrier();
    let advanced = false;
    const work = (async () => {
      await barrier.pause();
      advanced = true;
    })();
    await barrier.entered;
    expect(advanced).toBe(false);
    barrier.release();
    await work;
    expect(advanced).toBe(true);
    expect(() => failAtStage('sessions')('receipts')).not.toThrow();
    expect(() => failAtStage('sessions')('sessions')).toThrow(
      'Injected fixture fault',
    );
  });
});
