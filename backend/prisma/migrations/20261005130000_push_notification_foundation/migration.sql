-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "PushRegistrationState" AS ENUM ('RESERVED', 'ACTIVE', 'REVOKED', 'INVALID');

-- CreateEnum
CREATE TYPE "PushRegistrationReason" AS ENUM ('USER_DISABLED', 'LOGOUT', 'PERMISSION_REVOKED', 'SESSION_INACTIVE', 'TOKEN_INVALID', 'REPLACED');

-- CreateEnum
CREATE TYPE "PushTestAttemptState" AS ENUM ('SENDING', 'ACCEPTED', 'PROVIDER_HANDOFF', 'REJECTED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "PushInstallation" (
    "id" UUID NOT NULL,
    "secretHash" CHAR(64) NOT NULL,
    "lifecycleVersion" INTEGER NOT NULL DEFAULT 0,
    "lastTestStartedAt" TIMESTAMPTZ(6),
    "nextTestAvailableAt" TIMESTAMPTZ(6),
    "testLeaseUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushRegistration" (
    "id" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lifecycleVersion" INTEGER NOT NULL,
    "platform" "PushPlatform",
    "expoToken" TEXT,
    "tokenFingerprint" CHAR(64),
    "tokenRevision" INTEGER NOT NULL DEFAULT 0,
    "state" "PushRegistrationState" NOT NULL DEFAULT 'RESERVED',
    "reason" "PushRegistrationReason",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMPTZ(6),
    "invalidatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "PushRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushTestAttempt" (
    "id" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "tokenRevision" INTEGER NOT NULL,
    "tokenFingerprint" CHAR(64) NOT NULL,
    "state" "PushTestAttemptState" NOT NULL DEFAULT 'SENDING',
    "failureCode" TEXT,
    "providerTicketId" VARCHAR(256),
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "nextReceiptCheckAt" TIMESTAMPTZ(6),
    "receiptDeadlineAt" TIMESTAMPTZ(6),
    "receiptLeaseUntil" TIMESTAMPTZ(6),
    "receiptChecks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PushTestAttempt_pkey" PRIMARY KEY ("id")
);

-- Keep database invariants aligned with the push data model.
ALTER TABLE "PushInstallation"
    ADD CONSTRAINT "PushInstallation_lifecycleVersion_nonnegative"
    CHECK ("lifecycleVersion" >= 0),
    ADD CONSTRAINT "PushInstallation_secretHash_sha256_hex"
    CHECK (btrim("secretHash") ~ '^[a-f0-9]{64}$');

ALTER TABLE "PushRegistration"
    ADD CONSTRAINT "PushRegistration_lifecycleVersion_positive"
    CHECK ("lifecycleVersion" > 0),
    ADD CONSTRAINT "PushRegistration_tokenRevision_nonnegative"
    CHECK ("tokenRevision" >= 0),
    ADD CONSTRAINT "PushRegistration_tokenFingerprint_sha256_hex"
    CHECK ("tokenFingerprint" IS NULL OR btrim("tokenFingerprint") ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT "PushRegistration_active_token_state"
    CHECK (
        ("state" = 'ACTIVE'
            AND "platform" IS NOT NULL
            AND "expoToken" IS NOT NULL
            AND "expoToken" ~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$'
            AND (
                ("expoToken" LIKE 'ExpoPushToken[%]' AND char_length("expoToken") BETWEEN 23 AND 271)
                OR
                ("expoToken" LIKE 'ExponentPushToken[%]' AND char_length("expoToken") BETWEEN 27 AND 275)
            )
            AND "tokenFingerprint" IS NOT NULL
            AND "tokenRevision" > 0
            AND "activatedAt" IS NOT NULL)
        OR
        ("state" <> 'ACTIVE'
            AND "expoToken" IS NULL
            AND "tokenFingerprint" IS NULL)
    );

ALTER TABLE "PushTestAttempt"
    ADD CONSTRAINT "PushTestAttempt_tokenRevision_positive"
    CHECK ("tokenRevision" > 0),
    ADD CONSTRAINT "PushTestAttempt_tokenFingerprint_sha256_hex"
    CHECK (btrim("tokenFingerprint") ~ '^[a-f0-9]{64}$'),
    ADD CONSTRAINT "PushTestAttempt_receiptChecks_nonnegative"
    CHECK ("receiptChecks" >= 0);

-- CreateIndex
CREATE UNIQUE INDEX "PushRegistration_expoToken_key" ON "PushRegistration"("expoToken");

-- CreateIndex
CREATE INDEX "PushRegistration_userId_idx" ON "PushRegistration"("userId");

-- CreateIndex
CREATE INDEX "PushRegistration_sessionId_idx" ON "PushRegistration"("sessionId");

-- CreateIndex
CREATE INDEX "PushRegistration_installationId_state_idx" ON "PushRegistration"("installationId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PushRegistration_installationId_lifecycleVersion_key" ON "PushRegistration"("installationId", "lifecycleVersion");

-- CreateIndex
CREATE INDEX "PushTestAttempt_state_nextReceiptCheckAt_idx" ON "PushTestAttempt"("state", "nextReceiptCheckAt");

-- AddForeignKey
ALTER TABLE "PushRegistration" ADD CONSTRAINT "PushRegistration_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "PushInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushRegistration" ADD CONSTRAINT "PushRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushRegistration" ADD CONSTRAINT "PushRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushTestAttempt" ADD CONSTRAINT "PushTestAttempt_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "PushInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushTestAttempt" ADD CONSTRAINT "PushTestAttempt_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PushRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
