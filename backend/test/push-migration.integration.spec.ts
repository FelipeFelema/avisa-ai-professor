import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertSafeTestDatabase } from './helpers/test-database.helper';

const testSchema = 'push_foundation_migration_test';
const legacyUserId = 'legacy-user-push-migration-010';
const legacySessionId = 'legacy-session-push-migration-010';
const legacyUserId2 = 'legacy-user-push-migration-011';
const legacySessionId2 = 'legacy-session-push-migration-011';
const legacyUserId3 = 'legacy-user-push-migration-012';
const legacySessionId3 = 'legacy-session-push-migration-012';
const installationId1 = '00000000-0000-4000-8000-000000000101';
const installationId2 = '00000000-0000-4000-8000-000000000102';
const installationId3 = '00000000-0000-4000-8000-000000000103';
const registrationId1 = '00000000-0000-4000-8000-000000000201';
const registrationId2 = '00000000-0000-4000-8000-000000000202';
const registrationId3 = '00000000-0000-4000-8000-000000000203';
const attemptId1 = '00000000-0000-4000-8000-000000000301';
const attemptId2 = '00000000-0000-4000-8000-000000000302';
const attemptId3 = '00000000-0000-4000-8000-000000000303';
const token1 = `ExpoPushToken[${'A'.repeat(16)}]`;
const token2 = `ExponentPushToken[${'B'.repeat(16)}]`;
const token3 = `ExpoPushToken[${'C'.repeat(16)}]`;

function assertExactPushTestDatabase(): void {
  const database = assertSafeTestDatabase();
  if (database.pathname !== '/avisa_ai_test') {
    throw new Error('Push migration tests require local avisa_ai_test.');
  }
}

async function runMigration(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  const migration = readFileSync(
    resolve(
      __dirname,
      '../prisma/migrations/20261005130000_push_notification_foundation/migration.sql',
    ),
    'utf8',
  );
  const statements = migration
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await transaction.$executeRawUnsafe(statement);
  }
}

async function readLegacyRows(transaction: Prisma.TransactionClient) {
  return {
    users: await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User" ORDER BY "id"
    `,
    sessions: await transaction.$queryRaw<
      Array<{ id: string; userId: string; refreshTokenHash: string }>
    >`
      SELECT "id", "userId", "refreshTokenHash" FROM "AuthSession" ORDER BY "id"
    `,
    classrooms: await transaction.$queryRaw<
      Array<{ id: string; name: string }>
    >`
      SELECT "id", "name" FROM "Classroom" ORDER BY "id"
    `,
    announcements: await transaction.$queryRaw<
      Array<{ id: string; title: string }>
    >`
      SELECT "id", "title" FROM "Announcement" ORDER BY "id"
    `,
    inviteCodes: await transaction.$queryRaw<
      Array<{ id: string; code: string }>
    >`
      SELECT "id", "code" FROM "InviteCode" ORDER BY "id"
    `,
  };
}

async function expectConstraintFailure(
  transaction: Prisma.TransactionClient,
  operation: () => Promise<unknown>,
): Promise<void> {
  await transaction.$executeRawUnsafe(
    'SAVEPOINT push_expected_constraint_failure',
  );
  let failed = false;
  try {
    await operation();
  } catch {
    failed = true;
  }
  await transaction.$executeRawUnsafe(
    'ROLLBACK TO SAVEPOINT push_expected_constraint_failure',
  );
  await transaction.$executeRawUnsafe(
    'RELEASE SAVEPOINT push_expected_constraint_failure',
  );
  expect(failed).toBe(true);
}

describe('push migration integration', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    assertExactPushTestDatabase();
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma) {
      assertExactPushTestDatabase();
      await prisma.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`,
      );
      await prisma.$disconnect();
    }
  });

  it('applies to an empty namespace, preserves legacy rows, and enforces push constraints/cascades', async () => {
    assertExactPushTestDatabase();

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`,
      );
      await transaction.$executeRawUnsafe(`CREATE SCHEMA "${testSchema}"`);
      await transaction.$executeRawUnsafe(
        `SET LOCAL search_path TO "${testSchema}"`,
      );

      await transaction.$executeRawUnsafe(
        'CREATE TABLE "User" ("id" TEXT PRIMARY KEY)',
      );
      await transaction.$executeRawUnsafe(`
        CREATE TABLE "AuthSession" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "refreshTokenHash" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL
        )
      `);
      await transaction.$executeRawUnsafe(
        'CREATE TABLE "Classroom" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL)',
      );
      await transaction.$executeRawUnsafe(
        'CREATE TABLE "Announcement" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL)',
      );
      await transaction.$executeRawUnsafe(
        'CREATE TABLE "InviteCode" ("id" TEXT PRIMARY KEY, "code" TEXT NOT NULL)',
      );
      await transaction.$executeRaw`
        INSERT INTO "User" ("id") VALUES (${legacyUserId})
      `;
      await transaction.$executeRaw`
        INSERT INTO "User" ("id") VALUES (${legacyUserId2}), (${legacyUserId3})
      `;
      await transaction.$executeRaw`
        INSERT INTO "AuthSession" ("id", "userId", "refreshTokenHash", "expiresAt")
        VALUES (${legacySessionId}, ${legacyUserId}, 'synthetic-refresh-hash', CURRENT_TIMESTAMP + INTERVAL '1 day')
      `;
      await transaction.$executeRaw`
        INSERT INTO "AuthSession" ("id", "userId", "refreshTokenHash", "expiresAt")
        VALUES
          (${legacySessionId2}, ${legacyUserId2}, 'synthetic-refresh-hash-2', CURRENT_TIMESTAMP + INTERVAL '1 day'),
          (${legacySessionId3}, ${legacyUserId3}, 'synthetic-refresh-hash-3', CURRENT_TIMESTAMP + INTERVAL '1 day')
      `;
      await transaction.$executeRaw`
        INSERT INTO "Classroom" ("id", "name") VALUES ('legacy-classroom-010', 'legacy-classroom-preserved')
      `;
      await transaction.$executeRaw`
        INSERT INTO "Announcement" ("id", "title") VALUES ('legacy-announcement-010', 'legacy-announcement-preserved')
      `;
      await transaction.$executeRaw`
        INSERT INTO "InviteCode" ("id", "code") VALUES ('legacy-invite-010', 'legacy-invite-preserved')
      `;

      const beforeMigration = await readLegacyRows(transaction);
      await runMigration(transaction);
      const afterMigration = await readLegacyRows(transaction);
      expect(afterMigration).toEqual(beforeMigration);

      await transaction.$executeRaw`
        INSERT INTO "PushInstallation" ("id", "secretHash")
        VALUES (${installationId1}::uuid, ${'a'.repeat(64)})
      `;
      await transaction.$executeRaw`
        INSERT INTO "PushRegistration" (
          "id", "installationId", "userId", "sessionId", "lifecycleVersion"
        ) VALUES (
          ${registrationId1}::uuid, ${installationId1}::uuid,
          ${legacyUserId}, ${legacySessionId}, 1
        )
      `;
      const lockedInstallation = await transaction.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id" FROM "PushInstallation"
        WHERE "id" = ${installationId1}::uuid
        FOR UPDATE
      `;
      const lockedRegistrations = await transaction.$queryRaw<
        Array<{ id: string }>
      >`
        SELECT "id" FROM "PushRegistration"
        WHERE "installationId" = ${installationId1}::uuid
        ORDER BY "id"
        FOR UPDATE
      `;
      expect(lockedInstallation).toHaveLength(1);
      expect(lockedRegistrations).toHaveLength(1);

      await expectConstraintFailure(
        transaction,
        () =>
          transaction.$executeRaw`
          INSERT INTO "PushRegistration" (
            "id", "installationId", "userId", "sessionId", "lifecycleVersion"
          ) VALUES (
            ${registrationId2}::uuid, ${installationId1}::uuid,
            ${legacyUserId}, ${legacySessionId}, 1
          )
        `,
      );
      await expectConstraintFailure(
        transaction,
        () =>
          transaction.$executeRaw`
          UPDATE "PushRegistration" SET "state" = 'ACTIVE'
          WHERE "id" = ${registrationId1}::uuid
        `,
      );
      await expectConstraintFailure(
        transaction,
        () =>
          transaction.$executeRaw`
          UPDATE "PushInstallation" SET "lifecycleVersion" = -1
          WHERE "id" = ${installationId1}::uuid
        `,
      );

      await transaction.$executeRaw`
        UPDATE "PushRegistration"
        SET "state" = 'ACTIVE', "platform" = 'ANDROID',
            "expoToken" = ${token1}, "tokenFingerprint" = ${'b'.repeat(64)},
            "tokenRevision" = 1, "activatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${registrationId1}::uuid
      `;
      await transaction.$executeRaw`
        INSERT INTO "PushTestAttempt" (
          "id", "installationId", "registrationId", "tokenRevision", "tokenFingerprint"
        ) VALUES (
          ${attemptId1}::uuid, ${installationId1}::uuid,
          ${registrationId1}::uuid, 1, ${'b'.repeat(64)}
        )
      `;

      await transaction.$executeRaw`
        INSERT INTO "PushInstallation" ("id", "secretHash")
        VALUES (${installationId2}::uuid, ${'c'.repeat(64)})
      `;
      await transaction.$executeRaw`
        INSERT INTO "PushRegistration" (
          "id", "installationId", "userId", "sessionId", "lifecycleVersion"
        ) VALUES (
          ${registrationId2}::uuid, ${installationId2}::uuid,
          ${legacyUserId2}, ${legacySessionId2}, 1
        )
      `;
      await expectConstraintFailure(
        transaction,
        () =>
          transaction.$executeRaw`
          UPDATE "PushRegistration"
          SET "state" = 'ACTIVE', "platform" = 'IOS',
              "expoToken" = ${token1}, "tokenFingerprint" = ${'d'.repeat(64)},
              "tokenRevision" = 1, "activatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${registrationId2}::uuid
        `,
      );
      await transaction.$executeRaw`
        UPDATE "PushRegistration"
        SET "state" = 'ACTIVE', "platform" = 'IOS',
            "expoToken" = ${token2}, "tokenFingerprint" = ${'d'.repeat(64)},
            "tokenRevision" = 1, "activatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${registrationId2}::uuid
      `;
      await transaction.$executeRaw`
        INSERT INTO "PushTestAttempt" (
          "id", "installationId", "registrationId", "tokenRevision", "tokenFingerprint"
        ) VALUES (
          ${attemptId2}::uuid, ${installationId2}::uuid,
          ${registrationId2}::uuid, 1, ${'d'.repeat(64)}
        )
      `;

      await transaction.$executeRaw`
        INSERT INTO "PushInstallation" ("id", "secretHash")
        VALUES (${installationId3}::uuid, ${'e'.repeat(64)})
      `;
      await transaction.$executeRaw`
        INSERT INTO "PushRegistration" (
          "id", "installationId", "userId", "sessionId", "lifecycleVersion"
        ) VALUES (
          ${registrationId3}::uuid, ${installationId3}::uuid,
          ${legacyUserId3}, ${legacySessionId3}, 1
        )
      `;
      await transaction.$executeRaw`
        UPDATE "PushRegistration"
        SET "state" = 'ACTIVE', "platform" = 'ANDROID',
            "expoToken" = ${token3}, "tokenFingerprint" = ${'f'.repeat(64)},
            "tokenRevision" = 1, "activatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${registrationId3}::uuid
      `;
      await transaction.$executeRaw`
        INSERT INTO "PushTestAttempt" (
          "id", "installationId", "registrationId", "tokenRevision", "tokenFingerprint"
        ) VALUES (
          ${attemptId3}::uuid, ${installationId3}::uuid,
          ${registrationId3}::uuid, 1, ${'f'.repeat(64)}
        )
      `;

      await transaction.$executeRaw`
        DELETE FROM "User" WHERE "id" = ${legacyUserId}
      `;
      const userCascade = await transaction.$queryRaw<
        Array<{
          registrations: bigint;
          attempts: bigint;
          installations: bigint;
        }>
      >`
        SELECT
          (SELECT count(*) FROM "PushRegistration") AS "registrations",
          (SELECT count(*) FROM "PushTestAttempt") AS "attempts",
          (SELECT count(*) FROM "PushInstallation") AS "installations"
      `;
      expect(userCascade[0]).toEqual({
        registrations: 2n,
        attempts: 2n,
        installations: 3n,
      });

      await transaction.$executeRaw`
        DELETE FROM "AuthSession" WHERE "id" = ${legacySessionId2}
      `;
      const sessionCascade = await transaction.$queryRaw<
        Array<{
          registrations: bigint;
          attempts: bigint;
          installations: bigint;
          users: bigint;
        }>
      >`
        SELECT
          (SELECT count(*) FROM "PushRegistration") AS "registrations",
          (SELECT count(*) FROM "PushTestAttempt") AS "attempts",
          (SELECT count(*) FROM "PushInstallation") AS "installations",
          (SELECT count(*) FROM "User" WHERE "id" = ${legacyUserId2}) AS "users"
      `;
      expect(sessionCascade[0]).toEqual({
        registrations: 1n,
        attempts: 1n,
        installations: 3n,
        users: 1n,
      });

      await transaction.$executeRaw`
        DELETE FROM "PushInstallation" WHERE "id" = ${installationId3}::uuid
      `;
      const installationCascade = await transaction.$queryRaw<
        Array<{
          registrations: bigint;
          attempts: bigint;
          installations: bigint;
        }>
      >`
        SELECT
          (SELECT count(*) FROM "PushRegistration") AS "registrations",
          (SELECT count(*) FROM "PushTestAttempt") AS "attempts",
          (SELECT count(*) FROM "PushInstallation") AS "installations"
      `;
      expect(installationCascade[0]).toEqual({
        registrations: 0n,
        attempts: 0n,
        installations: 2n,
      });
    });
  });
});
