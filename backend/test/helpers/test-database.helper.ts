import { PrismaService } from '../../src/prisma/prisma.service';

const TEST_DATABASE_PATTERN = /(^|[_-])test([_-]|$)/i;

export function assertSafeTestDatabase(
  connectionString = process.env.DATABASE_URL,
): URL {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for integration tests.');
  }

  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, '');
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

  if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
    throw new Error('Integration tests require a PostgreSQL DATABASE_URL.');
  }

  if (!isLocalHost || !TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      `Refusing destructive test cleanup for unrecognized database: ${databaseName || '<unnamed>'}. ` +
        'Use a local database whose name contains "test".',
    );
  }

  return url;
}

export async function clearTestDatabase(prisma: PrismaService): Promise<void> {
  assertSafeTestDatabase();

  await prisma.$transaction([
    prisma.announcement.deleteMany(),
    prisma.userClassroom.deleteMany(),
    prisma.classroom.deleteMany(),
    prisma.authSession.deleteMany(),
    prisma.classroomDeletionReceipt.deleteMany(),
    prisma.inviteCode.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
