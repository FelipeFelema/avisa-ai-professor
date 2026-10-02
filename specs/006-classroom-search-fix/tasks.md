---
description: "Task list for Classroom Search Fix implementation"
---

# Tasks: Classroom Search Fix

**Input**: Design documents from `/specs/006-classroom-search-fix/`.

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/classroom-search.md`, `quickstart.md` and `.specify/memory/constitution.md`.

**Tests**: Included because the specification defines measurable acceptance matrices and the plan explicitly requires DTO/controller/service, HTTP/PostgreSQL, OpenAPI, debounce, race and real-cache coverage. Add the failing behavioral expectations before implementing the corresponding change; preserve existing regression assertions except those explicitly superseded by this contract.

**Organization**: Setup and foundation first, followed by US1/P1, US2/P2 and US3/P3, each with an independent checkpoint. Final validation covers regressions, quality gates, manual evidence and scope.

## Format: `[ID] [P?] [Story] Description`

- `[P]` identifies work in separate files that can run concurrently once its prerequisites are complete; it does not authorize automatic agent delegation.
- `[US1]`, `[US2]` and `[US3]` identify story tasks only. Every task has a sequential ID and explicit file paths.
- Paths are relative to the repository root: `backend/`, `mobile/` and `specs/`.

## Scope Guardrails

- Reuse `GET /api/v1/classrooms` and `ClassroomSummary[]`; no endpoint, response field, Prisma schema/migration, package or lockfile change.
- Search only available classroom names, using external trim, literal substring, case-insensitive comparison and significant accents; preserve internal characters and existing ordering.
- Keep `Minhas turmas` independent of the search and preserve membership, ownership, roles, authentication, confirmations, mutation guards, navigation and announcement invalidations.
- Use the existing class-validator/class-transformer, Zod, QueryClient, Axios, UI primitives and active theme palette. Do not change global validation options, theme providers or unrelated surfaces.
- Run destructive backend suites only on an isolated local PostgreSQL database whose name contains `test`, protected by `assertSafeTestDatabase`; never use the Compose development database `avisa_ai`.
- Evidence belongs in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` during implementation. Automated statuses are `PASS`, `WARN`, `FAIL` or `NOT RUN`; unavailable device/assistive-technology observations remain `NOT MEASURED`.

## Phase 1: Setup (Existing Monorepo Baseline)

**Purpose**: Confirm the feature boundary and reusable infrastructure without recreating the project.

- [X] T001 Verify the current endpoint, input pipeline, available/my query keys, mutation consumers, FormField and active themes against `specs/006-classroom-search-fix/plan.md` and `specs/006-classroom-search-fix/research.md`; inspect `backend/src/configure-app.ts`, `backend/src/classrooms/classrooms.controller.ts`, `mobile/src/config/query-keys.ts`, `mobile/src/components/ui/FormField.tsx`, `mobile/app/(app)/(tabs)/classrooms.tsx`, `backend/package.json` and `mobile/package.json`, then record the baseline scope and unrelated WIP in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md`.

---

## Phase 2: Foundational (Safe Validation and Shared Test Support)

**Purpose**: Establish reproducible regression evidence and real-query test support before story changes.

**Blocking checkpoint**: Complete T002–T003 before starting a story. No production dependency or schema setup is required.

- [X] T002 Confirm the isolated test database with `backend/test/helpers/test-database.helper.ts` and the CI setup in `.github/workflows/backend-ci.yml`, apply only existing migrations, and run the existing classroom unit/integration/OpenAPI and mobile service/list/mutation/theme/confirmation baseline suites identified in `specs/006-classroom-search-fix/quickstart.md`; create the FR-001–FR-024/SC-001–SC-010 evidence matrix and record commands, environment, warnings, existing failures and unavailable checks in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` without copying credentials.
- [X] T003 Reuse the real QueryClient support in `mobile/tests/helpers/render.tsx` and add focused deferred-promise/query wrapper utilities in `mobile/tests/helpers/classroom-search.tsx` for multiple available variants, active/inactive observers, controlled services and abort signals; allow production-like five-minute staleTime where freshness matters, disable incidental retries, clean up observers/clients/timers and keep existing global mocks in `mobile/tests/helpers/mocks.ts` unchanged unless a direct consumer requires an adjustment.

**Checkpoint**: Safe backend environment, existing behavior and real-cache test tools are documented and ready.

---

## Phase 3: User Story 1 - Encontrar uma turma disponível pelo nome (Priority: P1) — MVP

**Goal**: Deliver normalized and validated name search through the existing authenticated API and mobile list, excluding existing memberships and leaving my classrooms intact.

**Independent Test**: Use available Matemática 6º A, Matemática 7º B and Português 6º A plus a matching associated classroom. Verify partial name, uppercase, external spaces, empty/whitespace, internal spaces, accents and literal punctuation; accept 80 normalized code points and reject 81. Only eligible available classrooms change, while my classrooms keep their content/actions.

### Tests for User Story 1

- [X] T004 [P] [US1] Add `backend/src/classrooms/dto/find-available-classrooms-query.dto.spec.ts` using the installed transform/validation options to cover absent/empty/whitespace search, trim before 80/81 Unicode-code-point counting, surrogate pairs and combining sequences, preservation of internal characters, and rejection of null/nontextual/array/object values without implicit coercion; verify Portuguese validation messages and the constraint “Valores não textuais ou múltiplos são inválidos na fronteira HTTP.” from `specs/006-classroom-search-fix/data-model.md`.
- [X] T005 [P] [US1] Extend `backend/src/classrooms/classrooms.controller.spec.ts` and `backend/src/classrooms/classrooms.service.spec.ts` to assert the DTO-derived normalized term and authenticated user reach the existing list operation, empty terms omit the name criterion, nonempty terms use escaped literal `contains` with `mode: 'insensitive'`, membership remains `none: { userId }`, and projection/order/my-list behavior stays unchanged.
- [X] T006 [P] [US1] Extend `backend/test/classrooms.integration.spec.ts` with isolated classroom/membership fixtures and real HTTP/PostgreSQL assertions for substring, case, trim, significant accents, internal spaces, numbers, punctuation and literal `%`, `_` and backslash; cover 80/81 normalized code points, repeated search, bracket notation/extras under the installed Express parser, 400 before invalid list execution, 401 without a valid session, access for PARENT/PROFESSOR/ADMIN and an unfiltered `/classrooms/my`; keep cleanup within the protected test database.
- [X] T007 [P] [US1] Extend `backend/test/openapi.contract.spec.ts` to compare runtime Swagger and the canonical search parameter for `classrooms.findAvailable`: optional scalar string, `maxLength: 80` applied after trim, empty accepted without `minLength: 1`, duplicate rejection/serialization documented, existing 200/400/401 envelopes and operation/response inventory preserved.
- [X] T008 [P] [US1] Add `mobile/tests/validations/classroomSearch.schema.spec.ts` for trim equivalence, preserved internal spaces/case/accents/punctuation, empty validity, 80/81 points of code and Unicode parity with the backend; assert the data-model constraint “Mais de 80 pontos de código normalizados bloqueia query. Vazio é válido.” and the message `Use até 80 caracteres na pesquisa` without truncating text.
- [X] T009 [P] [US1] Extend `mobile/tests/services/classroom.service.spec.ts` to prove `getAvailableClassrooms` sends only the normalized term, omits search for absent/empty/whitespace input and preserves the current `/classrooms` URL and array response without changing mutation or my-list transport.
- [X] T010 [P] [US1] Extend `mobile/tests/config/query-keys.spec.ts` to assert normalized available variants: absent/empty/whitespace share `['classrooms', 'available', '']`, external-space equivalents share a key, internal characters/case remain intact and my/detail/announcement keys remain compatible.
- [X] T011 [P] [US1] Update `mobile/tests/routes/classrooms-list.spec.tsx` expectations superseded by the search contract to cover the field within available classrooms, normalized lookup, invalid input blocking without truncation, reset to unfiltered results and unchanged my content/actions for all available query outcomes; preserve current create/owner/member/navigation assertions and avoid claiming debounce coverage until US2.

### Implementation for User Story 1

- [X] T012 [US1] Create `backend/src/classrooms/dto/find-available-classrooms-query.dto.ts` and bind it through `@Query()` in `backend/src/classrooms/classrooms.controller.ts`; implement optional scalar text with external trim before a maximum of 80 Unicode code points, valid empty input, Portuguese errors, raw-type preservation against implicit conversion and whitelist rejection of extra query fields, without changing `backend/src/configure-app.ts` or JWT/role rules.
- [X] T013 [US1] Update the available-list criterion in `backend/src/classrooms/classrooms.service.ts` to omit the name filter for normalized empty input and escape backslash, `%` and `_` before literal case-insensitive `contains`; preserve significant accents, membership exclusion, response projection and existing order, and validate the escaping against the installed Prisma/PostgreSQL behavior in T006.
- [X] T014 [US1] Synchronize search Swagger documentation in `backend/src/classrooms/classrooms.controller.ts` and `specs/001-app-quality-readiness/contracts/openapi.json` with `specs/006-classroom-search-fix/contracts/classroom-search.md`; preserve `classrooms.findAvailable`, the closed optional scalar input, empty/trim/80-code-point rules, existing errors and `ClassroomSummary[]`, avoiding an unnecessary public DTO schema or synchronizing its canonical inventory if runtime emits one.
- [X] T015 [US1] Create `mobile/src/validations/classroomSearch.schema.ts` using existing Zod to expose normalization/validation for external trim and at most 80 Unicode code points, with empty valid, no Unicode/case/accent rewriting and no truncation; implement the data-model rule “Preserva espaços internos, caixa, acentos, números e pontuação.” and the exact message `Use até 80 caracteres na pesquisa`.
- [X] T016 [US1] Update `classroomKeys.available(search)` in `mobile/src/config/query-keys.ts` to use external-trim normalization and the empty variant for absent/empty/whitespace terms, retaining the existing key shape and other factories for current consumers; introduce the root prefix separately in US3.
- [X] T017 [US1] Normalize valid search input in `mobile/src/services/classes/classroom.service.ts` and `mobile/src/hooks/useAvailableClassrooms.ts`, omit the empty HTTP parameter and support disabling the available query for invalid input while retaining compatible default behavior for existing callers; keep `getMyClassrooms` and its query independent.
- [X] T018 [US1] Wire the schema to the visible text and available query in `mobile/app/(app)/(tabs)/classrooms.tsx`, place the existing FormField under `Turmas disponíveis` with `Buscar turma pelo nome`, display the validation error and preserve raw text according to “Campo exibe imediatamente o texto digitado, sem truncamento.”; do not set `TextInput.maxLength=80`, hide invalid-input cards and leave my-list state/actions unchanged, preparing replacement of local search state by the US2 hook.
- [X] T019 [US1] Run the new DTO/controller/service, classroom HTTP/PostgreSQL, OpenAPI, mobile schema/service/key/list suites using the directed commands in `specs/006-classroom-search-fix/quickstart.md`; record the US1 matrix, backend/mobile parity, preserved my-list/auth behavior and failures in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` before moving to US2.

**Checkpoint**: US1 search semantics, validation and membership exclusion are independently proven. This is the MVP of finding classrooms; the full debounce/state/cache feature still requires US2 and US3.

---

## Phase 4: User Story 2 - Compreender e controlar o estado da busca (Priority: P2)

**Goal**: Keep immediate editing while applying one 300 ms pause, current-term presentation, explicit states, accessible clear and precise retry.

**Independent Test**: Control timers and A/B promises. At 299 ms no edit-triggered call occurs; at 300 ms only the final normalized value is queried. Resolve/reject A after B, including during waiting and clearing: A cannot replace B's loading/error/results. Distinguish invalid, waiting, loading/refetch, results, no-match, general empty and error while preserving raw text and my-list state.

### Tests for User Story 2

- [X] T020 [P] [US2] Add `mobile/tests/hooks/useClassroomSearch.spec.tsx` with fake timers for immediate raw text, 299/300 ms, continuous edits, equivalent trim edits without duplicate lookup, timer restart/unmount cleanup, invalid blocking, clearing feedback immediately with empty query only after the pause, initial unfiltered load without an edit and retry limited to the current valid settled term.
- [X] T021 [P] [US2] Add `mobile/tests/hooks/useAvailableClassrooms.spec.tsx` using a real QueryClient and controlled promises to test enabled gating, normalized identity, queryFn-to-Axios cancellation, no previous-term placeholder, A/B results and rejections out of order, stale reactivation/refetch and error over cached data; extend `mobile/tests/services/classroom.service.spec.ts` for AbortSignal forwarding without changing error/session handling.
- [X] T022 [P] [US2] Extend `mobile/tests/routes/classrooms-list.spec.tsx` for invalid/waiting/loading/results/contextual no-match/general empty/error priority, clear/retry semantics, old response/error suppression during edits and clear, non-actionable stale/refetch cards and independent my-list loading/error/content; assert accessible labels and the exact search/validation/no-match messages from `specs/006-classroom-search-fix/contracts/classroom-search.md`.

### Implementation for User Story 2

- [X] T023 [US2] Create `mobile/src/hooks/useClassroomSearch.ts` using the US1 schema to own rawText, normalizedTerm, nullable validationError, settledTerm, waiting and timer; enforce “Atualizado após 300 ms desde a última edição; valor enviado/chave observada.”, “Pausa pendente; não apresenta resultados/erro de critério anterior.” and “Uma pausa por hook, limpa em edição e desmontagem.” from `specs/006-classroom-search-fix/data-model.md`, including every edit/clear, no duplicate request for an already-current equivalent criterion and retry availability only for a valid current settled term.
- [X] T024 [US2] Extend `mobile/src/hooks/useAvailableClassrooms.ts` and `mobile/src/services/classes/classroom.service.ts` to consume the queryFn AbortSignal in Axios, gate queries during waiting/validation and use only the normalized settled key without previous-term placeholder; ensure reactivated stale queries actually refresh under current configuration and keep cancellation separate from user-facing query errors.
- [X] T025 [US2] Compose the search hook and query state in `mobile/app/(app)/(tabs)/classrooms.tsx` with precedence validation → waiting → current error → loading/refresh → results/vazio; hide old or invalidated available cards even when `isLoading` is false, provide `Nenhuma turma encontrada para «termo»`, accessible `Limpar pesquisa` and guarded `Tentar novamente`, preserve raw text, keep the general empty state only for empty settled search and maintain my-list states, cards and actions.
- [X] T026 [US2] Extend `mobile/tests/routes/theme-surfaces.spec.tsx` to cover search field/error/waiting/loading/no-match/retry/clear under Claro and Escuro and a live theme switch during typing/feedback; use the active palette in `mobile/app/(app)/(tabs)/classrooms.tsx` and existing FormField/Button/ScreenState primitives, asserting that switching themes does not reset raw text, restart the timer or issue an extra query.
- [X] T027 [US2] Run the US2 schema/search/available/service/list/theme suites with the timer and out-of-order matrix in `specs/006-classroom-search-fix/quickstart.md`; record SC-002–SC-005, SC-008–SC-009 results and explicit native/manual limits in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` before moving to US3.

**Checkpoint**: The current search has predictable debouncing, states, clear/retry and race protection without replacing my classrooms by search feedback.

---

## Phase 5: User Story 3 - Manter resultados corretos após ações de turma (Priority: P3)

**Goal**: Refresh my and all relevant available variants after successful join/leave/delete, preventing stale participation actions without optimistic changes.

**Independent Test**: Seed empty/matemática/história variants with an active filtered query and inactive caches. Join removes from available/adds to my; leave reverses eligibility; delete removes everywhere. Revisit inactive variants before staleTime expires and resolve a pre-mutation first query late. No incompatible card becomes actionable. Pending/failure/cancel leave participation intact; refetch failure after server success is a query error, not mutation reversal.

### Tests for User Story 3

- [X] T028 [P] [US3] Add `mobile/tests/hooks/useJoinClassroom.spec.tsx` with the real-query helper to prove successful join cancels old my/available requests before prefix invalidation, awaits active refresh, invalidates empty and multiple inactive terms without immediately fetching every inactive variant, and yields authoritative membership on reactivation; cover first pending snapshot resolving late, mutation pending/failure and successful mutation followed by failed list refresh rather than only spying on `invalidateQueries`.
- [X] T029 [P] [US3] Extend `mobile/tests/hooks/useLeaveClassroom.spec.tsx` with active/inactive real-query scenarios proving eligible matching reappearance after leave, cancellation-before-invalidation, awaited refresh, stale variant reactivation and no false participation change on failure/pending; retain no automatic mutation retry and announcement invalidation assertions and separate server success from list-refresh failure.
- [X] T030 [P] [US3] Extend `mobile/tests/hooks/useDeleteClassroom.spec.tsx` with active/inactive real-query scenarios proving deleted classrooms never reappear from pre-success pending snapshots or cached terms, cancellation-before-invalidation and awaited refresh; retain announcement scope, retry policy, duplicate-submission guard and pending/failure behavior, including list-refresh failure after confirmed deletion.
- [X] T031 [P] [US3] Extend `mobile/tests/config/query-keys.spec.ts` to assert `classroomKeys.availableRoot()` equals `['classrooms', 'available']`, matches every normalized available variant and does not match my/detail/announcement keys; preserve compatibility of `available()` for creation/profile consumers.

### Implementation for User Story 3

- [X] T032 [US3] Add `classroomKeys.availableRoot()` in `mobile/src/config/query-keys.ts` and compose `available(term)` from that prefix, preserving its normalized three-element key and all existing consumers.
- [X] T033 [P] [US3] Make `onSuccess` in `mobile/src/hooks/useJoinClassroom.ts` asynchronous: await cancellation of my and the available-root requests before invalidating both families, await active refetch and leave inactive variants invalidated for reactivation; avoid optimistic membership changes or converting a refresh error into failure of the already-successful join.
- [X] T034 [P] [US3] Update `mobile/src/hooks/useLeaveClassroom.ts` to await cancellation of old my/available-root requests before awaited family invalidation, preserving existing announcement invalidation and `retry: false`; leave inactive variants stale and preserve successful leave even if list refresh fails, with no optimistic change on pending/failure.
- [X] T035 [P] [US3] Update `mobile/src/hooks/useDeleteClassroom.ts` to cancel old my/available-root requests before awaited family invalidation while retaining classroom announcement invalidation, `retry: false`, `inFlightRef`, both mutation wrappers and their settlement semantics; prevent late query snapshots from restoring deleted cards without adding optimistic deletion or reversing confirmed server success after refresh error.
- [X] T036 [US3] Add `mobile/tests/routes/classroom-search-consistency.spec.tsx` using the actual list route, actual search/query/mutation hooks, controlled services and a real QueryClient; exercise join/leave/delete under active filters, inactive-term revisit, late pre-mutation response, non-actionable refresh cards, query-error retry after successful mutation and failed/cancelled/pending actions, preserving confirmations and destinations in `mobile/app/(app)/(tabs)/classrooms.tsx` and reusing `mobile/tests/helpers/classroom-search.tsx` instead of route-hook mocks for this freshness proof.
- [X] T037 [US3] Run the three mutation hook suites, available-hook suite and real-route consistency suite, plus the unchanged confirmation matrix per `specs/006-classroom-search-fix/quickstart.md`; record FR-018–FR-021/SC-006–SC-007 and late-snapshot/refetch-failure evidence in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` before closing the story.

**Checkpoint**: Confirmed participation updates all search families; stale snapshots and inactive-cache reuse cannot expose incompatible actions, and failed/cancelled/pending mutations do not simulate success.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Validate preserved behavior across consumers, quality gates, device observations and full requirements coverage.

- [X] T038 Extend relevant regression assertions in `mobile/tests/routes/confirmation-matrix.spec.tsx` and `mobile/tests/accessibility/touch-targets.spec.tsx` for changed search/clear/retry controls and preserved create/open/join/leave/delete semantics, accessible names/roles/reading order and project touch targets; run Home, classroom details, list, theme and mutation-consumer regressions in `mobile/tests/routes/home.spec.tsx`, `mobile/tests/routes/classroom-details.spec.tsx`, `mobile/tests/routes/theme-surfaces.spec.tsx`, `mobile/tests/hooks/useCreateClassroom.spec.tsx` and `mobile/tests/hooks/useUpdateProfile.spec.tsx`, recording results in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` without redesigning those surfaces.
- [X] T039 Run all backend gates from `backend/package.json` and `specs/006-classroom-search-fix/quickstart.md` on the isolated test environment: Prisma validation/generation/existing migrate deploy, `format:check`, `lint`, `typecheck`, `test:cov`, `test:integration`, `test:contract`, `test:e2e` and `build`; record each command/status, existing failures and warnings in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` without weakening test-database protection or changing unrelated code.
- [X] T040 Run the complete directed mobile matrix, including `mobile/tests/routes/classroom-search-consistency.spec.tsx`, and the gates from `mobile/package.json`: `typecheck`, `lint`, `format:check`, `doctor`, `test:ci` and `export:ci`; record results, assertion/exit status, `act`/handle warnings and any preexisting/global failure separately in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md` without changing packages/lockfiles to hide an unrelated failure.
- [X] T041 Execute the Android Claro/Escuro walkthrough in `specs/006-classroom-search-fix/quickstart.md` against `mobile/app/(app)/(tabs)/classrooms.tsx`, including keyboard/focus, 80/81-character paste, slow/offline recovery, latest-term states, filter-active actions, cancellation, theme switch, enlarged text, labels/reading order/contrast/targets and TalkBack when available; record device/version/font scale/assistive technology and each observation in `specs/006-classroom-search-fix/evidence/classroom-search-validation.md`, leaving unavailable Android, iOS/VoiceOver or usability observations `NOT MEASURED` rather than inferring them from Jest/Doctor/export.
- [X] T042 Audit FR-001–FR-024 and SC-001–SC-010 against `specs/006-classroom-search-fix/spec.md`, `specs/006-classroom-search-fix/contracts/classroom-search.md`, the final source/test diff and `specs/006-classroom-search-fix/evidence/classroom-search-validation.md`; run root `git diff --check`, verify `backend/prisma/schema.prisma`, migrations, `backend/package.json`, `mobile/package.json` and lockfiles stay within the no-change boundary, confirm no new API/response/permission/my-filter/unrelated capability, and distinguish implemented automated coverage from remaining manual evidence before reporting completion.

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: T001
  → Phase 2: T002 → T003
    → Phase 3: US1 / T004–T019
      → Phase 4: US2 / T020–T027
        → Phase 5: US3 / T028–T037
          → Phase 6: T038–T042
```

- Setup/foundation precede every story; story checkpoints precede the next phase.
- US1 implementation edges: T012 follows T004–T005; T013 follows T005–T006 and T012; T014 follows T007 and T012–T013; T015 follows T008; T016 follows T010 and T015; T017 follows T009, T012–T016; T018 follows T011, T015–T017. T019 follows all US1 implementation/tests.
- US2 edges: T020–T022 follow T019; T023 follows T020; T024 follows T021 and T023; T025 follows T022–T024; T026 follows T025; T027 follows T020–T026.
- US3 edges: T028–T031 follow T027; T032 follows T031; T033 follows T028/T032, T034 follows T029/T032 and T035 follows T030/T032. T036 follows T033–T035; T037 follows all US3 work.
- Polish: T038 follows T037; T039–T041 follow T038; T042 closes after their outcomes are recorded. Serialize writes to the shared evidence file even if gate processes run concurrently.

### User Story Dependencies

- **US1/P1** depends on foundation and the existing theme/authorization infrastructure; it is the name-search MVP.
- **US2/P2** depends on US1 normalization, validation and normalized query identity. It has its own observable state/timer checkpoint.
- **US3/P3** depends on US1 queries and US2 freshness/presentation to prove cards cannot offer stale participation actions. Prefix preparation alone is not full US3 completion.
- Each story has an independent acceptance test after its stated prerequisites; shared-file edits and real semantic dependencies prevent concurrent execution of entire story phases.

### Parallel Opportunities

- T004–T011 can establish US1 failing expectations in parallel after foundation because they own different test files. Backend implementation T012–T014 and mobile schema/key work T015–T016 can proceed as separate lanes after the relevant tests, respecting the explicit edges.
- T020–T022 can establish US2 failing expectations in parallel. T021 edits the service test only after US1 T009 is complete; T022 edits the list test only after US1 T011 is complete.
- T028–T031 can establish US3 failing expectations in parallel. Once T032 and their respective tests are complete, T033–T035 can change the three separate mutation hooks concurrently.
- Do not concurrently edit query keys for T016/T032, service/hook files for T017/T024, route files for T018/T025, or shared evidence entries. `[P]` remains subject to phase boundaries and live prerequisite readiness.

## Parallel Execution Examples

### User Story 1

```text
After T003:
  T004: backend/src/classrooms/dto/find-available-classrooms-query.dto.spec.ts
  T006: backend/test/classrooms.integration.spec.ts
  T008: mobile/tests/validations/classroomSearch.schema.spec.ts
  T010: mobile/tests/config/query-keys.spec.ts
```

### User Story 2

```text
After T019:
  T020: mobile/tests/hooks/useClassroomSearch.spec.tsx
  T021: mobile/tests/hooks/useAvailableClassrooms.spec.tsx + services/classroom.service.spec.ts
  T022: mobile/tests/routes/classrooms-list.spec.tsx
Implementation follows the timer/query/presentation edges; do not parallelize shared source edits.
```

### User Story 3

```text
After T027: T028, T029, T030 and T031 prepare separate test files.
After T032 and each corresponding hook test:
  T033: mobile/src/hooks/useJoinClassroom.ts
  T034: mobile/src/hooks/useLeaveClassroom.ts
  T035: mobile/src/hooks/useDeleteClassroom.ts
```

## Implementation Strategy

### MVP First (US1 Only)

1. Complete T001–T003 and establish the US1 failing expectations.
2. Deliver backend DTO/criterion/contract and client normalization/query/field wiring.
3. Complete T019 and stop at the US1 checkpoint for review. Do not claim debounce, explicit full-state behavior or mutation cache consistency from this MVP.

### Incremental Delivery

1. US1 delivers correct name semantics, limits and eligible results.
2. US2 adds 300 ms control, latest-term states, cancellation, clear/retry and theme continuity.
3. US3 adds all-variant refresh and real-cache/route proof after confirmed participation actions.
4. Complete regression/gates and available device observations, then audit coverage and remaining evidence limits.

### Notes

- All 42 tasks start unchecked. Generation does not implement code, execute feature acceptance gates or create the evidence file.
- Use failing expectations to prove new behavior; tests for unchanged behavior may already pass. Checkpoints require execution and honest evidence, not just checked task boxes.
- When executing an authorized subset of phases, stop at that phase's checkpoint. Later tasks remain open.
- Backend/controller mocks do not establish real substring semantics, invalidation spies do not establish cache freshness and automated exports do not establish native usability.
