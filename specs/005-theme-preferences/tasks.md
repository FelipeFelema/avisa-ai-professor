---
description: "Task list for feature implementation"
---

# Tasks: Theme Preferences

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Input**: Design documents from `/specs/005-theme-preferences/`

**Prerequisites**: `plan.md` and `spec.md` (required), `research.md`, `data-model.md`, `contracts/theme-preferences.md`, and `quickstart.md`.

**Tests**: The plan and quickstart explicitly require automated state, contrast, UI, and regression coverage. Write each listed test before its implementation and confirm that it fails for the missing behavior.

**Organization**: Shared palette and provider work precedes three user-story phases. US1 delivers immediate choice, US2 completes visual coverage, and US3 restores the saved preference before routing. Each story has an independent checkpoint.

**Scope guardrails**:

- Change only `mobile/` and the 005 evidence/artifacts. Keep the approved Claro palette except measured contrast corrections; add no package, backend endpoint, account field, Prisma migration, or system-following option.
- Preserve route identity, scroll, form values, keyboard, dialogs, pending operations, authentication, queries, permissions, validations, and domain behavior. Do not key the navigation tree by theme.
- Android is the primary manual target. Keep unobserved Android, launch-screen, contrast, TalkBack, iOS, and participant outcomes as `NOT MEASURED`; do not inherit manual evidence from spec 004, whose T020/T021 remain open.

## Phase 1: Setup (Existing Mobile Baseline)

**Purpose**: Record the actual color consumers, behavior baseline, and scope boundary before editing code.

- [x] T001 Inventory `theme.colors`, `AUTH_THEME.colors`, module-level `StyleSheet.create`, direct color literals, route/layout/status-bar consumers, and existing tests in `mobile/app/`, `mobile/src/components/`, `mobile/src/theme/`, and `mobile/tests/`; record the affected-file checklist and the mobile-only boundary in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`.
- [x] T002 Run existing theme, Profile, auth/navigation, classroom/detail, confirmation, and shared-component Jest suites from `mobile/tests/` before changes; record commands, baseline results, and pre-existing failures in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`.

---

## Phase 2: Foundational (Shared Palette and Theme State)

**Purpose**: Expose two semantic palettes and one stable in-memory theme source to all routes. Persistence and bootstrap are completed in their story phases.

**⚠️ CRITICAL**: Complete this phase before any user-story UI migration.

- [x] T003 Extend `mobile/tests/theme/tokens.spec.ts` to require identical semantic keys in `lightTheme` and `darkTheme`, shared `spacing`/`radius`/`typography`/`targets`/`elevation`, and the Base, Texto, Ação, Semântica, and Navegação/dialog roles listed in `specs/005-theme-preferences/data-model.md`.
- [x] T004 Define immutable `lightTheme`, `darkTheme`, and `Theme` in `mobile/src/theme/tokens.ts` and export them from `mobile/src/theme/index.ts`; preserve current Claro values unless contrast evidence requires a correction, and add explicit Escuro values for every role.
- [x] T005 Add a palette-derived auth projection in `mobile/src/theme/auth.ts` and `mobile/src/theme/index.ts`; retain a temporary Claro `AUTH_THEME` compatibility export until its existing consumers migrate in US2, keep shared metric aliases, and map `surfaceSoft`, `primaryDark`, `primarySoft`, `primaryBorder`, `muted`, `error`, and `errorSoft` from the supplied palette without a second color source.
- [x] T006 Add provider/hook tests in `mobile/tests/providers/ThemeProvider.spec.tsx` for exactly `'light' | 'dark'`, initial in-memory Claro, immediate palette change, idempotent selection, and stable child identity; do not claim persistence or startup restoration in this foundation test.
- [x] T007 Add `ThemeContext` in `mobile/src/contexts/ThemeContext.tsx`, `ThemeProvider` in `mobile/src/providers/ThemeProvider.tsx`, and `useTheme` in `mobile/src/hooks/useTheme.ts` with preference, active palette, setter, and warning state; keep the provider mounted through session changes.
- [x] T008 Mount `ThemeProvider` above `AuthProvider` in `mobile/src/providers/AppProvider.tsx` and make `mobile/app/_layout.tsx` consume the same stable provider tree, with no theme-based `key` or duplicate router/QueryClient.

**Checkpoint**: Palettes have matching contracts, and changing the in-memory theme re-renders a mounted consumer without losing its state.

---

## Phase 3: User Story 1 - Escolher o tema no Perfil (Priority: P1) 🎯 MVP

**Goal**: Give an authenticated person exactly Claro and Escuro in a distinct Profile section, change appearance immediately, and warn when local saving fails.

**Independent Test**: In a mounted Profile, switch both directions and repeat a selection. Check text and accessible selected state, immediate Profile colors, retained route/scroll/account actions, and current-session selection plus warning after a failed write. This checkpoint does not claim complete cross-app styling or restart restoration.

### Tests for User Story 1

- [x] T009 [P] [US1] Add write tests in `mobile/tests/storage/theme.storage.spec.ts` for a separate theme key, only raw `'light'` or `'dark'` values, successful/rejected AsyncStorage writes, and no deletion by token cleanup; test rapid-write ordering in the provider suite.
- [x] T010 [P] [US1] Extend `mobile/tests/routes/profile.spec.tsx` for a separate `Aparência`/`Tema` block after identity and before account actions, exactly `Claro`/`Escuro`, textual and semantic selection, idempotent taps, immediate Profile restyling without route/scroll loss, failure warning, and unchanged edit/logout handlers.
- [x] T011 [P] [US1] Extend `mobile/tests/providers/ThemeProvider.spec.tsx` for immediate selection during a pending write, ordered rapid selections, stale-failure suppression, final-failure warning, and warning reset on a later selection while the active palette remains unchanged by storage errors.

### Implementation for User Story 1

- [x] T012 [US1] Add a theme-only key in `mobile/src/constants/storage.ts` and AsyncStorage write support in `mobile/src/storage/theme.storage.ts`; save exactly `'light'` or `'dark'` as a string, keep it separate from SecureStore tokens, and do not clear it through `mobile/src/storage/auth.storage.ts`.
- [x] T013 [US1] Update `mobile/src/providers/ThemeProvider.tsx` so `setTheme` changes memory synchronously and queues AsyncStorage writes in selection order; use a monotonic selection version so only the latest failed choice shows the Portuguese non-persistence warning and no write error reverts the active theme.
- [x] T014 [US1] Add the accessible two-option appearance block and inline warning in `mobile/app/(app)/(tabs)/profile.tsx`; derive its colors during render from `useTheme`, retain the existing identity, `Editar perfil`, `Sair da conta`, and loading/unavailable branches, and never remount its `ScrollView` on theme change.

**Checkpoint**: Run `mobile/tests/storage/theme.storage.spec.ts`, `mobile/tests/providers/ThemeProvider.spec.tsx`, and `mobile/tests/routes/profile.spec.tsx`; demonstrate US1 with a mounted Profile in both directions and a simulated write failure.

---

## Phase 4: User Story 2 - Usar todas as superfícies nos dois temas (Priority: P2)

**Goal**: Apply the active semantic palette to every existing public, authenticated, secondary, shared, and preparatory React surface without changing behavior.

**Independent Test**: Force each palette in the provider and traverse the full surface inventory from `spec.md`; verify paired colors, field/action/dialog states, tabs/status bar, and live theme switches while forms, lists, and operations retain state. Startup persistence is tested separately in US3.

### Tests for User Story 2

- [x] T015 [P] [US2] Extend `mobile/tests/theme/tokens.spec.ts` with measured real foreground/background pairs for both palettes (normal text ≥ 4.5:1; large text ≥ 3:1), field/action/semantic state pairs, and a scan of `mobile/app/` and `mobile/src/components/` for theme-dependent color literals or fixed light `StyleSheet` colors.
- [x] T016 [P] [US2] Extend `mobile/tests/components/AuthScreen.spec.tsx` and add `mobile/tests/components/theme-auth-controls.spec.tsx` for `AuthScreen`, `AuthField`, `AuthButton`, and `AuthRolePicker` under both palettes, covering placeholder, focused, invalid, disabled, selected, pressed, and pending states without changing labels or input values.
- [x] T017 [P] [US2] Extend `mobile/tests/components/Button.spec.tsx`, `FormField.spec.tsx`, `ConfirmationDialog.spec.tsx`, `ScreenState.spec.tsx`, `BackButton.spec.tsx`, and `AnnouncementCard.spec.tsx` in `mobile/tests/components/` for theme propagation, neutral/destructive meaning, dialog/backdrop/error, loading/empty/not-found, and preserved handlers while mounted.
- [x] T018 [P] [US2] Add route/layout coverage in `mobile/tests/routes/theme-surfaces.spec.tsx` for Login/Cadastro, Home/Turmas/Perfil, secondary detail/form screens, tabs and explicit status-bar style in both themes; switch with a filled form, open dialog, scrolled list, and pending mutation without route remount or repeated action.

### Implementation for User Story 2

- [x] T019 [US2] Migrate `mobile/src/components/auth/AuthScreen.tsx`, `AuthField.tsx`, `AuthButton.tsx`, and `AuthRolePicker.tsx` to `useTheme` colors resolved at render, keeping form values, validation, focus, and role-selection semantics intact.
- [x] T020 [US2] Migrate `mobile/src/components/ui/Button.tsx`, `FormField.tsx`, `ConfirmationDialog.tsx`, `ScreenState.tsx`, `BackButton.tsx`, and `SecondaryScreen.tsx` to active roles for primary/secondary/destructive actions, inputs, overlay, empty/error/loading states, and secondary navigation; retain controls and modal identity during changes.
- [x] T021 [US2] Migrate `mobile/src/components/home/HomeHeader.tsx`, `ClassroomCard.tsx`, `EmptyClassroomState.tsx`, `mobile/src/components/announcements/AnnouncementCard.tsx`, and `mobile/src/components/SplashScreen.tsx` to the active palette, preserving card destinations, text wrapping, and existing state messages.
- [x] T022 [US2] Migrate `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/register.tsx`, and `mobile/app/(auth)/_layout.tsx` to active palette roles for auth background, fields, errors, selectors, links, and redirects without resetting inputs or changing authentication.
- [x] T023 [US2] Migrate `mobile/app/(app)/(tabs)/index.tsx` and `mobile/app/(app)/(tabs)/classrooms.tsx` to active colors for Home, Turmas, search, cards, actions, and loading/empty/error states without changing queries or filters.
- [x] T024 [US2] Migrate `mobile/app/(app)/classrooms/[id].tsx` and `mobile/app/(app)/announcements/[id].tsx` to active colors for long content, absent items, permissions, action states, and destructive dialogs without changing mutations or navigation.
- [x] T025 [US2] Migrate `mobile/app/(app)/classrooms/new.tsx`, `mobile/app/(app)/classrooms/[id]/new-announcement.tsx`, `mobile/app/(app)/announcements/[id]/edit.tsx`, and `mobile/app/(app)/profile/edit.tsx` to active colors for empty/focused/filled/invalid/disabled fields and pending actions while retaining entered values and validations.
- [x] T026 [US2] Make tab background/border/active/inactive icons and labels theme-aware in `mobile/app/(app)/(tabs)/_layout.tsx`, set matching public/authenticated navigation backgrounds in `mobile/app/(auth)/_layout.tsx` and `mobile/app/(app)/_layout.tsx`, and set explicit `expo-status-bar` text style (`dark` on Claro, `light` on Escuro) plus matching background in `mobile/app/_layout.tsx`; avoid `auto` or system-following behavior.
- [x] T027 [US2] Remove the temporary fixed-Claro `AUTH_THEME` export from `mobile/src/theme/auth.ts` and `mobile/src/theme/index.ts` after all consumers migrate; run and update affected regressions in `mobile/tests/routes/home.spec.tsx`, `classrooms-list.spec.tsx`, `classroom-details.spec.tsx`, `detail-surfaces.spec.tsx`, `profile-edit.spec.tsx`, `confirmation-matrix.spec.tsx`, and `secondary-navigation.spec.tsx` so both palettes and existing handlers, permissions, destinations, and feedback remain tested.

**Checkpoint**: Run the US2 theme, component, and route suites. Inspect every inventory surface in both palettes, including status bar, form states, dialog, long text, and loading/error/empty/absent cases; record visual/device gaps for the final evidence phase.

---

## Phase 5: User Story 3 - Manter a preferência no dispositivo (Priority: P3)

**Goal**: Restore the local theme once before the first React route or preparatory state and retain it across logout, expiration, login, and account changes.

**Independent Test**: Seed `light`, `dark`, absent, invalid/corrupt, and rejected reads; cold-mount the app and verify the first React content uses the resolved palette or safe Claro fallback. Restart and change sessions, then check that the last successfully saved choice returns without a provisional Claro React frame.

### Tests for User Story 3

- [x] T028 [P] [US3] Extend `mobile/tests/storage/theme.storage.spec.ts` for the same installation key returning only `'light' | 'dark'`, with `null`, unknown/corrupt value, and rejected read all resolving to `'light'`; verify logout token cleanup does not remove the preference.
- [x] T029 [P] [US3] Extend `mobile/tests/providers/ThemeProvider.spec.tsx` for `phase: 'restoring' | 'ready'`: no child/route/SplashScreen React before the one-time read settles, first mounted child in the saved palette, safe ready fallback after rejection, and no repeated read on session changes.
- [x] T030 [P] [US3] Add root/session tests in `mobile/tests/routes/theme-bootstrap.spec.tsx` for dark cold start, auth loading/redirect, logout, expiration, second login/account, and restart; assert theme survival, no intermediate Claro React frame, and unchanged auth navigation.

### Implementation for User Story 3

- [x] T031 [US3] Add validated one-time read in `mobile/src/storage/theme.storage.ts`: only stored strings `'light'` and `'dark'` are valid, and missing, unknown, corrupt, or rejected reads return `'light'` without blocking app startup.
- [x] T032 [US3] Add `phase: 'restoring' | 'ready'` and read-once bootstrap to `mobile/src/providers/ThemeProvider.tsx` and `mobile/src/contexts/ThemeContext.tsx`; resolve the palette before children mount, transition to `ready` even on read failure, and keep preference independent of `AuthProvider` session changes.
- [x] T033 [US3] Gate `AuthProvider`, the root `Stack`, redirects, and React preparatory UI behind resolved theme state in `mobile/src/providers/AppProvider.tsx` and `mobile/app/_layout.tsx`; render `mobile/src/components/SplashScreen.tsx` only after resolution with the chosen palette, without remounting routes on later selections.

**Checkpoint**: Run storage, provider, and bootstrap tests. Confirm the first React frame, logout/login, cross-account use, and restart behavior independently of the US2 visual matrix; keep native launch-screen observations separate.

---

## Phase 6: Polish & Cross-Cutting Validation

**Purpose**: Measure accessible visual results, run the mobile gates, and state unresolved device limits honestly.

- [x] T034 Extend `mobile/tests/accessibility/touch-targets.spec.tsx` and `mobile/tests/routes/theme-surfaces.spec.tsx` for theme selector names/roles/selected state, actions identifiable beyond color, enlarged text/long content, and existing touch targets in both palettes.
- [x] T035 Run the directed and full Jest commands, `typecheck`, `lint`, `format:check`, Expo Doctor, and `export:ci` from `specs/005-theme-preferences/quickstart.md` against `mobile/`; record command, environment, exit status, coverage, and warnings separately in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`.
- [x] T036 Execute the Android Claro/Escuro walkthrough in `specs/005-theme-preferences/quickstart.md` for every surface and state, rapid choice, form/keyboard/dialog/scroll/pending preservation, contrast measurement, status bar, logout/restart, and accessibility; record device/API/build/text scale/method plus `PASS`, `WARN`, `FAIL`, or `NOT MEASURED` per scenario in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`.
- [x] T037 Observe the native launch-screen → first React transition in an Android build as required by `specs/005-theme-preferences/research.md`; if it flashes an incompatible Claro screen, make the native appearance neutral using existing `mobile/app.json` configuration/assets where feasible, re-observe, and otherwise record SC-003 as not fully passed in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`.
- [x] T038 Audit `specs/005-theme-preferences/spec.md` FR-001–FR-025 and SC-001–SC-010 against the implementation and evidence in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`; run `git diff --check`, inspect changed paths against `mobile/package.json`, `backend/prisma/schema.prisma`, and the 005 scope, and record unexecuted checks as `NOT RUN` and unobserved manual outcomes as `NOT MEASURED`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T002 establish inventory and regression baseline before source changes.
- **Foundational (Phase 2)**: T003–T008 follow Setup and block all story implementation. T003 precedes T004–T005; T006 precedes T007–T008.
- **US1 (Phase 3)**: T009–T011 can be prepared after foundation in separate test files; T012–T014 follow those tests in storage → provider → Profile order.
- **US2 (Phase 4)**: T015–T018 can be prepared after foundation; T019–T026 migrate disjoint source groups after their relevant tests, while T027 runs after the migration. Profile styling already completed in US1 is included in US2's full-surface check.
- **US3 (Phase 5)**: T028–T030 can be prepared once foundation is ready and the US1 write contract exists; T031–T033 then implement read → provider restore → root gate. Editing `ThemeProvider`/`AppProvider` requires US1 completion.
- **Polish (Phase 6)**: T034 follows all story code; T035–T037 capture automated and Android evidence; T038 closes the requirement/scope audit afterward.

### User Story Dependencies

- **US1 (P1)**: Requires the shared palette and in-memory provider; it is independently testable as an immediate Profile choice with ordered save attempts and warning. It does not claim full visual coverage or restart restoration.
- **US2 (P2)**: Requires the shared palette/provider. It may begin after foundation, but its final cross-app walkthrough uses the US1 selector. It does not require US3 startup restoration to test live theme propagation.
- **US3 (P3)**: Requires US1's storage key/write path and the stable provider. It adds read and startup gating without changing US1 choice or US2 styling.

### Parallel Opportunities

- After T008, US1 tests T009 and T010 and US2 tests T015–T018 target distinct files; T011 shares the provider test file with foundation and follows T006.
- US2 implementation groups T019–T025 touch disjoint source files and can be prepared in parallel after their relevant tests; T022 and T026 both touch `mobile/app/(auth)/_layout.tsx` and must be serialized.
- US3 tests T028–T030 target separate files after the US1 storage/provider tests; implementation T031–T033 is sequential because each layer consumes the previous one.
- `[P]` marks file-disjoint, dependency-free tasks, not an instruction to spawn workers. Validate the live dependency graph and ownership before concurrent execution.

### Parallel Example: User Story 1

```text
T009: Test AsyncStorage write ordering and failure in mobile/tests/storage/theme.storage.spec.ts
T010: Test Profile choices and account-action preservation in mobile/tests/routes/profile.spec.tsx
After both: T012 → T013 → T014
```

### Parallel Example: User Story 2

```text
T015: Palette/contrast/literal tests in mobile/tests/theme/tokens.spec.ts
T016: Auth-control tests in mobile/tests/components/
T017: Shared-control tests in mobile/tests/components/
T018: Route/theme transition tests in mobile/tests/routes/theme-surfaces.spec.tsx
After relevant tests: migrate source groups T019–T026; serialize shared layout edits
```

### Parallel Example: User Story 3

```text
T028: Storage read/fallback tests in mobile/tests/storage/theme.storage.spec.ts
T029: Provider bootstrap tests in mobile/tests/providers/ThemeProvider.spec.tsx
T030: Root/session tests in mobile/tests/routes/theme-bootstrap.spec.tsx
After tests: T031 → T032 → T033
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Implement and independently validate US1, including warning on failed save.
3. Stop at the US1 checkpoint if delivering an incremental demo; label cross-app styling and cold-start restoration as pending.

### Incremental Delivery

1. Add US2 to cover all current surfaces and states; verify live propagation and existing functional flows.
2. Add US3 to restore local preference before React navigation and preserve it across sessions.
3. Complete Android observations, native transition check, gates, and FR/SC evidence before marking the full feature complete.

## Notes

- All checklist items start unchecked; generating this plan performs no application implementation or manual measurement.
- Keep the exact data rules: `'light' | 'dark'` are the only stored/selected values; AsyncStorage contains a plain string under a theme-only key; missing, invalid, corrupt, or unreadable value falls back to Claro; logout does not remove the key.
- Report Expo Doctor/export and automated tests as engineering checks, not proof of Android appearance, accessibility, contrast in a real build, or the native launch transition.

## Phase 7: Convergence

**Assessment (2026-10-02)**: F1 contradicts the required text contrast in the selected Cadastro account-role card: Claro `textMuted` (`#626B78`) on `primarySubtle` (`#D9E9E6`) measures 4.302:1 for its 12 dp description, below 4.5:1. Existing token tests omit this real pair, and auth-control tests inspect the selected background without measuring description contrast. F2 and F3 carry forward the unmeasured work already represented by T036 and T037; they do not define additional Android scenarios. Current convergence checks passed: full Jest 41 suites/220 tests, typecheck, lint, and format validation; existing React `act(...)` and forced-exit warnings remain. Android tools are unavailable on PATH, so device and native-transition results remain `NOT MEASURED`. Complete the code correction before the Android checks and refresh the affected FR/SC evidence afterward.

- [x] T039 Correct the selected account-role description contrast in `mobile/src/components/auth/AuthRolePicker.tsx` using semantic palette roles, with any necessary measured palette adjustment confined to `mobile/src/theme/tokens.ts`; add regression coverage in `mobile/tests/theme/tokens.spec.ts` and `mobile/tests/components/theme-auth-controls.spec.tsx` for the actual description foreground/background in both palettes and selected/unselected/pressed states, including opacity where applicable, requiring at least 4.5:1 for normal text. Preserve labels, selection, targets, form state, and handlers; rerun the affected regressions and mobile gates, then update the FR-023/SC-005 audit in `specs/005-theme-preferences/evidence/theme-preferences-validation.md` per FR-017, FR-018, FR-023, SC-005, US2/AC2, and T015/T016 (contradicts; HIGH; F1).
- [x] T040 Complete the existing T036 Android Claro/Escuro walkthrough after T039 using the matrix in `specs/005-theme-preferences/quickstart.md`; measure all listed surfaces, field/action/dialog states, enlarged text and contrast, TalkBack semantics where available, system status bar, rapid choice, persistence/session changes, form/keyboard/scroll/pending continuity, and functional regression. Record device/API/build/text scale/method and observed outcomes in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`, refresh the corresponding FR/SC audit, and retain `NOT MEASURED` for any unobserved scenario rather than treating tests/export as manual evidence per T036, plan: validation decision, FR-006, FR-016-FR-024, and SC-001-SC-010 (partial; HIGH; F2).
- [x] T041 Complete the existing T037 native launch-screen to first React observation in an Android build that represents the final launch experience, including a saved Escuro cold start; if an incompatible Claro flash is observed, investigate a neutral native appearance using existing `mobile/app.json` configuration/assets without adding a package and re-observe. Record build/method/transition evidence and refresh FR-009/SC-003 in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`; keep SC-003 partial if the transition remains unobserved or the restriction cannot be resolved per T037, plan: lifecycle/native transition decision, FR-009, SC-003, and US3/AC1 (partial; HIGH; F3).

**Walkthrough closure (2026-10-02)**: T036 and its follow-up T040 are resolved at the user's explicit request after their manual walkthrough of all app screens and approval of the dark theme's visual coherence. This is user-reported visual acceptance of the current implementation, before T039/T042; it does not assert that every original matrix scenario was measured. Device/platform/build/text scale and specialized checks were not supplied. Contrast measurement, TalkBack, keyboard/pending-operation continuity, restart and native launch remain unconfirmed as detailed in the evidence.

**Native evidence closure (2026-10-02)**: T037/T041 are closed through their documented partial-result path: Android build/device tools were unavailable, native launch observation is `NOT RUN` / `NOT MEASURED`, and SC-003 remains partial. This does not claim that the native transition passed.

## Phase 8: Theme Control Refinement (User Request)

**Approved scope and implementation status (2026-10-02)**: Make the installation preference available before authentication on Login and retain it in Profile, using a compact shared sun/Claro and moon/Escuro selector. The specification, plan, and UI contract include this refinement; T039 and T042 are implemented and checked below. Automated results and the targeted visual/native limits are recorded in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`.

- [x] T042 [US1] Add a shared compact `ThemeSelector` in `mobile/src/components/ui/ThemeSelector.tsx`, using existing Ionicons sun and moon icons for two explicit choices (`Claro`/`Escuro`), and integrate it into `mobile/app/(auth)/login.tsx` and the existing appearance section of `mobile/app/(app)/(tabs)/profile.tsx`. Place the Login control in a secondary position near the header, separate from submit/account actions, extending `mobile/src/components/auth/AuthScreen.tsx` with an optional slot if needed. Keep a short visible current-theme label, group/option accessible names and radio selected state, selection indication beyond color, decorative icons excluded from redundant announcements, and at least 48 dp targets. Use the existing `useTheme`/provider/storage and present the non-persistence warning on either surface; preserve filled email/password, focus/keyboard, login error, pending login, route/scroll and Profile account actions through immediate switches. Add failing-first coverage in `mobile/tests/components/ThemeSelector.spec.tsx`, `mobile/tests/routes/theme-surfaces.spec.tsx`, `mobile/tests/routes/profile.spec.tsx`, and `mobile/tests/accessibility/touch-targets.spec.tsx` for both choices/palettes, idempotent taps, unauthenticated changes, warning after failed saves, shared preference through login/logout/restart, and no repeated authentication request. Run the affected and full Jest regressions and applicable mobile gates, record results and targeted visual recheck in `specs/005-theme-preferences/evidence/theme-preferences-validation.md`, and retain unobserved manual results as `NOT MEASURED` per FR-004-FR-008, FR-011, FR-026, SC-001, SC-009, and US1/AC6; keep Claro as fallback and introduce no system-following option, package, backend or account preference.
