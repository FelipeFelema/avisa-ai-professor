import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AuthSession and deletion receipt migration', () => {
  const migration = readFileSync(
    resolve(
      __dirname,
      '../prisma/migrations/20260824_add_auth_sessions_and_deletion_receipts/migration.sql',
    ),
    'utf8',
  );
  const legacyFixture = readFileSync(
    resolve(__dirname, 'fixtures/legacy-session.sql'),
    'utf8',
  );

  it('backfills each complete legacy refresh pair before dropping legacy columns', () => {
    expect(legacyFixture).toContain('refreshTokenId');
    expect(migration.indexOf('INSERT INTO "AuthSession"')).toBeGreaterThan(-1);
    expect(migration.indexOf('DROP COLUMN "refreshTokenHash"')).toBeGreaterThan(
      migration.indexOf('INSERT INTO "AuthSession"'),
    );
    expect(migration.indexOf('DROP COLUMN "refreshTokenId"')).toBeGreaterThan(
      migration.indexOf('INSERT INTO "AuthSession"'),
    );
    expect(migration).toContain("INTERVAL '7 days'");
  });

  it('creates a minimal receipt without a classroom foreign key', () => {
    expect(migration).toContain('CREATE TABLE "ClassroomDeletionReceipt"');
    expect(migration).toContain('"ownerId" TEXT NOT NULL');
    expect(migration).not.toContain(
      'ClassroomDeletionReceipt_classroomId_fkey',
    );
  });
});
