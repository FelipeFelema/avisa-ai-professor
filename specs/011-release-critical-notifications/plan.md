# Implementation Plan: Release Critical Notifications

**Branch**: `011-release-critical-notifications` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: P0 implementation authorized on 2026-10-06 after deadline review; P1 authorized on 2026-10-07. Base: `416256032a645e7335229a42bb2a825d174c85c0`, develop with merged Spec 010.

## Summary

P0 adds durable new-announcement notifications to existing classroom members with eligible Spec 010 registrations, excluding the author. A nullable recovery marker is saved with the announcement itself. Separate fanout materializes one event and one dispatch per candidate installation; failures in that processing cannot roll back the announcement. A database worker recovers pending markers and dispatches, revalidates authorization and binding, and persists an irreversible send boundary before using the existing authenticated Expo adapter.

The mobile reuses PushProvider, notifications SDK, consent and existing Android channel. A typed notification payload leads to an authenticated fresh detail query, with cache/session isolation and cold-start handling. P1 adds an independently toggled reminder selector, now included in the authorized full delivery.

## Technical Context

**Language/Version**: TypeScript; backend Node.js 22+, NestJS 11; mobile React Native 0.86 / Expo SDK 57.

**Primary Dependencies**: Existing Prisma 7/PostgreSQL, NestJS modules, Expo Notifications, Expo Router, TanStack Query and Zod. No planned new dependency, Redis, Bull, external broker or second push SDK. Live Doctor on 2026-10-07 passed 21/21 after a network-enabled retry; this run does not change dependencies.

**Storage**: PostgreSQL: additive nullable marker on Announcement, new event/dispatch ledger. Existing PushInstallation/PushRegistration/AuthSession remain the source of identity and eligibility. Mobile dedupe and pending destination are bounded in memory; SDK last-response consumption prevents ordinary cold-start replay.

**Testing**: Backend Jest unit, guarded integration/concurrency/contract/E2E; mobile official Jest harness, provider/navigation/cache regression tests, typecheck/lint/format/Doctor/export. All destructive database tests use exactly local `avisa_ai_test`; mock external transport. Owner walkthrough is separate from assertions.

**Target Platform**: Existing API plus Android preview walkthrough; preserve native-safe/web guards. No specialized native/device/accessibility campaign.

**Project Type**: Mobile + API within existing modules.

**Performance Goals**: Healthy publication notification submission within two minutes in controlled scenarios. Worker tick 30 s; up to 20 pending announcements and 100 dispatches per tick, maximum two concurrent HTTP sends. HTTP timeout 5 s; send lease 15 s, pre-send claim lease 60 s. Bounded work and no HTTP inside database transactions. The two-minute target is not an external delivery SLA or an unmeasured production-load claim.

**Constraints**: No token/capability/content logging; no automatic resend after SENDING/UNKNOWN; no changes to test cooldown/global rate limits; no runtime/dependency/build changes during this planning turn. Full 011 implementation authorized; runtime credentials/deployment and physical/CI evidence remain separate.

**Scale/Scope**: One NEW event per announcement; one EXPIRING event per current expiry value; one candidate dispatch per event/installation. P0 supports all current eligible classroom members and several installations per member. P1 may remain disabled without blocking P0. Candidate fanout is atomic for the current classroom, not an invented membership cap; load-test deterministic larger fixtures before changing pagination semantics.

## Constitution Check

Pre-research and post-design assessment: **PASS for planning**, not evidence of implemented quality gates.

| Principle / gate            | Design evidence                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Domain boundaries        | Announcements persists its marker; push owns fanout/dispatch/receipts. Explicit module integration, no provider call in controller. Existing mobile provider/service/route layers retained.                        |
| II. Security / contracts    | Membership and session eligibility checked server-side; fresh detail GET uses existing 404 semantics. Closed minimal payload; no client recipient selection.                                                       |
| III. Tests / gates          | FR-015 and tasks require unit/integration/concurrency/contract/navigation regressions plus existing local/remote gates; observed local results are in final-validation.md; owner walkthrough/final copy are PASS (user-reported); T060 closed and final remote CI evidence remains open. |
| IV. Safe evolution          | Reviewed additive migration, legacy markers null, constraints and cascades tested in isolated database. Recovery disables business dispatch while retaining schema/ledger.                                         |
| V. UX / basic semantics     | Existing Portuguese loading/error/not-found/login feedback, no automatic permission prompts or navigation on mere receipt. Preserve themes/labels.                                                                 |
| Individual validation scope | Owner may be sole walkthrough executor; `PASS (user-reported)` only for actual reports. Specialized campaigns and participant studies are DISPENSADA POR ESCOPO, with no execution tasks.                          |
| Delivery dependencies       | P0 implemented on the stacked branch after owner review; 010 is merged into develop; 011 owner walkthrough is PASS (user-reported), T060 closed by owner acceptance and actual CI remains open; current 010 T073/T074 are checked and untouched.                             |

No constitution violation identified; no complexity waiver requested. Decisions and alternatives: [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/011-release-critical-notifications/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/announcement-notifications.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
backend/prisma/schema.prisma
backend/prisma/migrations/20261006190000_release_critical_notifications/migration.sql
backend/src/announcements/announcements.service.ts
backend/src/announcements/announcements.module.ts
backend/src/push/
  announcement-push.config.ts
  announcement-push.service.ts
  announcement-push.worker.ts
  announcement-reminders.worker.ts          # P1, independently toggled
  push-registration.service.ts
  expo-push.adapter.ts
  push-receipts.worker.ts
  push.module.ts
backend/test/announcement-push-*.integration.spec.ts
backend/test/announcement-push.e2e-spec.ts
mobile/src/providers/PushProvider.tsx
mobile/src/services/push/announcement-push-presentation.ts
mobile/src/services/push/announcement-push-navigation.ts
mobile/src/services/announcements/announcement.service.ts
mobile/src/hooks/useAnnouncement.ts
mobile/app/(app)/announcements/[id].tsx
mobile/tests/services/announcement-push-*.spec.ts
mobile/tests/providers/announcement-push-provider.spec.tsx
mobile/tests/routes/announcement-push-detail.spec.tsx
```

**Structure Decision**: Extend the existing push domain; no new identity registry. Test attempts remain separate from business dispatches so test cooldown/lease semantics are unchanged. New tables store event/submission history, not another installation/token system.

## Phase 0 — Research conclusions

Local inspection found: current Announcement.create only saves the resource; UserClassroom has no membership history; adapter sends only push-test; receipts worker reads only PushTestAttempt; Android consent creates channel `push-test` named “Notificações”; detail query has a five-minute default staleTime. A tap that merely routes can display obsolete cached content. These findings determine recovery-marker, audience timing, typed transport extension and fresh authorization design.

Expo does not guarantee exactly-once device delivery. Receipt success means handoff, not display. Our stricter no-resubmit policy deliberately accepts possible missed notifications after an ambiguous crash rather than risking duplicate submissions. See [Expo delivery documentation](https://docs.expo.dev/push-notifications/sending-notifications/#delivery-guarantees).

## Phase 1 — Design

### Publication and durable fanout

1. `ANNOUNCEMENT_PUSH_ENABLED` is a backend-only boolean, default false. When enabled, new Announcement.create saves `notificationPending=true` in its own existing resource write. Disabled/legacy creation has null; no migration backfill. Existing request/response DTOs never expose or accept this internal field.
2. Return the normal 201 after saving. Optional post-commit wakeup is best effort and cannot change that response. Persistent scanner is the recovery path; no second mandatory DB write/enqueue or external request on publication.
3. Preselect candidate bindings by ordinary reads. In a separate transaction, lock all preselected recipient User rows in lexicographic order before Classroom, then their AuthSessions and installations/registrations in sorted order, then Announcement/membership. Revalidate only that preselected set; exclude disappeared/ineligible/changed bindings without adding new users after locks. Create/upsert unique NEW event, snapshot the surviving candidates, insert unique dispatches and set marker false atomically. A failure rolls back only fanout; marker remains true for recovery. Empty audience also creates a materialized event, preventing later new members from replaying it. These parent locks include those taken implicitly by dispatch foreign-key checks; plain snapshot reads alone are insufficient.
4. Invalid/expired pending announcements are marked false without a send. Deleted resources disappear by cascade. Events are never materialized again; eligibility later improves only for future events. No replay of legacy null markers.

### Send authorization, concurrency and outcomes

Claim PENDING→CLAIMED with CAS, monotonic claimVersion and lease; never hold a dispatch lock while waiting for domain locks. Within the final transaction, take recipient User → Classroom → AuthSession → installation/registrations → Announcement and matching UserClassroom → dispatch, then compare the claim version and original binding. Reuse 010 eligibility/locking primitives through a narrowly scoped server-internal method; never fabricate installation capabilities or reverse the existing User/session/installation order. Classroom is acquired before installation locks to avoid cycles with account deletion (User→owned Classroom→relationship/session deletion). Fanout takes every referenced User parent first, then Classroom and the remaining parents; it never discovers/adds a new recipient after those locks. Tests must prove fanout and final authorization against leave/account/classroom deletion, including a classroom owner who receives a notice authored by another professor.

Check announcement exists and `expiresAt > now`, current membership, non-author, original user/session/registration/lifecycleVersion/tokenRevision/fingerprint, and `isPushRegistrationEligible`. Rotation or reassociation cancels that candidate; do not retarget. Use shared locks on the authorization rows where needed so concurrent removal either precedes authorization or follows it. Commit SENDING before HTTP; this commit is the authorization/submission boundary. No provider call in transaction; mutations after that boundary cannot retract a submitted message.

PENDING/CLAIMED before SENDING may safely recover. Once SENDING is committed, crash, timeout, uncertain response or failed persistence of a ticket becomes UNKNOWN; never return to PENDING. Accepted submits consult receipts only. Known rejection is terminal in the minimal P0, including 429, preventing resend ambiguity; test cooldown and request rate limits remain unchanged. This conservative P0 trades occasional non-delivery for no automatic duplicates.

### Shared transport and receipts

Add a typed business-send entry point to ExpoPushAdapter while preserving `send(expoToken, attemptId)` for tests. Both use the same credentials, bounded request/parser, safe error allowlist and receipts API. Business payload uses existing Android `push-test` channel (already generically named), no new native dependency/config. TTL is `min(3600, floor(seconds remaining))`, and no send when TTL <1. Recheck expiry at authorization. Provider delay cannot guarantee no arrival after expiry; tap always fetches current access.

Extend the existing receipts worker with a business-ledger path, sharing batching/backoff/shutdown rather than creating another transport. Business first receipt check after 15 min, deadline 24 h; existing 010 test timing remains intact. Any business outcome/receipt/cleanup operation that touches both binding and ledger uses the same User→Classroom→session→installation/registration→Announcement/dispatch order; do not use capability-only installation→registration→dispatch locking for that path. Ledger-only outcome/lease/deadline CAS may be independent, provided it never acquires parent locks afterward. Invalidation from DeviceNotRegistered requires the exact registration/revision/fingerprint; late receipt cannot invalidate a replacement token. Missing cascaded parents/dispatches end processing safely without retrying send. Receipt detail may be pruned after seven days, but event materialization and dispatch uniqueness tombstones must remain while the announcement is active; cascade after resource deletion is safe and no fanout repeats.

### Mobile presentation and authorized tap

Typed parser admits only version-1 `announcement-created` (and optional `announcement-expiring`) with UUID v4 `announcementId` and `dispatchId`; no arbitrary route/URL. Keep push-test parsing/presentation unchanged. Foreground handler shows known business types with the permitted contextual title/body without automatic navigation; dedupe reception and tap independently using bounded 128-entry sets.

PushProvider handles live responses and the SDK's last response for cold start, then clears the consumed native response. Wait for restored auth/router readiness; pending intent is memory-only with five-minute TTL. Logged-in intents bind to userId and session generation; logout/account change clears them. An initial anonymous cold-start intent may be adopted once by the first authenticated session, with a fresh authorized query; no subsequent identity may inherit it.

Before navigating/displaying content, remove obsolete detail cache, perform fresh `findOne` with captured session generation and retry disabled for this tap, and check generation again. On 200 seed current-session cache and open the existing detail; on 404 clear protected content and show the existing unavailable state; on transient failure show retry/cancel without old content. Also protect an already-mounted detail with a fresh-fetch gate for notification navigation. Duplicate callbacks do not rerun the same intent. No new effects wired to reconciliation outputs; preserve the `/push/` connectivity-loop exclusion and all 010 flows.

### P1 expiration reminders

`ANNOUNCEMENT_PUSH_REMINDERS_ENABLED` defaults false, backend only, and requires business push enabled. Scheduler tick 60 s selects active, marked-011 announcements with `createdAt <= expiresAt - 24h` and `now >= expiresAt - 24h`. Materialize one EXPIRING event keyed by the current expiresAt milliseconds; atomic fanout snapshots current eligible members (same author exclusion). Re-read current expiry under lock. No event yet: a changed expiresAt recalculates due time. Same expiration event already materialized: never recreate or change candidates. A changed expiry has its own event; final authorization suppresses dispatches whose occurrenceKey no longer matches current expiresAt. Restart may catch up while active, never after expiry. Mandatory P0 tasks/gates do not depend on this worker or flag being true.

### Migration, recovery and acceptance

Reviewed P0 additive migration plus minimal P1 occurrenceKey migration; no deletion of existing ledger rows. Review full SQL before running against any real environment. Verify preservation/cascades/uniques on `avisa_ai_test`; never substitute the real walkthrough DB for a test database. Kill switch disables business send/selection, preserves tables and 010 neutral tests; pending sends may resume only if still active and unsent. An SENDING/UNKNOWN dispatch is never replayed by rollback/redeploy. Older backend sees nullable columns/new tables safely.

Acceptance matrix is in [quickstart.md](quickstart.md) and [tasks.md](tasks.md). Mandatory release = foundation validated + US1 + US2 + P0 security/concurrency/gates/walkthrough. US3 is included in full delivery. Default false is an operational flag, not implementation deferral. Owner authorization on 2026-10-07 permits all remaining 011 code, documentation and local gates including build/export. No commit, push, PR, runtime deployment or credential change is authorized.

## Final notification product adjustments — 2026-10-07

Owner reported P0/P1 walkthrough and final notification copy PASS (user-reported); T060 closed by explicit owner authorization. Production hiding accepted from automated/configuration tests; production-artifact smoke is reserved for final release. Final authorization reads only current classroom name/title into the in-memory send snapshot (existing parent/resource locks). Adapter formats the requested contextual copy, normalizes whitespace, bounds name/title to 80/120 and uses safe missing/blank fallbacks. No schema/migration, REST contract, four-field data payload, recipient eligibility, idempotence, consent or logout change. Full body and personal data stay excluded; logs stay generic. Refresh adapter/worker/service/privacy coverage and existing gates.

Mobile hides diagnostic test action/feedback unless development or an explicit EAS preview/development profile sets extra.pushDiagnosticsEnabled=true. Production/absent/unknown profiles overwrite inherited values with false. Infrastructure/endpoint is preserved. Only app configuration/JS changes; current preview embeds its previous bundle, and no expo-updates dependency/configuration exists. Validate new text after backend deployment/restart with the installed app; validate new visual gate with a fresh app artifact (preview keeps action, production hides it). No build/deploy is performed here.

Future Spec 012: contextual first-use onboarding with explicit CTA before native prompt; study preference persistence per user/device with safe logout revocation and no cross-account inheritance. Register only; preserve current lifecycle in 011.

Approved final commit groups and actual focused execution are recorded in commit-plan.md. After commits, owner requests push of the feature branch and PR targeting develop, followed by Backend CI, Mobile CI and Commit Conventions on the final PR revision. T061 stays open until actual results are consolidated; a documentary closure commit must itself receive final-revision checks. No Spec 012 execution.
