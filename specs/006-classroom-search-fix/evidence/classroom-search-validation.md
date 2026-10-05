# Classroom Search Fix - Validation Evidence

**Status vigente — 2026-10-04:** Aplica-se a [política permanente](../../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

This is the cumulative validation log. Earlier phase entries preserve their status at each checkpoint; Phase 6 results are recorded below.

## T001 - Existing Boundary and Baseline Scope

- `GET /api/v1/classrooms` is authenticated by the existing JWT guard. It accepts `search` as a primitive query value; Swagger advertises `maxLength: 80`, but there is no runtime query DTO yet. The global pipe already enables whitelist rejection, transformation, and implicit conversion.
- The available-classroom service conditionally applies `name.contains` with `mode: 'insensitive'` and always excludes memberships with `userClassrooms.none.userId`. `/classrooms/my` uses its own membership query and does not consume the search term.
- Mobile keys retain the raw available-search value in `['classrooms', 'available', search ?? '']`. The service always sends that value as a query parameter; the screen queries each edit immediately and currently places the field above both sections.
- Join, leave, and delete currently invalidate only the empty available variant. US3 remains out of this checkpoint.
- `FormField` reads the active theme palette during render and exposes its label/error accessibly. The classrooms screen already derives styles from `useTheme`; the existing Claro/Escuro providers remain reusable infrastructure.
- Initial `git status --short` showed only the new, untracked `specs/006-classroom-search-fix/` feature artifacts. No unrelated source WIP was present; the feature artifacts were preserved.
- `.dockerignore` already covers Node/Docker output and excludes `specs/` from Docker context; no ignore-file change was needed.

## T002 - Safe Test Environment and Pre-Change Baseline

Environment:

- PostgreSQL target: `localhost/avisa_ai_test`; `assertSafeTestDatabase` accepted it. The development database `avisa_ai` was not used.
- `.github/workflows/backend-ci.yml` uses the same local test database name. The test database had 11 existing migrations and no pending migrations.
- Device/emulator and assistive-technology observations: `NOT MEASURED`.

Commands and results:

| Command/check                                                                                                             | Result | Observation                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assertSafeTestDatabase()` with the isolated URL                                                                          | PASS   | Returned the local `avisa_ai_test` target.                                                                                                                                                                      |
| `npm run prisma:validate`                                                                                                 | PASS   | Existing Prisma schema valid.                                                                                                                                                                                   |
| `npm run prisma:generate`                                                                                                 | PASS   | Prisma Client generated from the existing schema.                                                                                                                                                               |
| `npm run prisma:migrate:deploy`                                                                                           | PASS   | 11 migrations found; none pending.                                                                                                                                                                              |
| Backend classroom controller/service unit suites                                                                          | PASS   | 2 suites, 24 tests.                                                                                                                                                                                             |
| `npm run test:integration -- --runTestsByPath test/classrooms.integration.spec.ts`                                        | PASS   | 1 suite, 9 tests. The logged simulated transaction failure is an asserted rollback scenario.                                                                                                                    |
| `npm run test:contract`                                                                                                   | PASS   | 1 suite, 7 tests.                                                                                                                                                                                               |
| Mobile classroom service/key/list, join/leave/delete, home/details, confirmation, theme, and touch-target baseline suites | PASS   | 10 suites, 69 tests. A pre-existing React `act` warning and Jest open-handle warning were emitted. npm also warned that the forwarded `--runInBand` option was parsed by npm; the test assertions still passed. |

## T003 - Shared Real-Query Test Support

- Added `mobile/tests/helpers/classroom-search.tsx` using real TanStack `QueryClient`, `QueryClientProvider`, and `QueryObserver` instances. It provides deferred responses, controllable available-list requests with captured abort signals, active/inactive observers across search variants, cache seeding, five-minute production-like stale time, retry disabled, and cleanup for observers, pending queries, cache, and caller-owned fake timers.
- `npm run typecheck` (mobile): PASS.
- `npx eslint tests/helpers/classroom-search.tsx` (mobile): PASS.
- `npx prettier --check tests/helpers/classroom-search.tsx` (mobile): PASS.
- `npx jest --runInBand --runTestsByPath tests/helpers/classroom-search.spec.tsx` (mobile): PASS, 1 suite and 4 tests for active/inactive variants, abort signals, deferred services, cache cleanup, and fake-timer cleanup.
- `git diff --check`: PASS.

## Acceptance Matrix

Statuses in this section describe the pre-change baseline. `FAIL` means the existing behavior does not yet satisfy the new search requirement; it is not a failing test command.

| Requirement | Baseline evidence/status                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| FR-001      | PASS baseline: available and my lists use separate queries; regression tests passed.                            |
| FR-002      | FAIL baseline: the current field is outside the "Turmas disponíveis" section.                                   |
| FR-003      | PASS baseline: current available listing remains behind the authenticated guard.                                |
| FR-004      | FAIL baseline: the current route forwards raw text without external trim.                                       |
| FR-005      | FAIL baseline: whitespace is truthy in the current backend criterion.                                           |
| FR-006      | FAIL baseline: the 80-character Swagger hint is not runtime DTO validation.                                     |
| FR-007      | WARN baseline: case-insensitive substring is present; literal wildcard and accent behavior are not covered.     |
| FR-008      | PASS baseline: the service excludes existing memberships; existing suites passed.                               |
| FR-009      | NOT RUN: debounce belongs to Phase 4.                                                                           |
| FR-010      | NOT RUN: edit-rate behavior belongs to Phase 4.                                                                 |
| FR-011      | FAIL baseline: raw spaced terms produce distinct keys/criteria.                                                 |
| FR-012      | NOT RUN: out-of-order current-term presentation belongs to Phase 4.                                             |
| FR-013      | PASS baseline: the available list has a loading state; active-search freshness is not established.              |
| FR-014      | FAIL baseline: no-match currently uses the general available-list empty state.                                  |
| FR-015      | PASS baseline: the current unfiltered empty list uses the general empty state.                                  |
| FR-016      | WARN baseline: generic retry exists; normalized current-term behavior is not established.                       |
| FR-017      | FAIL baseline: there is no accessible search-clear action.                                                      |
| FR-018      | FAIL baseline: join invalidates only the empty available variant.                                               |
| FR-019      | FAIL baseline: leave invalidates only the empty available variant.                                              |
| FR-020      | FAIL baseline: delete invalidates only the empty available variant.                                             |
| FR-021      | PASS baseline: mutations do not optimistically change membership; mutation regression suites passed.            |
| FR-022      | PASS baseline: 69 existing mobile regression tests passed.                                                      |
| FR-023      | FAIL baseline: search runtime validation and duplicate/extra-query rejection are not implemented.               |
| FR-024      | PASS baseline: the existing endpoint and `ClassroomSummary[]` response are reused; no schema change is planned. |
| SC-001      | NOT RUN: the new acceptance matrix is added in Phase 3.                                                         |
| SC-002      | NOT RUN: Phase 4.                                                                                               |
| SC-003      | NOT RUN: Phase 4.                                                                                               |
| SC-004      | NOT RUN: Phase 4.                                                                                               |
| SC-005      | NOT RUN: direct invalid-input and Unicode boundary matrix is added in Phase 3.                                  |
| SC-006      | NOT RUN: Phase 5.                                                                                               |
| SC-007      | NOT RUN: Phase 5.                                                                                               |
| SC-008      | PASS baseline: my-list tests remained independent during existing available-list UI states.                     |
| SC-009      | NOT RUN: search-specific feedback/clear/retry theme coverage belongs to Phase 4.                                |
| SC-010      | PASS baseline: confirmation, navigation, and action regression suites passed.                                   |

## Phase 3 - US1 Acceptance Results (T019)

| Requirement            | Result  | Evidence                                                                                                                                                                                                                                                              |
| ---------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-008, SC-001 | PASS    | Available-list integration covers substring, case, trim, empty, accent significance, internal spaces/punctuation, and literal `%`, `_`, and backslash terms; membership excludes the associated matching classroom. My-list response remains separate and unfiltered. |
| FR-002                 | PASS    | Route test places the labelled FormField under “Turmas disponíveis”; the live Claro/Escuro switch preserves its input and active palette. Native screen-reader/device checks remain `NOT MEASURED`.                                                                   |
| FR-003                 | PASS    | PostgreSQL/HTTP integration accepts PARENT, PROFESSOR, and ADMIN; absent and invalid sessions remain 401.                                                                                                                                                             |
| FR-004, FR-005, FR-011 | PASS    | Backend DTO and mobile Zod schema trim external spaces only; whitespace maps to the empty criterion/key, service omits the empty HTTP parameter, and internal spaces/case/accents remain unchanged.                                                                   |
| FR-006, SC-005         | PASS    | Backend and mobile cover normalized 80/81 code-point limits, including surrogate pairs and combining sequences; HTTP accepts 80 and returns 400 for 81 before invoking the list service.                                                                              |
| FR-007                 | PASS    | PostgreSQL integration verifies case-insensitive substring matching, significant accents, and literal wildcard/backslash terms.                                                                                                                                       |
| FR-023                 | PASS    | Runtime Swagger and canonical OpenAPI match: optional scalar form parameter, 80 limit described after trim, empty accepted without `minLength`, and repeated values documented/rejected. Unknown and bracketed query fields return 400.                               |
| FR-024                 | PASS    | Existing endpoint, `ClassroomSummary[]`, memberships, and response projection remain in use. No Prisma schema, migration, package, or lockfile change was made.                                                                                                       |
| SC-008                 | PASS    | Route tests retain “Minhas turmas” content and member actions through available-list loading, error, results, empty, and invalid-input states.                                                                                                                        |
| FR-022, SC-010         | PASS    | Existing create/owner/member/navigation/confirmation, home/details/theme, and touch-target regressions passed.                                                                                                                                                        |
| SC-009                 | NOT RUN | Automated field theme switching passed. Full search feedback/clear/retry theme coverage belongs to Phase 4; device legibility, keyboard/focus, and assistive technology remain `NOT MEASURED`.                                                                        |

Phase 3 validation:

| Check                                      | Result | Observation                                                                                                                                              |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend DTO/controller/service unit suites | PASS   | 3 suites, 39 tests.                                                                                                                                      |
| Classroom HTTP/PostgreSQL integration      | PASS   | 1 suite, 16 tests, on `localhost/avisa_ai_test` accepted by `assertSafeTestDatabase`. The rollback test logs its expected simulated transaction failure. |
| OpenAPI contract suite                     | PASS   | 1 suite, 7 tests; runtime/canonical operation inventory and search parameter match.                                                                      |
| Mobile US1, support, and regression suites | PASS   | 13 suites, 88 tests. Existing React `act` and Jest worker/open-handle warnings remain; Jest exited 0 with all assertions passing.                        |
| Backend and mobile `npm run typecheck`     | PASS   | Both workspaces typecheck.                                                                                                                               |
| Targeted ESLint and Prettier checks        | PASS   | All changed backend/mobile code and tests passed.                                                                                                        |
| `git diff --check` and OpenAPI JSON parse  | PASS   | No whitespace errors; canonical OpenAPI remains valid JSON.                                                                                              |

Phase 3 checkpoint: at T019, T020 and later tasks were still open; debounce/race/full search-state and post-mutation cache work were outside that checkpoint. Their results are recorded below. Phase 6 gates and native device/assistive-technology observations were not part of T019; applicable manual evidence is `NOT MEASURED`.

## Phase 4 - US2 Acceptance Results (T020-T027)

| Requirement           | Result | Evidence                                                                                                                                                                                                                                                                                                          |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-009-FR-010, SC-002 | PASS   | `useClassroomSearch` tests cover raw input immediately, 299/300 ms settling, restarted debounce across edits, equivalent normalized terms without duplicate lookup, clear behavior, invalid blocking, retry eligibility, and timer cleanup on unmount.                                                            |
| FR-011-FR-012, SC-003 | PASS   | Available-hook/service tests use real query observers and controlled promises to cover normalized query identity, signal forwarding/cancellation, A/B responses and errors out of order, suppression of old-term state during edits/clear, and stale reactivation.                                                |
| FR-013-FR-017, SC-004 | PASS   | Route tests cover validation/waiting/error/loading/refresh/results/contextual no-match/general empty states, guarded current-term retry, accessible clear, and hiding stale/non-actionable available cards.                                                                                                       |
| SC-005                | PASS   | Phase 3's backend/mobile boundary matrix covers 80/81 normalized code-point limits, Unicode surrogate/combining cases, and empty/invalid values.                                                                                                                                                                  |
| SC-008                | PASS   | Route tests preserve independent “Minhas turmas” loading, error, content, and actions through available-search feedback and result states.                                                                                                                                                                        |
| SC-009                | PASS   | Claro/Escuro route coverage exercises search feedback and controls; the focused live-switch case preserves raw text and the pending timer without an extra query. At T027, device legibility and assistive-technology observations were still `NOT MEASURED`; see the later T041 user-reported walkthrough below. |

Phase 4 validation:

| Check                                            | Result      | Observation                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search schema/hook/available/service/list suites | PASS        | `npx jest --runInBand --runTestsByPath tests/validations/classroomSearch.schema.spec.ts tests/hooks/useClassroomSearch.spec.tsx tests/hooks/useAvailableClassrooms.spec.tsx tests/services/classroom.service.spec.ts tests/routes/classrooms-list.spec.tsx`: 5 suites, 44 tests.                                                            |
| Theme search coverage                            | PASS / WARN | Focused new search-theme scenario: 1 test passed and Jest exited 0. The full `theme-surfaces.spec.tsx` produced 10 passing assertions but Jest reported an open handle and did not exit; the combined 6-suite/54-test run likewise passed every assertion before it was interrupted. The baseline also recorded a Jest open-handle warning. |
| Mobile typecheck                                 | PASS        | `npm run typecheck` (`tsc --noEmit`).                                                                                                                                                                                                                                                                                                       |
| Targeted ESLint                                  | PASS / WARN | Zero errors; 7 `no-require-imports` warnings in `tests/routes/theme-surfaces.spec.tsx`.                                                                                                                                                                                                                                                     |
| Targeted Prettier and `git diff --check`         | PASS        | All changed Phase 4/5 mobile paths were formatted; no whitespace errors.                                                                                                                                                                                                                                                                    |

## Phase 5 - US3 Acceptance Results (T028-T037)

| Requirement    | Result | Evidence                                                                                                                                                                                                                                                    |
| -------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-018, SC-006 | PASS   | Join hook and actual-route tests prove cancellation precedes invalidation, active list refresh is awaited, inactive available variants are invalidated and refresh on reactivation, and a late pre-join snapshot cannot restore an eligible card.           |
| FR-019, SC-006 | PASS   | Leave hook and actual-route tests prove filtered eligibility returns after confirmed leave, active refresh is awaited, inactive variants refresh when revisited, and pending/cancelled/failed leave does not invent a membership change.                    |
| FR-020, SC-006 | PASS   | Delete hook and actual-route tests prove available/my families are refreshed, late pre-delete snapshots cannot restore the classroom, announcement invalidation remains scoped, and confirmation/navigation behavior remains intact.                        |
| FR-021, SC-007 | PASS   | Real-query and route tests show pending/failure/cancellation preserve server-authoritative participation; list refresh failure after successful join/leave/delete is presented as a query error with retry, not as mutation failure or optimistic rollback. |

Phase 5 validation:

| Check                                                                 | Result      | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutation hooks, available hook, keys, real route, confirmation matrix | PASS / WARN | `npx jest --runInBand --runTestsByPath tests/hooks/useJoinClassroom.spec.tsx tests/hooks/useLeaveClassroom.spec.tsx tests/hooks/useDeleteClassroom.spec.tsx tests/hooks/useAvailableClassrooms.spec.tsx tests/config/query-keys.spec.ts tests/routes/classroom-search-consistency.spec.tsx tests/routes/confirmation-matrix.spec.tsx`: 7 suites, 35 tests; exit code 0. Mutation hook tests emitted React test-environment/`act` warnings; all assertions passed. |
| Mobile typecheck                                                      | PASS        | `npm run typecheck` (`tsc --noEmit`).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Targeted ESLint                                                       | PASS / WARN | Zero errors; the 7 theme-suite `no-require-imports` warnings described above.                                                                                                                                                                                                                                                                                                                                                                                     |
| Targeted Prettier and `git diff --check`                              | PASS        | All checked mobile paths were formatted; no whitespace errors.                                                                                                                                                                                                                                                                                                                                                                                                    |

At the Phase 5 checkpoint, T020-T037 were complete and T038+ remained open. Phase 6 results are recorded below; native/manual evidence remains `NOT MEASURED` where it could not be observed.

## Phase 6 - Polish and Cross-Cutting Validation (T038-T042)

### T038 - Regression and accessibility coverage

| Check                                     | Result | Evidence                                                                                                                                                                                                                                                                   |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused confirmation/accessibility suites | PASS   | `npx jest --runInBand --runTestsByPath tests/routes/confirmation-matrix.spec.tsx tests/accessibility/touch-targets.spec.tsx`: 2 suites, 28 tests. Search, clear, retry, open, join, leave, cancel, accessible names/roles, reading order and platform target sizes passed. |
| Formatting of the two changed test files  | PASS   | `npx prettier --write tests/routes/confirmation-matrix.spec.tsx tests/accessibility/touch-targets.spec.tsx`; both files formatted.                                                                                                                                         |

### T039 - Backend quality gates

All database-aware commands ran with a process-local `DATABASE_URL` targeting `localhost/avisa_ai_test`. The repository `.env` was not changed; the protected integration helper accepted the local test database. The development database `avisa_ai` was not used.

| Command                         | Result | Observation                                                                                     |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `npm run prisma:validate`       | PASS   | Existing Prisma schema valid.                                                                   |
| `npm run prisma:generate`       | PASS   | Prisma Client generated from the existing schema.                                               |
| `npm run prisma:migrate:deploy` | PASS   | 11 migrations found; none pending.                                                              |
| `npm run format:check`          | PASS   | All backend source and test files formatted.                                                    |
| `npm run lint`                  | PASS   | Exit code 0.                                                                                    |
| `npm run typecheck`             | PASS   | `tsc --noEmit`, exit code 0.                                                                    |
| `npm run test:cov`              | PASS   | 13 suites, 94 tests.                                                                            |
| `npm run test:integration`      | PASS   | 6 suites, 54 tests. The logged simulated transaction failure is the asserted rollback scenario. |
| `npm run test:contract`         | PASS   | 1 suite, 7 tests.                                                                               |
| `npm run test:e2e`              | PASS   | 3 suites, 11 tests.                                                                             |
| `npm run build`                 | PASS   | Nest build completed, exit code 0.                                                              |

### T040 - Mobile quality gates

| Command                | Result      | Observation                                                                                                                                                                                      |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck`    | PASS        | `tsc --noEmit`, exit code 0.                                                                                                                                                                     |
| `npm run lint`         | PASS        | Exit code 0.                                                                                                                                                                                     |
| `npm run format:check` | PASS        | All mobile files passed Prettier.                                                                                                                                                                |
| `npm run doctor`       | PASS        | Initial sandbox attempt could not reach Expo/React Native Directory (`EACCES`); rerun with network access passed all 21/21 checks.                                                               |
| `npm run test:ci`      | PASS / WARN | 48 suites, 276 tests, exit code 0. Existing React `act(...)` warnings and a Jest open-handle warning appeared; Jest exited naturally after the pending handle released. No forced exit was used. |
| `npm run export:ci`    | PASS        | Android, iOS and Web bundles exported. Generated `.expo-ci-export/` output was removed after validation.                                                                                         |

### T041 - Device observations

| Walkthrough/observation             | Result               | Evidence and limit                                                                                                                                                                                                                                                           |
| ----------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android Claro/Escuro walkthrough    | PASS (user-reported) | User reports completing the walkthrough and confirms the light/dark themes, classroom search and remaining functionality work correctly. Device model/version, font scale and assistive-technology details were not provided; the agent did not observe the device directly. |
| iOS/VoiceOver and broader usability | NOT MEASURED         | No iOS-specific or VoiceOver result was reported. Jest, Expo Doctor and export do not substitute for native observations.                                                                                                                                                    |

T041 is complete based on the user's report of the Android walkthrough. Device metadata and assistive-technology observations not stated by the user remain unreported; no independent device observation is claimed.

### T042 - Requirements and scope audit

| Requirement   | Final automated status                     | Evidence / limit                                                                                                                                                                                      |
| ------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001-FR-008 | PASS                                       | T019 backend HTTP/PostgreSQL and mobile tests cover literal substring, normalization, membership exclusion, accent/punctuation behavior, and an independent my-list.                                  |
| FR-009-FR-017 | PASS                                       | T027 timer, race, current-state, clear/retry and theme suites cover the 300 ms pause, current criterion, state priority and my-list independence.                                                     |
| FR-018-FR-021 | PASS                                       | T037 real-query mutation and route suites cover join/leave/delete cache refresh, late snapshots, failures, cancellation and pending actions.                                                          |
| FR-022        | PASS                                       | T038 confirmation matrix and the full mobile regression gate preserve create/open/join/leave/delete behavior; theme, details, Home and touch-target suites passed.                                    |
| FR-023-FR-024 | PASS                                       | T039 backend integration/contract gates preserve strict query validation, the existing endpoint, authorization and `ClassroomSummary[]` response.                                                     |
| SC-001        | PASS                                       | Search acceptance matrix and real HTTP/PostgreSQL tests passed.                                                                                                                                       |
| SC-002        | PASS                                       | Search-hook timer tests passed at 299/300 ms and across edits/cleanup.                                                                                                                                |
| SC-003        | PASS                                       | Controlled out-of-order response/error and stale reactivation tests passed.                                                                                                                           |
| SC-004        | PASS                                       | Route tests passed for validation, waiting, loading, results, empty, no-match, error, clear and retry.                                                                                                |
| SC-005        | PASS                                       | Backend/mobile tests passed for normalized 80/81 Unicode code-point boundaries and invalid query shapes.                                                                                              |
| SC-006        | PASS                                       | Real-cache and route tests passed for successful join/leave/delete and inactive search variants.                                                                                                      |
| SC-007        | PASS                                       | Mutation and refresh-failure tests passed without simulated participation changes.                                                                                                                    |
| SC-008        | PASS                                       | Route tests kept `Minhas turmas` content/actions independent through available-search states.                                                                                                         |
| SC-009        | PASS automated / PASS user-reported manual | Claro/Escuro route and accessibility assertions passed; the user reports the manual theme/search walkthrough was correct. Device metadata and whether TalkBack/VoiceOver was used were not specified. |
| SC-010        | PASS                                       | Confirmation, role/action, navigation, Home/details, mutation and full regression suites passed.                                                                                                      |

Final boundary audit:

- Root `git diff --check`: PASS. Canonical OpenAPI JSON parse: PASS.
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, backend/mobile `package.json` and lockfiles are unchanged.
- The existing `GET /api/v1/classrooms` operation remains `classrooms.findAvailable`; no route, response field, Prisma model/migration, package, permission, my-list filter or unrelated capability was added. The planned canonical OpenAPI search-parameter documentation is synchronized.
- Automated requirements and the user-reported Android walkthrough are recorded separately. T038-T042 are complete; device metadata and unreported assistive-technology observations remain unspecified.
