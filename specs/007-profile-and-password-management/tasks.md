---
description: "Task list for Profile and Password Management implementation"
---

# Tasks: Profile and Password Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Input**: Design documents from `/specs/007-profile-and-password-management/`.

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/profile-and-password.md`, `quickstart.md` and `.specify/memory/constitution.md`.

**Tests**: Included because the specification requires measurable validation, authorization, session, rollback and regression scenarios, and the plan requires unit, real HTTP/PostgreSQL, OpenAPI and mobile coverage. Write new behavioral expectations before their implementation and observe the expected failure; preserve existing assertions unless the feature explicitly supersedes them. Already implemented behavior needs regression proof, not an artificial failing test.

**Organization**: Setup and shared foundation, followed by US1/P1 and US2/P2 with independent checkpoints, then cross-cutting validation. This file schedules future implementation; every task starts unchecked.

## Format: `[ID] [P?] [Story] Description`

- `[P]` indicates separate files that can be worked on concurrently after prerequisites are complete; it does not authorize automatic agent delegation.
- `[US1]` and `[US2]` label story tasks only. IDs are sequential and paths are relative to the repository root.
- Evidence created during implementation belongs in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`. Record automated results as `PASS`, `WARN`, `FAIL` or `NOT RUN`; absent manual/device/assistive-technology observations are `NOT MEASURED`.

## Scope Guardrails

- Keep GET/PATCH `/api/v1/users/profile`; only name/email are editable. The main Perfil retains role, theme and logout. Add POST `/api/v1/auth/change-password` and `/profile/change-password` separately.
- Follow the explicit reconciliation in `plan.md` and `contracts/profile-and-password.md`: send and validate `confirmNewPassword` server-side to satisfy FR-016 despite the contradictory client-only wording in the spec entities. Confirmation remains transient and write-only. Do not attribute this design decision to an explicit user approval or silently rewrite the spec.
- New-password length is 6–72 Unicode code points; compare the complete strings exactly, without trim, case folding, Unicode normalization or truncation. No new maximum on current passwords. Preserve existing profile and registration validation policies, including their current character rules.
- Read bcrypt legacy credentials and scrypt v1; registration/password change write the adopted scrypt format. No mass migration, login rehash, refresh-token-hash change, new dependency, package/lockfile, table or Prisma migration.
- Account/sid come from authenticated server context. Credential write and revocation share one transaction; the initiating tokens stay valid. User-row locking and snapshot revalidation coordinate password change, sensitive profile writes and login-session creation.
- Passwords stay within transient form/transport/server verification boundaries. No secret-bearing logs, snapshots, test failure output, analytics, public identity, route params, local storage, query/mutation cache or retained raw HTTP errors.
- Use only an isolated local PostgreSQL database with `test` in its name and `assertSafeTestDatabase`; never run destructive suites against Compose development database `avisa_ai`.
- Preserve unrelated WIP and authentication, refresh/logout, theme, permissions, classrooms and announcements. Account deletion belongs to spec 008; reset-by-email, editable roles, session management UI and new authentication methods remain out of scope.

## Phase 1: Setup (Existing Monorepo Baseline)

**Purpose**: Establish the actual baseline and safe validation environment without recreating the project.

- [x] T001 Inspect existing profile normalization/DTO/service, credential writes/login/session creation, installed HTTP validation, Axios refresh, profile hooks/providers, navigation primitives, theme and package scripts in `backend/src/configure-app.ts`, `backend/src/users/users.service.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/auth-session.service.ts`, `mobile/src/lib/api.ts`, `mobile/app/(app)/profile/edit.tsx`, `mobile/src/providers/AuthProvider.tsx`, `backend/package.json` and `mobile/package.json`; record baseline behavior, adopted design decisions and unrelated WIP in `specs/007-profile-and-password-management/evidence/profile-password-validation.md` without copying secrets.
- [x] T002 Verify the isolated database using `backend/test/helpers/test-database.helper.ts` and `.github/workflows/backend-ci.yml`, apply only existing migrations, and run existing auth/users/profile/OpenAPI and mobile profile/navigation/theme baseline suites from `specs/007-profile-and-password-management/quickstart.md`; record environment, real results, existing failures, unavailable checks and the FR-001–FR-029/SC-001–SC-010 evidence matrix in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`.

**Checkpoint**: Baseline and protected test environment are documented. No story implementation has started.

---

## Phase 2: Foundational (Credential Compatibility, Session Coordination and Navigation)

**Purpose**: Supply the shared credential/session and navigation prerequisites needed by the stories.

**Blocking checkpoint**: Complete T003–T012 before story changes. Hashing and session-coordination changes are part of this feature, not optional cleanup.

### Tests and Test Support

- [x] T003 Add reusable synthetic role/occupied-email/2+sid/expired/revoked/legacy-credential fixtures, controlled transaction fault injection and deterministic race barriers in `backend/test/helpers/profile-password.helper.ts`; use `backend/test/helpers/test-app.helper.ts` with production `configureApp` and the protected test database. Add deferred-request/navigation and real QueryClient inspection support in `mobile/tests/helpers/profile-password.tsx` using `mobile/tests/helpers/render.tsx`; clean up clients, timers and observers, and keep secret comparisons boolean so failed assertions cannot print values, tokens or hashes.
- [x] T004 [P] Add `backend/src/common/security/password-hasher.spec.ts` covering bcrypt legacy and scrypt v1 verification, random salts, wrong passwords, significant whitespace/case, Unicode passwords up to 72 code points exceeding 72 bytes and differences beyond byte 72; reject malformed encodings, unsupported versions/costs and invalid salt/key lengths without fallback or executing arbitrary costs, and assert safe hashing/verification failures without secret-bearing diagnostics.
- [x] T005 [P] Extend `backend/src/auth/auth.service.spec.ts` and `backend/src/users/users.service.spec.ts` for legacy/new login compatibility, registration writing the full-input format with unchanged public role/invite/validation behavior, no login rehash, and login-session creation rechecking the credential snapshot under a User lock before committing; include rejection of stale snapshots without creating a usable session and preserve token claims/TTLs.
- [x] T006 [P] Extend `backend/src/auth/auth-session.service.spec.ts` for transaction-aware User locking, active sid ownership/revocation/expiration checks, session creation on the supplied transaction and `revokeOthersInTransaction` preserving the initiating sid; retain refresh hashing/rotation behavior and prove rotation never clears `revokedAt`.
- [x] T007 [P] Extend `mobile/tests/components/BackButton.spec.tsx` and `mobile/tests/routes/secondary-navigation.spec.tsx` for opt-in external pending/disabled state, merged accessible busy/disabled semantics, disabled presses issuing no navigation, and existing back/fallback/duplicate-press defaults on screens that do not opt in; render through providers.

### Shared Implementation

- [x] T008 Implement the pure `backend/src/common/security/password-hasher.ts` using async native `node:crypto` scrypt v1 with N=32768/r=8/p=3/maxmem=64 MiB, random 16-byte salt and 32-byte key, closed version/cost/base64url parsing and constant-time equal-length comparison; support legacy bcrypt reads, reject malformed formats safely, preserve the complete input and avoid domain imports, logs or weaker fallback.
- [x] T009 Integrate the hasher into registration in `backend/src/users/users.service.ts` and credential verification in `backend/src/auth/auth.service.ts`; registration writes scrypt while existing bcrypt accounts remain readable, with unchanged public registration rules, invite roles, profile projection and authentication error semantics; update the existing mocks exercised by T005 without changing refresh-token hashing or rehashing on login.
- [x] T010 Add transaction-aware account-lock/session helpers to `backend/src/auth/auth-session.service.ts` using parameterized User-row lock SQL, consistent User→sessions order, the supplied Prisma TransactionClient and sid ownership/active checks; allow session creation within the caller transaction, prepare expensive refresh-token hashing outside the lock where feasible, and preserve `findActive`, refresh representation and revocation semantics.
- [x] T011 Coordinate login verification and token/session issuance in `backend/src/auth/auth.service.ts` using T010: retain an internal credential snapshot, lock User and recheck it before creating the session on the same transaction, returning tokens only for a committed valid issuance; maintain registration issuance compatibility and existing TTLs/claims without exposing the snapshot, and add only necessary existing Prisma wiring in `backend/src/auth/auth.module.ts` if required.
- [x] T012 Implement opt-in pending/back disable support in `mobile/src/components/ui/SecondaryScreen.tsx` and `mobile/src/components/ui/BackButton.tsx`, including a handler-level external-disabled check and merged accessibility state; preserve defaults, fallback navigation, touch targets and render-time theme palette for all current consumers, and run T004–T007 focused suites before the foundation checkpoint.

**Checkpoint**: Full-input credential compatibility, transaction-aware session issuance and navigation primitives are verified. Route removal/hardware-back guards remain story-specific work.

---

## Phase 3: User Story 1 - Atualizar a própria identidade sem alterar o papel (Priority: P1) — MVP

**Goal**: Keep only Nome/E-mail in the editor, preserve immutable roles, normalized differential confirmation and identity/session integrity.

**Independent Test**: For PARENT/PROFESSOR/ADMIN, inspect both profile surfaces and exercise name-only, email-only, combined, normalized no-op, cancelled confirmation and occupied-email conflict. Direct forbidden fields must fail. Name/no-op preserve all sessions; effective email change preserves the initiator and rejects other access/refresh tokens; injected intermediate failures preserve identity/timestamps/sessions.

### Tests for User Story 1

- [x] T013 [P] [US1] Extend `backend/src/users/users.service.spec.ts` and `backend/src/users/users.controller.spec.ts` for closed name/email input, authenticated identity/sid, role immutability, normalization, no-op without write/timestamp/revoke, name-only session preservation, sensitive writes revalidating the sid inside the transaction and atomic email revocation; retain the data-model constraint “Pelo menos um campo; nome trim 3–100/padrão atual; email trim/lowercase válido até 255/único; payload contém apenas mudanças normalizadas.” and verify boundary values/current name patterns.
- [x] T014 [P] [US1] Extend `backend/test/users.integration.spec.ts` and `backend/test/profile.e2e-spec.ts` using the production validation pipeline and T003 fixtures for all roles, forbidden role/id/password/unknown fields, normalized name/email/joint/no-op requests, occupied-email conflicts, initiating-token continuity and other-session access/refresh rejection; inject failure after identity write and after revocation before commit, and a sid becoming invalid before the sensitive commit, proving boolean equality of prior identity/timestamps/session state in real PostgreSQL.
- [x] T015 [P] [US1] Extend `mobile/tests/routes/profile-edit.spec.tsx` for exactly Nome/E-mail and no role field/read-only value on every role, unchanged-field omission, normalized no-op with no request, prior→new summary, cancel preserving input, recoverable email conflict, success updating visible identity without logout, duplicate-submit prevention, pending back/hardware/gesture removal guards and expiry redirect; cover keyboard/scroll structure, dynamic themes and accessible errors using T003 support.
- [x] T016 [P] [US1] Extend `mobile/tests/validations/updateProfile.schema.spec.ts`, `mobile/tests/hooks/useUpdateProfile.spec.tsx` and `mobile/tests/providers/AuthProvider.spec.tsx` to preserve existing name/email normalization/limits/character rules, differential payload, role immutability, safe public cache/identity updates and no-op behavior; verify that theme preference and auth-session handling keep existing behavior after profile updates and errors.

### Implementation for User Story 1

- [x] T017 [US1] Harden the existing transaction in `backend/src/users/users.service.ts` with parameterized User-row locking, in-transaction sid ownership/active revalidation and reread/recomputation of effective changes before sensitive writes; preserve closed profile validation and the rule “Pelo menos um campo; nome trim 3–100/padrão atual; email trim/lowercase válido até 255/único; payload contém apenas mudanças normalizadas.” No-op returns current public identity without write; name-only preserves sessions; email write/revoke commit together and conflicts/failures roll back. Keep domain separation without importing AuthModule into UsersModule.
- [x] T018 [US1] Remove the Perfil read-only field/value from `mobile/app/(app)/profile/edit.tsx`, retaining only Nome/E-mail, existing validators/differential payload, explicit prior→new confirmation, cancellation without losing values, no-op feedback and recoverable email error; preserve `mobile/src/hooks/useUpdateProfile.ts` and `mobile/src/providers/AuthProvider.tsx` public identity updates unless a proven gap requires a scoped fix, with role unchanged and no forced logout.
- [x] T019 [US1] Add keyboard avoidance/scroll reachability and opt-in pending controls to `mobile/app/(app)/profile/edit.tsx`, plus a route-removal guard covering header Voltar, Android hardware back and gestures; keep the existing immediate submit ref, block voluntary cancellation during the request, allow auth-expiry redirection, and preserve inputs/errors and render-time palette through theme changes and recoverable failures.
- [x] T020 [US1] Run the users/profile unit, real HTTP/e2e and mobile schema/hook/provider/editor/navigation suites from `specs/007-profile-and-password-management/quickstart.md`; record the per-role identity/no-op/conflict/rollback/session matrix and relevant regressions in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`, separating automated checks from any unavailable device observation.

**Checkpoint**: US1 is independently functional and verified. This is the MVP; password change is still US2 work.

---

## Phase 4: User Story 2 - Alterar a própria senha com segurança (Priority: P2)

**Goal**: Deliver the distinct protected password flow, transactional credential replacement and other-session revocation while preserving the initiator, exact validation and transient secret handling.

**Independent Test**: With two active sessions, change the password in A; A retains its existing tokens, B loses access/refresh, and login accepts only the new password. Reject empty/nontextual/extra input, wrong current password, same new password, mismatch and 5/73 code points without writes. Prove rollback after write/revoke, coordinated concurrent change/login, one effective request on repeated taps and empty fields after success/abandonment/reentry.

### Tests for User Story 2

- [x] T021 [P] [US2] Add `backend/src/auth/dto/change-password.dto.spec.ts` for three required strings, empty/null/number/array/object input, forbidden id/userId/role/sid/extras, 5/6/72/73 Unicode code points, emojis and significant spaces/case; prove exact confirmation/new-current comparisons and raw-type rejection under production class-transformer options, with the data-model rule “Memória do formulário; protegidos; não vazios, nova 6–72 pontos de código, confirmação exata, nova diferente da atual; nenhuma normalização.” and no new maximum for currentPassword.
- [x] T022 [P] [US2] Extend `backend/src/auth/auth.service.spec.ts` and `backend/src/auth/auth.controller.spec.ts` for authenticated user/sid forwarding, JWT/rate-limit protection, 204 without body/tokens, current-password verification before writes, exact confirmation/difference validation, allowed 400 messages, 401 only for invalid sessions, stale-snapshot 409 and a shared update/revoke transaction preserving the initiator; assert safe errors without credential values.
- [x] T023 [P] [US2] Add `backend/test/password-change.integration.spec.ts` using T003 and production `createTestApp` for PARENT/PROFESSOR/ADMIN, the complete validation/type/extra-field matrix, 401/429, legacy and scrypt credentials, >72-byte full-input distinction, new-vs-old login, initiator's unchanged access/refresh tokens and other-session 401. Inject faults after write and after revoke before commit to prove real credential/timestamp/session rollback; coordinate two changes, old-snapshot login, mid-operation sid invalidation and concurrent refresh with deterministic barriers, proving at most one change wins and revoked sessions never revive.
- [x] T024 [P] [US2] Extend `backend/test/openapi.contract.spec.ts` for exact runtime/canonical operation and schema inventories including `auth.changePassword`, bearer security, the closed three-string required/writeOnly request, Unicode length semantics, empty 204 and 400/401/409/429/500 metadata; preserve existing profile response shape and verify no credential property in public schemas or response examples.
- [x] T025 [P] [US2] Add `mobile/tests/validations/changePassword.schema.spec.ts` covering the shared rule “Memória do formulário; protegidos; não vazios, nova 6–72 pontos de código, confirmação exata, nova diferente da atual; nenhuma normalização.” Include all empty fields, exact mismatch/same-password errors, 5/6/72/73 code points, emojis, >72 bytes, leading/trailing spaces, case and combining sequences without trim/normalization or a new current-password maximum; compare the expected acceptance matrix with T021/T023.
- [x] T026 [P] [US2] Extend `mobile/tests/services/auth.service.spec.ts` to assert POST `/auth/change-password` with exactly the three unchanged values and void success, safe allowlisted status/message/field mapping for 400/401/409/429/500/network errors, no raw AxiosError/config/body/cause retained, no domain retry and no refresh for incorrect current password; preserve existing 401 refresh behavior and ensure password 409 is not treated as an email conflict.
- [x] T027 [P] [US2] Add `mobile/tests/hooks/useChangePassword.spec.tsx` using a real QueryClient and deferred service promises to prove immediate duplicate-call suppression, pending/safe feedback transitions, field errors, no optimistic AuthUser/token updates, no query/mutation variables/errors containing credentials and release of request refs after completion; inspect storage/console mocks without printing synthetic secrets, and cover unmount/expired-session completion without unsafe late state updates.
- [x] T028 [P] [US2] Add `mobile/tests/routes/profile-change-password.spec.tsx` and extend `mobile/tests/routes/profile.spec.tsx` for a distinct Alterar senha action with main identity/role/theme/logout preserved, exactly three protected accessible fields, no secret summary, invalid local input issuing no request, one request under repeated taps, recoverable errors/indeterminate transport feedback, success without logout, clearing after success/abandonment/blur/unmount/expiry and empty reentry; assert header/hardware/gesture guards, expiry bypass, themes and keyboard/scroll behavior using providers.

### Backend Implementation for User Story 2

- [x] T029 [US2] Create `backend/src/auth/dto/change-password.dto.ts` as a closed write-only three-string request with field-safe Portuguese errors, preserving raw input types against installed implicit conversion without changing the global pipe; apply the rule “Memória do formulário; protegidos; não vazios, nova 6–72 pontos de código, confirmação exata, nova diferente da atual; nenhuma normalização.” Enforce exact server confirmation/difference and reject id/userId/role/sid/extras, with no new upper limit on currentPassword and no values/validation target in errors.
- [x] T030 [US2] Implement password change in `backend/src/auth/auth.service.ts`: load/verify the internal snapshot and derive the full-input hash outside the transaction, then lock User using T010, revalidate active owned sid and snapshot, write credential and call `revokeOthersInTransaction` on the same TransactionClient. Use 400 `CURRENT_PASSWORD_INVALID`/`PASSWORD_UNCHANGED`/`PASSWORD_CONFIRMATION_MISMATCH`, 401 for invalid sid and 409 `CREDENTIAL_CHANGED`; preserve initiator sid/tokens/refresh hash/expiry, return no tokens and expose only sanitized internal failures.
- [x] T031 [US2] Add POST `/api/v1/auth/change-password` to `backend/src/auth/auth.controller.ts` with authenticated server user/sid, JwtAuthGuard and existing RateLimitGuard, new DTO, 204 response and no role restriction beyond authentication; add any required module wiring in `backend/src/auth/auth.module.ts` without auth↔users cycles, and ensure no error reported as 401 after a successful password-change commit.
- [x] T032 [US2] Synchronize Swagger metadata in `backend/src/auth/auth.controller.ts` and `backend/src/auth/dto/change-password.dto.ts` with `specs/001-app-quality-readiness/contracts/openapi.json` and `specs/007-profile-and-password-management/contracts/profile-and-password.md`; document `auth.changePassword`, additionalProperties=false, all three required writeOnly strings, exact/Unicode rules, unchanged initiating tokens, domain messages, 204/400/401/409/429 and sanitized 500 without expanding the global ErrorResponse or changing public profile shape.

### Mobile Implementation for User Story 2

- [x] T033 [P] [US2] Create `mobile/src/validations/changePassword.schema.ts` with existing Zod and code-point counting, implementing “Memória do formulário; protegidos; não vazios, nova 6–72 pontos de código, confirmação exata, nova diferente da atual; nenhuma normalização.” Provide field-specific Portuguese errors and typed form output; preserve strings exactly, reject same new/current or mismatched confirmation, and impose no new current-password maximum or registration-form change.
- [x] T034 [P] [US2] Add transient ChangePasswordRequest and sanitized feedback/error types in `mobile/src/types/auth.ts`, implement/export the void-returning request in `mobile/src/services/auth/auth.service.ts` and `mobile/src/services/auth/index.ts`, and map only allowlisted messages/status locally; discard raw HTTP config/body/cause, use generic safe fallback for unknown errors, avoid the global email-409 mapping and domain retry, and leave AuthUser, tokens and storage unchanged.
- [x] T035 [US2] Create imperative `mobile/src/hooks/useChangePassword.ts` with an immediate in-flight ref, pending and sanitized field/status feedback only; invoke the T034 service without useMutation/query-cache/optimistic identity changes, clear retained request refs in finally, handle lifecycle/expiry safely and present indeterminate timeout/network results without claiming rollback or automatically repeating the operation.
- [x] T036 [US2] Create `mobile/app/(app)/profile/change-password.tsx` using React Hook Form, T033/T035 and existing themed primitives; show exactly Senha atual, Nova senha and Confirmar nova senha with protected input, password/newPassword purpose, no autocorrect/capitalization, accessible labels/errors/focus and keyboard avoidance/scroll. Render styles from the active palette and present safe success feedback without secret values, token replacement or logout.
- [x] T037 [US2] Complete pending/lifecycle handling in `mobile/app/(app)/profile/change-password.tsx`: disable fields/submission/voluntary exits and expose busy state while pending, apply T012 plus route-removal guards for Voltar/hardware back/gestures while allowing auth-expiry redirects, reset all three values on success/abandonment/blur/unmount/expiry and start each entry empty; preserve recoverable error correction and avoid retaining form/request snapshots or promising remote cancellation/physical memory erasure.
- [x] T038 [US2] Add the separate Alterar senha action navigating to `/profile/change-password` in `mobile/app/(app)/(tabs)/profile.tsx`; retain Nome/E-mail/role, theme selection and distinct Editar perfil/Sair actions, accessible targets, existing confirmations and permissions for PARENT/PROFESSOR/ADMIN, without anticipating deletion-of-account UI.
- [x] T039 [US2] Run the new DTO/auth/session/hasher unit, real password-change/auth/users integration, profile e2e and OpenAPI suites from `specs/007-profile-and-password-management/quickstart.md`; record exact validation/status, two-session preservation/revocation, old/new login, rollback and deterministic race results in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`, with no tokens/passwords/hashes in assertions or evidence output.
- [x] T040 [US2] Run mobile password schema/service/hook/route/profile and shared navigation suites from `specs/007-profile-and-password-management/quickstart.md` using provider harnesses and real QueryClient inspection; record field validation, safe errors/cache/storage, pending navigation, clearing/reentry, auth-expiry and theme results in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`, keeping manual ergonomics separately unmeasured until observed.

**Checkpoint**: US2 is independently proven across API and mobile; passwords and confirmations are transient, tokens of the initiator survive, and other sessions cannot access or refresh after commit.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate preserved behavior, operational cost, complete quality gates, manual UX and final scope.

- [x] T041 Re-run focused regression coverage in `backend/test/auth.integration.spec.ts`, `backend/test/users.integration.spec.ts`, `backend/test/profile.e2e-spec.ts`, `mobile/tests/lib/api-session.spec.ts`, `mobile/tests/providers/AuthProvider.spec.tsx`, `mobile/tests/providers/ThemeProvider.spec.tsx`, `mobile/tests/routes/theme-surfaces.spec.tsx`, `mobile/tests/routes/confirmation-matrix.spec.tsx` and existing classroom/announcement suites; verify registration/invites, legacy/new login, refresh/logout, profile/theme persistence, permissions and shared navigation, then record SC-010 in `specs/007-profile-and-password-management/evidence/profile-password-validation.md` without broad unrelated refactoring.
- [x] T042 Measure scrypt derivation/verification and end-to-end password-change latency under documented representative concurrency using `backend/src/common/security/password-hasher.ts`, `backend/test/password-change.integration.spec.ts` and the existing 10-second Axios timeout in `mobile/src/lib/api.ts`; record environment, samples and memory/cost failure behavior in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`, confirm hashing remains outside long-held locks and report limitations without inventing an SLA or weakening the adopted hash settings.
- [x] T043 Audit `backend/src/auth/auth.service.ts`, `backend/src/auth/dto/change-password.dto.ts`, `backend/src/users/users.service.ts`, `mobile/src/hooks/useChangePassword.ts`, `mobile/src/services/auth/auth.service.ts`, `mobile/app/(app)/profile/change-password.tsx`, public contracts and secret-sensitive tests for credential exposure; inspect responses/logging/error objects/AuthUser/storage/QueryClient with synthetic data and boolean assertions, correct in-scope gaps and record SC-008 in `specs/007-profile-and-password-management/evidence/profile-password-validation.md` without placing any password/hash/token in the report.
- [x] T044 [P] Run backend format, lint, typecheck, coverage, integration, contract, e2e and build gates plus Prisma validation/generation against existing migrations per `backend/package.json` and `specs/007-profile-and-password-management/quickstart.md`; keep the protected test database selected and record commands, exits, warnings/failures and real coverage in `specs/007-profile-and-password-management/evidence/backend-gates.md` for later consolidation.
- [x] T045 [P] Run mobile typecheck, lint, format, Expo Doctor, Jest CI/coverage and Expo export gates per `mobile/package.json` and `specs/007-profile-and-password-management/quickstart.md`; record commands, exits and unavailable checks in `specs/007-profile-and-password-management/evidence/mobile-gates.md`, avoiding any claim that automated exports prove device usability.
- [x] T046 Execute the Android functional/visual walkthrough from `specs/007-profile-and-password-management/quickstart.md` for each role and both forms: normalized confirmation/no-op/conflict, two sessions and old/new login, repeated taps/pending navigation/expiry, clearing/reentry, Claro/Escuro, keyboard, narrow width and enlarged text; record device/OS/font scale/scenario/observation in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`, or retain each unavailable observation as `NOT MEASURED` and leave the task open until actually measured.
- **T047 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha TalkBack de Perfil/senha. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- [x] T048 Consolidate `specs/007-profile-and-password-management/evidence/backend-gates.md` and `specs/007-profile-and-password-management/evidence/mobile-gates.md` into the acceptance matrix in `specs/007-profile-and-password-management/evidence/profile-password-validation.md`; audit all FR-001–FR-029/SC-001–SC-010 against code/tests/runtime/canonical contracts, run `git diff --check` including the feature's untracked artifacts as applicable, confirm no schema/migration/dependency/account-deletion changes and preserved unrelated WIP, and update only genuinely completed entries in `specs/007-profile-and-password-management/tasks.md`, retaining manual and other missing evidence as open work.

**Checkpoint**: Implementation, contracts and evidence agree. Passing automated gates does not close unmeasured manual tasks.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1: T001 → T002
                  ↓
Phase 2: T003 → {T004, T005, T006, T007}
              T004 → T008
              T005 + T008 → T009
              T006 → T010
              T009 + T010 → T011
              T007 → T012
                  ↓ all foundation work verified
Phase 3: US1 / T013–T020 → MVP checkpoint
                  ↓ default incremental order
Phase 4: US2 / T021–T040 → password-flow checkpoint
                  ↓ both stories complete
Phase 5: T041 → T042 → T043 → {T044, T045} → T046 → T047 → T048
```

- **Setup**: T001 precedes baseline/database verification T002. T003 needs that protected environment and baseline.
- **Foundation**: T004–T007 use separate test files and can be prepared concurrently after T003. T008/T010/T012 are independent implementation branches once their corresponding tests are ready. T009 follows T008 and T005; T011 follows T009/T010 and revisits the same AuthService tests sequentially. T012 closes the foundation checkpoint only after all foundation suites have run.
- **US1**: T013–T016 can run concurrently after Phase 2. T017 follows T013/T014; T018 follows T015/T016; T019 follows T018 and T012. Backend T017 and mobile T018–T019 have disjoint implementation files. T020 joins both branches and is the US1 checkpoint.
- **US2**: T021–T028 can be prepared concurrently after the foundation; each test group has disjoint files. T029 follows T021; T030 follows T022/T023, T029 and T010–T011; T031 follows T030/T029; T032 follows T031 and T024. T033 follows T025; T034 follows T026 and the settled request contract; T035 follows T034/T027; T036 follows T033/T035/T028; T037 follows T036/T012; T038 follows T028/T036. T039 follows the backend branch; T040 follows both branches and T039.
- **Polish**: T041–T043 follow both story checkpoints. T044/T045 can run concurrently because they write separate evidence files; T048 alone consolidates them. Manual tasks require the complete integrated flows and their actual environments.

### User Story Dependencies

- **US1/P1** requires the shared foundation but no password-change endpoint or screen; it is independently testable and is the suggested MVP.
- **US2/P2** requires the foundation and password contract. Its core does not require US1's editor removal, but the default delivery order completes US1 first. If implementation is split, serialize writes to shared AuthService/UsersService tests and the main evidence file; integrated regression/checkpoints require both stories.
- **Shared ownership**: `backend/src/auth/auth.service.ts` is touched by T009/T011/T030; `backend/src/users/users.service.ts` by T009/T017; corresponding specs recur later. Treat these as ordered tasks, not parallel lanes. `mobile/app/(app)/profile/change-password.tsx` belongs to T036→T037. Never have concurrent writers to the same evidence file.
- `[P]` is a scheduling hint only. Evaluate live prerequisites, distinct file ownership, worthwhile task size and capacity before any authorized delegation; this task-generation request does not start agents or implementation.

## Parallel Example: User Story 1

After the foundation checkpoint, prepare separate backend tests T013/T014 and mobile tests T015/T016 concurrently. After those expectations are ready:

```text
Backend lane: T017 users transaction hardening
Mobile lane:  T018 editor → T019 keyboard/pending/removal guards
Join:         T020 acceptance evidence and US1 checkpoint
```

## Parallel Example: User Story 2

T021–T028 use separate test files and can be prepared together after the foundation. With tests and request contract ready:

```text
Backend lane: T029 DTO → T030 operation → T031 endpoint → T032 Swagger/canonical
Schema lane:  T033 mobile schema
Client lane:  T034 transport/types → T035 imperative hook
Join mobile:  T036 screen → T037 lifecycle guards → T038 main-profile action
Join proof:   T039 backend acceptance → T040 mobile acceptance
```

T033/T034 have no shared files or dependency on each other's unfinished implementation; backend work can proceed while both run. Mobile service tests may use a mocked transport until the endpoint is ready, but integrated password/session evidence waits for the complete backend contract. Main evidence writes are serialized.

## Requirement and Acceptance Coverage

| Requirement group             | Main tasks                                               | Independent proof                                                                                              |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| FR-001–FR-004; SC-001         | T013–T015, T017–T018, T028, T038                         | Three roles, immutable role, editor fields, main actions and manipulated HTTP bodies                           |
| FR-005–FR-010; SC-002         | T013–T020                                                | Current validation, differential confirmation, no-op, name/email/conjoint, conflict and email-session rollback |
| FR-011–FR-016; SC-004/009     | T021, T023, T025, T028–T029, T033, T036                  | Distinct three-field flow, exact comparison and client/server Unicode boundary parity                          |
| FR-017–FR-022; SC-003/005/006 | T004–T006, T008–T011, T022–T023, T030–T031, T039         | Full-input hashing, server identity, initiating tokens, revocation, login, real rollback and coordinated races |
| FR-023–FR-026; SC-007/008     | T019, T026–T028, T034–T037, T040, T043                   | Single request, pending/expiry guards, safe errors/cache/storage, clearing and empty reentry                   |
| FR-027; SC-009                | T007, T012, T015, T019, T028, T036–T037, T046–T047       | Automated structure/theme/accessibility plus separately observed Android keyboard/text/AT ergonomics           |
| FR-028–FR-029; SC-010         | T002, T005–T006, T016, T024, T032, T041, T044–T045, T048 | Registration/auth/refresh/logout/theme/domain regressions, canonical contract and quality gates                |
| Operational cost and scope    | T042, T048                                               | Measured hashing/request cost, timeout limitations, unchanged schema/packages and preserved WIP                |

## Implementation Strategy

### MVP First: US1

1. Complete Setup and Foundation, including credential compatibility/session coordination and their tests.
2. Complete T013–T020 for US1 and validate all three roles and identity/session outcomes.
3. Stop at the MVP checkpoint if only US1 is authorized. Do not label password change as delivered.

### Incremental Delivery

1. Foundation → independently verified US1.
2. Add the US2 backend and explicit Swagger/canonical contract, with real rollback/race proof.
3. Add US2 schema/transport/hook/screen and verify transient secret handling and pending navigation.
4. Complete regression, measured hashing cost, full quality gates, manual Android/AT evidence and scope audit.
5. Mark only work actually completed. An unavailable check is documented; unmeasured manual evidence remains open.

## Notes

- Total: **48 tasks** — Setup 2, Foundation 10, US1 8, US2 20, Polish 8; **20 `[P]` opportunities** subject to the dependencies above.
- Test databases, synthetic inputs and fault injection must remain isolated and cannot expose credential values in diagnostics.
- Failed intermediate database work proves rollback only when the transaction callback actually reached the write/revoke boundary; mocks rejecting before the callback are insufficient.
- Timeout/transport failure after commit may leave an indeterminate remote result. Do not claim rollback, remote cancellation or an automatic safe retry.
- Task generation does not authorize staging, committing, publishing, implementation or modification of other feature artifacts.
