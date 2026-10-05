# Backend Validation Prerequisites

**Status vigente — 2026-10-04:** Aplica-se a [política permanente](../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

## Safety Boundary

- Integration and E2E database operations must use only the local isolated PostgreSQL database `avisa_ai_test`.
- Keep `DATABASE_URL` in private local configuration. Never print it, commit it, or copy it to validation artifacts.
- Preserve and use `backend/test/helpers/test-database.helper.ts::assertSafeTestDatabase` before any test database writes or cleanup. Do not bypass the helper.
- Keep the database override in one PowerShell process for migration deploy and subsequent backend checks, as documented in `quickstart.md`.
- Do not run migration deploy, destructive integration tests, or E2E tests until the exact URL has been verified as PostgreSQL on localhost/loopback with database name exactly `avisa_ai_test`.

## Current Check

- Date: 2026-10-04.
- `backend/.env` contains private database configuration. It points to a different database, so it was not used directly. A process-local URL was derived by changing only its path to `avisa_ai_test`; the URL and credentials were never emitted or persisted.
- Exact local `avisa_ai_test` target: VERIFIED by PostgreSQL connection query (`current_database()` returned exactly `avisa_ai_test`; server version was returned by the check).
- Migration deploy: PASS. `npm run prisma:migrate:deploy` connected to local `avisa_ai_test`; 11 existing migrations were found and none were pending.
- `assertSafeTestDatabase`: source inspected; it rejects missing URLs, non-PostgreSQL schemes, non-loopback hosts, and database names that do not contain `test`. Keep this guard active; the feature-specific setup must additionally require the exact `avisa_ai_test` name.
- Backend dependencies: `backend/node_modules` exists.
- ADMIN helper: tests verify unsafe configuration is refused before provisioning and cleanup transaction; ADMIN is created through Prisma using the existing scrypt hasher and logged in through HTTP. The protected profile response confirms a valid current ADMIN session. The helper does not use public registration or emit credentials/tokens.
- Fixture caller scan: public-registration ADMIN fixtures in `classrooms.integration.spec.ts`, `users.integration.spec.ts`, `profile.e2e-spec.ts`, and `account-deletion.e2e-spec.ts` now use the helper. Other ADMIN test cases create rows directly. Account-deletion E2E retains a historical ADMIN invite row for the later public-registration rejection coverage.
- Regression results: classrooms integration 16/16, users integration 27/27, profile E2E 6/6, account-deletion E2E 24/24, and helper integration 2/2.
- Full backend gates: Prisma validate/generate/migrate deploy, Prettier, ESLint, typecheck, coverage 17/17 suites (200 tests), integration 12/12 (134 tests), OpenAPI contract 1/1 suite (9 tests), E2E 4/4 suites (39 tests), and build all passed.

## Phase 3 — User Story 1

- Date: 2026-10-04.
- Safety: before database tests, a process-local URL was derived from `backend/.env` by changing only its path to `avisa_ai_test`. The host/scheme were checked as local PostgreSQL and `SELECT current_database()` returned exactly `avisa_ai_test`. The URL and credentials were not emitted or recorded. `assertSafeTestDatabase` remained enabled.
- Unit tests: PASS, 4 suites / 46 tests for invite DTO/controller/service and user registration.
- PostgreSQL integration: PASS, `npx jest --config ./test/jest-integration.json --runInBand --runTestsByPath test/invite-codes.integration.spec.ts` — 1 suite / 10 tests. Real collision evidence used a deterministic local random-byte seam; driver-adapter P2002 metadata identified `InviteCode_code_key`, while unrelated unique failures were not retried. The expiry-wait test confirmed a `pg_stat_activity` lock wait before releasing the holder transaction.
- HTTP/E2E and affected regressions: PASS, `npx jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/invite-codes.e2e-spec.ts test/profile.e2e-spec.ts test/account-deletion.e2e-spec.ts` — 3 suites / 47 tests.
- Runtime OpenAPI and integration regressions: PASS, `npx jest --config ./test/jest-integration.json --runInBand --runTestsByPath test/openapi.contract.spec.ts test/classrooms.integration.spec.ts test/users.integration.spec.ts test/admin-user.helper.integration.spec.ts` — 4 suites / 54 tests.
- Static checks: PASS, backend typecheck, targeted ESLint, targeted Prettier and `git diff --check`.
- Contract outcomes: request is closed to the literal PROFESSOR role; new code is `PROF-` plus 32 uppercase hex characters; expiry delta is exactly 604800000 ms; response is no-store; public registration creates PARENT by default or PROFESSOR through a valid invite, never ADMIN.
- Persistence outcomes: use consumption takes a row lock, checks the strict post-lock UTC instant and deactivates only PROFESSOR invitations; registration consumes and creates the PROFESSOR in one transaction. Collision retries use at most three separate transactions and fresh codes.
- Schema/migrations: unchanged; no migration deploy was needed for this phase.
- Expected test logs: existing injected transaction-fault regressions emitted Nest error logs while their assertions and process exit passed; no invite code, database URL or credential was recorded.

These are local automated results, not CI provenance. Clipboard and native/accessibility walkthroughs are outside this phase.

## Phase 4–5 — User Story 2, audit and backend gates

- Date: 2026-10-04 (America/Sao_Paulo).
- Safety: derived a process-local `DATABASE_URL` from private local configuration by changing only its path to `avisa_ai_test`; scheme/loopback/exact database path were checked, then a PostgreSQL query confirmed `current_database() = avisa_ai_test`. Neither the URL nor credentials were emitted or stored. `assertSafeTestDatabase` stayed active.
- Persistence regression T042: full local integration gate passed and includes the two-generation test. It verifies distinct invitations, both remaining independently active, independent consumption, untouched historical ADMIN rows, and rollback/no mutation after a deliberately forced second-issuance collision.
- Audit T049: `InviteCodeService` inspects collision metadata only in memory, retries only the named invite-code uniqueness collision, and converts exhausted collisions/other persistence failures to generic Nest exceptions without retaining the driver error or cause. `UsersService` preserves HTTP contract exceptions and email conflict behavior, while an unexpected failure in invited PROFESSOR registration becomes a generic 500. In-memory synthetic driver/collision sentinels are absent from serialized exceptions/messages.
- Backend full gates: PASS — Prisma validate/generate, migration deploy (11 existing migrations, none pending), Prettier, ESLint, typecheck, coverage 19 suites / 221 tests, PostgreSQL integration 13 suites / 146 tests, OpenAPI contract 1 suite / 9 tests, E2E 5 suites / 56 tests, and Nest build.
- Regression scope includes the login/session, current-role authorization, PARENT/PROFESSOR registration, profile, classrooms, announcements, account deletion, runtime OpenAPI, and historical ADMIN invitation cases in those gates.
- Expected test logs: integration assertions intentionally inject profile/password and classroom transaction failures; Nest logs those synthetic failures while suites exit successfully. No invite code, database URL, driver payload, or credential was recorded.
- Provenance: these are local results. `Backend CI / Run backend checks` was not inspected and is not inferred from them.

## Required Before Database Validation

In a single PowerShell session, configure `DATABASE_URL` privately, validate scheme/loopback/exact database name using the guarded block in `quickstart.md`, set `NODE_ENV=test`, then run migration deploy and the applicable integration/E2E checks. Stop immediately if the exact database check or any command fails. Do not record the URL in this file.

## Convergence — final backend validation (2026-10-04)

The user authorized all remaining Spec 009 tasks, including the cross-spec convergence phase. Existing WIP was preserved. T057's backend corrections retain Nest 11 / Prisma 7 and are documented in [dependency-audit.md](./dependency-audit.md); `npm audit --omit=dev --json` now exits 0 with zero vulnerabilities. This is a registry audit result, not an application security assessment.

Before any destructive check, a process-local URL was derived from private configuration, validated as loopback PostgreSQL with the exact `avisa_ai_test` path, and independently checked by `SELECT current_database()`. Migration deploy and all subsequent database suites ran sequentially in that same process with `NODE_ENV=test` and the existing safety helper enabled. No URL or credential was printed or stored.

| Final command                                               | Observed outcome                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run prisma:validate`                                   | Exit 0; controlled Prisma configuration loads with the scoped deepmerge-ts 8 correction.                            |
| `npm run prisma:generate`                                   | Exit 0.                                                                                                             |
| `npm run prisma:migrate:deploy`                             | Exit 0; existing migrations, no schema/migration changes.                                                           |
| `npm run format:check`, `npm run lint`, `npm run typecheck` | Each exit 0.                                                                                                        |
| `npm run test:cov`                                          | Exit 0; 19 suites / 221 tests; 81.41% statements, 75.58% branches, 79.03% functions, 81.60% lines; thresholds pass. |
| `npm run test:integration`                                  | Exit 0; 13 suites / 146 tests.                                                                                      |
| `npm run test:contract`                                     | Exit 0; 9 tests; runtime and canonical OpenAPI agree.                                                               |
| `npm run test:e2e`                                          | Exit 0; 5 suites / 56 tests.                                                                                        |
| `npm run build`                                             | Exit 0.                                                                                                             |

The regression matrix includes current-role/session authorization, login, PARENT/PROFESSOR registration, historical ADMIN invite rejection, invite collisions/concurrency/expiry/rollback, profile/password, account deletion, classrooms and announcements. Injected-fault test logs are expected; no operational invite or credential is copied to evidence.

These checks validate the local working tree. `Backend CI / Run backend checks` and `Commit Conventions / Validate commits` have no corresponding final-revision evidence: the changes are uncommitted, with base HEAD `ca0ff3dce2e1e61cee803b43ddf2ba3accd5a0bb`. Historical enforcement evidence is [github-required-checks.md](../001-app-quality-readiness/evidence/github-required-checks.md). No commit, push, PR or workflow dispatch was performed to manufacture T069 evidence.

## Relato de CI e limite da revisão local — 2026-10-05

**PASS (user-reported)** para o funcionamento do CI nos PRs das specs 001–009, conforme relato explícito do usuário. O relato não trouxe URLs, IDs de execução, artefatos ou SHA de revisão; nenhum resultado por job específico é inventado. Os workflows locais Backend CI, Mobile CI e Commit Conventions continuam presentes e não foram alterados neste ajuste.

A nova copy de exclusão e a documentação deste fechamento estão no working tree, sem commit/push/PR. Portanto **T069 permanece aberta exclusivamente para vincular as execuções à revisão final quando ela existir no GitHub**. O relato confirma a confiança no CI existente e não é convertido em prova de execução do GitHub sobre essas alterações locais. Não é necessário refazer a implementação de CI; falta apenas a evidência correspondente à revisão final. Nenhum envio remoto é autorizado implicitamente.
