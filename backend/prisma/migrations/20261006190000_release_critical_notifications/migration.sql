-- CreateEnum
CREATE TYPE "AnnouncementPushKind" AS ENUM ('NEW', 'EXPIRING');

-- CreateEnum
CREATE TYPE "AnnouncementPushDispatchState" AS ENUM ('PENDING', 'CLAIMED', 'SENDING', 'ACCEPTED', 'PROVIDER_HANDOFF', 'REJECTED', 'UNKNOWN', 'SUPPRESSED');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "notificationPending" BOOLEAN;

-- CreateTable
CREATE TABLE "AnnouncementPushEvent" (
    "id" UUID NOT NULL,
    "announcementId" TEXT NOT NULL,
    "kind" "AnnouncementPushKind" NOT NULL,
    "snapshotAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementPushEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementPushDispatch" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lifecycleVersion" INTEGER NOT NULL,
    "tokenRevision" INTEGER NOT NULL,
    "tokenFingerprint" CHAR(64) NOT NULL,
    "state" "AnnouncementPushDispatchState" NOT NULL DEFAULT 'PENDING',
    "claimVersion" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(6),
    "sendStartedAt" TIMESTAMPTZ(6),
    "providerTicketId" VARCHAR(256),
    "failureCode" VARCHAR(64),
    "acceptedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "nextReceiptCheckAt" TIMESTAMPTZ(6),
    "receiptDeadlineAt" TIMESTAMPTZ(6),
    "receiptLeaseUntil" TIMESTAMPTZ(6),
    "receiptChecks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementPushDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPushEvent_announcementId_kind_key" ON "AnnouncementPushEvent"("announcementId", "kind");

-- CreateIndex
CREATE INDEX "AnnouncementPushDispatch_state_leaseUntil_idx" ON "AnnouncementPushDispatch"("state", "leaseUntil");

-- CreateIndex
CREATE INDEX "AnnouncementPushDispatch_state_createdAt_idx" ON "AnnouncementPushDispatch"("state", "createdAt");

-- CreateIndex
CREATE INDEX "AnnouncementPushDispatch_state_nextReceiptCheckAt_idx" ON "AnnouncementPushDispatch"("state", "nextReceiptCheckAt");

-- CreateIndex
CREATE INDEX "AnnouncementPushDispatch_userId_idx" ON "AnnouncementPushDispatch"("userId");

-- CreateIndex
CREATE INDEX "AnnouncementPushDispatch_sessionId_idx" ON "AnnouncementPushDispatch"("sessionId");

-- CreateIndex
CREATE INDEX "AnnouncementPushDispatch_registrationId_idx" ON "AnnouncementPushDispatch"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementPushDispatch_eventId_installationId_key" ON "AnnouncementPushDispatch"("eventId", "installationId");

-- CreateIndex
CREATE INDEX "Announcement_notificationPending_createdAt_id_idx" ON "Announcement"("notificationPending", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "AnnouncementPushEvent" ADD CONSTRAINT "AnnouncementPushEvent_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AnnouncementPushEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "PushInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PushRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ledger constraints supplement Prisma's structural schema.
ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_versions_check"
CHECK ("lifecycleVersion" >= 0 AND "tokenRevision" > 0 AND "claimVersion" >= 0 AND "receiptChecks" >= 0);

ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_send_boundary_check"
CHECK ("state" NOT IN ('SENDING', 'ACCEPTED', 'PROVIDER_HANDOFF', 'UNKNOWN') OR "sendStartedAt" IS NOT NULL);

ALTER TABLE "AnnouncementPushDispatch" ADD CONSTRAINT "AnnouncementPushDispatch_accepted_receipt_check"
CHECK ("state" <> 'ACCEPTED' OR ("providerTicketId" IS NOT NULL AND "acceptedAt" IS NOT NULL AND "nextReceiptCheckAt" IS NOT NULL AND "receiptDeadlineAt" IS NOT NULL));
