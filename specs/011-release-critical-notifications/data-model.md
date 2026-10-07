# Data Model: Release Critical Notifications

Implemented P0 design, extended for authorized P1 on 2026-10-07. Existing Announcement/UserClassroom/PushInstallation/PushRegistration/AuthSession remain authoritative.

## Announcement — one internal field

| Field               | Literal constraint                                        | Meaning                                                                                                                                  |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| notificationPending | `nullable boolean; default null; legacy rows remain null` | null = legacy/business notifications disabled at publication; true = new-publication fanout pending; false = materialized or suppressed. |

New create sets true only when `ANNOUNCEMENT_PUSH_ENABLED=true`. Same resource write; never accept/expose field in public DTOs. No standalone required enqueue transaction. Fanout transaction commits candidates/event and false together; on failure remains true. Marker may never be reset from false to true by retry, cleanup, edit or redeploy. Index `(notificationPending, createdAt, id)` for bounded pending scans. Existing API fields and authorization unchanged.

## AnnouncementPushEvent

| Field          | Literal constraint                                     | Meaning                                                |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| id             | `UUID v4; primary key`                                 | Durable event identity.                                |
| announcementId | `required TEXT; FK Announcement.id; onDelete Cascade`  | Existing Announcement id is TEXT, not PostgreSQL UUID. |
| kind           | `enum NEW or EXPIRING; required`                       | NEW is P0; EXPIRING implemented for P1.                |
| snapshotAt     | `required timestamptz; fixed on first materialization` | Audience selection time; never refanout.               |
| createdAt      | `required timestamptz; default now`                    | Operational timestamp.                                 |

**Uniqueness**: `unique (announcementId, kind, occurrenceKey)`. Added occurrenceKey is `publication` for NEW and `expiration:<expiresAt milliseconds>` for EXPIRING; retain these tombstones. A minimal follow-up migration preserves the P0 ledger and replaces only its event uniqueness index.

Insert/upsert and all candidate dispatch rows belong to one fanout transaction. Preselection is read-only; lock all referenced recipient Users in sorted order before Classroom, then sorted sessions/installations/registrations and Announcement/membership; revalidate only that set before inserts. Foreign-key checks also acquire parent locks, so do not add new recipients after the ordered lock acquisition. An existing event means its snapshot is complete, including an empty audience. No HTTP in this transaction. The event is the durable tombstone against rematerialization; retain while its Announcement exists. Deleting parent cascades the event and dispatches. Recreating a different announcement generates a different event; do not recycle IDs.

## AnnouncementPushDispatch

| Field                                                      | Literal constraint                                                                                             | Meaning                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| id                                                         | `UUID v4; primary key`                                                                                         | Public payload dispatchId; not an authorization capability. |
| eventId                                                    | `required UUID; FK AnnouncementPushEvent.id; onDelete Cascade`                                                 | Parent event.                                               |
| installationId                                             | `required UUID; FK PushInstallation.id; onDelete Cascade`                                                      | Existing installation, no duplicate installation model.     |
| registrationId                                             | `required UUID; FK PushRegistration.id; onDelete Cascade`                                                      | Original eligible binding.                                  |
| userId                                                     | `required TEXT; FK User.id; onDelete Cascade`                                                                  | Original recipient account.                                 |
| sessionId                                                  | `required TEXT; FK AuthSession.id; onDelete Cascade`                                                           | Original session.                                           |
| lifecycleVersion                                           | `integer >= 0; fixed binding snapshot`                                                                         | Must equal current installation/registration before send.   |
| tokenRevision                                              | `integer > 0; fixed binding snapshot`                                                                          | Rotation does not create another dispatch.                  |
| tokenFingerprint                                           | `required CHAR(64); fixed fingerprint; never raw token`                                                        | Private operational fingerprint; never public/logged.       |
| state                                                      | `enum PENDING, CLAIMED, SENDING, ACCEPTED, PROVIDER_HANDOFF, REJECTED, UNKNOWN or SUPPRESSED; default PENDING` | State machine below.                                        |
| claimVersion                                               | `integer >= 0; default 0; increments on every successful claim`                                                | CAS fencing; every write after claim compares version.      |
| leaseUntil                                                 | `nullable timestamptz; pre-send lease 60 seconds`                                                              | Expired CLAIMED may be reclaimed; SENDING never is.         |
| sendStartedAt                                              | `nullable timestamptz; written before HTTP; immutable after SENDING`                                           | External-send boundary; stale SENDING after 15 s → UNKNOWN. |
| providerTicketId                                           | `nullable VARCHAR(256); private; allowlisted format`                                                           | Receipt lookup, never API/payload/logging.                  |
| failureCode                                                | `nullable VARCHAR(64); safe internal allowlist only`                                                           | No external error body, token, URL or private identifiers.  |
| acceptedAt / completedAt                                   | `nullable timestamptz`                                                                                         | Separate acceptance and terminal completion.                |
| nextReceiptCheckAt / receiptDeadlineAt / receiptLeaseUntil | `nullable timestamptz; initial receipt check 15 minutes; deadline 24 hours; receipt lease 60 seconds`          | Read-only receipt retries after acceptance.                 |
| receiptChecks                                              | `integer >= 0; default 0`                                                                                      | Receipt backoff counter, no send retry counter.             |
| createdAt / updatedAt                                      | `required timestamptz; default now; updatedAt changes on write`                                                | Operational progress.                                       |

**Uniqueness**: `unique (eventId, installationId)`; registrationId/tokenRevision are NOT part of the idempotence key. Index `(state, leaseUntil)`, `(state, createdAt)` and `(state, nextReceiptCheckAt)` for bounded recovery/receipts; index recipient/session/registration references for deletion.

Database CHECK constraints enforce nonnegative versions/counters, positive tokenRevision, required sendStartedAt for SENDING/ACCEPTED/PROVIDER_HANDOFF/UNKNOWN and receipt metadata consistency for ACCEPTED. Integrity checks must permit deletion races (zero rows updated = no retry) and SUPPRESSED before HTTP. Additive migration review includes FK types and cascades, not only Prisma-generated SQL.

### State transitions

```text
PENDING -> CLAIMED -- valid final authorization/CAS --> SENDING
              |                                       |
              | expiry/binding/access invalid          | ticket ok -> ACCEPTED
              +-> SUPPRESSED                          | known reject -> REJECTED
              |                                       + ambiguous/crash -> UNKNOWN
              + lease expiry -> CLAIMED (new version)
ACCEPTED -> PROVIDER_HANDOFF | REJECTED | UNKNOWN (receipt deadline)
```

- No transition from SENDING, ACCEPTED, UNKNOWN, REJECTED or a terminal state back to PENDING/CLAIMED. This preserves at-most-one automatic submission across restart and code rollback.
- Crash after SENDING but before actual HTTP may miss an alert; do not pretend this can be distinguished from crash after accepted HTTP. No automatic resend.
- Reclaim invalidates earlier claimVersion. A stale claimant cannot transition to SENDING or publish a result. Receipt claims also use lease/CAS; receipts never call send.
- All final send authorization validates the original recipient/session/registration/revision/fingerprint plus current membership, unexpired Announcement and shared `isPushRegistrationEligible`.
- DeviceNotRegistered invalidates only the same current revision/fingerprint using shared 010 primitives in the ordered business wrapper. A late outcome never affects another account/replacement token.
- Business transactions combining binding and dispatch follow User→Classroom→session→installation/registration→Announcement/dispatch for receipt finalization as well as send authorization. Existing capability-only 010 locks are not suitable for combining the business ledger with binding mutations. A ledger-only CAS releases its lock before any subsequent parent operation.

## P1 reminder semantics — independently toggled

No per-announcement in-memory timer. One EXPIRING event per expiry value is the reminder guard. Eligible resource must have non-null notificationPending (created under 011), `createdAt <= expiresAt - 24h`, and `now >= expiresAt - 24h` while `expiresAt > now`. Query current expiresAt each tick; no event yet means an edit may move its due time. Existing event for the same value means no second reminder. After edit, pending sends from the previous expiry are suppressed at final authorization; only current expiresAt can materialize a reminder. Snapshot recipients at reminder materialization, not reuse NEW recipients.

Default `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false`; P0 never depends on scheduler completion. NEW/EXPIRING share the same dispatch uniqueness and no-resend states.

## Deletion, cleanup and privacy

- Account/session/registration/installation deletion cascades their dispatch rows; remaining events do not refanout. Account-deletion tests prove isolation and no retained private recipient linkage.
- Announcement/classroom deletion cascades all related events/dispatches; in-flight HTTP may already have been authorized, so payload remains generic and tap authorization always applies.
- Receipt details may be redacted after seven days. Do not delete active-announcement event/dispatch uniqueness tombstones for ordinary cleanup. For an expired resource, prune dispatch detail only while retaining the event and false marker so no late replay occurs.
- No raw Expo token or capability is duplicated into the ledger. Read current token privately only after final authorization. Public announcement serializers explicitly select existing fields so marker/ledger cannot leak.
- Recovery disables business flags and preserves added tables/markers. Legacy records stay null; no bulk catch-up of old announcements or destructive rollback.

The public Announcement schema still requires expiresAt and create/update use durationInDays. Reminder selection defensively rejects null/invalid expiry (unit coverage); this feature does not add a new no-expiration API mode.
