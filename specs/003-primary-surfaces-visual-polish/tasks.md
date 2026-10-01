---
description: "Task list for feature implementation"
---

# Tasks: Primary Surfaces Visual Polish

**Input**: Design documents from `/specs/003-primary-surfaces-visual-polish/`

**Prerequisites**: `plan.md` and `spec.md` (required), `research.md`, `data-model.md`, `contracts/primary-surfaces.md`, and `quickstart.md`.

**Organization**: Tasks are dependency-ordered and grouped by user story so each story can be validated as an independent increment after the shared contract foundation.

**Scope guardrails**:

- Alter only Home, Turmas, their directly shared classroom card/empty-state primitives, and the existing classroom-summary response needed for `expiresAt`.
- Do not add dependencies, Prisma schema changes, migrations, new endpoints, search semantics, theme preferences, detail/Profile changes, or new domain rules.
- Preserve the current query keys, search parameter, active-announcement selection, permissions, navigation, mutations, confirmations, cache invalidation, and feedbacks.
- Treat Android as the primary manual evidence target; record unavailable iOS, VoiceOver, participant, device, or unexecuted evidence as `NOT MEASURED`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing monorepo baseline and the feature's no-dependency/no-migration boundary before implementation.

- [X] T001 [P] Confirm the existing scripts, dependencies, lockfiles, and no-migration boundary against `backend/package.json`, `backend/package-lock.json`, `mobile/package.json`, `mobile/package-lock.json`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, and `specs/003-primary-surfaces-visual-polish/plan.md`.

---

## Phase 2: Foundational (Read-Only Classroom Summary Contract)

**Purpose**: Extend the existing classroom summary with the persisted announcement expiration moment without changing selection, authorization, membership, search, or mutation behavior.

**⚠️ CRITICAL**: Complete this phase before the user-story phases.

### Contract tests and regression coverage

- [X] T002 [P] Add unit coverage for `expiresAt`, active-announcement filtering, newest-announcement selection, and `null` mapping in both list methods in `backend/src/classrooms/classrooms.service.spec.ts`.
- [X] T003 [P] Add integration coverage for `GET /api/v1/classrooms/my` and `GET /api/v1/classrooms?search={texto}` in `backend/test/classrooms.integration.spec.ts`, asserting the active announcement's ISO expiration, the no-announcement shape, and unchanged membership/search behavior.
- [X] T004 [P] Extend the canonical response expectation and runtime contract assertions for required `LastAnnouncementSummary.expiresAt` with `format: date-time` in `specs/001-app-quality-readiness/contracts/openapi.json` and `backend/test/openapi.contract.spec.ts`, without adding operations or changing unrelated schemas.
- [X] T005 [P] Add mobile service regression coverage for both classroom-list GET functions, including `expiresAt` pass-through and the unchanged `search` query parameter, in `mobile/tests/services/classroom.service.spec.ts`.

### Contract implementation

- [X] T006 Add `expiresAt` to `LastAnnouncementSummaryDto` and to both active-announcement Prisma projections/mappings in `backend/src/classrooms/dto/classroom-summary.dto.ts` and `backend/src/classrooms/classrooms.service.ts`, preserving the existing `expiresAt >= now`, `createdAt desc`, `take: 1`, membership, ownership, and search rules.
- [X] T007 Add the required ISO string field inside non-null `lastAnnouncement` in `mobile/src/types/classroom.ts`, keeping `teacher` and `lastAnnouncement` nullable and leaving the existing classroom service endpoints unchanged.

**Checkpoint**: The backend and mobile agree on the additive summary contract; no schema or migration is needed, and both list endpoints still return the same selected classroom/announcement records.

---

## Phase 3: User Story 1 - Compreender a Home rapidamente (Priority: P1) 🎯 MVP

**Goal**: Make Home's greeting, primary title, classroom summaries, expiration labels, and loading/error/empty/success states immediately understandable.

**Independent Test**: Render Home with populated, empty, loading, and failing `useMyClassrooms` states. Verify the greeting/title hierarchy, card information order, exact expiration labels, absence of misleading labels, accessible retry, and no error-to-empty conflation without relying on Turmas.

### Tests for User Story 1

- [X] T008 [P] [US1] Add unit tests in `mobile/tests/lib/classroom-expiration.spec.ts` for local calendar calculations using the optional `now`: `Expira hoje`, `Expira em 1 dia`, `Expira em X dias`, invalid/past timestamps returning `null`, and no negative result across local date boundaries.
- [X] T009 [P] [US1] Extend `mobile/tests/routes/home.spec.tsx` to cover the greeting/title hierarchy, populated cards, active/no announcement cases, loading, error with retry, success-empty CTA, exact expiration labels, and the absence of a negative or misleading expiration label.

### Implementation for User Story 1

- [X] T010 [US1] Implement the pure `getClassroomAnnouncementExpirationLabel` helper in `mobile/src/lib/classroom-expiration.ts`, comparing local year/month/day values, accepting a testable `now`, returning `null` for invalid/past input, and emitting only the three labels defined by the contract.
- [X] T011 [P] [US1] Update `HomeHeader` in `mobile/src/components/home/HomeHeader.tsx` with the existing theme/auth tokens, an accessible header boundary, natural text wrapping, and a greeting that is perceptibly smaller than `Bem-vindo ao Avisa Aí Professor`.
- [X] T012 [US1] Extend `ClassroomCard` in `mobile/src/components/home/ClassroomCard.tsx` with an optional active-announcement expiration input/secondary label, preserving the classroom/teacher/announcement order, natural wrapping, separate open-card `Pressable`, and separate `Entrar`/`Sair`/`Excluir turma` action control.
- [X] T013 [US1] Recompose Home in `mobile/app/(app)/(tabs)/index.tsx` to consume loading/error/refetch state, render `ScreenState` for loading and error, render the existing empty CTA only after successful empty data, and pass the selected announcement expiration to each `ClassroomCard` without changing the query or navigation.

**Checkpoint**: Home is independently usable and testable for all four query states, exact expiration labels, and the P1 acceptance scenarios.

---

## Phase 4: User Story 2 - Localizar seções e ações em Turmas (Priority: P2)

**Goal**: Give Turmas a clear introduction → search → Minhas turmas → Turmas disponíveis hierarchy while preserving every existing query, action, role rule, and search behavior.

**Independent Test**: Render Turmas for Professor and Responsável with each list loading, failing, empty, and populated. Verify section order, section association, one decorative search icon, role-based `Criar turma`, unchanged search input/request behavior, and unchanged classroom actions.

### Tests for User Story 2

- [X] T014 [P] [US2] Extend `mobile/tests/components/FormField.spec.tsx` to verify the optional leading search icon is exactly one `search-outline`, decorative/non-announced, and does not change the input's label, value, callback, disabled state, helper, or error semantics.
- [X] T015 [P] [US2] Extend `mobile/tests/routes/classrooms-list.spec.tsx` to verify visual order, Professor-only `Criar turma`, no reserved action space for Responsável, search value/callback preservation, and unchanged open/join/leave/delete labels and mutation wiring.
- [X] T016 [P] [US2] Extend `mobile/tests/routes/primary-states.spec.tsx` to verify independent loading/error/empty states for Minhas turmas and Turmas disponíveis, accessible section headings, retry actions, and no mixing of the two lists.

### Implementation for User Story 2

- [X] T017 [P] [US2] Add an optional decorative leading-icon prop to `FormField` in `mobile/src/components/ui/FormField.tsx`, rendering `Ionicons` with `search-outline` support while preserving the existing label/input/error/helper/accessibility contract and touch target.
- [X] T018 [P] [US2] Add contextual title/description options to `EmptyClassroomState` in `mobile/src/components/home/EmptyClassroomState.tsx`, preserving current defaults, explicit section association, accessible summary/header semantics, and the optional `Ver turmas` action.
- [X] T019 [US2] Compose the Turmas hierarchy in `mobile/app/(app)/(tabs)/classrooms.tsx` with accessible introduction and section headers, the decorative search icon, contextual empty states, and token-based responsive styles, while preserving query keys, `search`, loading/error/results, role visibility, confirmations, mutations, navigation, and ownership action selection.

**Checkpoint**: Turmas is independently testable for both profiles and both lists without any functional search or classroom-action change.

---

## Phase 5: User Story 3 - Ler cards e estados sem perder contexto (Priority: P3)

**Goal**: Make shared cards and empty states remain consistent, readable, and operable with long content, absent data, narrow layouts, enlarged text, and context-specific actions.

**Independent Test**: Compare Home, Minhas turmas, and Turmas disponíveis with long names/titles, missing teacher, no announcement, each action variant, narrow content, and enlarged text. Verify information order, no essential truncation/overlap, explicit empty meaning, and separation between opening a card and performing an action.

### Tests for User Story 3

- [X] T020 [P] [US3] Add cross-surface assertions in `mobile/tests/routes/home.spec.tsx` and `mobile/tests/routes/classrooms-list.spec.tsx` for long content, missing teacher/announcement, consistent card information order, contextual empty text, and distinct open versus enter/leave/delete controls.
- [X] T021 [P] [US3] Extend `mobile/tests/accessibility/touch-targets.spec.tsx` to cover the altered classroom card, empty-state, header, and search controls for project platform minimums, roles, names, visible focus/pressed treatment, and non-color-only action/expiration semantics.

### Implementation for User Story 3

- [X] T022 [US3] Refine the shared layout and accessibility behavior in `mobile/src/components/home/ClassroomCard.tsx` and `mobile/src/components/home/EmptyClassroomState.tsx` so variable text wraps naturally with no fixed content height or unjustified `numberOfLines`, actions stay in their own subtree, essential content remains readable, and empty-state meaning is explicit without changing domain actions.

**Checkpoint**: The same shared primitives serve all primary surfaces consistently, while every existing classroom action remains distinguishable and operable.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Validate the complete feature, capture available evidence, and make scope/evidence limitations explicit.

- [X] T023 Create the feature evidence matrix in `specs/003-primary-surfaces-visual-polish/evidence/primary-surfaces-validation.md`, with rows for Home/Turmas profiles, four Home states, expiration cases, search regressions, classroom actions, long content, enlarged text, and statuses `PASS`, `WARN`, `FAIL`, `NOT RUN`, or `NOT MEASURED`.
- [X] T024 Run the directed backend unit, integration, contract, typecheck, lint, format, and build commands from `specs/003-primary-surfaces-visual-polish/quickstart.md` against `backend/package.json`, and record results and any pre-existing/global failures in `specs/003-primary-surfaces-visual-polish/evidence/primary-surfaces-validation.md`.
- [X] T025 Run the directed mobile Jest, typecheck, lint, format, Expo Doctor, and export commands from `specs/003-primary-surfaces-visual-polish/quickstart.md` against `mobile/package.json`, and record results without treating export or Doctor as manual usability evidence in `specs/003-primary-surfaces-visual-polish/evidence/primary-surfaces-validation.md`.
- [X] T026 Execute the Android walkthrough described in `specs/003-primary-surfaces-visual-polish/quickstart.md` against `mobile/app/(app)/(tabs)/index.tsx` and `mobile/app/(app)/(tabs)/classrooms.tsx`, covering `PARENT`/`PROFESSOR`, states, expiration, search regression, actions, long content, narrow width, and enlarged text; record observations in `specs/003-primary-surfaces-visual-polish/evidence/primary-surfaces-validation.md`.
- [X] T027 Perform the final scope and contract audit against `specs/003-primary-surfaces-visual-polish/spec.md`, `specs/003-primary-surfaces-visual-polish/plan.md`, `specs/003-primary-surfaces-visual-polish/contracts/primary-surfaces.md`, `backend/prisma/schema.prisma`, and `specs/001-app-quality-readiness/contracts/openapi.json`, confirming no out-of-scope detail/Profile/theme/search/domain changes and marking unavailable iOS or human-audit evidence as `NOT MEASURED`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 has no implementation dependency and establishes the package, lockfile, schema, and migration boundary.
- **Foundational (Phase 2)**: T002–T005 can run in parallel after T001; T006 implements the backend contract after those expectations exist; T007 completes the mobile type contract after the backend shape is defined.
- **User Story 1 (Phase 3)**: Depends on T006–T007. T008–T009 can run in parallel; T010 precedes the expiration-aware card and Home composition; T011 can run alongside T012 after the helper is available; T013 is the story integration point.
- **User Story 2 (Phase 4)**: Depends on the foundation and the shared card API from T012. T014–T016 can run in parallel; T017–T018 can then run in parallel; T019 integrates the route.
- **User Story 3 (Phase 5)**: Depends on the completed Home and Turmas compositions (T013 and T019). T020–T021 can run in parallel; T022 applies the shared final refinements.
- **Polish (Phase 6)**: T023 follows implementation; T024–T027 depend on the feature implementation and directed tests, with T024/T025 executable independently before the manual Android walkthrough.

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on the foundational classroom-summary contract; it is the MVP increment.
- **User Story 2 (P2)**: Uses the shared `ClassroomCard` API from US1 but does not depend on Home behavior; it is independently testable for both profiles and list states.
- **User Story 3 (P3)**: Depends on both primary-surface compositions because its acceptance criteria compare Home, Minhas turmas, and Turmas disponíveis.

### Parallel Opportunities

- Foundation tests T002–T005 can run in parallel because they touch separate backend/OpenAPI/mobile test contracts.
- US1 tests T008–T009 can run in parallel; HomeHeader work T011 is independent from the expiration-aware card work after T010.
- US2 tests T014–T016 can run in parallel; FormField and EmptyClassroomState implementation T017–T018 can run in parallel before route integration T019.
- US3 coverage T020–T021 can run in parallel because they target route fixtures and shared accessibility checks separately.
- Backend validation T024 and mobile validation T025 may run in parallel when isolated environments are available; their results must be classified separately.

## Parallel Execution Examples

### Foundation

```text
Task T002: Add backend service unit expectations in backend/src/classrooms/classrooms.service.spec.ts
Task T003: Add classroom-list integration expectations in backend/test/classrooms.integration.spec.ts
Task T004: Extend the OpenAPI contract in specs/001-app-quality-readiness/contracts/openapi.json and backend/test/openapi.contract.spec.ts
Task T005: Add mobile classroom GET regression expectations in mobile/tests/services/classroom.service.spec.ts
```

### User Story 1

```text
Task T008: Add expiration helper tests in mobile/tests/lib/classroom-expiration.spec.ts
Task T009: Extend Home route tests in mobile/tests/routes/home.spec.tsx
```

### User Story 2

```text
Task T014: Extend FormField tests in mobile/tests/components/FormField.spec.tsx
Task T015: Extend Turmas route tests in mobile/tests/routes/classrooms-list.spec.tsx
Task T016: Extend primary state tests in mobile/tests/routes/primary-states.spec.tsx
```

### User Story 3

```text
Task T020: Add cross-surface content/action assertions in mobile/tests/routes/home.spec.tsx and mobile/tests/routes/classrooms-list.spec.tsx
Task T021: Extend accessibility and touch-target checks in mobile/tests/accessibility/touch-targets.spec.tsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001 and the foundational contract phase T002–T007.
2. Complete User Story 1 T008–T013.
3. Stop and validate Home independently with the directed tests and the available Android evidence.
4. Do not begin detail surfaces, theme preferences, or classroom-search-fix work.

### Incremental Delivery

1. Add the additive summary contract and prove it with backend, OpenAPI, and mobile regressions.
2. Deliver US1 Home and validate its four states and expiration labels.
3. Deliver US2 Turmas and validate profile-specific actions and unchanged search behavior.
4. Deliver US3 shared-card/empty-state resilience and validate long content/accessibility.
5. Run the complete gates and Android walkthrough, documenting unavailable evidence explicitly.

### Notes

- Every task uses the required checklist format: checkbox, sequential ID, optional `[P]`, optional user-story label, and explicit file path(s).
- No task authorizes a database migration, dependency installation, endpoint creation, search behavior change, or work in the next feature specs.
- Test harness timer/open-handle messages are classified according to the repository protocol when the relevant tests pass.
