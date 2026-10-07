import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { assertSafeTestDatabase } from './test-database.helper';

export function assertAnnouncementPushTestDatabase(): void {
  const url = assertSafeTestDatabase();
  if (url.pathname !== '/avisa_ai_test') {
    throw new Error('Announcement push tests require local avisa_ai_test.');
  }
}

export async function createAnnouncementPushActor(
  prisma: PrismaService,
  role: Role = Role.PARENT,
) {
  assertAnnouncementPushTestDatabase();
  const user = await prisma.user.create({
    data: {
      name: 'Synthetic notification actor',
      email: `announcement-push-${randomUUID()}@example.test`,
      password: 'synthetic-password-hash',
      role,
    },
  });
  const session = await prisma.authSession.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: 'synthetic-refresh-hash',
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });
  return { user, session };
}

export async function createAnnouncementPushBinding(
  prisma: PrismaService,
  actor: Awaited<ReturnType<typeof createAnnouncementPushActor>>,
) {
  assertAnnouncementPushTestDatabase();
  const installation = await prisma.pushInstallation.create({
    data: {
      id: randomUUID(),
      secretHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
      lifecycleVersion: 1,
    },
  });
  const token = `ExpoPushToken[${randomBytes(18).toString('base64url')}]`;
  const registration = await prisma.pushRegistration.create({
    data: {
      installationId: installation.id,
      userId: actor.user.id,
      sessionId: actor.session.id,
      lifecycleVersion: 1,
      state: 'ACTIVE',
      platform: 'ANDROID',
      expoToken: token,
      tokenFingerprint: createHash('sha256').update(token).digest('hex'),
      tokenRevision: 1,
      activatedAt: new Date(),
    },
  });
  return { installation, registration };
}

export async function createAnnouncementPushFixture(prisma: PrismaService) {
  assertAnnouncementPushTestDatabase();
  const owner = await createAnnouncementPushActor(prisma, Role.PROFESSOR);
  const author = await createAnnouncementPushActor(prisma, Role.PROFESSOR);
  const member = await createAnnouncementPushActor(prisma);
  const outsider = await createAnnouncementPushActor(prisma);
  const classroom = await prisma.classroom.create({
    data: {
      name: `Synthetic A ${randomUUID()}`,
      ownerId: owner.user.id,
      userClassrooms: {
        create: [owner, author, member].map(({ user }) => ({
          userId: user.id,
        })),
      },
    },
  });
  const otherClassroom = await prisma.classroom.create({
    data: {
      name: `Synthetic B ${randomUUID()}`,
      ownerId: outsider.user.id,
      userClassrooms: { create: { userId: outsider.user.id } },
    },
  });
  const ownerBinding = await createAnnouncementPushBinding(prisma, owner);
  const authorBinding = await createAnnouncementPushBinding(prisma, author);
  const memberBinding = await createAnnouncementPushBinding(prisma, member);
  const outsiderBinding = await createAnnouncementPushBinding(prisma, outsider);
  return {
    owner,
    author,
    member,
    outsider,
    classroom,
    otherClassroom,
    ownerBinding,
    authorBinding,
    memberBinding,
    outsiderBinding,
  };
}
