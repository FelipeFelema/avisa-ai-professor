-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomDeletionReceipt" (
    "classroomId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassroomDeletionReceipt_pkey" PRIMARY KEY ("classroomId")
);

-- Migrate the legacy refresh pair before removing it from User.
INSERT INTO "AuthSession" ("id", "userId", "refreshTokenHash", "expiresAt", "createdAt", "updatedAt")
SELECT "refreshTokenId", "id", "refreshTokenHash",
       CURRENT_TIMESTAMP + INTERVAL '7 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "refreshTokenId" IS NOT NULL AND "refreshTokenHash" IS NOT NULL;

ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

ALTER TABLE "User" DROP COLUMN "refreshTokenHash";
ALTER TABLE "User" DROP COLUMN "refreshTokenId";
