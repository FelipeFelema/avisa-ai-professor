# Research: Release Critical Notifications

**Date**: 2026-10-06. Repository inspection plus bounded read-only research delegation required by `speckit-plan`. Decisions are proposed for owner review; no implementation.

## Publication recovery without coupling to enqueue

**Decision**: nullable `Announcement.notificationPending` saved in the same resource write; post-commit scanner creates event/dispatches separately.

**Rationale**: current `AnnouncementsService.create` returns Prisma's saved resource. Putting a separate outbox insert in its required transaction would roll it back on enqueue failure. An optional wakeup alone loses notifications on crash. The inline marker survives both without an additional critical enqueue dependency. No historical markers are backfilled.

**Alternatives considered**: synchronous Expo send (latency/failure coupling); fire-and-forget only (not restart-safe); transactional separate outbox required to publish (enqueue failure violates FR-005); database trigger/event broker (extra coupling/infrastructure); createdAt scan with activation watermark (more policy/cursor state than a nullable marker).

## Audience timing and eligibility

**Decision**: snapshot candidates once at first durable fanout, exclude author, then recheck same binding/membership at final authorization.

**Rationale**: UserClassroom stores composite identity only, no joinedAt/history. Exact publication-time audience after a failed enqueue cannot be reconstructed. The chosen timing is explicit in spec assumptions. Unique `(eventId, installationId)` persists despite tokenRevision changes; another revision/account cannot create another dispatch for that event.

**Alternatives considered**: publication-time snapshot (extra critical write); send to anyone currently in classroom on every retry (late-member replay); uniqueness by token revision/registration (duplicates across account/token changes).

## External submission boundary

**Decision**: commit SENDING before HTTP; ambiguous outcomes become UNKNOWN, never resend. Before SENDING, lease/CAS recovery is safe. Rejections are terminal for minimal P0. Accepted outcomes resume receipt reads only.

**Rationale**: external HTTP and local commit are not one atomic transaction. A crash after accepted send but before recording it cannot safely retry. This mirrors 010's conservative uncertain-result policy, with event/installation idempotence added.

**Alternatives considered**: retry all timeouts or reclaim SENDING as pending (duplicate risk); claim exactly-once device delivery (unsupported); Redis queue (does not solve the external ambiguity).

Expo allows possible duplicate downstream delivery, and receipt success confirms provider handoff rather than display. It recommends checking receipts after 15 minutes; they expire after 24 hours. Business receipts follow this guidance while preserving existing test timing. [Official sending documentation](https://docs.expo.dev/push-notifications/sending-notifications/).

## Shared transport and safe locks

**Decision**: extend existing ExpoPushAdapter and PushReceiptsWorker; use current eligibility predicate and ordered locking with Classroom before installation in the business authorization wrapper.

**Rationale**: adapter currently sends only neutral tests; worker queries only PushTestAttempt. Business ledger is separate from test cooldown. Account deletion locks User then owned Classroom before relationship/session deletes. Dispatch INSERT implicitly locks User parents for FK checks; fanout holding Classroom before these Users can deadlock when the classroom owner is a recipient of another professor's notice. Preselect bindings, acquire all recipient Users first, then Classroom and other parents, and revalidate without adding candidates. Receipts combining registration and dispatch also require the business order: installation→registration→dispatch can conflict with account deletion's announcement/dispatch-before-session cascade. Ledger-only CAS is safe if it never acquires parents afterward. New tests cover fanout, outcomes and receipts against deletion, including owner≠author. Never synthesize private installation proof.

**Alternatives considered**: use PushTestService for business sends (wrong cooldown/audience semantics); new tokens/SDK/independent receipts transport (duplication); unguarded predicate-only selection (TOCTOU on binding/membership).

Review of the proposed design found and corrected both lock inversions before implementation. FK checks acquire KEY SHARE on referenced parents, which conflicts with FOR UPDATE; ordinary reads do not eliminate that implicit acquisition. Sources: [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html), [official FK trigger implementation](https://github.com/postgres/postgres/blob/master/src/backend/utils/adt/ri_triggers.c).

## Tap and stale cache

**Decision**: fresh normal detail GET with session generation and cache suppression; reuse existing Portuguese detail/404 states. Handle live and last native response; clear consumed response and separate bounded receive/tap dedupe.

**Rationale**: `useAnnouncement` inherits five-minute staleTime from query-client. Routing alone may expose cached content after access removal. Existing `findOne` already captures session generation; detail backend already filters membership/expiry and returns 404. Installed SDK declarations expose getLastNotificationResponseAsync/clearLastNotificationResponseAsync. Android consent already creates `push-test`, named “Notificações”; reuse it for generic business display.

**Alternatives considered**: trust announcementId/title in push (authorization/privacy failure); route directly without query (stale cache); persist pending destination across identities (cross-account intent); add a native channel/dependency during planning (unnecessary).

## Expiration reminder

**Decision**: one EXPIRING event per announcement/current expiry value, flag default false, clock-driven selector and shared pipeline. Current expiresAt determines a not-yet-created event; an event for the same expiry value is never recreated.

**Rationale**: unique kind/event and persisted dispatch keys survive restarts. Cancellation/recheck guards expired/deleted resources. Keeping P1 as a non-blocking increment makes P0 release independently verifiable.

**Alternatives considered**: in-memory per-announcement timers (lost on restart); separate reminder token system; mandatory scheduler before P0 release (violates priority fence).

## Evidence boundaries

Historical 2026-10-06 planning checkpoint: 010 T073/T074 and Doctor were open then. Current evidence, including 21/21 Doctor on 2026-10-07, is in final-validation.md. No unresolved technical clarification remains for planning; audience timing, author omission, conservative send policy and optional reminder timing are visible assumptions for owner review.

## P1 authorization update — 2026-10-07

Owner requested complete P1. Add occurrenceKey to the existing event ledger and replace event uniqueness with (announcementId, kind, occurrenceKey); NEW keeps publication, EXPIRING uses current expiry milliseconds. Reuse ordered fanout and final authorization. A stale expiry dispatch is suppressed; returning to a previously used expiry does not recreate its tombstone. SENDING remains irreversible, including timeout/restart. PostgreSQL selector excludes already materialized current occurrences before LIMIT to avoid starvation. No new queue, token registry, adapter or dependency.
