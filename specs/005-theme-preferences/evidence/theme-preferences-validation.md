# Theme Preferences - Validation Evidence

**Status vigente — 2026-10-04:** Aplica-se a [política permanente](../../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

**Execution date**: 2026-10-02  
**Authorized scope**: Phases 1-6 (T001-T038).  
**Phase 6 status**: T034, T035, and T038 complete. T036 and T037 remain open because Android device/emulator evidence could not be collected; record those outcomes as `NOT MEASURED`.

## T001 - Inventory and scope boundary

| Area                  | Observed baseline                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Palette               | `mobile/src/theme/tokens.ts` exported one `theme` object containing colors and metrics. `mobile/src/theme/auth.ts` projected auth aliases from that Claro palette. |
| Color consumers       | Routes and components listed in `tasks.md` consume `theme.colors` or `AUTH_THEME.colors`; module-level `StyleSheet.create` resolves those colors at import time.   |
| Color literals        | The search for hex, `rgb`, and `rgba` in `mobile/app/` and `mobile/src/components/` found no visual color literals; the palette in `src/theme` is the source.      |
| Profile               | `profile.tsx` keeps identity and logout in one `ScrollView`; styles and icons used static `AUTH_THEME`. Loading and unavailable-user branches are separate.        |
| Navigation and system | Root, auth, app, and tab layouts use static styles. The tab layout sets tints; no explicit `StatusBar` or `NavigationBar` consumer was found.                      |
| Session and storage   | `AppProvider` mounts `AuthProvider` within one `QueryClientProvider`; `auth.storage.ts` uses SecureStore only for tokens.                                          |
| Boundary              | Feature changes stay in `mobile/` and `specs/005-theme-preferences/`. No backend, OpenAPI, account field, database, or dependency change.                          |

Existing test inventory for the baseline included `tests/theme/tokens.spec.ts`; Profile and profile-edit routes; auth service, auth screen, auth-navigation, and secondary-navigation suites; Home, classroom-list, classroom-detail, detail-surface, primary-state, and new-announcement accessibility routes; confirmation matrix/dialog; shared UI components; and touch-target accessibility.

### Affected-file checklist

Phases 1-5 are complete. Phase 6 adds automated accessibility coverage and cross-cutting validation; native Android observations remain outstanding.

- [x] Palette: `mobile/src/theme/tokens.ts`, `mobile/src/theme/auth.ts`, `mobile/src/theme/index.ts`, `mobile/tests/theme/tokens.spec.ts`.
- [x] Shared state: `mobile/src/contexts/ThemeContext.tsx`, `mobile/src/providers/ThemeProvider.tsx`, `mobile/src/hooks/useTheme.ts`, `mobile/src/providers/AppProvider.tsx`, `mobile/app/_layout.tsx` (existing AppProvider root retained), `mobile/tests/providers/ThemeProvider.spec.tsx`, `mobile/tests/helpers/render.tsx`, `mobile/tests/setup.ts`.
- [x] US1/Profile/storage: `mobile/src/constants/storage.ts`, `mobile/src/storage/theme.storage.ts`, `mobile/app/(app)/(tabs)/profile.tsx`, `mobile/tests/storage/theme.storage.spec.ts`, `mobile/tests/routes/profile.spec.tsx`.
- [x] US2 auth: `mobile/src/components/auth/{AuthScreen,AuthField,AuthButton,AuthRolePicker}.tsx`, `mobile/app/(auth)/{_layout,login,register}.tsx`.
- [x] US2 shared and preparatory: `mobile/src/components/ui/{Button,FormField,ConfirmationDialog,ScreenState,BackButton,SecondaryScreen}.tsx`, `mobile/src/components/home/{HomeHeader,ClassroomCard,EmptyClassroomState}.tsx`, `mobile/src/components/announcements/AnnouncementCard.tsx`, `mobile/src/components/SplashScreen.tsx`.
- [x] US2 routes and navigation: `mobile/app/(app)/(tabs)/{_layout,index,classrooms}.tsx`, `mobile/app/(app)/classrooms/{[id],new}.tsx`, `mobile/app/(app)/classrooms/[id]/new-announcement.tsx`, `mobile/app/(app)/announcements/{[id],[id]/edit}.tsx`, `mobile/app/(app)/profile/edit.tsx`, `mobile/app/(app)/_layout.tsx`.
- [x] US2 coverage: component suites, `mobile/tests/routes/theme-surfaces.spec.tsx`, and regressions listed in T027.
- [x] US3 bootstrap: `mobile/src/storage/theme.storage.ts`, `mobile/src/contexts/ThemeContext.tsx`, `mobile/src/providers/ThemeProvider.tsx`, `mobile/src/providers/AppProvider.tsx`, `mobile/app/_layout.tsx`, and `mobile/tests/routes/theme-bootstrap.spec.tsx`.
- [x] Phase 6 accessibility additions: `mobile/tests/accessibility/touch-targets.spec.tsx` and the extended long-content/theme-selector cases in `theme-surfaces.spec.tsx` (T034).

## T002 - Automated baseline before source changes

Command from `mobile/`:

```powershell
.\node_modules\.bin\jest.cmd --ci --runInBand --forceExit
```

**Result**: PASS - 36 suites, 148 tests, 0 failures; 14.116 seconds. This covered the existing theme, Profile, auth/navigation, classroom/detail, confirmation, accessibility, and shared-component suites.

**Pre-existing warnings**: `tests/hooks/useDeleteClassroom.spec.tsx` emitted React `act(...)` warnings; Jest printed its forced-exit/open-handle note. Exit code was 0 and no test failed.

## Phase 2 checkpoint - shared palette and in-memory state

```powershell
.\node_modules\.bin\jest.cmd --runInBand tests/theme/tokens.spec.ts tests/providers/ThemeProvider.spec.tsx
```

**Result**: PASS - 2 suites, 10 tests. Matching color-role keys and shared metric references, auth projection, initial Claro state, immediate bidirectional changes, idempotent selection, mounted-child identity, and AppProvider integration passed. `npm run typecheck` and `npm run lint` also passed at this checkpoint.

## Phase 3 checkpoint - Profile selection and local writes

```powershell
.\node_modules\.bin\jest.cmd --runInBand tests/storage/theme.storage.spec.ts tests/providers/ThemeProvider.spec.tsx tests/routes/profile.spec.tsx
```

**Result**: PASS - 3 suites, 21 tests. This covered the separate raw-value storage key, token-cleanup isolation, pending and ordered writes, stale-failure suppression, latest-write warning, warning reset, accessible selection in both directions, immediate Profile recoloring, retained ScrollView identity, and existing edit/logout behavior.

Full mobile Jest regression:

```powershell
.\node_modules\.bin\jest.cmd --ci --runInBand --forceExit
```

**Result**: PASS - 38 suites, 167 tests, 0 failures; 14.23 seconds. Existing React `act(...)` warnings and the Jest forced-exit/open-handle note remain; they do not fail tests.

| Gate                              | Result                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`               | PASS                                                                                                                                                                   |
| `npm run lint`                    | PASS                                                                                                                                                                   |
| `npm run format:check`            | PASS                                                                                                                                                                   |
| `npm run export:ci`               | PASS - Android, iOS, and Web bundles generated; generated export directory removed after verification.                                                                 |
| `npm run doctor`                  | WARN - 19/21 checks passed. Expo config schema and React Native Directory checks could not reach the Expo API (`fetch failed`, `EACCES`); this run is network-limited. |
| `git diff --check`                | PASS                                                                                                                                                                   |
| Backend/API/database/dependencies | No changed files in these areas; no endpoint, account field, migration, or package was added.                                                                          |

## Phase 4 checkpoint - US2 visual coverage

Command from `mobile/`:

```powershell
npx jest tests/theme/tokens.spec.ts tests/components/AuthScreen.spec.tsx tests/components/theme-auth-controls.spec.tsx tests/components/Button.spec.tsx tests/components/FormField.spec.tsx tests/components/ConfirmationDialog.spec.tsx tests/components/ScreenState.spec.tsx tests/components/BackButton.spec.tsx tests/components/AnnouncementCard.spec.tsx tests/routes/theme-surfaces.spec.tsx tests/routes/auth-navigation-ux.spec.tsx tests/routes/home.spec.tsx tests/routes/classrooms-list.spec.tsx tests/routes/profile.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/detail-surfaces.spec.tsx tests/routes/profile-edit.spec.tsx tests/routes/confirmation-matrix.spec.tsx tests/routes/secondary-navigation.spec.tsx tests/routes/new-announcement-accessibility.spec.tsx --runInBand --forceExit
```

**Result**: PASS - 20 suites, 115 tests. Both palettes passed the automated foreground/background contrast thresholds for normal and large text, semantic and action states, and a source scan found no fixed visual color literals or theme-colored module-level `StyleSheet` styles in app/shared component trees. Auth controls, shared components, layouts, status bar, routes, forms, dialogs, pending operations, and navigation regressions passed.

**Measured token correction**: The dark `primaryPressed` color was changed to `#7EDCCF` after the test found the prior value below 4.5:1 against `primarySubtle`. The automated contrast test now covers that pair in both palettes. This is code-based contrast measurement; no device or enlarged-text visual inspection was performed.

## Phase 5 checkpoint - US3 startup restoration

Command from `mobile/`:

```powershell
npx jest tests/storage/theme.storage.spec.ts tests/providers/ThemeProvider.spec.tsx tests/routes/theme-bootstrap.spec.tsx --runInBand --forceExit
```

**Result**: PASS - 3 suites, 27 tests. Storage accepts only `light` and `dark`, and falls back to `light` for missing, corrupt, unknown, or rejected reads. Provider tests verify one read, no children before resolution, first child in the restored palette, a ready Claro fallback on failure, and no read when the session identity changes. Root/session tests verify a dark first React stack/status bar, themed auth-loading UI, the existing `/login` redirect, authenticated tab navigation, and one storage read through logout, expiration, and account changes. Token cleanup leaves the theme key intact.

## Integrated Phase 4-5 checkpoint

After Phase 5 changed the shared provider/bootstrap path, the combined directed regression was rerun from `mobile/`:

```powershell
npx jest tests/theme/tokens.spec.ts tests/components/AuthScreen.spec.tsx tests/components/theme-auth-controls.spec.tsx tests/components/Button.spec.tsx tests/components/FormField.spec.tsx tests/components/ConfirmationDialog.spec.tsx tests/components/ScreenState.spec.tsx tests/components/BackButton.spec.tsx tests/components/AnnouncementCard.spec.tsx tests/routes/theme-surfaces.spec.tsx tests/routes/auth-navigation-ux.spec.tsx tests/routes/home.spec.tsx tests/routes/classrooms-list.spec.tsx tests/routes/profile.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/detail-surfaces.spec.tsx tests/routes/profile-edit.spec.tsx tests/routes/confirmation-matrix.spec.tsx tests/routes/secondary-navigation.spec.tsx tests/routes/new-announcement-accessibility.spec.tsx tests/storage/theme.storage.spec.ts tests/providers/ThemeProvider.spec.tsx tests/routes/theme-bootstrap.spec.tsx --runInBand --forceExit
```

**Result**: PASS - 23 suites, 142 tests, 0 failures. Jest printed its forced-exit/open-handle note; the command exited 0. No React `act(...)` warnings were emitted by this run.

## Phase 6 - T034 accessibility coverage

`mobile/tests/accessibility/touch-targets.spec.tsx` now runs its shared-control and route-action target checks for both stored themes and both platform minimums. It also verifies that the real Profile theme options expose a named radio group, two named radio choices, selected state, and minimum height/width, then changes the selection and checks the textual current-theme label. Action checks require text labels and button roles in both themes, so action meaning does not depend on color.

`mobile/tests/routes/theme-surfaces.spec.tsx` checks the Profile selector and account actions after Claro/Escuro changes, and uses long name/email values to verify there is no line truncation or font-scaling opt-out. The native device rendering at an enlarged text scale remains `NOT MEASURED`.

The Profile theme choices now specify a 48 dp minimum width, the larger of the configured iOS and Android minimums. The mounted Profile tests verify the target in both palettes.

**Directed T034 test result**: PASS - `tests/accessibility/touch-targets.spec.tsx` and `tests/routes/theme-surfaces.spec.tsx`, 2 suites/22 tests. The later Phase 6 directed run below also includes these suites.

## Phase 6 - T035 automated gates

**Environment**: Windows PowerShell; 2026-10-02; Node v22.14.0; npm 11.10.1; Expo CLI 57.0.27; project Expo `~57.0.26`; React Native `0.86.3`. Commands ran from `mobile/` unless noted.

| Gate                    | Command                                                                                                                                                                                                                    | Result                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Directed Jest           | `npx jest --runInBand --forceExit tests/theme tests/storage tests/providers tests/routes/profile.spec.tsx tests/components tests/accessibility tests/routes/theme-surfaces.spec.tsx tests/routes/theme-bootstrap.spec.tsx` | PASS - 16 suites, 115 tests.                                                                                                                                                                                                   |
| Full Jest with coverage | `npx jest --ci --runInBand --coverage --forceExit --coverageDirectory="$coveragePath"` where `$coveragePath` was a new `%TEMP%\avisa-ai-professor-005-phase6-coverage-20261002` directory                                  | PASS - 41 suites, 220 tests. Coverage: 87.43% statements, 89.03% branches, 80.55% functions, 87.59% lines.                                                                                                                     |
| TypeScript              | `npm run typecheck`                                                                                                                                                                                                        | PASS - exit 0.                                                                                                                                                                                                                 |
| Lint                    | `npm run lint`                                                                                                                                                                                                             | PASS - exit 0.                                                                                                                                                                                                                 |
| Formatting              | `npm run format:check`                                                                                                                                                                                                     | PASS - exit 0 after excluding generated coverage output from the mobile tree.                                                                                                                                                  |
| Expo Doctor             | `npm run doctor`                                                                                                                                                                                                           | PASS - 21/21 checks passed; exit 0 when rerun with network access. The sandboxed attempt was 19/21, exit 1, because Expo config schema and React Native Directory checks could not reach the API (`EACCES 34.110.201.56:443`). |
| Cross-platform export   | `npm run export:ci`                                                                                                                                                                                                        | PASS - Android, iOS, and Web bundles exported; exit 0. `.expo-ci-export` was absent before execution and removed after verification.                                                                                           |
| Whitespace              | `git diff --check` from repo root                                                                                                                                                                                          | PASS - exit 0.                                                                                                                                                                                                                 |

**Jest warnings**: Several existing query-hook tests print React `act(...)` warnings. Jest also prints its forced-exit/open-handle note. The full run exited 0 with no failed assertions. **Export warnings**: the configured `--no-bytecode` mode prints Expo's debugging warning, and Node reports the inherited `NO_COLOR`/`FORCE_COLOR` combination; export still exits 0.

The Expo SDK 57 StatusBar component supports the status-text `style`; it no longer accepts a runtime `backgroundColor` prop. The root themed surface and Stack content carry the active background, while the StatusBar switches explicitly between dark and light text. The Expo SDK 57 reference is [here](https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/). Bootstrap and surface tests assert both parts.

## Phase 6 - T036 Android walkthrough

**Original agent-side environment**: `adb` and `emulator` are unavailable; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset. Android native build/install/launch by the agent: `NOT RUN`. The export above contains JS bundles and is not native-device evidence. The original scenario matrix below records what the agent had not observed; the subsequent user-reported update supersedes the general visual walkthrough outcome only.

| Scenario                                                                                          | Result       | Automated evidence does not replace                                                               |
| ------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| US1 / SC-001: switch Claro/Escuro both directions while Profile is scrolled and logout is pending | NOT MEASURED | Visual immediacy and physical scroll/pending-operation preservation.                              |
| US1 / FR-011: simulate a local write failure on Android                                           | NOT MEASURED | Manual warning presentation; simulated rejection is covered by Profile/provider tests.            |
| US3 / SC-003/004: saved-theme restart, logout/login/account switch, missing/invalid/read failure  | NOT MEASURED | Cold native launch and real installation storage behavior; bootstrap/storage cases are automated. |
| US2 / SC-002: inspect Login, Cadastro, Home, Turmas, Perfil, detail and form surfaces             | NOT MEASURED | Visual completeness on a real Android viewport.                                                   |
| US2 / SC-006/007: field and action state matrix in both themes                                    | NOT MEASURED | Real focus, disabled/pending appearance and contrast.                                             |
| US2 / SC-002/008: loading, empty, error, absent, dialogs, tabs, back and system status bar        | NOT MEASURED | Native rendering of system bars and surface states.                                               |
| US2 / SC-005: enlarged text, long content, contrast, TalkBack names/roles/selection               | NOT MEASURED | On-device font scaling, color measurement, and assistive-technology announcements.                |
| US1/US2 / SC-009: switch theme with form, keyboard, dialog, scrolled list or mutation pending     | NOT MEASURED | Physical keyboard/scroll/dialog/mutation continuity.                                              |
| Regression / SC-010: auth, search, classroom/announcement/profile mutations and logout            | NOT MEASURED | End-to-end Android interaction outcomes.                                                          |

### User-reported walkthrough update - 2026-10-02

**Source/method**: The user reports that they manually walked through all app screens, found the dark theme visually coherent with the app, and preferred it to Claro. They explicitly requested that the walkthrough be marked resolved. No device/platform/OS/build, text scale, account/role, screenshots or specialized measurement method were provided; these metadata are `NOT REPORTED`. This is direct user-reported visual acceptance, not an agent-executed device test.

**Outcome**: General screen walkthrough and dark-theme visual coherence: **PASS (USER-REPORTED)**. T036 and its convergence follow-up T040 are closed by explicit user instruction for that accepted visual walkthrough. This closure narrows the acceptance evidence to the reported inspection; it does not mark every scenario in the original matrix as passed and does not establish the original after-T039 ordering, since T039 is still open. Inspection of all Claro states, real contrast measurements, enlarged-text rendering, TalkBack, physical keyboard/scroll/pending-operation continuity, forced storage failures, restart/session recovery and system status-bar transitions remain `NOT MEASURED` unless separately reported. Native launch transition T037/T041 remains open.

**FR/SC update at the time (before T039/T042)**: FR-015/FR-016 and the dark-theme visual portion of SC-002 had user-reported acceptance across all screens. SC-002's complete two-theme/state matrix and the specialized portions of SC-003/SC-005/SC-008/SC-009 still lacked full measurement. The convergence contrast finding was that selected `AuthRolePicker` description in Claro used `textMuted` `#626B78` on `primarySubtle` `#D9E9E6`, measuring 4.302:1 below FR-023/SC-005's 4.5:1 requirement. T039 below resolves that code finding; device-only checks remain separately limited.

## Phase 6 - T037 native launch transition

**Result**: Android native build/transition observation `NOT RUN` / `NOT MEASURED`. No Android device/emulator or native build is available in this environment, so the native launch-screen-to-first-React transition and any incompatible Claro flash were not observed. SC-003 is therefore not fully verified. No `app.json` or asset adjustment was made without observing the transition that would justify one.

## Phase 6 - T038 requirements and scope audit

Automated/code evidence was checked against each FR and SC. Device-only parts remain explicitly unverified as shown in the adjacent manual matrix.

| Requirement | Automated/code evidence reviewed                                                                     | Audit result / remaining limit                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-001      | Profile route radio choices; T034 selector names/roles.                                              | Two choices are Claro and Escuro; device announcement remains not measured.                                                                |
| FR-002      | Storage, provider, and bootstrap suites.                                                             | Missing/invalid values fall back to Claro in automated cases.                                                                              |
| FR-003      | Profile route section placement and existing identity/actions.                                       | Appearance block is separate; account capabilities remain in place.                                                                        |
| FR-004      | T034 radio-group/choice labels and selected-state assertions.                                        | Text and semantics are present; TalkBack announcement is not measured.                                                                     |
| FR-005      | Theme surface and Profile live-switch suites.                                                        | Automated mounted surfaces update in place; real-device appearance is not measured.                                                        |
| FR-006      | Route/profile/form/dialog state regressions and stable component identity assertions.                | Automated preservation checks pass; physical keyboard/scroll/pending matrix is not measured.                                               |
| FR-007      | Theme storage and ordered provider-write tests.                                                      | Local save/read behavior is covered automatically.                                                                                         |
| FR-008      | Bootstrap/session tests for logout, expiration, and account changes.                                 | Theme remains installation-scoped in automated session changes; no server preference is present.                                           |
| FR-009      | Bootstrap test holds React children until restored preference resolves.                              | First React stack follows saved theme; native launch-screen transition is not measured.                                                    |
| FR-010      | Storage/provider tests for missing, unknown, corrupt, and rejected reads.                            | Safe Claro fallback and ready state are covered.                                                                                           |
| FR-011      | Provider/Profile write-rejection tests.                                                              | Theme stays active and warning appears in tests; Android presentation is not measured.                                                     |
| FR-012      | Token contract tests compare shared semantic keys and metrics.                                       | Claro/Escuro token structures match.                                                                                                       |
| FR-013      | Token/source-scan tests for direct colors and fixed light styles.                                    | Automated scan passes for app/shared surfaces.                                                                                             |
| FR-014      | Token tests and Phase 4 contrast record.                                                             | Claro palette retained; the prior documented contrast correction applies to dark `primaryPressed`. Device identity review is not measured. |
| FR-015      | Dark palette roles and token contrast tests.                                                         | Explicit dark palette retains role hierarchy in code; visual review is not measured.                                                       |
| FR-016      | Route/layout/theme-surface suites and source inventory scan.                                         | Automated coverage spans listed route and shared surfaces; exhaustive visual inspection is not measured.                                   |
| FR-017      | Auth, FormField, selector and component state tests.                                                 | Focus, filled, invalid, disabled and selected states are asserted in code for both themes.                                                 |
| FR-018      | Token contrast, long-content route checks, and T034 font-scaling defaults.                           | Scaling is not disabled and text is not truncated in inspected Profile values; enlarged-device rendering is not measured.                  |
| FR-019      | Button/component/route tests and T034 text/role checks.                                              | Action meaning remains textual/semantic; native pressed/disabled/pending appearance is not measured.                                       |
| FR-020      | ConfirmationDialog suite checks both palettes, backdrop and handlers.                                | Automated dialog behavior passes; native appearance is not measured.                                                                       |
| FR-021      | ScreenState and route state suites.                                                                  | Loading/empty/error/absent cases retain messages and actions in automation.                                                                |
| FR-022      | Tab/layout/status-style route tests.                                                                 | Explicit status text style and themed root background are asserted; native system bar rendering is not measured.                           |
| FR-023      | T015 contrast calculations for text/background pairs in both palettes.                               | Automated thresholds pass; on-device, icon/border and enlarged-text contrast are not measured.                                             |
| FR-024      | Full Jest regression: 41 suites/220 tests; typecheck and lint pass.                                  | Covered authentication, routes, handlers, state and domain regressions pass.                                                               |
| FR-025      | 74 changed tracked/untracked paths inspected; all under `mobile/` or `specs/005-theme-preferences/`. | `mobile/package.json`, lockfile, backend and `backend/prisma/schema.prisma` are unchanged; no endpoint or migration added.                 |
| SC-001      | Profile tests cover immediate selection, selected state and retained ScrollView identity.            | Automated portion passes; complete manual/device outcome is not measured.                                                                  |
| SC-002      | Theme surface, component and route suites exercise both palettes.                                    | Automated portion passes; full Android surface walk is not measured.                                                                       |
| SC-003      | Bootstrap tests verify saved theme before first React child.                                         | Partial: native launch transition is not measured, so no full success claim.                                                               |
| SC-004      | Missing/invalid/rejected reads and fallback are tested.                                              | Automated recovery cases pass.                                                                                                             |
| SC-005      | Mathematical text contrast tests and semantic-label checks pass.                                     | Partial: actual large-text, TalkBack, icon/border and device contrast are not measured.                                                    |
| SC-006      | Auth-field/FormField tests cover empty, focused, filled, invalid and disabled states.                | Automated portion passes; device presentation is not measured.                                                                             |
| SC-007      | Button/action tests cover roles, labels, variants, disabled/pending and selected meaning.            | Automated portion passes; native visual state matrix is not measured.                                                                      |
| SC-008      | Tab, stack, root surface and explicit status-text style tests pass.                                  | Partial: actual Android status bar color/contrast is not measured.                                                                         |
| SC-009      | Mounted route/form/dialog/list state regression assertions pass.                                     | Partial: keyboard, physical scroll and pending Android flow are not measured.                                                              |
| SC-010      | Full Jest regression passes: 41 suites/220 tests.                                                    | Automated regression criterion passes; manual end-to-end outcomes are not measured.                                                        |

**Scope result**: `git diff --check` passed. The inspected 74 changed paths are all within the approved `mobile/` and `specs/005-theme-preferences/` boundary. No dependency manifest/lockfile, backend, API/OpenAPI, account field, or Prisma schema changed. Export output was removed after verification. No manual evidence was inherited from spec 004.

## Phase 8 - T042 theme-control refinement

**User request (2026-10-02)**: Offer theme choice on Login if consistent with interface conventions, and simplify the control using sun/Claro and moon/Escuro icons. The accepted design is a shared compact two-choice selector on Login and Profile, preserving textual current-theme feedback and accessible option names/selection. It uses the existing installation preference and dependencies.

**Status (updated 2026-10-02)**: IMPLEMENTED and automatically validated below. The general walkthrough acceptance above covers the prior app surfaces, not this new selector. Its targeted visual recheck is `NOT MEASURED`; FR-026 and US1/AC6 now have automated evidence while native interaction remains unobserved.

## Phase 7/8 - T039 and T042 implementation update (2026-10-02)

T039 now gives selected account-role descriptions the semantic `text` role over `primarySubtle`; unselected descriptions retain `textMuted` over `surfaceMuted`. Press feedback uses a slight scale transform instead of reducing the opacity of text and card colors. The measured foreground/background ratios from the active role-palette pairs are:

| Palette/state      | Foreground role/color | Background role/color     | Contrast |
| ------------------ | --------------------- | ------------------------- | -------: |
| Claro, selected    | `text` `#182026`      | `primarySubtle` `#D9E9E6` | 13.152:1 |
| Claro, unselected  | `textMuted` `#626B78` | `surfaceMuted` `#FAF8F5`  |  5.088:1 |
| Escuro, selected   | `text` `#F4F7F6`      | `primarySubtle` `#294640` |  9.529:1 |
| Escuro, unselected | `textMuted` `#B5C2BE` | `surfaceMuted` `#222F2D`  |  7.554:1 |

The `theme-auth-controls` regression checks these actual component colors in both palettes for selected, unselected, and pressed states, including that no opacity is applied. The token test also includes the selected description pair. No token values needed adjustment.

T042 adds the shared `ThemeSelector` with sun/moon Ionicons, named radio choices, selected radio state, a checkmark plus stronger label weight, a visible current-theme label, and 48 dp minimum targets. Decorative icons are excluded from accessibility announcements. Login renders it in an optional `AuthScreen` header slot; Profile renders the same component in Aparência. Both read and update the existing installation preference and show the storage-failure alert. Login form state and the in-flight mutation remain mounted when the palette changes; rejected login promises continue to use the existing visible mutation error feedback.

### Automated validation

| Check                 | Command / environment                                                                                                                                                                                                                                                                                                                                          | Result                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directed regressions  | `npx jest --runInBand --forceExit tests/components/theme-auth-controls.spec.tsx tests/components/ThemeSelector.spec.tsx tests/theme/tokens.spec.ts tests/routes/theme-surfaces.spec.tsx tests/routes/profile.spec.tsx tests/accessibility/touch-targets.spec.tsx tests/components/AuthScreen.spec.tsx tests/routes/auth-navigation-ux.spec.tsx` from `mobile/` | PASS - 8 suites, 67 tests.                                                                                                                                                                                                |
| Full Jest             | `npx jest --ci --runInBand --coverage --coverageReporters=text-summary --forceExit` from `mobile/`                                                                                                                                                                                                                                                             | PASS - 42 suites, 228 tests. Coverage: 87.70% statements, 90.32% branches, 81.20% functions, 87.86% lines. Existing React `act(...)` and open-handle/forced-exit notices remain.                                          |
| TypeScript            | `npm run typecheck` from `mobile/`                                                                                                                                                                                                                                                                                                                             | PASS - exit 0.                                                                                                                                                                                                            |
| Lint                  | `npm run lint` from `mobile/`                                                                                                                                                                                                                                                                                                                                  | PASS - exit 0.                                                                                                                                                                                                            |
| Formatting            | `npm run format:check` from `mobile/`                                                                                                                                                                                                                                                                                                                          | PASS - all files formatted.                                                                                                                                                                                               |
| Expo Doctor           | `npm run doctor` from `mobile/`                                                                                                                                                                                                                                                                                                                                | PASS - 21/21 checks after retrying the two Expo API metadata checks with network access; the sandboxed attempt was 19/21 because those requests returned `EACCES`.                                                        |
| Cross-platform export | `npm run export:ci` from `mobile/`                                                                                                                                                                                                                                                                                                                             | PASS - Android, iOS, and Web bundles exported. The generated `.expo-ci-export` directory was absent before the run and removed after inspection. Existing no-bytecode and `NO_COLOR`/`FORCE_COLOR` warnings were printed. |
| Whitespace            | `git diff --check` from the repository root                                                                                                                                                                                                                                                                                                                    | PASS - exit 0.                                                                                                                                                                                                            |

### Supplemental requirement audit

| Requirement      | Updated evidence                                                                                                                                                                                                                                                                                                                                    | Result / limit                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-017           | `theme-auth-controls.spec.tsx` asserts selected/unselected semantic foreground and background in both palettes; route state coverage remains in place.                                                                                                                                                                                              | PASS in code; device rendering remains `NOT MEASURED`.                                                                                                |
| FR-018           | Role text pairs exceed 4.5:1; the shared selector uses semantic text colors and allows font scaling.                                                                                                                                                                                                                                                | Automated/code PASS; enlarged-device rendering remains `NOT MEASURED`.                                                                                |
| FR-023 / SC-005  | Four actual role-description pairs measure 5.088:1 to 13.152:1; tests cover both palettes and pressed state without opacity.                                                                                                                                                                                                                        | Automated text contrast PASS; device contrast, icon/border measurements, TalkBack and enlarged text remain `NOT MEASURED`, so SC-005 remains partial. |
| FR-026 / US1 AC6 | Login and Profile expose the same two named radios, selected state, current-theme label, non-color selection mark and 48 dp targets. Tests cover unauthenticated theme selection, idempotent taps, failed-save warning, Login input/error/pending preservation, one authentication call and preference restoration in Profile after remount/logout. | Automated PASS; targeted visual review and physical keyboard/focus behavior remain `NOT MEASURED`.                                                    |
| SC-001 / SC-009  | Login selection and live form/pending state are checked; Profile retains its scroll and account actions; a remount test restores the saved theme.                                                                                                                                                                                                   | Automated portions PASS; Android scroll/keyboard/dialog/pending continuity remains `NOT MEASURED`.                                                    |
| FR-009 / SC-003  | React bootstrap remains tested before route mounting.                                                                                                                                                                                                                                                                                               | PARTIAL: the native launch-screen transition to a saved-Escuro first React frame could not be observed.                                               |

### T037/T041 native launch observation closure

The current execution environment has no `adb` or `emulator` command, no `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and no `mobile/android` native project directory or `mobile/eas.json` build profile. No Android device/build was available for a saved-Escuro cold start. Native launch-to-React observation is therefore `NOT RUN` / `NOT MEASURED`; SC-003 remains partial and FR-009 is verified only for the first React route. No `app.json` or asset change was made because no incompatible native flash was observed to justify one. This records the explicit partial-result path in T037/T041; it is not evidence that the native transition passed.

### Scope and evidence limits

The new implementation and tests stay under `mobile/`; evidence stays under `specs/005-theme-preferences/`. `mobile/package.json`, its lockfile, `backend/`, `backend/prisma/schema.prisma`, API contracts and native app configuration were not changed. No package, server preference, endpoint or migration was added. General dark-theme walkthrough acceptance previously reported by the user does not include this new control.
