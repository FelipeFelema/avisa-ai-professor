---
description: "Dependency-ordered tasks for account deletion and data lifecycle"
---

# Tasks: Account Deletion and Data Lifecycle

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Input**: Design documents from `/specs/008-account-deletion-data-lifecycle/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/account-deletion.md](./contracts/account-deletion.md), [quickstart.md](./quickstart.md), and `.specify/memory/constitution.md`.

**Tests**: Required by the acceptance scenarios, integrity/concurrency matrix and constitution. Write the relevant tests before implementation and observe the expected failure; use real isolated PostgreSQL for persistence, rollback and lock ordering. Existing passing behavior is regression coverage, not a required red test.

**Organization**: Setup → shared foundation → US1/P1 (impact and confirmation) → US2/P2 (atomic server deletion) → US3/P3 (session termination and client integration) → cross-cutting validation. US1 is independently demonstrable without completing a deletion. The complete destructive mobile flow is released only after US2 and US3 pass together.

## Format: `[ID] [P?] [Story] Description`

- Every task starts with `- [ ]`, a sequential task ID and an exact repository path.
- `[P]` means separate file ownership and no dependency between tasks in the stated parallel group; prerequisite phases still apply.
- `[US1]`, `[US2]` and `[US3]` map to the three stories in `spec.md`; Setup, Foundation and Polish have no story labels.
- Check only completed work. Unavailable manual/device evidence stays open and is recorded as `NOT RUN` or `NOT MEASURED`.

## Path Conventions

- Backend implementation: `backend/src/`; unit tests beside implementation; integration/E2E/helpers in `backend/test/`.
- Mobile routes: `mobile/app/`; logic in `mobile/src/`; Jest/RNTL coverage in `mobile/tests/`.
- Feature evidence: `specs/008-account-deletion-data-lifecycle/validation.md`, `backend-validation.md`, `mobile-validation.md`, `android-walkthrough.md`, and `accessibility-validation.md` are future implementation outputs.
- Runtime Swagger and canonical contract must evolve together in `specs/001-app-quality-readiness/contracts/openapi.json`.
- Reuse `backend/prisma/schema.prisma`, current migrations and dependencies. No new table, column, enum, migration, account receipt or package is planned.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a preserved baseline and safe, reusable validation environment.

- [x] T001 Record the worktree baseline, affected domains, current schema/FKs, receipt writers, auth/session paths, mobile private caches and applicable regression commands in `specs/008-account-deletion-data-lifecycle/validation.md`; confirm the independent scope from 007, preserve existing WIP and initialize future test/device results as unexecuted.
- [x] T002 Create reusable disposable fixture, sanitized snapshot, deterministic barrier and fault-injection helpers in `backend/test/helpers/account-deletion.helper.ts` with safety coverage in `backend/test/account-deletion.helper.integration.spec.ts`; call `assertSafeTestDatabase` from `backend/test/helpers/test-database.helper.ts` before cleanup, explicitly use local `avisa_ai_test` with existing migrations, and prepare PARENT/PROFESSOR/one-or-two-ADMIN/historical-role graphs, active/expired announcements, receipts, InviteCode, third parties and multiple sessions from `specs/008-account-deletion-data-lifecycle/quickstart.md`.

**Checkpoint**: Baseline and fixtures are reviewable; no destructive fixture runs against `avisa_ai`, and no product deletion has been introduced.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Closed confirmation contracts and coordinated session/receipt writers, plus an opt-in transport rule preventing destructive replay.

**Blocking rule**: Complete this checkpoint before implementing any story. The account advisory gate and deletion graph are implemented in US2, while this phase prepares the writers with which they must coordinate.

### Tests for the foundation

- [x] T003 [P] Add raw-JSON validation tests in `backend/src/users/dto/delete-account.dto.spec.ts` for required fields, null/number/boolean/array/object, extras, exact phrase including case/spaces/newlines/confusables and nonempty unchanged passwords including existing long/Unicode credentials; use the real implicit-conversion ValidationPipe configuration and assert constant errors without submitted values.
- [x] T004 [P] Extend `backend/src/auth/auth-session.service.spec.ts` for TransactionClient-only creation/rotation, prepared hashes outside locks, active-session constraints, snapshot changes, missing/revoked/expired sessions and no upsert; preserve digest and legacy refresh-hash compatibility.
- [x] T005 [P] Extend `backend/src/auth/auth.service.spec.ts` for login/issueTokens/refresh waiting on User lock, current User claims and refresh snapshot revalidation after waiting; cover missing User, revoked/expired/rotated sid, no usable tokens on failure and unchanged registration/password/profile session contracts.
- [x] T006 [P] Extend `backend/src/classrooms/classrooms.service.spec.ts` for User-first locking and existence recheck before receipt access in initial delete, idempotent replay and uniqueness-conflict recovery; expect 401 for removed callers and preserve existing ownership, 403/404 and receipt behavior for existing accounts.
- [x] T007 [P] Extend `mobile/tests/lib/api-session.spec.ts` to require an opt-in no-refresh/no-replay DELETE configuration on the first 401, no resend on reconnection and unchanged refresh/replay for ordinary requests; assert the failed destructive request is never retained for later execution.

### Implementation for the foundation

- [x] T008 Define `DeleteAccountRequest` and `AccountDeletionImpact` Swagger DTOs in `backend/src/users/dto/delete-account.dto.ts` and `backend/src/users/dto/account-deletion-impact.dto.ts`; quote and enforce `currentPassword`: "string não vazia, preservada integralmente, sem novo limite de senha sobre credenciais existentes" and `confirmationPhrase`: "string exatamente `EXCLUIR MINHA CONTA`", with "Ambos obrigatórios/write-only; nenhum trim, normalização, coerção ou field desconhecido"; restore original JSON types, close the request schema, require impact `role` "PARENT / PROFESSOR / ADMIN", `canDelete` "boolean", `blockReason` "`LAST_ADMIN_REQUIRED` ou null", and `ownedClassroomsCount`, `announcementsInOwnedClassroomsCount`, `externalMembershipsCount`, `authoredAnnouncementsInOtherClassroomsCount` each "inteiro ≥ 0", exposing no identity, credential or third-party IDs.
- [x] T009 Harden session persistence primitives in `backend/src/auth/auth-session.service.ts` to use a supplied TransactionClient for creation/rotation under User lock and fail closed on absent/inactive or changed refresh snapshots; prepare hashes outside the transaction, update existing sessions without upsert and ensure every public creation/rotation path participates in the protocol.
- [x] T010 Coordinate login, issueTokens/registration and refresh in `backend/src/auth/auth.service.ts` with the T009 primitives: reread current User and active sid/hash after User lock, retain password snapshot checking for login, derive claims from current data and expose tokens only after commit; preserve JWT/sid/TTL and legacy credentials, sanitize disappearance/revocation to 401 and never recreate a removed account/session.
- [x] T011 Make `backend/src/classrooms/classrooms.service.ts` acquire/recheck the caller User before receipt/turma access using the same transaction, including idempotent and conflict-recovery branches; prevent any receipt recreation after User removal while retaining existing ownership and 403/404/idempotency behavior without importing Users/Auth services or changing the schema.
- [x] T012 Add a typed opt-in no-refresh/no-replay request flag in `mobile/src/types/axios.d.ts` and honor it before the 401 refresh branch in `mobile/src/lib/api.ts`; support public/internal Axios config types, keep normal request behavior and never refresh, retry or queue a flagged destructive request.
- [x] T013 Run foundation DTO/auth/session/receipt/interceptor tests and fixture safety coverage from `specs/008-account-deletion-data-lifecycle/quickstart.md`, record commands/exits and the agreed gate → User → Classroom/session/receipt order in `specs/008-account-deletion-data-lifecycle/validation.md`, and verify unchanged schema, package manifests and existing session/receipt contracts before the story checkpoint.

**Checkpoint**: Confirmation boundaries and competing writers are safe; flagged requests cannot be replayed. No public account DELETE is available yet.

---

## Phase 3: User Story 1 — Compreender e confirmar a exclusão (Priority: P1) — MVP

**Goal**: Present current server-calculated impact, permanence, preserved data, last-ADMIN blocking and exact local confirmation for every role.

**Independent Test**: Open the flow as PARENT, PROFESSOR and ADMIN, including zero relations and historical ownership/authorship. Compare the displayed summary to the fixture, reject empty/incorrect confirmation, cancel/reenter with empty fields and verify no table/session changes. No completed deletion is needed at this checkpoint.

### Tests for User Story 1

- [x] T014 [P] [US1] Add impact unit tests in `backend/src/users/account-deletion.service.spec.ts` for a consistent read snapshot, all roles, zero relations, current last-ADMIN eligibility, announcements of every author/expiration, external-only membership/authorship counts and an exact response allowlist without total ADMIN count or IDs.
- [x] T015 [P] [US1] Extend `backend/src/users/users.controller.spec.ts` for protected GET `/api/v1/users/account-deletion`, sub/sid-only identity for all roles, rejected GET body/query/selectors, `Cache-Control: no-store` and safe 200/400/401/500 behavior.
- [x] T016 [P] [US1] Create GET HTTP acceptance coverage in `backend/test/account-deletion.e2e-spec.ts` using T002 fixtures for role/graph/zero-count/last-ADMIN responses, absent/revoked/expired sessions, forbidden selectors and response leakage, with snapshots proving that GET is read-only.
- [x] T017 [P] [US1] Add Zod confirmation tests in `mobile/tests/validations/deleteAccount.schema.spec.ts` with the T003 raw-value/phrase matrix and password length/Unicode parity; require literal comparisons without trim, normalization, coercion or new limits on existing passwords.
- [x] T018 [P] [US1] Add impact transport tests in `mobile/tests/services/account-deletion.service.spec.ts` for the exact response shape, safe error allowlist, cancellation, no persistent caching and no raw Axios config/body/request/cause in returned feedback.
- [x] T019 [P] [US1] Add US1 RNTL coverage in `mobile/tests/routes/profile-delete-account.spec.tsx` for the Profile entry, role/relationship copy, last-ADMIN block, zero relations, loading/error/read retry, focus refresh, local validation, cancel/back/blur/unmount clearing, Claro/Escuro and field/action accessibility; stub submission and prove it never deletes a fixture.

### Implementation for User Story 1

- [x] T020 [US1] Implement a consistent read-only impact snapshot in `backend/src/users/account-deletion.service.ts` and register it in `backend/src/users/users.module.ts`; use current User/sid and actual relationships for the four counts, include expired data, report only true/null or false/`LAST_ADMIN_REQUIRED` eligibility, and keep Prisma in users without an AuthModule cycle or a gate lock on GET.
- [x] T021 [US1] Expose GET `/api/v1/users/account-deletion` in `backend/src/users/users.controller.ts` with JWT for every role, rejected body/query fields/selectors, `no-store`, operationId `users.getAccountDeletionImpact` and sanitized errors; never derive the target from client-provided identity or cached role.
- [x] T022 [US1] Synchronize GET Swagger/runtime and `AccountDeletionImpact` in `specs/001-app-quality-readiness/contracts/openapi.json`, extending `backend/test/openapi.contract.spec.ts` for the operation, Bearer security, required enums/nonnegative counts/null blockReason and exact endpoint inventory while preserving prior contracts.
- [x] T023 [US1] Implement transient request/impact types in `mobile/src/types/auth.ts` and exact Zod validation in `mobile/src/validations/deleteAccount.schema.ts`: `currentPassword` "string não vazia, preservada integralmente, sem novo limite de senha sobre credenciais existentes", `confirmationPhrase` "string exatamente `EXCLUIR MINHA CONTA`", "Ambos obrigatórios/write-only; nenhum trim, normalização, coerção ou field desconhecido"; require impact `role` "PARENT / PROFESSOR / ADMIN", `canDelete` "boolean", each of the four T008 counts "inteiro ≥ 0" and `blockReason` "`LAST_ADMIN_REQUIRED` ou null", rejecting unknown fields without retaining submitted credentials.
- [x] T024 [US1] Implement imperatively fetched impact and sanitized Portuguese feedback in `mobile/src/services/auth/account-deletion.service.ts` and export through `mobile/src/services/auth/index.ts`; validate the closed response, accept AbortSignal, and keep impact transient without QueryClient/storage/request-object retention.
- [x] T025 [US1] Introduce impact state/loading/read-retry/focus refresh in `mobile/src/hooks/useDeleteAccount.ts`, guarded against stale/unmounted/session-changed results; obtain server impact on entry/resume and after conflict, treat zero as ready and never derive counts or eligibility from cached lists/AuthUser.role alone.
- [x] T026 [US1] Add the destructive “Excluir minha conta” entry in `mobile/app/(app)/(tabs)/profile.tsx` and the dedicated `mobile/app/(app)/profile/delete-account.tsx` screen using SecondaryScreen, ScreenState, existing fields/buttons and active palette; explain permanence, current relations removed/preserved, ADMIN access loss, InviteCode/theme preservation and that the graph is recalculated at submission, distinct from logout/profile/password actions.
- [x] T027 [US1] Complete pre-submit lifecycle and accessibility behavior in `mobile/app/(app)/profile/delete-account.tsx`: protected current-password field, visible literal phrase, no autofill/autocorrection/capitalization, scroll/keyboard/text scaling, field-linked announced errors/focus, clear values on cancel/back/blur/unmount/expiration and block submission without eligible fresh impact; keep the live destructive handler unavailable until T056 integrates US2/US3.
- [x] T028 [US1] Validate the read-only US1 acceptance matrix and schema parity, GET canonical/runtime contract, cancel/reentry and absence of sensitive values in `specs/008-account-deletion-data-lifecycle/validation.md`; record fixture comparisons and test exits, distinguish simulated submission from a completed operation and stop at the MVP checkpoint when only US1 is authorized.

**Checkpoint**: A person can understand and actively confirm the impact without removing data. This MVP is a review/demo increment; a public destructive flow awaits the complete server and cleanup integration.

---

## Phase 4: User Story 2 — Excluir a conta sem deixar dados inconsistentes (Priority: P2)

**Goal**: Permanently delete only the authenticated account and its policy-defined graph in one transaction, preserve others and protect the last ADMIN under concurrency.

**Independent Test**: Invoke the authenticated DELETE against disposable PostgreSQL fixtures and compare all removed/preserved rows. Inject faults after actual write stages, race two accounts/sessions and competing writers, inspect empty 204 and retry 401, and register anew with the freed email under existing rules. This checkpoint can be proven through HTTP without the integrated mobile submission.

### Tests for User Story 2

- [x] T029 [P] [US2] Extend deletion unit coverage in `backend/src/users/account-deletion.service.spec.ts` for exact confirmation/password verification outside locks, gate-before-User lock, live sid/hash/role checks, `CREDENTIAL_CHANGED`, last-ADMIN rejection before writes, ordered Classroom locks, one TransactionClient, required delete order, commit-only success and sanitized errors without automatic retry.
- [x] T030 [P] [US2] Extend `backend/src/users/users.controller.spec.ts` for self-only DELETE `/api/v1/users/account`, closed body/query contract, existing RateLimitGuard, all roles, `no-store`, empty 204 and the precise 400/401/409/429/500 error contract; assert wrong password is 400 and repeated deletion is never a receipt-based success.
- [x] T031 [P] [US2] Create `backend/test/account-deletion.integration.spec.ts` with the T002 full-table snapshot matrix: PARENT/PROFESSOR/eligible ADMIN/historical-role graph, owned subtrees including third-party/expired contents, external participation/authorship, receipts/sessions, unaffected User/InviteCode/resources, last ADMIN, changed hash/role/relations and email reuse with fresh identity and invalid old tokens.
- [x] T032 [P] [US2] Create deterministic two-connection concurrency tests in `backend/test/account-deletion.concurrency.integration.spec.ts` for same-account deletion, two ADMINs including first rollback, receipt/turma writers, User-related inserts and third-party children of owned turmas; use T002 barriers rather than sleeps and assert no orphan or recreated identity after either ordering.
- [x] T033 [P] [US2] Extend `backend/test/account-deletion.e2e-spec.ts` for full DELETE validation/session/status/security behavior, POST-registration email reuse under each role's normal invite rules, empty success/no tokens and no credential/phrase/SQL/third-party/global ADMIN information in responses.

### Implementation for User Story 2

- [x] T034 [US2] Implement destructive preflight and locking in `backend/src/users/account-deletion.service.ts`: verify the exact password snapshot outside the transaction with `backend/src/common/security/password-hasher.ts`, then READ COMMITTED with a documented fixed parametrized transactional advisory gate before User FOR UPDATE; reread User, own sid with "revokedAt nulo e expiresAt futuro", current hash/role, return 401 on absence and 409 `CREDENTIAL_CHANGED` or `LAST_ADMIN_REQUIRED` before any writes, count ADMINs after gate acquisition and lock owned Classroom rows by id order.
- [x] T035 [US2] Implement the current-graph removal sequence in `backend/src/users/account-deletion.service.ts` using only the T034 TransactionClient: Announcement by authorId → UserClassroom by userId → Classroom by ownerId with existing cascades → ClassroomDeletionReceipt by ownerId → all AuthSession by userId → User; include all roles and expired/revoked data, preserve third-party accounts/unrelated rows/InviteCode, create no account receipt, call no public Classroom delete and rollback/sanitize every failed stage without retry.
- [x] T036 [US2] Expose DELETE `/api/v1/users/account` in `backend/src/users/users.controller.ts` using current authenticated sub/sid, JWT, existing RateLimitGuard, T008 DTO and rejected query selectors; return `Cache-Control: no-store` and 204 with no body/tokens only after commit, operationId `users.deleteOwnAccount`, constant documented errors and no request/credential logging.
- [x] T037 [US2] Synchronize DELETE Swagger/runtime and `DeleteAccountRequest` in `specs/001-app-quality-readiness/contracts/openapi.json`, extending `backend/test/openapi.contract.spec.ts` for closed required write-only fields, Bearer security, stable message codes, all documented statuses, 204 without content and preservation of the GET and every previous endpoint.
- [x] T038 [US2] Complete real rollback proof in `backend/test/account-deletion.integration.spec.ts` by injecting failures after each destructive stage reached inside the transaction, including receipts/sessions, plus controlled lock timeout/deadlock rollback; compare full before/after snapshots and prove no partial deletion or leaked Prisma/SQL/cause values.
- [x] T039 [US2] Complete same-account and last-ADMIN races in `backend/test/account-deletion.concurrency.integration.spec.ts`: one effective removal and second 401, count after first commit, first rollback permitting reevaluation and at least one ADMIN always remaining; test current role/hash changes between preflight and lock without stale authorization.
- [x] T040 [US2] Complete both orderings of receipt/turma and relationship races in `backend/test/account-deletion.concurrency.integration.spec.ts`, including idempotent/conflict receipt paths, creation of ownership/membership/authorship and third-party child insertions into owned turmas; writes committed before deletion follow the policy, later references cannot commit as orphans and preserved callers keep their existing contracts.
- [x] T041 [US2] Extend real login/issueTokens/refresh-versus-deletion coverage in `backend/test/auth.integration.spec.ts` with T002 barriers before User lock and both commit orders; assert all old/newly issued-but-late tokens fail after deletion, absent/revoked/rotated sessions yield safe 401, refresh never upserts and current JWT/refresh strategies consult persisted session validity.
- [x] T042 [US2] Execute the backend US2 unit/HTTP/contract/integrity/rollback/race matrix and record removed/preserved row comparisons, email reuse, every-session rejection and test exits in `specs/008-account-deletion-data-lifecycle/validation.md`; validate no post-commit false 401, account tombstone, schema change or uncoordinated receipt/session writer before accepting the backend checkpoint.

**Checkpoint**: The server contract deletes the complete policy graph atomically, preserves unrelated data and proves rollback/ADMIN/session/receipt concurrency. The initiating mobile device is integrated in US3.

---

## Phase 5: User Story 3 — Encerrar o acesso e retornar à autenticação (Priority: P3)

**Goal**: Submit once, close every local authenticated state, preserve theme and recover honestly from a lost response without destructive resend or stale-session restoration.

**Independent Test**: Use multiple sessions, receive 204 in one device and reject access/refresh in the others. Resolve old refresh/profile/queries/mutations after cleanup, fail each SecureStore removal, simulate a lost response before/during/after processing and verify `valid`/`invalid`/`indeterminate` read-only outcomes, protected navigation and theme after restart.

### Tests for User Story 3

- [x] T043 [P] [US3] Extend `mobile/tests/lib/api-session.spec.ts` for late refresh suppression by generation, ordinary-request regression, flagged DELETE 401 without replay and read-only verification distinguishing definitive invalidation from network/5xx/429/unknown refresh failure without retaining the DELETE or submitted fields.
- [x] T044 [P] [US3] Add shared-generation tests in `mobile/tests/lib/session-generation.spec.ts` and queued storage tests in `mobile/tests/storage/auth.storage.spec.ts` for synchronous invalidation, both token-key removal attempts, stale/in-flight writes before/after clear, storage failures and preservation of `theme-preference` with values "`light`/`dark".
- [x] T045 [P] [US3] Extend `mobile/tests/providers/AuthProvider.spec.tsx` for cleanup before storage awaits, identity/QueryClient removal despite failures, expired-session cleanup, stale restore/profile/refresh rejection, failed bootstrap remaining closed, retryable storage recovery and no private screen/content before server validation on restart.
- [x] T046 [P] [US3] Add submission/verification coverage in `mobile/tests/hooks/useDeleteAccount.spec.tsx` for synchronous single-flight before rerender, no TanStack mutation/secret retention, definitive 204, field errors/conflicts, 401 read verification, lost response and all three verification results; require fresh impact/new manual confirmation and forbid declaring rollback from a valid read.
- [x] T047 [P] [US3] Extend `mobile/tests/services/account-deletion.service.spec.ts` for exactly one flagged DELETE carrying only two fields, empty 204, safe 400/409/429 feedback, unknown transport outcomes, read-only session verification and an allowlisted error object without Axios config/data/request/cause or submitted values.
- [x] T048 [P] [US3] Extend `mobile/tests/routes/profile-delete-account.spec.tsx` for pending fields/cancel/back/gesture/hardware guards, session-expiration escape, all clearing paths, single visible result, neutral invalid-session versus confirmed-success feedback, lost-response read verification, and back/deep-link/restart protection with theme preserved.

### Implementation for User Story 3

- [x] T049 [US3] Implement a small shared in-memory generation utility in `mobile/src/lib/session-generation.ts` and serialize token writes/removals in `mobile/src/storage/auth.storage.ts`; invalidate generation synchronously before cleanup awaits, reject old-generation writes, try both token keys even if one fails and return a safe recovery outcome without clearing AsyncStorage/theme or persisting account state.
- [x] T050 [US3] Integrate generation capture/checks into refresh and session-expiration handling in `mobile/src/lib/api.ts`, ensuring in-flight refresh cannot save/replay into a cleared or replaced session; support an opt-in read-only verification path that distinguishes definitive 401 from unknown refresh/network/5xx/429 while keeping ordinary-request policies and the T012 destructive no-replay flag.
- [x] T051 [US3] Harden `mobile/src/providers/AuthProvider.tsx`, `mobile/src/types/auth.ts` and `mobile/src/services/auth/auth.service.ts` for synchronous authenticated-state closure, cancellation/clear of private QueryClient data and identity even when SecureStore fails, generation-guarded login/profile/bootstrap/restore, explicit safe storage recovery and server session validation before exposing restored private content; preserve existing login/register/profile/password/logout contracts and avoid an unnecessary remote logout/refetch after successful deletion.
- [x] T052 [US3] Propagate AbortSignal and generation boundaries through private reads in `mobile/src/hooks/useMyClassrooms.ts`, `mobile/src/hooks/useAnnouncement.ts`, `mobile/src/hooks/useClassroomAnnouncements.ts`, `mobile/src/hooks/useAvailableClassrooms.ts`, `mobile/src/services/classes/classroom.service.ts`, `mobile/src/services/announcements/announcement.service.ts`, `mobile/src/services/announcements/service.ts` and `mobile/src/services/announcements/findOne.ts`; extend `mobile/tests/services/classroom.service.spec.ts` and add `mobile/tests/hooks/private-session-boundaries.spec.tsx` proving canceled/old reads cannot refill cleared caches, with existing classroom-search behavior intact.
- [x] T053 [US3] Guard old-generation settlement and effects in private mutations in `mobile/src/hooks/useUpdateProfile.ts`, `mobile/src/hooks/useCreateClassroom.ts`, `mobile/src/hooks/useJoinClassroom.ts`, `mobile/src/hooks/useLeaveClassroom.ts`, `mobile/src/hooks/useDeleteClassroom.ts`, `mobile/src/hooks/useCreateAnnouncement.ts`, `mobile/src/hooks/useUpdateAnnouncement.ts`, `mobile/src/hooks/useDeleteAnnouncement.ts` and the imperative `mobile/src/hooks/useChangePassword.ts`; extend `mobile/tests/hooks/private-session-boundaries.spec.tsx` to resolve old requests/success/error callbacks after cleanup and suppress identity/cache/invalidation/navigation effects, including consumer callbacks in `mobile/app/(app)/profile/edit.tsx`, `mobile/app/(app)/profile/change-password.tsx`, `mobile/app/(app)/classrooms/new.tsx`, `mobile/app/(app)/classrooms/[id].tsx`, `mobile/app/(app)/classrooms/[id]/new-announcement.tsx`, `mobile/app/(app)/announcements/[id].tsx` and `mobile/app/(app)/announcements/[id]/edit.tsx` where necessary; stale mutation results must not repopulate authenticated cache or feedback.
- [x] T054 [US3] Implement DELETE and read-only session verification in `mobile/src/services/auth/account-deletion.service.ts` using T012/T050 options and T023 exact types; keep requests imperative without QueryClient/MutationCache or persistence, accept only 204 as confirmed deletion, translate constant errors by allowlist, sanitize caught objects and distinguish `valid`/`invalid`/`indeterminate` without existence lookup by email/ID or automatic DELETE resend.
- [x] T055 [US3] Complete `mobile/src/hooks/useDeleteAccount.ts` with ref-based single-flight, safe local feedback and the loading/ready/blocked/pending/conflict/indeterminate/verification state machine; clear transient confirmation on unknown outcome/conflict/expiration, perform read-only verification after 401/response loss, reload impact before new manually entered confirmation, and never infer rollback from 200 or deletion success from session invalidation alone.
- [x] T056 [US3] Integrate the live destructive flow in `mobile/app/(app)/profile/delete-account.tsx` with AuthProvider cleanup, pending navigation/hardware/gesture guards that disarm on expiration, sensitive-value clearing on every specified lifecycle, blocked/recoverable/unknown states and “Verificar sessão”; update `mobile/app/(app)/_layout.tsx` and `mobile/app/(auth)/login.tsx` for protected history/deep links/restart and transient identity-free confirmed-success or neutral-session-ended feedback, never passing credentials through routes or showing success without 204.
- [x] T057 [US3] Validate the integrated US3 races, duplicate taps, response-loss variants, safe errors/cache/storage, SecureStore recovery and multi-session/theme/navigation outcomes using `mobile/tests/hooks/useDeleteAccount.spec.tsx`, `mobile/tests/hooks/private-session-boundaries.spec.tsx`, `mobile/tests/lib/api-session.spec.ts`, `mobile/tests/providers/AuthProvider.spec.tsx` and `mobile/tests/routes/profile-delete-account.spec.tsx`; record commands/exits and observed limits in `specs/008-account-deletion-data-lifecycle/validation.md` before declaring the complete destructive flow delivered.

**Checkpoint**: A confirmed 204 clears local account state; a definitive invalid session closes access with neutral feedback; an uncertain result stays uncertain. No automatic destructive resend or late authenticated-state restoration occurs, and theme survives.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close regression, operational, documentation and separately observed device evidence for the integrated feature.

- [x] T058 [P] Document the two endpoints, irreversible lifecycle policy, last-ADMIN limit, existing rate limit, client no-replay/unknown-result recovery, theme preservation and isolated-test workflow in `backend/README.md` and `mobile/README.md`, cross-checking `specs/008-account-deletion-data-lifecycle/contracts/account-deletion.md` and recording any observed limitation without adding administrative/retention/notification scope.
- [x] T059 Audit sensitive data and run applicable regressions for login/register/invites/profile/password/logout/theme/turmas/comunicados and classroom-delete idempotency using `backend/test/auth.integration.spec.ts`, `backend/test/classrooms.integration.spec.ts`, `backend/test/openapi.contract.spec.ts`, `mobile/tests/routes/profile.spec.tsx`, `mobile/tests/routes/profile-edit.spec.tsx`, `mobile/tests/routes/profile-change-password.spec.tsx` and `mobile/tests/lib/api-session.spec.ts`; record response/log/error/route/QueryCache/MutationCache/storage inspections and zero submitted credential/phrase/third-party-ID leaks in `specs/008-account-deletion-data-lifecycle/validation.md`.
- [x] T060 Measure transaction/lock-wait duration for realistic ownership/content fixture sizes and controlled contention through `backend/test/account-deletion.concurrency.integration.spec.ts`, recording commands, sizes, waits, Prisma limits and the Axios 10-second boundary in `specs/008-account-deletion-data-lifecycle/validation.md`; verify batched deletion/no per-turma requests/hash outside locks, do not invent an SLO or widen global timeouts without evidence, and retain unknown-result behavior when delivery exceeds the client timeout.
- [x] T061 [P] Run backend Prisma validation/generation/existing-migration deployment against explicitly verified `avisa_ai_test`, format check, lint, typecheck, coverage, integration, contract, E2E and build commands from `specs/008-account-deletion-data-lifecycle/quickstart.md`; record each command/exit and meaningful failures in `specs/008-account-deletion-data-lifecycle/backend-validation.md`, keeping destructive test suites serialized on their shared database.
- [x] T062 [P] Run mobile typecheck, lint, format check, Doctor, complete CI Jest/coverage and export commands from `specs/008-account-deletion-data-lifecycle/quickstart.md`; record command/exit and environment/network limitations in `specs/008-account-deletion-data-lifecycle/mobile-validation.md`, separating automated gates from unobserved Android/iOS/AT behavior.
- [x] T063 Perform the disposable-account Android walkthrough for all roles/last ADMIN in Claro/Escuro, with cancel/reentry, successful deletion, second-session refusal, back/deep link/restart and preserved theme; measure unaided impact comprehension/completion against the two-minute SC-006 target and record device/SO/role/theme/scenario/duration/results without secrets in `specs/008-account-deletion-data-lifecycle/android-walkthrough.md`, leaving unavailable observations `NOT MEASURED`.
- **T064 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha Android/TalkBack da exclusão da conta. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- [x] T065 Consolidate applicable checkpoints, FR/SC evidence, commands/exits and individual acceptance in `specs/008-account-deletion-data-lifecycle/validation.md`; record T064 as DISPENSADA POR ESCOPO without treating its historical measurements as blockers. Incorporate the individual complement from 009:T070 via 009:T073, run `git diff --check` and an affected-file/scope audit, preserve prior WIP and mark only actually completed work. Native/AT campaigns and independent participants are not requirements. **Concluída em 2026-10-05 via 009:T073; T070 registrada, copy simplificada e gates afetados aprovados.**

**Checkpoint**: Automated delivery gates pass and manual results are attributed to observed environments. Unmeasured usability/AT criteria are not treated as passed.

---

## Dependencies & Execution Order

### Phase graph

```text
Phase 1: T001 → T002
                  ↓ safe fixture/baseline checkpoint
Phase 2: {T003, T004, T005, T006, T007}
         T003 → T008
         T004 → T009 → T010 (also T005)
         T006 → T011
         T007 → T012
         {T008, T010, T011, T012} → T013
                  ↓ foundation checkpoint
Phase 3: US1 / T014–T028 → read-only MVP
                  ↓ default incremental delivery
Phase 4: US2 / T029–T042 → atomic server checkpoint
                  ↓ server + summary required for client integration
Phase 5: US3 / T043–T057 → full destructive-flow checkpoint
                  ↓ integrated flow verified
Phase 6: T058–T060 → {T061, T062} → T063 → T065 (T064 DISPENSADA POR ESCOPO; complement 009:T070 → 009:T073)
```

### Task dependencies within stories

- **US1 backend**: T014/T015/T016 are distinct test files. T020 follows T014; T021 follows T020/T015; T022 follows T021. HTTP proof T016 executes successfully after T021. T020 creates/registers the service, so the users module never refers to an absent class at a checkpoint.
- **US1 mobile**: T017/T018/T019 are distinct test files. T023 follows T017/T008. T024 follows T018/T023 and the settled GET contract. T025 follows T024; T026 follows T019/T023/T025; T027 follows T026. T028 joins T022/T027 and all US1 tests. The screen cannot invoke a live DELETE yet.
- **US2**: T029–T033 can be prepared together after Phase 2 when US1 file ownership is free. T034 follows T029/T008/T010/T011 and T020; T035 follows T034; T036 follows T035/T030; T037 follows T036/T022. T038 follows T031/T035; T039 follows T032/T035; T040 follows T039/T011; T041 follows T010/T035/T002. T033 runs after T036. T042 joins T037–T041 and the HTTP matrix.
- **US3**: T043–T048 can be prepared together after prior writes to their files have finished. T049 follows T044; T050 follows T049/T043/T012; T051 follows T050/T045. T052 follows T051. T053 follows T052 because both proof tasks own `private-session-boundaries.spec.tsx`. T054 follows T050/T047/T023/T036; T055 follows T054/T046/T025; T056 follows T055/T051/T048/T027. T057 joins T053/T056 and all US3 tests.
- **Polish**: T058/T059/T060 need T042/T057; T059/T060 write the main evidence sequentially. T061/T062 require settled implementation/regressions and use distinct evidence files; never run multiple destructive backend suites concurrently. T063 uses individual functional acceptance; T064 is dispensed and does not block T065. T065 consolidates only applicable evidence, including the individual complement in 009:T070.

### User story dependencies

- **US1/P1** needs the foundation and GET only. Its independent proof stops before real deletion; server password reauthentication is verified in US2.
- **US2/P2** needs the foundation, shared service/DTO and current graph semantics. Its integrity proof is independently executable via HTTP. Complete US1 first by default because both edit the service, controller, controller/service specs, canonical contract and E2E file.
- **US3/P3** needs US1 summary/form and US2 DELETE, plus no-replay and all session-writer guarantees. Unit tests can simulate the server contract, but integrated acceptance requires the real server checkpoint.
- **Release scope** is all three stories with regression/gates. US1 alone is a useful MVP demo, not completion of permanent account deletion.

### Shared ownership and parallel opportunities

- Foundation tests T003–T007 are separate files. T008, the T009→T010 lane, T011 and T012 are distinct implementation lanes once their tests are ready; T013 is the join.
- US1 test preparation T014–T019, US2 test preparation T029–T033 and US3 test preparation T043–T048 can run within their respective phase after prerequisite checkpoints; serialize repeated writes to files from earlier phases.
- US1 backend T020→T021→T022 can proceed alongside mobile T023→T024→T025→T026→T027 once the contract is settled. These lanes do not share implementation files.
- US2 rollback proof T038, race proof T039→T040 and auth proof T041 edit distinct test files; run their database suites serially. They follow the complete transaction implementation.
- US3 T051→T052→T053 and T054→T055 are separate implementation lanes after T050; T056 joins provider and hook readiness. Tests sharing a file are always ordered.
- `account-deletion.service.ts/.spec.ts`, `users.controller.ts/.spec.ts`, canonical OpenAPI/contract tests and account-deletion E2E are shared across US1/US2. `useDeleteAccount.ts`, route/service specs and `api-session.spec.ts` recur across US1/Foundation/US3. Treat repeated ownership as a sequence, never parallel writes.
- T061/T062 can run independently with distinct component outputs. T058 can prepare README changes while other final checks run; T065 alone consolidates evidence.
- `[P]` describes future scheduling opportunities. This task-generation request starts neither implementation nor delegated agents.

## Parallel Example: User Story 1

After T013, prepare T014–T019 in separate files. Once each lane's tests and contracts are ready:

```text
Backend: T020 impact → T021 GET → T022 runtime/canonical contract
Mobile:  T023 schema/types → T024 service → T025 hook → T026 screen → T027 lifecycle
Join:    T028 read-only impact/confirmation checkpoint
```

US1 mobile tests use a mocked impact transport until GET is ready; the final checkpoint compares real HTTP fixtures. No lane sends a live DELETE.

## Parallel Example: User Story 2

After foundation and completed US1 shared-file work, prepare T029–T033 together. After T034→T035→T036:

```text
Contract lane: T037 Swagger/canonical
Rollback lane: T038 full-table fault injection
Race lane:     T039 same-account/ADMIN → T040 receipt/relationship races
Auth lane:     T041 login/issue/refresh races
Join:          T042 HTTP/integrity checkpoint
```

These proof lanes own different files, but PostgreSQL runs remain serialized because fixture cleanup shares `avisa_ai_test`.

## Parallel Example: User Story 3

Prepare T043–T048 in distinct files. After T049→T050:

```text
Session lane:  T051 provider/bootstrap → T052 private reads → T053 mutation effects
Deletion lane: T054 imperative service → T055 single-flight/verification hook
Join UI:       T056 live submission/cleanup/navigation
Join proof:    T057 integrated client races and result recovery
```

T056 waits for both the cleanup API and hook readiness; no destructive integration is released while either lane is incomplete.

## Requirement and Acceptance Coverage

| Requirement / outcome               | Main tasks                                                             | Independent proof                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001–FR-004; SC-006               | T014–T016, T020–T022, T025–T028, T063                                  | Three roles, actual graphs, zero relations, current impact, clear removals/preservations and separately timed comprehension.                                         |
| FR-002/FR-005–FR-007; SC-001/SC-009 | T003/T008, T017–T019, T023/T027, T029–T030, T033–T036, T047/T054, T059 | Exact two-field request, self-only sub/sid, raw JSON rejection, protected transient inputs, safe feedback and no-change invalid attempts.                            |
| FR-008/FR-020; SC-007               | T007/T012, T043/T046/T048, T054–T057                                   | Ref single-flight before rerender, no interceptor resend, pending guards and expiration escape, one visible result.                                                  |
| FR-009–FR-014; SC-002/SC-003/SC-005 | T002, T029/T031–T035, T038/T040/T042                                   | Full-table graph matrix, historical roles, cascades, receipts/InviteCode preservation, genuine transactional rollback and concurrent relation integrity.             |
| FR-015/FR-016                       | T014/T020/T025–T028, T031–T032, T034/T039/T042                         | Last ADMIN blocked in summary and live transaction; current role/hash/relationships and serialized ADMIN decisions after commit/rollback.                            |
| FR-017; SC-004                      | T004–T006, T009–T011, T032/T035/T039–T042, T043–T045, T049–T053/T057   | All sessions removed; login/refresh/writers coordinate; late tokens, restored state, queries and mutation effects cannot regain access.                              |
| FR-018/FR-019                       | T030–T031/T033, T035–T038/T042, T047/T054, T059                        | Freed email with new identity/normal invite rules, empty post-commit 204, constant sanitized error/status contract and no old-token reuse.                           |
| FR-021–FR-023; SC-007/SC-008        | T043–T057, T062–T063                                                   | Generation/storage queue, read-only valid/invalid/indeterminate verification, closed history/deep links/restart, storage-failure recovery and theme alone preserved. |
| FR-024/FR-025; SC-006               | T019/T025–T028, T046/T048/T055–T056, T063–T064                         | Portuguese loading/block/error/pending/unknown/success; structural accessibility tests plus actual keyboard/font/theme/AT evidence.                                  |
| FR-026; SC-010                      | T001/T005–T007/T013, T022/T037/T041, T051–T053, T058–T059/T061–T065    | Existing auth/profile/password/theme/domain/receipt contracts, exact OpenAPI inventory, full component gates and preserved WIP/scope.                                |
| SC-009 and operational limits       | T003/T008/T018/T033/T038, T044/T047/T049/T054, T059–T060/T065          | Inspected logs/errors/responses/caches/storage without secrets/third-party IDs; measured lock/transaction limits without invented performance/device claims.         |

## Implementation Strategy

### MVP First: US1

1. Complete T001–T013 for safe fixtures and shared contracts/writers.
2. Complete T014–T028 for actual impact, warning, exact confirmation, cancellation and blocked ADMIN.
3. Stop and validate US1 independently. Keep live destructive submission unavailable; a UI demo does not claim that deletion or session cleanup is delivered.

### Incremental Delivery

1. Foundation → independently verified read-only US1.
2. Add US2 atomic DELETE and Swagger/canonical inventory together; prove graph preservation, rollback, email reuse and real writer races.
3. Add US3 generation/storage/API/provider protections, private-data boundaries and imperative submission/verification; integrate the screen only when server and cleanup are ready.
4. Validate response loss, late callbacks, session revocation, storage failure and restart before exposing the complete flow.
5. Complete regression, measured limits, documentation, quality gates and observed Android/AT evidence. Leave unexecuted observations open.

## Notes

- Total: **65 tasks** — Setup 2, Foundation 11, US1 15, US2 14, US3 15, Polish 8; **25 tasks marked `[P]`**. These groups and additional disjoint implementation lanes are governed by the dependencies above.
- No functional dependency on changing profile/password in 007; existing authentication primitives and test patterns may be reused without requiring that user journey.
- Future administrative removal/demotion of ADMIN must participate in the gate; uncoordinated external SQL is outside the current product contract.
- A fault rejected before reaching a transaction/write boundary does not prove rollback. A sleep does not prove a concurrent interleaving.
- Timeout/disconnection does not prove remote cancellation or rollback. A valid session read proves validity at that instant; an invalid read does not prove deletion without a received 204.
- Keep theme outside authenticated cleanup. Do not claim a failed SecureStore key was erased; close memory/private routes and recover safely.
- No transfer, soft delete, account recovery, export, backup/retention policy, administrative user management, push or broad security audit is added.
- Task generation changes only this file and authorizes no implementation, staging, commit, push or publishing.
