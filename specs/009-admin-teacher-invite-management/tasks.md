---
description: "Dependency-ordered tasks for admin teacher invite management"
---

# Tasks: Admin Teacher Invite Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Input**: Design documents from `/specs/009-admin-teacher-invite-management/`.

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/teacher-invites.md](./contracts/teacher-invites.md), [quickstart.md](./quickstart.md), and `.specify/memory/constitution.md`.

**Tests**: Required by the acceptance scenarios, the explicit testing/validation matrices in the plan and quickstart, and constitution principles II–IV. Add or update behavior tests before implementation and observe the expected failure. Existing passing regressions do not need artificial failures. Concurrency, expiration after lock wait and rollback require real isolated PostgreSQL; mocks alone do not prove them.

**Organization**: Setup → Foundation → US1/P1 (authorized generation, atomic teacher registration and display) → US2/P2 (copy and deliberate subsequent generation) → cross-cutting validation. Basic authorization, cleanup and secret protection belong to US1 so the MVP is safe independently; US2 extends those guarantees to clipboard continuations and subsequent results.

**Implementation gate**: The planning exception is not approval of a constitutional amendment. T003 must be completed through a reviewed change before product implementation begins. This file only schedules that work; generating tasks does not amend the constitution or execute any task.

## Format: `[ID] [P?] [Story] Description`

- Active tasks use `- [ ]`, a sequential ID and an exact repository path; completed tasks use `- [x]`. Retired tasks retain their ID as **DISPENSADA POR ESCOPO**, without an execution checkbox.
- `[P]` means distinct files with no mutual dependency in the parallel group described below; prerequisite phases and explicit dependencies still apply.
- `[US1]` and `[US2]` map to the two stories in `spec.md`. Setup, Foundation and Polish have no story label.
- Mark only completed work. Distinguish automated and individual user-reported results. Native/AT/independent-participant campaigns are permanently dispensed, never marked as measured/PASS or kept as blockers.

## Path Conventions

- Backend implementation: `backend/src/`; unit tests beside the affected module; database/HTTP/OpenAPI tests and helpers in `backend/test/`.
- Mobile routes: `mobile/app/`; business logic in `mobile/src/`; Jest/RNTL coverage in `mobile/tests/`.
- New paths below are future implementation outputs, including `validation.md`, `backend-validation.md`, `mobile-validation.md`, `manual-walkthrough.md`, `android-accessibility.md` and `ios-accessibility.md` under `specs/009-admin-teacher-invite-management/`.
- Runtime Swagger and executable baseline evolve together in `specs/001-app-quality-readiness/contracts/openapi.json`; preserve unrelated operations and schemas.
- Preserve `backend/prisma/schema.prisma`, current migrations and the global ADMIN enum. Add only the planned `expo-clipboard` dependency and synchronize `mobile/package-lock.json`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish scope, baseline and safe validation conditions.

- [x] T001 Record branch/worktree baseline, affected modules, current emission/consumption callers, ADMIN-by-public-registration fixtures, applicable regression suites and the constitutional gate in `specs/009-admin-teacher-invite-management/validation.md`; preserve unrelated WIP and initialize implementation/device outcomes as unexecuted.
- [x] T002 Record and verify the isolated local `avisa_ai_test` prerequisites from `specs/009-admin-teacher-invite-management/quickstart.md` in `specs/009-admin-teacher-invite-management/backend-validation.md`; retain `backend/test/helpers/test-database.helper.ts::assertSafeTestDatabase`, require the exact test database before destructive commands, keep DATABASE_URL private and use one process for the database override, existing migration deploy and subsequent tests.

**Checkpoint**: Scope and database safety are documented; no product behavior or production data has changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Resolve governance and prepare reusable test identities, response validation and transport regression coverage.

**Blocking rule**: Complete this phase before US1 or US2 product implementation. T003 is a reviewed governance prerequisite, not a silent rewrite or assumed approval.

- [x] T003 Resolve the planning exception through a reviewed amendment to `.specify/memory/constitution.md`: public privileged registration is exclusively PROFESSOR by invite and ADMIN provisioning remains operational/manual outside the app; include concrete rationale, affected constraints, Sync Impact Report, appropriate semantic version and Last Amended, inspect impacted `.specify/templates/` artifacts, and record review/compliance evidence in `specs/009-admin-teacher-invite-management/validation.md` before proceeding.
- [x] T004 [P] Add safety and real-login tests for the ADMIN test helper in `backend/test/admin-user.helper.integration.spec.ts`; assert refused unsafe database configuration before writes/cleanup, hashed credentials, Prisma-only provisioning and HTTP login yielding a valid current ADMIN session without public registration or emitted secrets (depends on T003).
- [x] T005 [P] Add response-schema tests in `mobile/tests/validations/teacherInvite.schema.spec.ts` for required metadata, UUID, `PROF-` plus 32 uppercase hex characters, literal PROFESSOR/true, valid ISO UTC timestamps and exact 604800000 ms delta; reject incompatible/malformed results without propagating raw Zod issues or the secret (depends on T003).
- [x] T006 Implement test-only ADMIN provisioning in `backend/test/helpers/admin-user.helper.ts` using the existing password hasher, safe isolated Prisma writes and HTTP login; preserve `User` constraint "email unique" and `AuthSession` "id, userId, expiresAt, revokedAt e refreshTokenHash", avoid production seeds/endpoints and never log credentials/tokens (depends on T004).
- [x] T007 [P] Replace public ADMIN registration fixtures with T006 in `backend/test/classrooms.integration.spec.ts` and `backend/test/users.integration.spec.ts`; keep PARENT/PROFESSOR registration coverage and existing profile/session/classroom assertions, and scan `backend/test/` for additional integration callers relying on ADMIN invites (depends on T006).
- [x] T008 [P] Replace public ADMIN registration fixtures with T006 in `backend/test/profile.e2e-spec.ts` and `backend/test/account-deletion.e2e-spec.ts`; preserve real HTTP login and authorization, account-deletion helper behavior and historical ADMIN invite rejection fixtures, and update additional affected E2E/helper callers found by T001 without deleting their regression coverage (depends on T006; coordinate any shared helper edits with T007).
- [x] T009 Define typed result/feedback/state in `mobile/src/types/teacher-invite.ts` and the response validator in `mobile/src/validations/teacherInvite.schema.ts`; enforce "id, code, role literal PROFESSOR, isActive literal true, createdAt, expiresAt, updatedAt", "Novo: `PROF-` + 32 caracteres hex maiúsculos criptográficos" and "Novos convites: createdAt + 604800000 ms", plus UUID and ISO UTC metadata from the contract; model checking/authorized/indeterminate/invalid and safe uncertain feedback without raw payload/error retention (depends on T005).
- [x] T010 [P] Extend existing transport regression tests in `mobile/tests/lib/api-session.spec.ts` to prove invite POST with `noAuthReplay: true` is not refreshed, retried or replayed after 401/reconnection while ordinary requests keep current behavior; prove the flag alone does not invoke session expiration, which the feature hook must handle explicitly (depends on T003; reuse `mobile/src/lib/api.ts`, do not change its default semantics).

**Checkpoint**: Reviewed governance is resolved; fixtures authenticate ADMIN outside public registration; response schema and transport boundaries are testable. No new schema or migration is required.

---

## Phase 3: User Story 1 — Gerar convite de professor (Priority: P1) — MVP

**Goal**: An ADMIN can generate and inspect a seven-day, one-use PROFESSOR invitation through the app; the server rejects manipulated/unauthorized generation and public ADMIN registration, and consumes a teacher invite atomically with account creation.

**Independent Test**: Provision a test ADMIN outside registration, log in, open Perfil → Convites de professores and generate once. Confirm response/display PROFESSOR, exact seven-day delta and local date/time; consume through public registration once to obtain PROFESSOR and reject repeat/concurrent use. PARENT/PROFESSOR/deep-link attempts, invalid sessions, manipulated bodies and historical ADMIN invitations produce no invitation/account or administrative disclosure. Copy is not required for this checkpoint.

### Tests for User Story 1

- [x] T011 [P] [US1] Add DTO tests in `backend/src/invites-code/dto/create-invite-code.dto.spec.ts` using the actual implicit-conversion ValidationPipe configuration from `backend/src/configure-app.ts`; require an object with only string literal role PROFESSOR and reject missing/null/number/boolean/array/object/unknown role, ADMIN/PARENT, invalid body and extras including expiresInDays/code/dates without echoing submitted values.
- [x] T012 [P] [US1] Add controller tests in `backend/src/invites-code/invite-code.controller.spec.ts` for ADMIN guard metadata, server-derived actor id/sid delegation, the unchanged `inviteCodes.create` operation and no-store response; assert request fields cannot supply identity, lifetime or an arbitrary role.
- [x] T013 [P] [US1] Extend emission unit tests in `backend/src/invites-code/invite-code.service.spec.ts` for User → AuthSession revalidation, missing/revoked/expired/unbound sid, current non-ADMIN role, 128-bit generation, exact lifetime, distinct new-transaction retries for code-specific P2002 only, maximum three attempts and sanitized 503/internal errors with zero raw code/driver details.
- [x] T014 [US1] Extend consumption unit tests in `backend/src/invites-code/invite-code.service.spec.ts` for required caller TransactionClient, PROFESSOR-only lock/conditional deactivation, strict expiration and explicit UTC updatedAt; cover nonexistent/inactive/expired/used/non-PROFESSOR with identical generic errors and unchanged historical ADMIN records (after T013, same file).
- [x] T015 [P] [US1] Extend `backend/src/users/users.service.spec.ts` for hash preparation before transaction/lock, consumption and User.create on the same tx, fixed PROFESSOR role, unchanged PARENT/legacy-teacher registration and rollback/error mapping for insertion failure and concurrent unique email; never derive ADMIN from invite/body.
- [x] T016 [P] [US1] Add real PostgreSQL emission tests in `backend/test/invite-codes.integration.spec.ts` for current ADMIN/sid authorization, User → AuthSession lock order and deterministic role/revocation changes between guard and transaction; force code collisions, three-attempt exhaustion and other persistence failures, assert exact creation/expiry and sanitized outcomes, using safe fixtures and barriers rather than timing-only sleeps.
- [x] T017 [US1] Extend `backend/test/invite-codes.integration.spec.ts` for two concurrent consumers with different emails yielding exactly one account, generic loser, User.create failure and concurrent email-unique rollback leaving an unconsumed valid invite, plus unchanged historical ADMIN/PARENT invitations and valid legacy PROFESSOR codes (after T016, same file).
- [x] T018 [US1] Extend `backend/test/invite-codes.integration.spec.ts` with deterministic exact-expiry, expiration while waiting for FOR UPDATE, non-UTC PostgreSQL session and explicit UTC updatedAt coverage; verify the post-lock clock and strict inequality, not only a pre-check or NOW() at transaction start (after T017, same file).
- [x] T019 [P] [US1] Add HTTP tests in `backend/test/invite-codes.e2e-spec.ts` for 201 metadata/no-store, no token/invalid/expired/revoked/deleted/unbound session 401, current PARENT/PROFESSOR or demoted ADMIN 403, invalid raw bodies/roles/extras 400, zero unauthorized writes/disclosure and identical generic registration rejection; cover one successful PROFESSOR use, unchanged PARENT/legacy PROFESSOR, email 409, historical ADMIN untouched and registration no-store without printing responses containing secrets.
- [x] T020 [P] [US1] Extend `backend/test/openapi.contract.spec.ts` to require a closed PROFESSOR-only request without expiresInDays, literal creation role/active state, unchanged metadata and operationId, documented no-store/errors and PROFESSOR-only public registration semantics; keep checks for unaffected operations and fictitious examples only.
- [x] T021 [P] [US1] Add mobile service tests in `mobile/tests/services/teacher-invite.service.spec.ts` for exact fixed body, sessionGeneration/signal/noAuthReplay, validated result and safe status/category mapping; treat timeout/cancel/5xx/malformed response as uncertain with no resend, and use synthetic sentinels to assert no retained Axios config/response/body, Zod issues, cause or secret in errors/logs.
- [x] T022 [P] [US1] Add hook tests in `mobile/tests/hooks/useTeacherInvite.spec.tsx` for focus/resume profile checks, synchronous one-POST lock before rerender, initial/pending/result/error/uncertain states, 401 expireSession(generation), 403 clear/reconcile, current identity/role and late GET/POST continuations; cover blur/unmount/background/logout/account/role changes without secret resurrection or persistence.
- [x] T023 [P] [US1] Add route/deep-link tests in `mobile/tests/routes/admin-teacher-invites.spec.tsx` for ADMIN-only access, non-ADMIN Perfil and unauthenticated login redirects, blocked/hidden checking/indeterminate state, fixed purpose/no selectors, generation result and errors, local creation/expiry display and accessible loading/result semantics without secret snapshots.
- [x] T024 [P] [US1] Extend `mobile/tests/routes/profile.spec.tsx` so only ADMIN sees “Convites de professores” and navigates to `/admin/teacher-invites`; preserve existing profile, theme, password, deletion and logout controls.

### Implementation for User Story 1

- [x] T025 [US1] Restrict `backend/src/invites-code/types/invite-code-role.types.ts` and `backend/src/invites-code/dto/create-invite-code.dto.ts` to required string literal PROFESSOR, rejecting original invalid JSON types and extras despite implicit conversion; remove expiresInDays and preserve response "UUID do registro criado.", "Literal PROFESSOR.", "Literal true no momento da geração.", "ISO 8601 UTC, precisão milissegundos." and exact expiry metadata, using only fictitious `PROF-EXAMPLE` in Swagger; retain global Role.ADMIN for existing accounts (depends on T011).
- [x] T026 [US1] Change the emission interface in `backend/src/invites-code/invite-code.service.ts` to accept server-derived actor/sid, revalidate User then AuthSession under parametrized row locks in the emission tx, require existing current ADMIN, correct session ownership, not revoked and not expired, and return sanitized 401/403 with no insertion on failure; avoid a new dependency on AuthService (depends on T013/T016).
- [x] T027 [US1] Implement cryptographic issuance and bounded collision handling in `backend/src/invites-code/invite-code.service.ts`: enforce "Novo: `PROF-` + 32 caracteres hex maiúsculos criptográficos", "Toda emissão nova = PROFESSOR", "Criação retorna true", "Emissão persiste explicitamente o instante base de geração, precisão ms." and "Novos convites: createdAt + 604800000 ms"; use randomBytes(16), one post-authorization base instant, existing code unique and at most three new transactions with new secrets only for code-specific P2002, sanitizing exhausted/internal errors without raw causes/logs (after T026).
- [x] T028 [US1] Refactor consumption in `backend/src/invites-code/invite-code.service.ts` to require `Prisma.TransactionClient`, lock by code using parametrized FOR UPDATE, accept only active PROFESSOR and deactivate conditionally on that same tx; enforce "Validade estrita `expiresAt > instante de consumo`" after lock using `clock_timestamp() AT TIME ZONE 'UTC'`, "Atualizado no consumo; SQL raw deve fazê-lo explicitamente em UTC." and "consumo bem-sucedido muda para false na mesma transação do cadastro"; reject all unavailable/non-PROFESSOR states with “Código de convite inválido ou indisponível.” and preserve legacy code formats/historical rows (after T027; T014/T017/T018).
- [x] T029 [US1] Refactor `backend/src/users/users.service.ts` so input normalization/password hashing precede locks and one interactive transaction orchestrates invite consumption and User.create with fixed PROFESSOR, preserving "Sem convite, cadastro cria PARENT; com convite válido, PROFESSOR fixo." and "email unique"; map unique email to existing 409, roll back consumption on failure and expose success only after commit while leaving token issuance in existing auth flow (depends on T015/T028).
- [x] T030 [US1] Integrate authenticated id/sid in `backend/src/invites-code/invite-code.controller.ts`, retain JWT + current-role ADMIN guards and v1/operationId, set Cache-Control no-store and document 201/400/401/403/503/sanitized internal responses consistent with `specs/009-admin-teacher-invite-management/contracts/teacher-invites.md`; never trust request identity/role/lifetime for service authorization (depends on T012/T025–T027).
- [x] T031 [US1] Update registration transport and Swagger description in `backend/src/auth/auth.controller.ts` for PARENT default, PROFESSOR-only invite, generic unavailable-code errors, email 409 and Cache-Control no-store; preserve existing DTO/session/token shape and public registration validation, do not add an ADMIN provisioning endpoint or registration retry (depends on T019/T029).
- [x] T032 [US1] Synchronize only affected invitation/registration schemas, headers, errors and descriptions in `specs/001-app-quality-readiness/contracts/openapi.json` with T025/T030/T031 and run `backend/test/openapi.contract.spec.ts`; retain unchanged paths and use no operational code in examples (depends on T020/T025/T030/T031).
- [x] T033 [P] [US1] Implement imperative `mobile/src/services/admin/teacher-invite.service.ts` sending only `{ role: 'PROFESSOR' }` to `/invite-codes` with signal/current sessionGeneration and noAuthReplay; validate using T009, project only safe metadata, preserve stale-session detection and map errors to safe Portuguese categories including uncertain outcomes without automatic retry, cache or raw Axios/Zod payload retention (depends on T021/T009/T010; independent of backend implementation).
- [x] T034 [US1] Implement generation state in `mobile/src/hooks/useTeacherInvite.ts` with synchronous ref lock, AbortController and operation/focus epochs, current identity/role/session guards and local-only result/error; block reentrant generation before render, treat uncertain delivery explicitly, never refresh/refetch/replay POST, and derive local expiry without claiming remote consumption (depends on T022/T033).
- [x] T035 [US1] Complete authorization/lifecycle handling in `mobile/src/hooks/useTeacherInvite.ts`: reuse `mobile/src/services/auth/auth.service.ts::getProfile` on focus/resume, applyProfileUpdate only for the current session/visit, hide/block while checking/indeterminate/background, explicitly expireSession(generation) on 401 and clear/reconcile on 403; blur/unmount/logout/identity or role changes invalidate continuations and discard result/feedback so late GET/POST cannot restore it (after T034; reuse `mobile/src/providers/AuthProvider.tsx` without putting secrets in global state).
- [x] T036 [US1] Implement `mobile/app/(app)/admin/teacher-invites.tsx` using SecondaryScreen/theme primitives and T034–T035; enforce deep-link redirects, show fixed PROFESSOR/personal/seven-day/one-use purpose and initial/busy/result/recoverable/uncertain/invalid states in Portuguese, selectable full code, local creation/expiration, “Ativo na geração” and “Prazo encerrado”, with scroll/text scaling and accessible labels/disabled/busy/feedback without color-only meaning or automatic secret announcements (depends on T023/T034/T035).
- [x] T037 [P] [US1] Add the ADMIN-only “Convites de professores” action in `mobile/app/(app)/(tabs)/profile.tsx` to open `/admin/teacher-invites`, reusing theme/buttons and preserving current controls; rely on route/server authorization as well as visibility (depends on T024; coordinate final integration after T036).
- [x] T038 [US1] Validate the US1 checkpoint through the targeted unit/integration/HTTP/OpenAPI/mobile tests above and relevant fixture regressions, recording commands, exit statuses and acceptance results without codes in `specs/009-admin-teacher-invite-management/backend-validation.md` and `specs/009-admin-teacher-invite-management/mobile-validation.md`; prove exact lifetime, current authorization, atomic one-use registration, no public ADMIN path, no replay and cleared transient state before declaring MVP ready.

**Checkpoint**: US1 is functional and independently testable without clipboard. Do not declare it complete if public ADMIN registration or nontransactional consumption remains. Only full backend/mobile integration proves the generation experience; schema/mocks alone are insufficient.

---

## Phase 4: User Story 2 — Copiar e compartilhar o convite com segurança (Priority: P2)

**Goal**: Copy the exact displayed code with accessible success/failure feedback, deliberately generate another without revoking the previous invite, and extend transient-lifecycle guarantees to pending clipboard/subsequent generation operations.

**Independent Test**: Starting from an authorized generated result, copy exactly its code; exercise clipboard true/false/throw and rapid taps, retaining selectable fallback on failure with zero generation from copying. Deliberately generate a second result, confirm the first is not revoked, preserve the earlier result on a failed second generation, and leave/logout/change authorization during pending operations without old results or feedback reappearing.

### Story-specific setup and tests

- [x] T039 [US2] Install only SDK-compatible expo-clipboard with `npx expo install expo-clipboard` from `mobile`, updating `mobile/package.json` and `mobile/package-lock.json`; add the scoped clipboard mock needed in `mobile/tests/hooks/useTeacherInvite.spec.tsx` without native behavior claims or unrelated dependency upgrades (depends on US1 checkpoint).
- [x] T040 [P] [US2] Extend `mobile/tests/hooks/useTeacherInvite.spec.tsx` for exact-string clipboard true/false/rejection, synchronous duplicate-copy guard, no generation on copy, no HTTP await between gesture and clipboard, expired/pending/unauthorized copy blocked, pending-copy invalidation on visit/account/role changes and deliberate second-generation success/failure/uncertainty preserving only the authorized previous result (depends on T039).
- [x] T041 [P] [US2] Extend `mobile/tests/routes/admin-teacher-invites.spec.tsx` for “Copiar código”, accessible “Código copiado.” and retry/selectable fallback, expired-copy disabled, distinct previous/pending/new result, “Gerar outro código não revoga o anterior.” and readable Claro/Escuro/text-size states; exclude operational secrets from snapshots (depends on T039).
- [x] T042 [P] [US2] Extend `backend/test/invite-codes.integration.spec.ts` to generate two invitations deliberately and verify both distinct records remain active/unmodified until their own consumption/expiry, including untouched historical ADMIN rows; ensure a failed second issuance changes neither the first nor any historical invitation (depends on US1 checkpoint; behavior already implemented in US1).
- [x] T043 [P] [US2] Extend `mobile/tests/routes/auth-session-boundary.spec.tsx` for invite/copy/subsequent-generation continuations across logout, restart, focus changes and account/role transitions; inspect storage mocks plus React Query query/mutation cache in memory to prove zero retained invitation code and no restored feedback, without reading or clearing the OS clipboard (depends on T039).

### Implementation for User Story 2

- [x] T044 [US2] Add copy state and action to `mobile/src/hooks/useTeacherInvite.ts`: invoke Clipboard.setStringAsync with exactly the displayed code directly on explicit gesture after synchronous authorized/current/unexpired/pending guards; treat false/throw as error, latch repeated taps, clear stale copy feedback on result changes and invalidate late continuations, without reading/erasing clipboard or triggering generation (depends on T040/T043).
- [x] T045 [US2] Extend deliberate generation in `mobile/src/hooks/useTeacherInvite.ts` to retain a previously received result during a second request/failure while authorized, replace it only on confirmed success, label uncertainty safely and reset copy feedback; use the existing single-flight/epoch/session checks and never promise revocation or server rollback after client abort (after T044; T040).
- [x] T046 [US2] Integrate copy/second-generation actions and feedback in `mobile/app/(app)/admin/teacher-invites.tsx`, including exact labels/fallback/non-revocation notice from the contract, selectable full code/date layout in both themes and enlarged text, disabled/busy actions and expired-copy behavior on timer/resume; expose accessible non-secret success/error feedback and retain all US1 route/lifecycle guards (depends on T041/T044/T045).
- [x] T047 [US2] Validate US2 clipboard/route/session-boundary and two-invitation persistence tests alongside US1 regressions; record exact-copy and one-generation-per-deliberate-action results, secret/cache inspection and web fallback test limitations in `specs/009-admin-teacher-invite-management/mobile-validation.md` and `specs/009-admin-teacher-invite-management/backend-validation.md` without recording code values (depends on T042–T046).

**Checkpoint**: US1 and US2 work together, generation/copy failures recover correctly, and no secret/feedback survives a disallowed visit or identity. Real clipboard and assistive-technology evidence still require the final manual tasks.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Complete directly affected documentation, secret audit, quality gates and measured evidence.

- [x] T048 [P] Update `README.md`, `backend/README.md` and `mobile/README.md` for ADMIN-only teacher invitations, fixed seven-day duration, one-use PROFESSOR/public-ADMIN prohibition, deliberate non-revoking subsequent generation, transient state, explicit clipboard and uncertain-result behavior; document the intentional removed ADMIN/expiresInDays contract and compatible existing PARENT/PROFESSOR/login flows using fictitious placeholders only.
- [x] T049 [P] Audit code, error/log surfaces, OpenAPI examples, snapshots and evidence for FR-021/SC-008 in `backend/src/invites-code/invite-code.service.ts`, `backend/src/users/users.service.ts`, `mobile/src/services/admin/teacher-invite.service.ts`, `mobile/src/hooks/useTeacherInvite.ts` and their tests; use in-memory synthetic sentinels to verify zero raw secrets/cause/config/driver payload leakage or persistent/query/mutation/navigation state, fix findings and record sanitized evidence in `specs/009-admin-teacher-invite-management/validation.md` (coordinate any fixes before T050/T051).
- [x] T050 Run backend gates from `specs/009-admin-teacher-invite-management/quickstart.md` against local avisa_ai_test only: prisma validate/generate/existing migrate deploy, format:check, lint, typecheck, test:cov, test:integration, test:contract, test:e2e and build, checking each exit status before proceeding; record results and applicable login/session/PARENT/PROFESSOR/profile/account-deletion/classroom/announcement regressions in `specs/009-admin-teacher-invite-management/backend-validation.md`, including `Backend CI / Run backend checks` provenance rather than inferring CI from a local run (after affected fixes/docs).
- [x] T051 Run mobile typecheck, lint, format:check, test:ci, doctor and export:ci from `specs/009-admin-teacher-invite-management/quickstart.md`, checking each exit status; cover existing profile/auth-session/api-session/registration/theme regressions, retry network-dependent Doctor with network if needed, and record results plus `Mobile CI / Run mobile checks` provenance in `specs/009-admin-teacher-invite-management/mobile-validation.md` without treating exports as native/clipboard/AT proof (after affected fixes/docs; may run alongside T050 in a separate process).
- [x] T052 Realizar o walkthrough funcional individual de convites e registrar o relato em `specs/009-admin-teacher-invite-management/manual-walkthrough.md`: localizar/gerar/copiar, comparar localmente o texto colado sem publicar código, consumir uma vez como PROFESSOR, rejeitar repetição/ADMIN público, manter convites independentes, verificar recuperação e limpeza ao sair/logout/troca de conta/rebaixamento, fuso/expiração e fallback de cópia. O próprio usuário pode ser o único executor, no ambiente que já utiliza, com contas descartáveis; aceitar `PASS (user-reported)` com cenários relatados. A referência de 60 segundos não exige pesquisa independente ou protocolo nativo. Uma mesma evidência fecha T052/T066; depende dos gates automatizados aplicáveis. **Conclusão 2026-10-05: PASS (user-reported), geração/uso único/reutilização inválida e fluxo geral funcional; cenários não itemizados não são atribuídos ao usuário.**
- **T053 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha Android/TalkBack de convites. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T054 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha iOS/VoiceOver de convites. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- [x] T055 Consolidate FR-001–FR-025 and SC-001–SC-009 traceability, reviewed constitutional compliance, intentional API incompatibilities, schema/migration preservation, CI/local/manual provenance and unresolved evidence in `specs/009-admin-teacher-invite-management/validation.md`; reconcile `specs/009-admin-teacher-invite-management/tasks.md` with work actually completed and preserve open tasks for missing measurements or failures rather than reporting unconditional readiness.

**Checkpoint**: Documentation and contracts agree; required automated gates pass; measured/manual outcomes and remaining gaps are explicit. Release readiness does not follow from task generation or unmeasured device evidence.

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup**: T001 → T002 establishes baseline and safe database configuration.
2. **Foundation**: T003 reviewed amendment is mandatory; T004/T005/T010 may proceed in parallel after it. T004 → T006 → T007/T008 prepares ADMIN fixtures; T005 → T009 prepares mobile schema/types. Complete all before the US1 checkpoint work.
3. **US1**: Write relevant tests T011–T024 first, respecting same-file sequences. Backend contract/emission T025–T027 precedes consumption T028 → registration T029; controller/registration transport T030/T031 → canonical contract T032. Mobile T033 → T034 → T035 → T036 integrates with independent profile T037. T038 joins backend/mobile and fixture regressions.
4. **US2**: T039 → T040–T043 tests → T044 → T045 → T046; T042 persistence test has no new product implementation dependency. T047 validates both stories.
5. **Polish**: T048/T049 follow stories. Complete audit fixes before T050/T051. T052 requires passing automated checkpoints; T053/T054 are permanently dispensed; T055 consumes all available evidence and records anything still open.

### User Story Dependencies

- **US1/P1** depends only on Foundation, with registration safety included in its deliverable. It does not require clipboard or US2.
- **US2/P2** depends on US1's generated result, authorization/lifecycle and atomic backend. It is independently testable from that completed increment, not implementable before it.
- Shared files (`invite-code.service.spec.ts`, `invite-codes.integration.spec.ts`, `useTeacherInvite.ts`, route tests/screen) are sequential across tasks and stories; do not assign them concurrently.

### Dependency Graph

```text
T001 → T002 → T003
                ├─ T004 → T006 → (T007 | T008)
                ├─ T005 → T009
                └─ T010
                       ↓ Foundation checkpoint
       US1 backend tests → T025–T032 ─┐
       US1 mobile tests  → T033–T037 ─┴→ T038 (MVP)
                                          ↓
                         T039 → T040–T043 → T044–T046 → T047 (US2)
                                                              ↓
                              T048/T049 → T050/T051 → T052 → T055 (T053/T054 dispensed)
```

Ranges in the graph are phase groups, not permission to ignore per-task dependencies. Only T052 remains an applicable functional walkthrough; never run destructive PostgreSQL suites concurrently against the same database. Use per-command database safety overrides consistently, not just for the first command.

### Within Each Story

- Tests precede the behavior they cover; existing passing regression assertions remain valid.
- DTO/types before affected endpoints, transaction primitives before orchestration, service before hook before route.
- No automatic retry/replay for mobile generation or registration. Internal code-collision retry belongs solely to the server and uses new transactions.
- Validate each checkpoint before proceeding; evidence contains no emitted codes, tokens or database secrets.

### Parallel Opportunities

- After T003: T004 (backend helper safety), T005 (mobile schema tests), T010 (transport tests).
- After T006: T007 and T008 own different integration/E2E fixtures; serialize any discovered shared helper changes.
- US1 tests: T011/T012/T013/T015/T016/T019/T020/T021/T022/T023/T024 own different files. T014 follows T013, and T017/T018 follow T016 in their shared files.
- US1 implementation: T033 and the backend work may proceed independently once their own tests/prerequisites are ready; T037 profile work is independent of the route implementation until checkpoint integration.
- After T039: T040/T041/T042/T043 test distinct files. US2 hook changes T044/T045 are sequential.
- Final docs T048 and audit T049 may proceed in parallel with separate ownership. Backend/mobile gates T050/T051 use separate processes; native evidence T053/T054 uses separate platforms/artifacts.

## Parallel Example: User Story 1

```text
After Foundation, add these tests in parallel:
T011 — backend/src/invites-code/dto/create-invite-code.dto.spec.ts
T012 — backend/src/invites-code/invite-code.controller.spec.ts
T013 — backend/src/invites-code/invite-code.service.spec.ts
T015 — backend/src/users/users.service.spec.ts
T021 — mobile/tests/services/teacher-invite.service.spec.ts
T022 — mobile/tests/hooks/useTeacherInvite.spec.tsx

Then work independently once the relevant tests are ready:
T025–T032 — backend contract, issuance, consumption and registration
T033–T036 — mobile service, hook and guarded route
T037 — mobile/app/(app)/(tabs)/profile.tsx
Join all branches at T038; same-file subtasks remain sequential.
```

## Parallel Example: User Story 2

```text
After US1 and T039, add these tests in parallel:
T040 — mobile/tests/hooks/useTeacherInvite.spec.tsx
T041 — mobile/tests/routes/admin-teacher-invites.spec.tsx
T042 — backend/test/invite-codes.integration.spec.ts
T043 — mobile/tests/routes/auth-session-boundary.spec.tsx

Then implement T044 → T045 → T046 and join persistence/mobile results at T047.
Do not modify the shared hook or screen concurrently across stories.
```

## Implementation Strategy

### MVP First — User Story 1 Only

1. Complete Setup and the reviewed Foundation, including T003.
2. Complete US1 tests, backend emission/atomic registration, mobile service/authorization/display and canonical OpenAPI synchronization.
3. Stop at T038 and validate generation plus real one-use PROFESSOR registration independently.
4. Demonstrate generation/display without clipboard. Do not keep a public ADMIN invite path or nontransactional consumption to shrink MVP scope.
5. This task-generation request does not authorize implementation, commits, staging, push, PR or deployment.

### Incremental Delivery

1. Foundation provides compliant policy, safe ADMIN fixtures and typed validation.
2. US1 supplies the safe generation/display capability with a complete backend registration invariant.
3. US2 adds exact copy and deliberate subsequent generation without losing the first result on failure or preserving secrets across identities.
4. Finish docs/audit/gates and measure functional/native/accessibility evidence separately. Re-run passed checks only after relevant changes or unresolved failures; record limitations explicitly.

### Requirement Coverage

| Requirements / criteria              | Primary work and evidence                                                |
| ------------------------------------ | ------------------------------------------------------------------------ |
| FR-001–004; SC-001                   | T011–T013, T016, T019, T022–T024, T026, T030, T034–T038                  |
| FR-005–009; SC-002/003               | T005/T009, T011/T013/T016/T019/T020/T021, T025–T027, T030/T032/T033      |
| FR-010/023/024                       | T023, T034–T036, T040/T041/T044–T046, T052–T054                          |
| FR-011/012; SC-005/006               | T039–T041, T044/T046/T047, T052–T054                                     |
| FR-013–015; SC-006                   | T021/T022, T027/T033/T034, T040/T042/T045–T047, T052                     |
| FR-016/022; SC-007                   | T010/T022/T023, T034–T036, T040/T043/T044/T045, T047/T052                |
| FR-017–020; SC-004                   | T014/T015/T017–T019, T028/T029/T031, T038/T042/T050                      |
| FR-021; SC-008                       | T013/T021/T022, T025/T027/T028/T033/T035, T043/T047–T049/T055            |
| FR-025; SC-009                       | T006–T008, T015/T019/T020/T024, T029/T031/T032/T038, T048/T050/T051/T055 |
| Reviewed constitutional prerequisite | T003, Foundation checkpoint, T055                                        |

## Notes

- No new tables/fields/migrations, invite listing/history/revocation, author linkage, role/lifetime selection, ADMIN provisioning UI, external sharing, push/email or broad production-security audit.
- Do not delete or reactivate historical ADMIN invitations. ADMIN accounts already provisioned keep existing login/session semantics.
- Expired/used invitation rejection is generic; valid legacy PROFESSOR invitation format is preserved. A second invitation does not revoke the first.
- Copy only by explicit gesture; OS clipboard content is neither read for verification nor cleared on departure. App transient cleanup does not control clipboard content afterward.
- Abort/client timeout does not prove server rollback. Uncertain response permits only a new deliberate generation; no automatic POST replay.
- Local expiry is derived from dates and timer/resume; “Ativo na geração” does not claim remote consumption status.
- Evidence provenance remains explicit. Native/AT/independent-participant campaigns are DISPENSADA POR ESCOPO under the permanent policy; they are not missing mandatory measurements. Functional individual reports and applicable automated gates remain in scope.

## Phase 6: Convergence

**Objetivo**: centralizar na Spec 009 as pendências das specs 001–009, conforme solicitação de 2026-10-04, incluindo follow-ups anteriormente adiados e lacunas de evidência que permanecem mesmo com tasks marcadas. Esta fase acrescenta trabalho de fechamento; sua criação não constitui implementação nem comprovação de resolução.

**Fontes de intenção**: `spec.md`, `plan.md` e `tasks.md` de cada spec de origem, sob a constituição vigente. Os registros de validação e o código atual sustentam os achados F01–F19. A revisão inventariou 216 FR, 83 SC e 135 cenários de aceitação, nove planos e cinco princípios constitucionais; os testes não foram reexecutados durante esta consolidação.

**Regras de fechamento vigentes (2026-10-04)**:

- Aplicar a constituição v2.1.0 e a [política permanente](../../.specify/memory/validation-scope.md). As campanhas nativas/assistivas e os participantes independentes foram retirados definitivamente do escopo.
- Entradas sem checkbox com status **DISPENSADA POR ESCOPO** preservam o ID histórico, não representam execução/PASS e não bloqueiam o DAG. Não transferi-las para outra spec.
- Preservar os aceites individuais `PASS (user-reported)` das specs 002, 005, 006, 007 e 008. T052/T066 usam uma só validação individual; T070 admite complementação pelo próprio usuário.
- Preservar contratos atuais de busca (006), tema (005), Perfil/senha (007), exclusão (008) e convites PROFESSOR/cadastro público sem ADMIN (009). Corrigir somente defeitos observados, com regressões afetadas, sem novas funcionalidades.
- Dependências T057 e CI T069 continuam aplicáveis. Para suites destrutivas, usar exclusivamente PostgreSQL local `avisa_ai_test`, guardas ativas e execução sequencial. Não registrar segredos em evidência.

### Tasks de fechamento — HIGH primeiro

- [x] T056 [HIGH] Diagnosticar o não encerramento de `npm run test:ci` em `mobile/`, localizar recursos/timers/listeners/observers ou mocks sem teardown em `mobile/tests/setup.ts`, `mobile/tests/helpers/`, suites afetadas e `mobile/jest.config.js`, e corrigir a causa no escopo demonstrado; manter assertions e thresholds, concluir o comando original com exit 0 natural sem `--forceExit`, depois executar os demais gates aplicáveis ainda pendentes de T051 e registrar comandos/exits em `specs/009-admin-teacher-invite-management/mobile-validation.md`. O diagnóstico anterior com `--detectOpenHandles` não identificou o recurso; investigar sem presumir que a causa esteja no novo hook per `009/tasks.md:T051`, `009/plan.md:Delivery Boundaries and Validation`, `001/FR-021`, `001/SC-009` e Constitution III (partial; F01).
- [ ] T057 [HIGH] Reauditar as dependências de produção atuais de `backend/package.json`, `backend/package-lock.json`, `mobile/package.json` e `mobile/package-lock.json` com `npm audit --omit=dev --json`, comparar com os resíduos/aceites temporários de `specs/001-app-quality-readiness/evidence/final-readiness.md` e classificar alcance e correções compatíveis; tratar os resíduos ou documentar uma decisão vigente com responsável, mitigação e prazo, sem apresentar exceção ainda ativa como dívida eliminada. Preservar Node/Nest/Prisma/Expo aprovados, sincronizar lockfiles quando houver correção e executar regressões/gates dos componentes afetados; registrar advisories atuais e disposição em `specs/009-admin-teacher-invite-management/backend-validation.md`, `mobile-validation.md` e `validation.md`. O registro histórico vence antes do primeiro lançamento público ou em 2026-10-09, e não prova a situação atual per `001/tasks.md:T071`, `001/tasks.md:T075` e `001/plan.md:fechamento de gates` (partial; F02).
- **T058 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha especializada de layout nativo Home/Turmas da 003. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T059 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha especializada de layout/contraste nativo da 004; origem T020 dispensada. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T060 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha TalkBack da 004; origem T021 dispensada. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T061 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha TalkBack de Perfil/senha da 007; origem T047 dispensada. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T062 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha Android/TalkBack da exclusão da 008; origem T064 dispensada. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T063 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha especializada de cold start nativo da 005. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T064 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha especializada Android do seletor da 005; verificações funcionais/automatizadas continuam válidas. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T065 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha nativa física/assistiva transversal das specs 001–006. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- [x] T066 [HIGH] Concluir a mesma validação funcional individual de T052, sem campanha duplicada, em `specs/009-admin-teacher-invite-management/manual-walkthrough.md`; aceitar relato do próprio usuário com os cenários de geração/cópia/consumo/recuperação/sessão realmente observados e corrigir defeitos encontrados no escopo da 009. Não exigir outros participantes, Android/TalkBack, iOS/VoiceOver ou metadados especializados. Após T056 e gates afetados por eventuais correções de T057; T053/T054/T067/T068 são dispensadas. **Conclusão 2026-10-05: PASS (user-reported), geração/uso único/reutilização inválida e fluxo geral funcional; cenários não itemizados não são atribuídos ao usuário.**
- **T067 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha Android/TalkBack de convites, mesma origem de T053. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T068 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha iOS/VoiceOver de convites, mesma origem de T054. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- [ ] T069 [MEDIUM] Vincular às evidências locais as execuções de `Backend CI / Run backend checks` e `Mobile CI / Run mobile checks` que efetivamente validem a revisão final quando disponíveis, registrando revisão, URL/run/job, resultado e artefatos sanitizados em `specs/009-admin-teacher-invite-management/backend-validation.md`, `mobile-validation.md` e `validation.md`; conferir também o gate `Commit Conventions / Validate commits` e referenciar a prova de enforcement já registrada em `specs/001-app-quality-readiness/evidence/github-required-checks.md`. Resultado de código anterior e execução local não comprovam CI da revisão atual; falta de execução correspondente mantém o campo pendente, sem criar push/PR/publicação como efeito implícito desta task per `009/tasks.md:T050–T051`, `009/tasks.md:T055`, `009/SC-009`, `001/FR-021–FR-023` e Constitution III (missing; F14; após todas as correções/gates locais relevantes).
- [x] T070 [MEDIUM] Confirmar com o próprio usuário a compreensão do aviso de impacto e o uso de localizar/cancelar/concluir a exclusão, registrando somente os cenários observados em `specs/008-account-deletion-data-lifecycle/android-walkthrough.md` (nome histórico do arquivo; não exige plataforma específica). Preservar o aceite funcional `PASS (user-reported)` de T063; aceitar complementação individual, sem participantes independentes ou estudo sem ajuda. Dois minutos é referência de usabilidade, sem protocolo obrigatório de cronometragem. Corrigir copy/usabilidade somente se surgir defeito. T062 está dispensada e não é pré-requisito. **Conclusão 2026-10-05: compreensão confirmada pelo usuário; copy simplificada por papel e regressões automatizadas aprovadas.**
- **T071 — DISPENSADA POR ESCOPO (2026-10-04)**: Campanha iOS/VoiceOver das superfícies primárias da 001. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- **T072 — DISPENSADA POR ESCOPO (2026-10-04)**: Pesquisa com participantes independentes da 001; walkthrough individual e automação substituem esse critério de entrega. Ver [decisão permanente](../../.specify/memory/validation-scope.md). Não representa teste executado ou PASS; não bloqueia conclusão nem gera follow-up.
- [x] T073 [MEDIUM] Finalizar a consolidação da 008 em `specs/008-account-deletion-data-lifecycle/validation.md`, reunindo FR/SC aplicáveis, gates existentes, aceite individual/complementação de T070 e a dispensa definitiva de 008:T064/009:T062. Executar whitespace/scope audit previsto em 008:T065, preservar WIP e proveniência e fechar a origem 008:T065 somente após cobertura aplicável comprovada. Não manter medições nativas/assistivas dispensadas como pendência. Após T070 e regressões afetadas por correções. **Conclusão 2026-10-05: evidência aplicável consolidada e origem 008:T065 encerrada.**
- [x] T074 [MEDIUM] Consolidar documentalmente as specs 001–009 em `specs/009-admin-teacher-invite-management/validation.md`, com uma linha por spec e links para código/evidência/gates aplicáveis. Reconciliar datas, IDs, dependências e status, distinguindo execução automatizada, `PASS (user-reported)`, `DISPENSADA POR ESCOPO` e pendências ativas. Incorporar os relatos de 2026-10-05, T052/T066, a simplificação de copy em T070 e o fechamento da 008 em T073. Conforme autorização de 2026-10-05, encerrar esta tarefa de documentação com T057/T069 explicitamente abertas, sem confundir consolidação concluída com dívida eliminada ou CI remoto da revisão local. Verificar whitespace/escopo e preservar WIP; itens dispensados não reaparecem. **Concluída em 2026-10-05; evidência em validation.md.**

### Matriz de origem e dependências de fechamento

| Spec | Disposição vigente                                                                                              | Fechamento aplicável na 009 |
| ---- | --------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 001  | Campanhas nativas/assistivas e participantes independentes dispensados. Dependências e CI continuam aplicáveis. | T057/T069/T074              |
| 002  | Aceite funcional existente preservado; medições especializadas dispensadas.                                     | T074                        |
| 003  | Campanha nativa Home/Turmas dispensada; código e gates automatizados preservados.                               | T074                        |
| 004  | T020/T021 dispensadas por escopo.                                                                               | T074                        |
| 005  | Campanhas nativas de cold start/seletor/AT dispensadas; temas e testes funcionais preservados.                  | T074                        |
| 006  | T041 PASS (user-reported) preservado; campanha assistiva dispensada.                                            | T074                        |
| 007  | T046 PASS (user-reported) preservado; T047 dispensada.                                                          | T074                        |
| 008  | T063 preservado; T064 dispensada; T070/T073 e origem T065 concluídas em 2026-10-05.                             | Consolidação concluída      |
| 009  | Gates locais e aceite individual aprovados; T052/T066/T070/T073/T074 concluídas.                                | T057/T069 ainda ativas      |

**Estado após 2026-10-05**: walkthrough T052/T066 e complementação/copy T070 concluídos; consolidações T073/T074 encerradas por autorização explícita do usuário. T057 e T069 mantêm critérios técnicos próprios. Correções futuras exigem somente regressões/gates afetados e atualização dos registros, sem recriar campanhas dispensadas.

**Critério de saída integral**: a documentação está consolidada, mas a conclusão integral da Spec 009 depende de resolver T057 e comprovar T069. O relato de CI dos PRs anteriores é aceito com sua proveniência e não atribui runs, SHA ou resultados ao WIP local. Itens dispensados nunca bloqueiam o fechamento.
