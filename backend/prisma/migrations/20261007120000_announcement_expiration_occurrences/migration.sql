-- Preserve existing NEW identities and all dispatch tombstones.
ALTER TABLE "AnnouncementPushEvent" ADD COLUMN "occurrenceKey" VARCHAR(40) NOT NULL DEFAULT 'publication';
-- EXPIRING was reserved but unused before P1. Preserve any reserved rows if present.
UPDATE "AnnouncementPushEvent" AS e SET "occurrenceKey" = 'expiration:' || (EXTRACT(EPOCH FROM a."expiresAt") * 1000)::bigint::text FROM "Announcement" AS a WHERE e."announcementId" = a."id" AND e."kind" = 'EXPIRING';
CREATE UNIQUE INDEX "AnnouncementPushEvent_announcementId_kind_occurrenceKey_key" ON "AnnouncementPushEvent"("announcementId", "kind", "occurrenceKey");
DROP INDEX "AnnouncementPushEvent_announcementId_kind_key";
ALTER TABLE "AnnouncementPushEvent" ADD CONSTRAINT "AnnouncementPushEvent_occurrence_check" CHECK (("kind" = 'NEW' AND "occurrenceKey" = 'publication') OR ("kind" = 'EXPIRING' AND "occurrenceKey" ~ '^expiration:[0-9]+$'));
