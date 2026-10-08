import { randomUUID } from 'node:crypto';
import { Prisma, Role, User } from '@prisma/client';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { hashPassword } from '../../src/common/security/password-hasher';
import { assertSafeTestDatabase } from './test-database.helper';

export function assertReleaseTestDatabase(
  connection = process.env.DATABASE_URL,
) {
  const url = assertSafeTestDatabase(connection);
  if (url.pathname !== '/avisa_ai_test') {
    throw new Error('Release assessment requires exactly avisa_ai_test.');
  }
  return url;
}

export async function createReleaseSecurityFixture(
  prisma: PrismaService,
  auth: AuthService,
) {
  assertReleaseTestDatabase();
  const prefix = `release-${randomUUID()}`;
  const password = 'Synthetic release password';
  const passwordHash = await hashPassword(password);
  const users = await prisma.$transaction(async (tx) => {
    const records: User[] = [];
    for (const [tag, role] of [
      ['professorA', Role.PROFESSOR],
      ['professorB', Role.PROFESSOR],
      ['parentA', Role.PARENT],
      ['parentB', Role.PARENT],
      ['admin', Role.ADMIN],
    ] as const) {
      records.push(
        await tx.user.create({
          data: {
            name: tag,
            email: `${prefix}-${tag}@example.com`,
            role,
            password: passwordHash,
          },
        }),
      );
    }
    return records;
  });
  const [professorA, professorB, parentA, parentB] = users;
  const accounts = await Promise.all(
    users.map(async (user) => ({
      ...user,
      ...(await auth.issueTokens(user)),
    })),
  );
  const classrooms = await prisma.$transaction(async (tx) => {
    const records: Prisma.ClassroomGetPayload<{
      include: { announcements: true };
    }>[] = [];
    for (const [index, owner, member] of [
      [0, professorA, parentA],
      [1, professorB, parentB],
    ] as const) {
      records.push(
        await tx.classroom.create({
          data: {
            name: `${prefix}-${index}`,
            ownerId: owner.id,
            userClassrooms: {
              create: [{ userId: owner.id }, { userId: member.id }],
            },
            announcements: {
              create: {
                title: `Private ${index}`,
                content: `Private content ${index}`,
                authorId: owner.id,
                expiresAt: new Date(Date.now() + 86400000),
              },
            },
          },
          include: { announcements: true },
        }),
      );
    }
    return records;
  });
  return {
    prefix,
    password,
    accounts,
    classrooms,
    professorA: accounts[0],
    professorB: accounts[1],
    parentA: accounts[2],
    parentB: accounts[3],
    admin: accounts[4],
    installations: [randomUUID(), randomUUID()],
    absentId: randomUUID(),
    invalidId: 'not-a-uuid',
  };
}

export async function cleanupReleaseSecurityFixture(
  prisma: PrismaService,
  fixture: Awaited<ReturnType<typeof createReleaseSecurityFixture>>,
) {
  assertReleaseTestDatabase();
  const ids = fixture.accounts.map((account) => account.id);
  await prisma.$transaction([
    prisma.classroom.deleteMany({ where: { ownerId: { in: ids } } }),
    prisma.userClassroom.deleteMany({ where: { userId: { in: ids } } }),
    prisma.classroomDeletionReceipt.deleteMany({
      where: { ownerId: { in: ids } },
    }),
    prisma.inviteCode.deleteMany({
      where: { code: { startsWith: fixture.prefix } },
    }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
}
