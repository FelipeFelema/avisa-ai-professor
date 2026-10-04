# Validation — Spec 008, phases 1–3

Scope: T001–T028. Stop before T029 / Phase 4. No account DELETE endpoint or live destructive mobile submission is authorized at this checkpoint.

## Baseline (2026-10-03)

- Branch: `008-account-deletion-data-lifecycle`; initial `git status --short`: only the untracked `specs/008-account-deletion-data-lifecycle/` directory. Existing feature documents are preserved.
- Requirements checklist: 16/16 checked. No extension hooks file or AGENTS.md found. Ignore files/configurations already cover dependencies, secrets, generated builds, coverage and editor output; packages are private.
- Domains: users owns read-only impact; auth coordinates session writers; classrooms coordinates the receipt writer. Mobile changes are limited to Axios opt-in replay policy, transient impact/schema/hook and Profile confirmation UI.
- Current schema: User ownership/authorship/membership FKs are restrictive; Classroom children and User sessions cascade. ClassroomDeletionReceipt has no User FK. InviteCode has no User relationship. No schema, migration or package change is planned.
- Receipt writer: `ClassroomsService.delete`, including idempotent and P2002 recovery. Session writers: AuthSessionService creation/rotation and AuthService login/registration/refresh. Both must acquire User before sessions/receipts/Classroom; the future destructive gate precedes User. GET uses a consistent read snapshot without gate/row locks.
- Mobile private data: AuthProvider identity, SecureStore access/refresh tokens, QueryClient private classroom/announcement queries. Impact and confirmation stay outside those caches/storage. Theme belongs to the installation. Session cleanup/generation work is Phase 5 and remains unimplemented here.
- Independent of spec 007 user journeys. Existing profile/password/login/register/refresh/logout/receipt contracts remain regression targets.
- Database validation must explicitly select local `avisa_ai_test`, with `assertSafeTestDatabase` before fixture setup/cleanup. Never run against development `avisa_ai`.

## Results

| Check                                                     | Status                                                                                                   |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Phase 1 fixture safety and baseline                       | PASS — 9 fixture/safety tests, existing 11 migrations, local avisa_ai_test                               |
| Phase 2 DTO/session/auth/receipt/interceptor gate         | PASS — 80 backend unit tests, 48 PostgreSQL regression/fixture tests, 13 interceptor tests               |
| Phase 3 impact/HTTP/OpenAPI/mobile confirmation           | PASS — 18 impact/controller unit tests, 18 account HTTP tests, 9 OpenAPI tests, 68 directed mobile tests |
| Full backend/mobile quality gates                         | PASS — results and commands below                                                                        |
| Completed account deletion / rollback / destructive races | NOT RUN — outside authorized phases                                                                      |
| Android, keyboard, font scaling, contrast, TalkBack       | NOT MEASURED                                                                                             |
| iOS / VoiceOver                                           | NOT RUN / NOT MEASURED                                                                                   |
| Timed comprehension                                       | NOT MEASURED                                                                                             |

## Foundation checkpoint

- Red tests observed before implementation: missing fixture/DTO modules; unsafe unlocked session create/rotate; receipt access before User recheck; destructive 401 refresh; missing refresh snapshot revalidation. Then green.
- Backend: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/users/dto/delete-account.dto.spec.ts src/auth/auth.service.spec.ts src/auth/auth-session.service.spec.ts src/classrooms/classrooms.service.spec.ts`: exit 0, 4 suites / 80 tests.
- PostgreSQL: `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/account-deletion.helper.integration.spec.ts test/auth.integration.spec.ts test/classrooms.integration.spec.ts test/password-change.integration.spec.ts`: exit 0, 4 suites / 48 tests. Every database run explicitly sets local `avisa_ai_test`. Expected legacy simulated transaction-failure log is test fault injection, not product success evidence.
- Mobile: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/lib/api-session.spec.ts`: exit 0, 13 tests; first 401 and network/server failure cannot refresh/replay/retain flagged DELETE; normal refresh/replay still works.
- Auth obtains current claims in a read-only User-lock transaction, hashes outside all transactions, then locks/revalidates again for persistence. If User/credential/email/role or active SID/hash changes between passes, return sanitized 401 without tokens. No retry. The existing password refresh-race test now intercepts the actual User-lock boundary and expects rejection before tokens, replacing its old unlocked-rotation spy.
- Lock protocol: future account gate → User → Classroom/session/receipt. Session/receipt writers use User first without a global gate. GET will use RepeatableRead without write locks.
- Unchanged Prisma schema/migrations and package manifests/lockfiles. No account DELETE route introduced.
- Corrected validation setup mistakes: two nonexistent regression filenames and one root-directory Jest launch failed; reran from backend with the actual filenames. A stale rotate spy initially waited on a boundary no longer used; updated it to the lock boundary and reran successfully. These failed attempts are not counted as passing evidence.

## US1 checkpoint — T014–T028

- Red tests observed for missing impact service/controller wiring, mobile schema/service/route and the absent canonical GET operation. Implementation then passed the directed matrices.
- GET `/api/v1/users/account-deletion` uses JWT identity/sid and a RepeatableRead transaction for current role, last-ADMIN eligibility and four exact counts. No gate, row locks, writes, expiry filter, resource IDs or total ADMIN count. `Cache-Control: no-store` also applies before authentication guards, covering 401 responses.
- Disposable fixture expectations for all roles, including historical PARENT/ADMIN ownership: two own turmas, three announcements inside them (including third-party/expired contents), one external membership and one externally authored announcement. Zero relations are ready. One ADMIN returns false/`LAST_ADMIN_REQUIRED`; two return true/null. HTTP snapshots before/after prove no table/session changes. A concurrent insertion between actual PostgreSQL reads remains outside that GET snapshot and appears on the next GET.
- HTTP covers missing/revoked/expired/foreign sessions, missing account, no token, body/query selectors, sanitized 500 and absence of the public account DELETE (404). Runtime/canonical OpenAPI have 21 existing/new operations and the exact closed `AccountDeletionImpact`; all prior contracts match.
- Backend DTO and mobile Zod reject absent/nonstring/raw JSON inputs, unknown fields, case/space/newline/confusable phrase variants. Existing passwords, including a one-character string, spaces and long Unicode credentials, are preserved exactly without a new maximum. This checkpoint validates presence/type/exact phrase locally; verifying the actual password against the account belongs to US2.
- Profile opens `/profile/delete-account` for all roles. The screen explains permanent removal, actual/historical relations, external preservation, ADMIN access loss, InviteCode/theme preservation and graph recalculation. The last ADMIN cannot proceed. Loading, safe read error/retry, focus/resume refresh and valid zero counts are covered.
- `Revisar confirmação` performs only local validation and clears the values. The account DELETE button has no live handler and stays disabled. No password/phrase is sent to impact GET, retained in QueryClient/MutationCache, persisted or returned as feedback. This is an independently reviewable confirmation increment, not a completed deletion.
- Transient hook guards requests by current account object, focus, mount and request generation; it aborts superseded/unmounted reads and ignores late responses even if transport ignores cancellation. Refreshing or losing eligibility clears form inputs. Cancel, back/blur, unmount, session expiration and background/resume discard inputs. Structural tests cover protected password, autofill/autocorrection/capitalization off, exact visible phrase, field-linked errors/focus/announcements, keyboard/scroll wrappers, both active palettes and accessible actions.
- Directed mobile command: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/validations/deleteAccount.schema.spec.ts tests/services/account-deletion.service.spec.ts tests/hooks/useDeleteAccount.spec.tsx tests/routes/profile-delete-account.spec.tsx tests/lib/api-session.spec.ts`: exit 0, 5 suites / 68 tests. Extra hook lifecycle tests support T025.
- Corrected implementation/check issues before final gates: TypeScript literal inference, Axios adapter/deferred fixture types, imported Express request type, typed Prisma test proxy, and React effect/ref lint rules. Canonical synchronization preserves the original formatting/contracts with only the new path/schema inserted. No failures below remain unresolved.

## Final automated gates

Commands run from the corresponding component directory. PostgreSQL integration/contract/E2E always explicitly selected `postgresql://localhost:5432/avisa_ai_test` (credentials omitted here); safety guards confirmed the local test target. Native PostgreSQL was available while Docker was unavailable.

| Component  | Command                                                                      | Observed result                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Backend    | `npm run prisma:migrate:deploy`                                              | Exit 0; 11 existing migrations; no pending migrations                                                                                    |
| Backend    | `npm run prisma:validate`, `npm run prisma:generate`                         | Both exit 0; schema valid/client generated                                                                                               |
| Backend    | `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build` | All exit 0                                                                                                                               |
| Backend    | `npm run test:cov`                                                           | Exit 0; 17 suites / 184 tests; coverage 77.71% statements, 70.89% branches, 76.96% functions, 78.06% lines; configured thresholds passed |
| Backend    | `npm run test:integration`                                                   | Exit 0; 9 suites / 97 tests on isolated PostgreSQL                                                                                       |
| Backend    | `npm run test:contract`                                                      | Exit 0; 9 tests; runtime/canonical exact inventory/schema                                                                                |
| Backend    | `npm run test:e2e`                                                           | Exit 0; 4 suites / 33 tests, including 18 account-impact acceptance tests                                                                |
| Mobile     | `npm run typecheck`, `npm run format:check`, `npm run lint`                  | All exit 0                                                                                                                               |
| Mobile     | `node node_modules/jest/bin/jest.js --ci --runInBand --coverage --forceExit` | Exit 0; 55 suites / 378 tests; configured coverage thresholds passed                                                                     |
| Mobile     | `npm run doctor` with network access                                         | Exit 0; 21/21 checks                                                                                                                     |
| Mobile     | `npm run export:ci`                                                          | Exit 0; Web, Android and iOS bundles exported                                                                                            |
| Repository | `git diff --check` and changed-path/schema/manifest audit                    | Exit 0; no schema/migration/package/lockfile changes; no staging/commit/push                                                             |

Validation qualifications:

- The first mobile coverage run passed 55/378 assertions but did not terminate because of open asynchronous handles. Its process was stopped and the established `--forceExit` variant completed with exit 0. Existing classroom-hook suites emitted React `act` warnings; they are not device/accessibility evidence.
- Doctor first reported 19/21 because sandbox network access prevented its Expo schema and React Native Directory checks. The network-enabled rerun passed all 21.
- Export revealed that `.expo-ci-export` was not ignored. Added only this generated directory to root Git ignore, mobile Prettier ignore and ESLint ignores, then reran format/lint successfully. No generated bundle is part of this delivery.
- Backend fault-injection suites emitted expected existing simulated-failure logs; all assertions and exit codes passed. They are regression evidence for existing profile/classroom operations, not proof of account-deletion rollback.
- No Android/device/TalkBack/font-scale/visual contrast/timed comprehension observation was made. iOS export proves bundling only; iOS/VoiceOver remains unexecuted.

## Scope closure at the Phase 1-3 checkpoint (2026-10-03)

T001–T028 complete. T029–T065 remain unchecked. Phase 4, account password verification/deletion/advisory gate/rollback races, Phase 5 session cleanup/indeterminate outcome handling and final manual evidence are not implemented or claimed here. No preexisting WIP was discarded. `.specify/extensions.yml` is absent; before/after implementation hooks were therefore skipped according to the skill.

## Phase 4 checkpoint (2026-10-04)

Scope: T029-T042 (US2), the backend atomic account deletion and its HTTP, integrity, rollback, concurrency and session-writer proofs. T029-T042 are complete. Stop here: Phase 5 starts at T043; T043-T065 remain unchecked.

### Implementation and policy evidence

- DELETE /api/v1/users/account uses the authenticated sub and sid, JWT and the existing rate limit. It accepts the closed confirmation/password DTO, rejects query selectors, sets Cache-Control: no-store, and returns an empty 204 only after the transaction commits. Wrong password is 400; invalid or repeated deletion is 401; changed credentials and last-ADMIN refusal are 409; unexpected failures are sanitized as 500 without retry.
- Password verification uses the preflight hash before acquiring locks. A READ COMMITTED transaction obtains the fixed parameterized advisory gate before locking the User, rereads the current User, active session, hash and role, counts ADMINs under the gate, then locks owned classrooms in ascending id order.
- One transaction removes authored announcements, memberships, owned classrooms and their cascades, owned classroom-deletion receipts, every account session, and the User. It creates no account tombstone. Full-table PostgreSQL snapshots verify unrelated Users, InviteCodes, resources, external participation/authorship and third-party data remain intact. Email reuse creates a fresh identity; old access/refresh credentials fail.
- Deterministic two-connection tests cover duplicate deletion, competing ADMIN deletions and rollback, live password/role changes between preflight and the User lock, both classroom-receipt orderings, ownership/membership/authorship inserts in both orders, and third-party child inserts in both orders. Login, token issuance and refresh are raced against deletion in both commit orders.

### Automated validation

All commands ran from backend. PostgreSQL suites used the configured local connection with its database path explicitly changed to avisa_ai_test; integration safety guards verified the target. Destructive suites ran serially.

| Command / scope                                                                                                                                                                                  | Result                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/users/account-deletion.service.spec.ts src/users/users.controller.spec.ts src/users/dto/delete-account.dto.spec.ts           | Exit 0; 3 suites, 61 tests                                                                                                     |
| npm run test:contract                                                                                                                                                                            | Exit 0; 1 suite, 9 tests; runtime and canonical OpenAPI contract                                                               |
| npm run test:e2e                                                                                                                                                                                 | Exit 0; 4 suites, 39 tests                                                                                                     |
| PostgreSQL: test/account-deletion.integration.spec.ts, test/account-deletion.concurrency.integration.spec.ts, test/auth.integration.spec.ts with --config test/jest-integration.json --runInBand | Exit 0; 3 suites, 40 tests                                                                                                     |
| npm run test:cov                                                                                                                                                                                 | Exit 0; 17 suites, 200 tests; 78.03% statements, 70.88% branches, 77.34% functions, 78.44% lines; configured thresholds passed |
| npm run lint, npm run typecheck, npm run format:check, npm run build                                                                                                                             | All exit 0                                                                                                                     |
| git diff --check and affected-path/schema/manifest audit                                                                                                                                         | Exit 0; no Phase 4 Prisma schema, migration, package or lockfile change                                                        |

The advisory-lock query was adjusted after PostgreSQL could not deserialize the lock function's void result (P2010): it now selects a constant from the transaction-scoped lock call. The database integration suite passed after the correction. An initial lint pass also flagged unsafe any values in test-only Prisma proxy adapters; the adapters were typed and lint passed. A first connection attempt with an incomplete local test URL failed before test execution; the successful runs used the configured local credentials and explicitly selected avisa_ai_test.

### Phase boundary

No Phase 5 implementation or manual device evidence is claimed. The live mobile submission, session cleanup/recovery flow and its integrated walkthrough remain for T043 onward. Android/iOS, screen-reader, enlarged-text, contrast and timed-comprehension observations remain NOT MEASURED. Existing Phase 1-3 worktree changes were preserved.

## Phase 5 checkpoint (2026-10-04)

Scope: T043–T057 (US3), client session closure and account-deletion result recovery. These tasks are complete; stop before Phase 6, T058–T065, which remain unchecked.

### Implementation and policy evidence

- A module-level session generation now guards token writes, refresh responses, bootstrap/profile work, private reads, mutation results and caller callbacks. Session expiry/deletion closes identity and clears private query data synchronously before SecureStore cleanup awaits. Both token removals are attempted; failures produce retryable local cleanup feedback without claiming the failed key was erased. Theme preference remains in AsyncStorage.
- Private React Query reads pass cancellation signals and are generation-checked before returning data. Session-aware mutations suppress stale success/error effects and do not retry ambiguous failures. Existing classroom-search, profile/password, announcement and classroom behavior remains in the full mobile regression run.
- Account deletion is imperative and single-flight. The service sends one closed two-field DELETE with replay disabled, treats only 204 as confirmed, allowlists feedback and removes Axios request/config/data/cause details. Session verification is a separate read-only request and yields valid, invalid or indeterminate; a valid session triggers a fresh impact summary and manual confirmation, never an automatic DELETE resend or a rollback claim.
- The route clears typed credentials before awaiting submission, blocks cancel/back/gestures while pending, disarms protection after expiry, and presents identity-free confirmed or neutral session-ended notices. Private routes remain gated while bootstrap validates the server session.
- Automated mobile transports are mocked in unit/component tests. These tests do not claim a live client/server destructive walkthrough or multi-device observation.

### Automated validation

Commands ran from `mobile` unless marked repository root.

| Command / scope                             | Result                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx jest --runInBand --forceExit --silent` | Exit 0; 60 suites / 408 tests, including the integrated Phase 5 race, storage, provider, service and route coverage. Jest's force-exit advisory was printed after all suites passed. |
| `npm run typecheck`                         | Exit 0; TypeScript completed without errors.                                                                                                                                         |
| `npm run lint`                              | Exit 0; no lint errors or warnings.                                                                                                                                                  |
| `npm run format:check`                      | Exit 0; all matched mobile files use Prettier formatting.                                                                                                                            |
| Repository: `git diff --check`              | Exit 0; no whitespace errors. Git reported an existing CRLF-to-LF notice for the unrelated modified Spec 001 OpenAPI file.                                                           |

### Phase boundary and unmeasured evidence

T058–T065 remain unchecked. Phase 6 documentation, Doctor/export checks and final polish have not been started. No Android or iOS device walkthrough, TalkBack/VoiceOver, enlarged-text, contrast or timed-comprehension observation was made; these remain NOT MEASURED. No preexisting backend/Spec 001 worktree changes were removed or staged.

## Phase 6 checkpoint — 2026-10-04

The authorized scope was T058–T065. T058–T062 are implemented and validated. On 2026-10-04, the user reported completing the full Android walkthrough with all functionality behaving as expected; T063 is recorded as `PASS (user-reported)`. Device metadata, a per-scenario breakdown and timed comprehension results were not provided and remain unmeasured. T064 remains open because no keyboard, enlarged-text or TalkBack results have been reported. T065 remains open after T064 in the declared task graph.

### Documentation, privacy and operational evidence

- Backend and mobile READMEs now document the impact GET and self-only DELETE, permanent lifecycle, last-ADMIN rule, existing rate limit, no-replay and unknown-result flow, theme preservation and explicit isolated `avisa_ai_test` workflow. They were cross-checked against the Spec 008 contract.
- The contract and quickstart now identify the runtime as implemented and point readers to actual validation evidence; their expected-behavior matrix remains separate from measured results.
- The sensitive-data review found no request-body logging in the account-deletion controller/service path. Backend response tests cover credential/token/third-party/internal-error leakage; mobile service tests reject raw Axios request/config/response/cause data and submitted values. Route tests inspect empty QueryCache/MutationCache state; storage/provider tests exercise cache/token cleanup and preservation of only the theme preference.
- Login/register/invite/profile/password/logout/theme/classroom/announcement/OpenAPI regressions ran in the full backend and mobile suites. Full database suites were serialized; no destructive test command targeted `avisa_ai`.
- The T060 synthetic measurements and their limits are in [backend-validation.md](./backend-validation.md). They show local transaction and gate-wait time under tested loads, not a production SLO. Axios remains at 10 seconds; the client retains indeterminate-result handling and no automatic DELETE replay.

### Requirement and success-criterion evidence

| Requirement / outcome                         | Evidence                                                                                                                              | Qualification                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| FR-009–FR-020; SC-002–SC-005                  | Backend snapshot, rollback, status, ADMIN and deterministic race tests; full integration and E2E suites passed.                       | PostgreSQL used the isolated local `avisa_ai_test`; no production inference.      |
| FR-017; FR-020–FR-023; SC-004, SC-007, SC-008 | Mobile generation, storage, provider, private-query and mutation tests; 60 suites / 414 tests passed with coverage thresholds.        | Android second-session/restart behavior and device storage remain unobserved.     |
| FR-024–FR-025; SC-006                         | Profile and deletion-route tests cover copy, eligibility, field/error states, route guards and structural accessibility.              | Unaided comprehension, TalkBack and two-minute completion were NOT MEASURED.      |
| FR-026; SC-009–SC-010                         | Runtime/canonical contract, privacy assertions, full regression suites, Prisma/build/lint/typecheck/format, Doctor and export passed. | Automated checks do not establish native visual or assistive-technology behavior. |

### Automated gates and final scope audit

- Backend gates: see [backend-validation.md](./backend-validation.md). Prisma schema/generation/deploy, 11 integration suites / 132 tests, contract 9/9, E2E 39/39, coverage 200/200, formatting, lint, typecheck and build all exited 0.
- Mobile gates: see [mobile-validation.md](./mobile-validation.md). Typecheck, lint, format, Doctor 21/21, Jest 60/60 suites / 414/414 with thresholds, and Android/iOS/web export all exited 0.
- Repository `git diff --check` exited 0. Markdown formatting was checked for the affected READMEs, tasks and evidence files. The final working-tree audit found no schema/migration/package/lockfile change and no `AccountDeletionReceipt` model or table. Existing `ClassroomDeletionReceipt` behavior is covered by the Phase 4 integrity tests.
- The final query against `avisa_ai_test` found zero users, classrooms, announcements and sessions after the serialized test runs. `.expo-ci-export` is ignored. No preexisting WIP was discarded, staged, committed or pushed.

### Outstanding manual evidence

The Android functional walkthrough is `PASS (user-reported)` in [android-walkthrough.md](./android-walkthrough.md); device metadata and the two-minute comprehension measurement remain `NOT MEASURED`. Keyboard/text-scale/contrast/TalkBack remain `NOT MEASURED`, and iOS/VoiceOver remains `NOT RUN / NOT MEASURED`; see [accessibility-validation.md](./accessibility-validation.md). T064 and its dependent T065 remain open until their required evidence and consolidation are complete.

T058–T063 are marked complete in `tasks.md`. The reported Android walkthrough is attributed to the user; assistive-technology evidence is not inferred from that report.
