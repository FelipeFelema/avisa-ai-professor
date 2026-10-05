---
description: "Task list for feature implementation"
---

# Tasks: Detail Surfaces Visual Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Input**: Design documents from `/specs/004-detail-surfaces-visual-polish/`

**Prerequisites**: `plan.md` and `spec.md` (required), `research.md`, `data-model.md`, `contracts/detail-surfaces.md`, and `quickstart.md`.

**Organization**: Tasks follow the three user stories in priority order. Each story has its own tests and checkpoint after the shared baseline.

**Scope guardrails**:

- Alter only the classroom detail, announcement detail, Profile, and `AnnouncementCard`; adjust a shared visual primitive only if these surfaces directly require it and its other consumers are covered by regression tests.
- Preserve hooks, queries, mutations, ownership, authorship, `PROFESSOR` visibility for `+ Novo`, confirmations, duplicate-submission guards, feedback, cache invalidation, navigation, and server expiration rules.
- Do not change backend, OpenAPI, Prisma, services, domain types, packages, lockfiles, theme preferences, search, profile editing, password management, or account deletion.
- Use Android for primary manual evidence. Record any unobserved device, version, text scale, TalkBack, iOS/VoiceOver, or participant result as `NOT MEASURED`.

## Phase 1: Setup (Existing Mobile Baseline)

**Purpose**: Confirm the already delivered spec 003 foundation and the exact mobile-only change boundary.

- [x] T001 Verify the spec 003 expiration helper, current visual tokens and shared UI primitives, route/test paths, and unchanged package/API/schema boundary in `mobile/src/lib/classroom-expiration.ts`, `mobile/src/theme/tokens.ts`, `mobile/src/theme/auth.ts`, `mobile/src/components/ui/`, `mobile/package.json`, `backend/prisma/schema.prisma`, and `specs/004-detail-surfaces-visual-polish/plan.md`.

---

## Phase 2: Foundational (Regression Baseline)

**Purpose**: Establish the behavior that the visual changes must preserve.

**⚠️ CRITICAL**: Complete this phase before changing any story surface.

- [x] T002 Run the existing directed mobile suites from `specs/004-detail-surfaces-visual-polish/quickstart.md` against `mobile/tests/lib/classroom-expiration.spec.ts`, `mobile/tests/routes/classroom-details.spec.tsx`, `mobile/tests/routes/profile.spec.tsx`, `mobile/tests/routes/confirmation-matrix.spec.tsx`, `mobile/tests/routes/secondary-navigation.spec.tsx`, and `mobile/tests/accessibility/touch-targets.spec.tsx`; record baseline results and existing failures in `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md`.

**Checkpoint**: Existing expiration, action, navigation, profile, and accessibility behavior has an explicit baseline.

---

## Phase 3: User Story 1 - Consultar os comunicados de uma turma (Priority: P1) 🎯 MVP

**Goal**: Show classroom context before the announcement section, keep readable cards and valid expiration labels, and place the role-appropriate destructive action after the list or its recoverable state.

**Independent Test**: Render the classroom detail for owner and non-owner with populated, empty, loading, error, 404, and absent-classroom states. Verify heading/order, `+ Novo` criterion and destination, card contents/navigation, expiration labels, final action, and preserved confirmation/mutation behavior without changing the other two screens.

### Tests for User Story 1

- [x] T003 [P] [US1] Add `AnnouncementCard` tests for title → `Professor • {nome}` → at least the current three-line content preview → secondary expiration label, exact `Expira hoje`/`Expira em 1 dia`/`Expira em X dias` results, omitted invalid/past labels, and the single accessible press destination in `mobile/tests/components/AnnouncementCard.spec.tsx`.
- [x] T004 [P] [US1] Extend `mobile/tests/routes/classroom-details.spec.tsx` for classroom name → `Comunicados`/conditional `+ Novo` → ordered cards or `Nenhum comunicado` → contextual action; cover `PROFESSOR` creation destination, owner/member visibility, unknown user, classroom loading/error/absence, announcement loading/error/404, and retry or safe return.
- [x] T005 [P] [US1] Extend `mobile/tests/routes/confirmation-matrix.spec.tsx` for owner `Excluir turma` and member `Sair da turma` after populated and empty lists, checking destructive treatment, named target/consequence, cancel, pending, duplicate-tap guard, error recovery, correct mutation, and `/classrooms` navigation only after success.

### Implementation for User Story 1

- [x] T006 [US1] Replace the local day calculation in `mobile/src/components/announcements/AnnouncementCard.tsx` with `getClassroomAnnouncementExpirationLabel` from `mobile/src/lib/classroom-expiration.ts`; keep the existing card data and open action, use a secondary textual label only for a valid future/current expiry, and avoid negative or misleading labels without filtering items.
- [x] T007 [US1] Recompose `mobile/app/(app)/classrooms/[id].tsx` with the classroom name as context before the `Comunicados` section and its `PROFESSOR`-only `+ Novo`; render cards or empty state before the final destructive `Excluir turma`/`Sair da turma` button, retain the valid contextual action after recoverable announcement loading/error, and suppress it for absent/404 classroom or unidentified user while preserving existing handlers and `SecondaryScreen` exits.

**Checkpoint**: Run the US1 card, classroom-detail, and confirmation tests. The classroom detail can be reviewed independently as the MVP.

---

## Phase 4: User Story 2 - Ler um comunicado completo (Priority: P2)

**Goal**: Give the full announcement a clear title, author, publication/expiry metadata, readable body, and author-only actions.

**Independent Test**: Render short and long announcements as author and non-author, including line breaks, loading, recoverable error, 404, and missing data. Check the full reading order, intact `pt-BR` dates, edit/delete results, and safe secondary navigation without relying on Profile or classroom-detail layout.

### Tests for User Story 2

- [x] T008 [P] [US2] Add announcement-detail tests in `mobile/tests/routes/detail-surfaces.spec.tsx` for title heading → `Professor • {nome}` → associated `Publicado em`/`Expira em` values → complete body with line breaks; cover long values, author-only actions without empty reserved space, `/announcements/{id}/edit`, loading, retryable error, 404, and missing-item return.
- [x] T009 [P] [US2] Extend `mobile/tests/routes/confirmation-matrix.spec.tsx` for announcement deletion as author versus non-author, confirming target/consequence, cancel, pending, duplicate-tap guard, error in the dialog, unchanged mutation arguments, and `router.back()` only after success.
- [x] T010 [P] [US2] Extend `mobile/tests/routes/secondary-navigation.spec.tsx` to assert the announcement detail keeps the single back control and `/classrooms` fallback through loading, error, and absent-item states, and uses its classroom fallback when the announcement is present.

### Implementation for User Story 2

- [x] T011 [US2] Refine `mobile/app/(app)/announcements/[id].tsx` so the title remains the principal accessible heading, authorship follows it, each existing `pt-BR` date stays visibly paired with its label in a distinct metadata group, and the full body wraps with paragraph breaks and scrolls without fixed height; keep author-only edit/delete controls, confirmation handlers, and `SecondaryScreen` behavior intact.

**Checkpoint**: Run the US2 detail, confirmation, and secondary-navigation tests; verify both author and non-author states independently.

---

## Phase 5: User Story 3 - Conferir o próprio perfil (Priority: P3)

**Goal**: Align Profile's header, identity, account information, and existing actions with the current visual language while keeping session states and routes unchanged.

**Independent Test**: Render an authenticated user with normal and long name/email/role, loading, and unavailable-user states. Verify avatar, Nome/E-mail/Perfil values, edit/logout actions, processing, and `Entrar` without depending on either detail route.

### Tests for User Story 3

- [x] T012 [US3] Extend `mobile/tests/routes/profile.spec.tsx` for `Meu perfil` → avatar → Nome → E-mail → Perfil → `Editar perfil` → `Sair da conta` order, original values and long-text wrapping, `/profile/edit`, destructive logout loading and `/login`, and distinct loading versus unavailable-user states with `Entrar`.

### Implementation for User Story 3

- [x] T013 [US3] Refine `mobile/app/(app)/(tabs)/profile.tsx` with existing `theme`/`AUTH_THEME` tokens so the header and identity match the authenticated surfaces, long name/email/role can wrap beside decorative icons at narrow widths or enlarged text, and the existing avatar initial, edit route, logout pending state, and `ScreenState` branches remain operable; add no account controls.

**Checkpoint**: Run the Profile route tests and verify authenticated, loading, and unavailable-user states independently.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Check accessibility and functional regressions across all three surfaces, then record what was and was not observed.

- [x] T014 Extend `mobile/tests/accessibility/touch-targets.spec.tsx` for the altered announcement card and route controls: accessible names/roles, heading and reading order, pressed/focus treatment, text plus destructive meaning, and project minimum targets of 48 dp on Android and 44 pt on iOS.
- [x] T015 Complete the scenario matrix in `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md` for US1 owner/member and list states, expiration cases, US2 authorship/body/states, US3 account/session states, navigation, confirmations, long content, narrow width, enlarged text, and accessibility; classify each observation `PASS`, `WARN`, `FAIL`, `NOT RUN`, or `NOT MEASURED`.
- [x] T016 Run the directed and full mobile Jest gates described in `specs/004-detail-surfaces-visual-polish/quickstart.md` against `mobile/tests/`, including the new `AnnouncementCard` and announcement-detail suites, and record outcomes plus any pre-existing/global failure separately in `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md`.
- [x] T017 Run `typecheck`, `lint`, `format:check`, Expo Doctor, and `export:ci` from `mobile/package.json` as directed by `specs/004-detail-surfaces-visual-polish/quickstart.md`; record each result in `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md` without treating Doctor/export as manual usability proof.
- [x] T018 Execute the Android walkthrough in `specs/004-detail-surfaces-visual-polish/quickstart.md` against `mobile/app/(app)/classrooms/[id].tsx`, `mobile/app/(app)/announcements/[id].tsx`, and `mobile/app/(app)/(tabs)/profile.tsx`; record device/version, text scale, available assistive technology, owner/member/author states, actions, long content, narrow layout, and visual observations in `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md`, marking every unavailable measurement `NOT MEASURED`.
- [x] T019 Audit the final diff against `specs/004-detail-surfaces-visual-polish/spec.md`, `specs/004-detail-surfaces-visual-polish/contracts/detail-surfaces.md`, `backend/prisma/schema.prisma`, `mobile/package.json`, and `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md`; account for FR-001–FR-023 and SC-001–SC-010 and confirm no API, domain, search, theme, account-management, or primary-surface scope change.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 verifies the current repo and spec 003 foundation.
- **Foundational (Phase 2)**: T002 follows T001 and captures the regression baseline before code changes.
- **US1 (Phase 3)**: T003–T005 can begin after T002; T006 follows T003; T007 follows T004–T006.
- **US2 (Phase 4)**: T008–T010 can begin after T002 and work in separate files; T011 follows their expectations. US2 is independently testable and has no code dependency on US1.
- **US3 (Phase 5)**: T012 begins after T002; T013 follows T012. US3 is independently testable and has no code dependency on US1 or US2.
- **Polish (Phase 6)**: T014 follows the three implementation tasks; T015 establishes the final matrix; T016–T018 add automated and observed results; T019 closes the scope audit after those results.

### User Story Dependencies

- **US1 (P1)**: Depends on the existing spec 003 helper and shared UI only; it is the MVP.
- **US2 (P2)**: Uses existing `SecondaryScreen`, `ScreenState`, `Button`, and `ConfirmationDialog` directly; it does not require the US1 layout.
- **US3 (P3)**: Uses existing authentication data and UI tokens; it does not require either detail route.

### Parallel Opportunities

- US1 tests T003–T005 target separate files and can be prepared in parallel before implementation.
- US2 tests T008–T010 target separate files and can be prepared in parallel before implementation.
- After T002, story tests and route implementations can be scheduled by priority while maintaining separate story checkpoints; do not edit the shared `confirmation-matrix.spec.tsx` simultaneously for T005 and T009.

## Parallel Execution Examples

### User Story 1

```text
T003: mobile/tests/components/AnnouncementCard.spec.tsx
T004: mobile/tests/routes/classroom-details.spec.tsx
T005: mobile/tests/routes/confirmation-matrix.spec.tsx
```

### User Story 2

```text
T008: mobile/tests/routes/detail-surfaces.spec.tsx
T009: mobile/tests/routes/confirmation-matrix.spec.tsx
T010: mobile/tests/routes/secondary-navigation.spec.tsx
```

### User Story 3

```text
T012: mobile/tests/routes/profile.spec.tsx
T013 follows T012: mobile/app/(app)/(tabs)/profile.tsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001–T002, then write and observe the new US1 test expectations.
2. Complete T006–T007 and run the US1 checkpoint.
3. Review the classroom detail independently before starting the P2 and P3 refinements.

### Incremental Delivery

1. Deliver and validate US1 classroom detail and announcement cards.
2. Deliver and validate US2 announcement detail and author actions.
3. Deliver and validate US3 Profile and session states.
4. Complete T014–T019, including the available Android observations and explicit evidence limits, before closing spec 004 or beginning spec 005.

### Notes

- Every task uses a checkbox, sequential ID, optional `[P]`, story label only inside a story phase, and explicit file path(s).
- New tests should establish the specified observable behavior before each implementation change; keep existing passing regression assertions intact.
- Automated gates cannot establish visual layout, text scaling, or assistive-technology usability without direct observation.

## Phase 7: Convergence

- **T020 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha especializada de layout/contraste nativo. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T021 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha TalkBack/VoiceOver das superfícies de detalhe. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
