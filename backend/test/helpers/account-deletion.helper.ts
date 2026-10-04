import { randomUUID } from 'node:crypto';
import { Role, AuthSession, Classroom } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { hashPassword } from '../../src/common/security/password-hasher';
import { assertSafeTestDatabase } from './test-database.helper';

export function createBarrier() {
  let arrived!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  const resumed = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    entered,
    release,
    pause: async () => {
      arrived();
      await resumed;
    },
  };
}

export function failAtStage(stage: string) {
  return (current: string) => {
    if (current === stage) throw new Error('Injected fixture fault');
  };
}

export type AccountFixture = { userIds: string[]; inviteIds: string[] };

const fixturePassword = 'Synthetic fixture password';
let fixturePasswordHash: Promise<string> | undefined;

export async function createAccountFixture(
  prisma: PrismaService,
  options: { role: Role; adminCount?: 1 | 2; empty?: boolean },
) {
  assertSafeTestDatabase();
  const prefix = `account-fixture-${randomUUID()}`;
  const password = fixturePassword;
  fixturePasswordHash ??= hashPassword(password);
  const passwordHash = await fixturePasswordHash;
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.create({
      data: {
        name: 'Fixture account',
        email: `${prefix}@example.com`,
        password: passwordHash,
        role: options.role,
      },
    });
    const external = await tx.user.create({
      data: {
        name: 'External owner',
        email: `${prefix}-external@example.com`,
        password: passwordHash,
        role: Role.PROFESSOR,
      },
    });
    const thirdParty = await tx.user.create({
      data: {
        name: 'Third party',
        email: `${prefix}-third@example.com`,
        password: passwordHash,
        role: Role.PARENT,
      },
    });
    const users = [target, external, thirdParty];
    const adminCount = options.adminCount ?? 2;
    for (let i = options.role === Role.ADMIN ? 1 : 0; i < adminCount; i++) {
      users.push(
        await tx.user.create({
          data: {
            name: 'Admin fixture',
            email: `${prefix}-admin-${i}@example.com`,
            password: passwordHash,
            role: Role.ADMIN,
          },
        }),
      );
    }
    const sessions: AuthSession[] = [];
    for (const user of [target, target, thirdParty]) {
      sessions.push(
        await tx.authSession.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            refreshTokenHash: 'synthetic-not-a-token',
            expiresAt: new Date(Date.now() + 86400000),
          },
        }),
      );
    }
    sessions.push(
      await tx.authSession.create({
        data: {
          id: randomUUID(),
          userId: target.id,
          refreshTokenHash: 'synthetic-expired',
          expiresAt: new Date(0),
        },
      }),
    );
    sessions.push(
      await tx.authSession.create({
        data: {
          id: randomUUID(),
          userId: target.id,
          refreshTokenHash: 'synthetic-revoked',
          expiresAt: new Date(Date.now() + 86400000),
          revokedAt: new Date(),
        },
      }),
    );
    const invite = await tx.inviteCode.create({
      data: {
        code: prefix,
        role: Role.PROFESSOR,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await tx.classroomDeletionReceipt.createMany({
      data: [
        { classroomId: randomUUID(), ownerId: target.id },
        { classroomId: randomUUID(), ownerId: external.id },
      ],
    });
    const classrooms: Classroom[] = [];
    if (!options.empty) {
      for (const [index, owner] of [target, target, external].entries()) {
        classrooms.push(
          await tx.classroom.create({
            data: { name: `${prefix}-${index}`, ownerId: owner.id },
          }),
        );
      }
      await tx.userClassroom.createMany({
        data: [
          { userId: target.id, classroomId: classrooms[0].id },
          { userId: thirdParty.id, classroomId: classrooms[0].id },
          { userId: target.id, classroomId: classrooms[2].id },
          { userId: external.id, classroomId: classrooms[2].id },
        ],
      });
      await tx.announcement.createMany({
        data: [
          {
            authorId: target.id,
            classroomId: classrooms[0].id,
            expiresAt: new Date(Date.now() + 86400000),
          },
          {
            authorId: external.id,
            classroomId: classrooms[0].id,
            expiresAt: new Date(0),
          },
          {
            authorId: thirdParty.id,
            classroomId: classrooms[0].id,
            expiresAt: new Date(Date.now() + 86400000),
          },
          {
            authorId: target.id,
            classroomId: classrooms[2].id,
            expiresAt: new Date(0),
          },
          {
            authorId: external.id,
            classroomId: classrooms[2].id,
            expiresAt: new Date(Date.now() + 86400000),
          },
        ].map((item) => ({
          ...item,
          title: 'Fixture announcement',
          content: 'Synthetic fixture content',
        })),
      });
    }
    return {
      target,
      external,
      thirdParty,
      password,
      sessions,
      classrooms,
      userIds: users.map((user) => user.id),
      inviteIds: [invite.id],
    };
  });
}

export async function cleanupAccountFixture(
  prisma: PrismaService,
  fixture: AccountFixture,
) {
  assertSafeTestDatabase();
  await prisma.$transaction(async (tx) => {
    await tx.announcement.deleteMany({
      where: { authorId: { in: fixture.userIds } },
    });
    await tx.userClassroom.deleteMany({
      where: { userId: { in: fixture.userIds } },
    });
    await tx.classroom.deleteMany({
      where: { ownerId: { in: fixture.userIds } },
    });
    await tx.classroomDeletionReceipt.deleteMany({
      where: { ownerId: { in: fixture.userIds } },
    });
    await tx.authSession.deleteMany({
      where: { userId: { in: fixture.userIds } },
    });
    await tx.inviteCode.deleteMany({
      where: { id: { in: fixture.inviteIds } },
    });
    await tx.user.deleteMany({ where: { id: { in: fixture.userIds } } });
  });
}

// Explicit allowlists: no credential/token hash is ever included in evidence.
export async function snapshotDatabase(prisma: PrismaService) {
  assertSafeTestDatabase();
  return prisma.$transaction(async (tx) => ({
    users: await tx.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    sessions: await tx.authSession.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    classrooms: await tx.classroom.findMany({ orderBy: { id: 'asc' } }),
    memberships: await tx.userClassroom.findMany({
      orderBy: [{ userId: 'asc' }, { classroomId: 'asc' }],
    }),
    announcements: await tx.announcement.findMany({ orderBy: { id: 'asc' } }),
    receipts: await tx.classroomDeletionReceipt.findMany({
      orderBy: { classroomId: 'asc' },
    }),
    invites: await tx.inviteCode.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        role: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  }));
}
