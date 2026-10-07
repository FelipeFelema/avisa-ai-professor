# Tasks: Release Critical Notifications

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contract](contracts/announcement-notifications.md), [quickstart.md](quickstart.md).

**Status**: Full Spec 011 implemented and locally validated on 2026-10-07, including T046–T053. 59/61 tasks checked; T060/T061 remain open only for physical walkthrough and actual final-revision CI evidence. Existing completed tasks preserved. Real-local runtime preparation authorized and recorded in walkthrough-preparation-2026-10-07.md; no physical report or final-revision remote CI yet. Base develop `416256032a645e7335229a42bb2a825d174c85c0`, with merged Spec 010. Owner authorized three local commit groups on 2026-10-07; this does not close T060/T061. Physical walkthrough PENDING; final-revision remote CI NOT RUN. No Spec 012, push or PR.

**Tests**: Required by FR-015 and constitution; write relevant failing tests before implementing behavior. External transport is mocked. Destructive fixtures/migrations use exactly local `avisa_ai_test` with existing guards.

**Format**: `- [ ] Tnnn [P?] [USn?] Description with exact paths`. `[P]` means independent files within the stated prerequisite phase, not permission to implement before review. P0 = US1 + US2 + shared/P0 closure; US3 is authorized P1 in this full delivery; its runtime flag remains independent.

## Phase 1: Setup

- [x] T001 Record authorized implementation checkpoint, branch/base, 010 dependency status and existing gates in `specs/011-release-critical-notifications/final-validation.md`; do not claim T073/T074 complete or change their checkboxes.
- [x] T002 Review acceptance assumptions and freeze audience timing, no-resubmit boundary and P1 optional scope in `specs/011-release-critical-notifications/spec.md` and `specs/011-release-critical-notifications/plan.md` after owner approval; preserve WIP and do not implement deferred P1 implicitly.
- [x] T003 Prepare synthetic multi-classroom/binding fixtures in `backend/test/helpers/announcement-push.fixture.ts`, using exact `localhost/avisa_ai_test` guards, provider mocks and no real secrets; preserve `backend/test/helpers/test-database.helper.ts` protections.

## Phase 2: Foundational — shared P0 prerequisites

**Purpose**: Additive persistence, private configuration and ordered authorization. No business submission before the foundation tests and reviewed migration pass.

- [x] T004 [P] Write constraints/legacy-data/cascade tests in `backend/test/announcement-push-migration.integration.spec.ts`: old rows null, unique event/installation, CHECK failures, no second token registry and deletion isolation in local `avisa_ai_test`.
- [x] T005 [P] Write config tests in `backend/src/push/announcement-push.config.spec.ts`: booleans default false, strict parsing, business unavailable if 010 transport unavailable, P1 off independently, and no secret values in diagnostics.
- [x] T006 Add internal `Announcement.notificationPending` in `backend/prisma/schema.prisma`: "nullable boolean; default null; legacy rows remain null" and index `(notificationPending, createdAt, id)`; retain existing public DTO and expiry semantics.
- [x] T007 Add AnnouncementPushEvent in `backend/prisma/schema.prisma`: id "UUID v4; primary key"; announcementId "required TEXT; FK Announcement.id; onDelete Cascade"; kind "enum NEW or EXPIRING; required"; snapshotAt "required timestamptz; fixed on first materialization"; createdAt "required timestamptz; default now"; "unique (announcementId, kind)" in the original P0 checkpoint; T048 now adds occurrenceKey and its replacement unique index for authorized P1.
- [x] T008 Add dispatch identity/binding fields in `backend/prisma/schema.prisma`: id "UUID v4; primary key"; eventId "required UUID; FK AnnouncementPushEvent.id; onDelete Cascade"; installationId "required UUID; FK PushInstallation.id; onDelete Cascade"; registrationId "required UUID; FK PushRegistration.id; onDelete Cascade"; userId "required TEXT; FK User.id; onDelete Cascade"; sessionId "required TEXT; FK AuthSession.id; onDelete Cascade"; lifecycleVersion "integer >= 0; fixed binding snapshot"; tokenRevision "integer > 0; fixed binding snapshot"; tokenFingerprint "required CHAR(64); fixed fingerprint; never raw token"; "unique (eventId, installationId)".
- [x] T009 Add dispatch execution fields in `backend/prisma/schema.prisma`: state "enum PENDING, CLAIMED, SENDING, ACCEPTED, PROVIDER_HANDOFF, REJECTED, UNKNOWN or SUPPRESSED; default PENDING"; claimVersion "integer >= 0; default 0; increments on every successful claim"; leaseUntil "nullable timestamptz; pre-send lease 60 seconds"; sendStartedAt "nullable timestamptz; written before HTTP; immutable after SENDING"; failureCode "nullable VARCHAR(64); safe internal allowlist only"; acceptedAt/completedAt "nullable timestamptz"; indexes `(state, leaseUntil)` and `(state, createdAt)`.
- [x] T010 Add dispatch receipt/operational fields in `backend/prisma/schema.prisma`: providerTicketId "nullable VARCHAR(256); private; allowlisted format"; nextReceiptCheckAt/receiptDeadlineAt/receiptLeaseUntil "nullable timestamptz; initial receipt check 15 minutes; deadline 24 hours; receipt lease 60 seconds"; receiptChecks "integer >= 0; default 0"; createdAt/updatedAt "required timestamptz; default now; updatedAt changes on write"; receipt index `(state, nextReceiptCheckAt)` and recipient/session/registration deletion indexes.
- [x] T011 Generate/review additive SQL in `backend/prisma/migrations/20261006190000_release_critical_notifications/migration.sql` (planned reserved name): nullable marker, enums/tables/FKs/uniques and CHECKs from `specs/011-release-critical-notifications/data-model.md`; no backfill/drop/truncate; generate client and validate migration only on guarded local `avisa_ai_test` before proposing real deployment.
- [x] T012 Write ordered-authorization tests in `backend/src/push/announcement-push-locks.spec.ts` and `backend/test/announcement-push-locks.integration.spec.ts`: all selected Users→Classroom→AuthSessions→installations/registrations→Announcement/memberships→dispatch, implicit FK parent locks, original snapshots, no late candidate addition or capability fabrication; fanout versus account deletion with owner≠author.
- [x] T013 Extend server-internal eligibility/locking support narrowly in `backend/src/push/push-registration.service.ts`, reusing `isPushRegistrationEligible` and existing session/binding primitives; business wrapper takes Classroom before installation without changing the existing 010 lock order, proof guards or cleanup behavior.
- [x] T014 Implement business flags in `backend/src/push/announcement-push.config.ts` and placeholders in `backend/.env.example`: `ANNOUNCEMENT_PUSH_ENABLED=false`, `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false`, backend only; enabled business still requires authenticated available 010 transport, and P1 never gates P0.
- [x] T015 Register configuration only (business service/worker wiring waits for T029) through `backend/src/push/push.module.ts` and preserve guarded cleanup ordering in `backend/test/helpers/test-database.helper.ts`: dispatch→event before existing push/domain cleanup; export only necessary internal application service, never private values.

**Checkpoint**: T004/T005 can run in parallel after T003; T006–T010 share schema and are sequential. T011 validates their SQL; T012 precedes T013; T014 uses T005. T015 completes foundation and does not start reminder scheduling.

## Phase 3: User Story 1 — new-announcement notice (P0)

**Goal**: Persist publication independently, snapshot eligible classroom installations once and submit at most once per event/installation.

**Independent Test**: Mocked transport with A/B classrooms, author, empty audience and several installations; inject enqueue/HTTP/commit failure, race claims and restart at the external boundary.

### Tests

- [x] T016 [P] [US1] Extend `backend/src/announcements/announcements.service.spec.ts`: business-enabled create writes marker in same resource save; disabled create stays null; post-commit enqueue/wakeup failure returns normal saved announcement; edit never resets marker and authorization remains unchanged.
- [x] T017 [P] [US1] Add fanout/isolation fixtures in `backend/test/announcement-push-fanout.integration.spec.ts`: only A members/eligible registrations, no B/author, multiple installations, empty snapshot, late join/activation, original binding, fanout rollback and restart recovery.
- [x] T018 [P] [US1] Add submission/restart races in `backend/test/announcement-push-dispatch.integration.spec.ts`: competing fanout/claims, fencing, claim expiry, SENDING-before-HTTP crash, accepted HTTP then persistence failure and zero second submission after UNKNOWN.
- [x] T019 [P] [US1] Extend `backend/src/push/expo-push.adapter.spec.ts`: closed generic payload, shared authenticated request, TTL expiry, safe errors, known 429 terminal, ambiguous 5xx/timeout unknown and unchanged push-test send/cooldown behavior.
- [x] T020 [P] [US1] Add receipt/deletion/rotation tests in `backend/test/announcement-push-dispatch.integration.spec.ts`: shared worker restarts, accepted-only receipt reads, exact revision invalidation, cascade privacy, tombstones after cleanup and no automatic resend; receipt/binding finalization versus owner≠author account deletion under the full business lock order.
- [x] T021 [US1] Add API authorization/publication tests in `backend/test/announcement-push.e2e-spec.ts` and `backend/test/openapi.contract.spec.ts`: normal 201 on failed post-save processing, unchanged professor/membership/limit checks, extra recipient/marker fields rejected, no private ledger fields in DTOs.

### Implementation

- [x] T022 [US1] Integrate marker plus optional safe post-save wakeup in `backend/src/announcements/announcements.service.ts` and `backend/src/announcements/announcements.module.ts`; catch only notification-side wakeup errors, never conceal resource persistence failure, and never await provider HTTP to publish.
- [x] T023 [US1] Implement atomic event/fanout in `backend/src/push/announcement-push.service.ts`: read-only preselection, lock every referenced User in sorted order before Classroom→sorted sessions/installations/registrations→Announcement/membership, revalidate only that set, exclude author, event upsert/unique dispatch inserts and marker=false in one separate transaction; account for implicit FK locks, no late new recipient, failed/empty fanout semantics and no historical null replay.
- [x] T024 [US1] Implement final business authorization and fenced CLAIMED→SENDING in `backend/src/push/announcement-push.service.ts`: exact account/session/registration/revision/fingerprint, shared eligibility, unexpired Announcement and current membership under the approved lock order; suppress invalid binding rather than retarget/recreate.
- [x] T025 [US1] Extend `backend/src/push/expo-push.adapter.ts` with typed business-send input using the same authenticated transport; generic copy/closed payload/existing channel `push-test`, TTL min(3600, remaining seconds), safe codes and no submission retry; retain existing `send(expoToken, attemptId)` contract.
- [x] T026 [US1] Write worker timer/CAS/shutdown tests in `backend/src/push/announcement-push.worker.spec.ts`: tick30s, 20 pending announcements/100 dispatches, two sends concurrently, 60s claim lease, 15s SENDING timeout, stale claim version and crash recovery without replay.
- [x] T027 [US1] Implement marker reconciliation and bounded dispatch worker in `backend/src/push/announcement-push.worker.ts`: safe pre-SENDING recovery, commit SENDING before HTTP, terminal known rejects, UNKNOWN on uncertainty/failed accepted persistence, graceful abort/drain and no transport in DB transactions.
- [x] T028 [US1] Extend `backend/src/push/push-receipts.worker.ts` and its unit tests for business accepted dispatches using existing adapter/batching/backoff/shutdown; initial15min/deadline24h and exact-binding invalidation under full User→Classroom→session→installation/registration→Announcement/dispatch order; no capability-only binding→dispatch inversion, ledger-only CAS never takes parent locks afterward; preserve 010 timing/cooldown and uniqueness tombstones.
- [x] T029 [US1] Register business dispatch worker in `backend/src/push/push.module.ts` without registering optional reminder worker; business kill switch suppresses dispatch independently of neutral tests.
- [x] T030 [US1] Extend `backend/test/announcement-push-locks.integration.spec.ts` for leave/logout/revoke/rotation/reassociation/classroom/announcement/account deletion versus fanout/final authorization/outcome/receipts: both lock winners, owner≠author recipient case and implicit FK parents, no cross-account sends/deadlocks, no claim on retracting already authorized HTTP.
- [x] T031 [US1] Record US1 narrowed official-script test results, mocked submission counts and boundary limitations in `specs/011-release-critical-notifications/final-validation.md`; qualify assertions separately from receipts/device display and preserve open work.
- [x] T032 [US1] Verify 010 neutral-test/lifecycle/account-deletion regressions with `backend/src/push/push-test.service.spec.ts`, `backend/test/push-test.concurrency.integration.spec.ts`, `backend/test/push-lifecycle.concurrency.integration.spec.ts` and `backend/test/account-deletion.concurrency.integration.spec.ts`; record unchanged cooldown/single-flight/rate-limit safeguards.

**Checkpoint**: US1 complete independently of mobile tap/P1; required P0 release still also needs US2.

## Phase 4: User Story 2 — authorized tap and presentation (P0)

**Goal**: Show generic notice and open a fresh authorized detail without stale session/cache leaks.

**Independent Test**: Synthetic notification/SDK callbacks plus real provider/query/session layers; no need for actual US1 transport. Validate foreground, live/cold-start responses, cache+404 and account changes.

### Tests

- [x] T033 [P] [US2] Add closed-payload/dedupe tests in `mobile/tests/services/announcement-push-presentation.spec.ts`: version1, allowed discriminators, UUIDv4 IDs, unexpected URL/field rejection, receive/tap sets bounded128 and unknown types harmless.
- [x] T034 [P] [US2] Add intent/auth tests in `mobile/tests/services/announcement-push-navigation.spec.ts`: five-minute memory TTL, initial anonymous adoption once, identity/generation invalidation, fresh findOne with tap retry disabled, loading/error/retry/cancel and duplicate callback single-flight.
- [x] T035 [P] [US2] Add SDK/provider tests in `mobile/tests/providers/announcement-push-provider.spec.tsx`: foreground has no automatic navigation/prompt; live response plus last native response deduplicated/cleared; readiness waits and logout removes listeners/pending intent.
- [x] T036 [P] [US2] Add stale-cache/detail tests in `mobile/tests/routes/announcement-push-detail.spec.tsx`: populated old detail + 404/expiry/lost membership, same route already mounted, slow fetch then account change, 200 current result and existing Portuguese loading/error/unavailable states/themes.
- [x] T037 [US2] Extend current detail authorization tests in `backend/test/announcements.integration.spec.ts`: valid JWT but other turma/lost membership/expired/deleted resource remains normal404; arbitrary push IDs create no exception to existing authorization.

### Implementation

- [x] T038 [US2] Implement typed parser and separate bounded receive/tap dedupe in `mobile/src/services/push/announcement-push-presentation.ts` and `mobile/src/validations/announcement-push.schema.ts`: version1, `announcement-created`/optional `announcement-expiring`, UUIDv4 announcementId/dispatchId, closed fields; keep push-test contract unchanged.
- [x] T039 [US2] Implement memory-only guarded tap coordinator in `mobile/src/services/push/announcement-push-navigation.ts`: captured generation/user, one pending intent with TTL5min, anonymous initial adoption rule, cleanup on identity change, fresh authorized findOne before content/navigation and explicit transient-error retry/cancel.
- [x] T040 [US2] Integrate known business types into `mobile/src/providers/PushProvider.tsx`: generic foreground presentation, live response/last-response cold-start consume+clear, auth/router readiness, no effect feedback loop or permission prompt and preserve push-test listeners/rotation/reconciliation.
- [x] T041 [US2] Add notification fresh-fetch gate to `mobile/src/hooks/useAnnouncement.ts` and `mobile/app/(app)/announcements/[id].tsx`, using existing `mobile/src/services/announcements/announcement.service.ts` session guard: remove stale cache, no protected content before current200, 404 clears content, route already mounted also guarded; ordinary route contract preserved.
- [x] T042 [US2] Wire logout/account-change cancellation through `mobile/src/providers/AuthProvider.tsx` while retaining queryClient.clear/session-generation and 010 cleanup order; never persist notification destination or private push values in AsyncStorage.
- [x] T043 [US2] Verify current Android `push-test` channel labeled Notificações in `mobile/src/services/push/push-device.service.ts` and config fixtures; reuse it without new native config/dependencies, extra opt-in prompt or change to existing installation behavior.
- [x] T044 [US2] Run relevant official mobile tests including `mobile/tests/providers/PushProvider.spec.tsx`, `mobile/tests/providers/push-reconciliation-feedback.spec.tsx`, `mobile/tests/providers/AuthProvider.spec.tsx` and new US2 suites; confirm no dynamic-import regression, 429 feedback or test cooldown/navigation regression.
- [x] T045 [US2] Record US2 synthetic navigation/cache/session evidence and remaining individual walkthrough in `specs/011-release-critical-notifications/final-validation.md`; do not claim physical delivery from mocked callbacks.

**Checkpoint**: US1 + US2 form P0; proceed directly to Phase6 P0 closure when P1 is deferred.

## Phase 5: User Story 3 — expiration reminder (P1, authorized)

**Entry fence**: Owner explicitly authorized full P1 on 2026-10-07. All tasks of this phase are in the current authorized implementation scope. The runtime flag defaults false; never classify unexecuted evidence as PASS or transfer work to Spec012.

**Independent Test**: Fake clock and durable events/dispatches; one reminder per current expiresAt value, changed current expiry, concurrent ticks/restart and deletion/expiry suppression.

- [x] T046 [P] [US3] Write due-time/flag tests in `backend/src/push/announcement-reminders.worker.spec.ts`: tick60s, current expiry minus24h, no immediate reminder for short-lived new resources, flag false, edited due time and late catch-up only while active.
- [x] T047 [P] [US3] Write durable reminder scenarios in `backend/test/announcement-push-reminders.integration.spec.ts`: unique EXPIRING occurrence by expiresAt, at-most-one event/installation across race/restart/edit, revalidated memberships, deleted/expired suppression and P0 unaffected with P1 off.
- [x] T048 [US3] Add reminder event materialization to `backend/src/push/announcement-push.service.ts` using existing unique event/dispatch path, current member snapshot/author exclusion and original binding; add occurrenceKey and minimal additive migration; never regenerate an existing occurrence; suppress pending sends for a replaced expiresAt or copy NEW recipients.
- [x] T049 [US3] Implement clock-driven optional selector in `backend/src/push/announcement-reminders.worker.ts`: non-null 011 marker, createdAt <= expiresAt-24h, now >= due and expiresAt>now, current expiry lock/recheck, bounded tick and shutdown; no in-memory per-resource timers.
- [x] T050 [US3] Wire optional worker through `backend/src/push/push.module.ts` and `backend/src/push/announcement-push.config.ts`, inactive with default false; do not make new-publication dispatch wait for reminder selection.
- [x] T051 [US3] Extend payload/copy tests in `backend/src/push/expo-push.adapter.spec.ts` and `mobile/tests/services/announcement-push-presentation.spec.ts` for generic `announcement-expiring` through the same authorized detail and no-resubmit pipeline.
- [x] T052 [US3] Run P1 filtered integration/unit plus P0 regressions with P1 disabled, using `backend/test/announcement-push-reminders.integration.spec.ts` and `backend/test/announcement-push.e2e-spec.ts`; record no additional NEW dispatch or cooldown coupling.
- [x] T053 [US3] Record controlled-clock reminder timing/restart assertions and pending physical evidence in `specs/011-release-critical-notifications/final-validation.md` and `specs/011-release-critical-notifications/quickstart.md`; separate mocked automation from pending physical/CI evidence.

## Phase 6: Full 011 validation and closure

- [x] T054 [P] Add privacy sentinels/capture in `backend/test/announcement-push-privacy.integration.spec.ts` and `mobile/tests/services/announcement-push-privacy.spec.ts`: zero private tokens/capabilities/fingerprints/provider IDs, school content or account linkage in logs/responses/payloads; synthetic fixtures only.
- [x] T055 [P] Update `README.md`, `specs/011-release-critical-notifications/quickstart.md` and `specs/011-release-critical-notifications/contracts/announcement-notifications.md` for final booleans, audience timing, uncertain outcomes, additive recovery and optional P1; no credential values or unsolicited provisioning.
- [x] T056 Review actual additive SQL, canonical/runtime contracts, cleanup tombstones and domain regressions in `backend/prisma/migrations/20261006190000_release_critical_notifications/migration.sql`, `specs/001-app-quality-readiness/contracts/openapi.json` and `backend/test/openapi.contract.spec.ts`; show exact SQL/environment before any separately authorized real migration.
- [x] T057 Execute backend official gates from `backend/package.json` and `.github/workflows/backend-ci.yml` per quickstart: Prisma validate/generate/migrate only `avisa_ai_test`, format/lint/typecheck, coverage/integration/contract/E2E/build; mock sends and record actual exit/coverage/repeats in `specs/011-release-critical-notifications/final-validation.md`.
- [x] T058 Execute mobile gates from `mobile/package.json` and `.github/workflows/mobile-ci.yml`: typecheck/lint/format/test:ci/Doctor/export; preserve genuine third-party/CI failures and record results in `specs/011-release-critical-notifications/final-validation.md`; no automatic dependency upgrade/new EAS build to conceal a failed gate.
- [x] T059 Validate flags/recovery plus no-duplicate tombstones across disable/restart/redeploy in `backend/test/announcement-push-dispatch.integration.spec.ts` and regression suites; preserve 010 consent/test behavior, scopes and real-workthrough prerequisites in `specs/011-release-critical-notifications/final-validation.md`.
- [ ] T060 Record owner functional walkthrough P0/P1 in `specs/011-release-critical-notifications/final-validation.md` following `specs/011-release-critical-notifications/quickstart.md` after separate artifact/deployment authorization: normal open, publication, foreground/background if viable, tap current authorized detail, lost-access/account-change denial and 010 opt-out/test regression; mark only reported scenarios `PASS (user-reported)` and separate acceptance/handoff/display.
- [ ] T061 Consolidate P0/P1 FR-001–019 and SC-001–008, tests, migration/recovery, owner evidence and actual local/remote gates in `specs/011-release-critical-notifications/final-validation.md` and `specs/011-release-critical-notifications/tasks.md`; include implemented P1 and its validation, require validated 010 for release and do not claim unexecuted CI.

## Dependencies & Execution Order

```text
Owner review -> Setup T001–T003 -> Foundation T004–T015
                               -> US1 T016–T032 --+
                               -> US2 T033–T045 --+-> P0 closure T054–T061 -> MVP
                                                   |
                       owner authorization received ------+-> authorized US3 T046–T053
```

- US2 can be validated with synthetic events after shared contracts, independently of real US1 sending. Shared-file edits (PushModule, adapter, auth provider) must be serialized when integration overlaps.
- P0 release requires both US1 and US2 plus P0 closure and validated010. US1 alone is a backend increment, not the complete launch MVP.
- T054/T055 can proceed in parallel after US1/US2. T056 precedes final gates; T057/T058 are independent component runs. T059 and actual walkthrough T060 precede T061. For current full delivery, affected T057/T058 gates rerun after Phase5.
- P1 shares service/module files and is now authorized after the P0 checkpoint. Rerun affected P0 gates after integration; current full delivery includes P1.
- Planned migration directory is reserved for implementation; generate/inspect actual SQL rather than creating a fake migration during planning.

## Parallel Examples

- US1: T016 announcement unit tests, T017 fanout integration, T018 restart/concurrency, T019 adapter tests and T020 receipt integration can be authored in parallel after foundation; run DB suites serially unless fixtures isolate schemas. T021 shares existing contract suite and is serialized.
- US2: T033 parser tests, T034 intent tests, T035 provider tests and T036 detail/cache tests touch separate files and can be authored together; then serialize integrations T038–T042 with their prerequisites.
- US3: T046 fake-clock unit and T047 durable reminder integration are independent after safe P1 entry. T048–T050 share service/module/config and remain sequential.

## Implementation Strategy and Traceability

Owner authorized full 011 including P1 on 2026-10-07. Implement smallest P0 pipeline, validate US1 and US2 independently, then run P0 closure with P1 disabled. Pause on foundation/authorization/duplicate failures; do not expand to optional scheduler to avoid resolving P0 defects. Builds/deployment/publication remain separate owner actions.

| Requirements / outcomes        | Tasks                                                      |
| ------------------------------ | ---------------------------------------------------------- |
| FR-001/004/005/014; SC-002/005 | T006–T007, T016–T017, T021–T023, T026–T029                 |
| FR-002/003; SC-001             | T003, T008, T012–T013, T017, T024, T030                    |
| FR-006/007; SC-003             | T007–T011, T018, T023–T028, T059                           |
| FR-008/013; SC-006/008         | T014–T015, T019–T020, T025/T028/T032, T043–T044, T054–T059 |
| FR-009–012; SC-004/006         | T019/T025, T033–T045, T054, T060                           |
| FR-015; all P0 outcomes        | Test tasks, T031/T045 and T054–T061                        |
| FR-016–019; SC-007             | T046–T053; full 011 gates after P1 integration             |

61 tasks: Setup3, Foundation12, US1 17, US2 13, US3 8, closure8. Current authorized scope61;59 checked,2 evidence tasks open; historical P0 scope53. Only verified execution tasks are checked. Specialized campaigns/participants are DISPENSADA POR ESCOPO, with no execution checkbox and no release dependency.

### P1 execution dependencies (2026-10-07)

T046/T047 tests -> occurrenceKey schema/migration/client -> T048 shared materialization -> T049 selector -> T050 wiring -> T051 adapter/mobile contract -> T052 P1/P0 validation -> T053 evidence. Final T057/T058 rerun after changes; T060 remains owner-reported only and T061 remains open until physical/CI evidence. Shared service/module/schema edits execute sequentially.
