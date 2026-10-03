# Spec 007 Phase 5 — backend gates

Date: 2026-10-03. Windows, Node v22.14.0, npm 11.10.1; existing dependencies. Commands run from `backend`, with a process-only `DATABASE_URL` selecting local `avisa_ai_test` before **every** Prisma/Jest invocation and `NODE_ENV=test`. No connection string or credential is recorded. Integration/e2e setup and fixture/cleanup helpers enforce `assertSafeTestDatabase`.

| Command | Exit | Result |
|---|---|---|
| `npm run prisma:validate` | 0 | PASS; existing schema valid |
| `npm run prisma:generate` | 0 | PASS; existing Prisma client generated |
| `npm exec -- prisma migrate status` | 0 | PASS; 11 existing migrations, database up to date |
| `npm run prisma:migrate:deploy` | 0 | PASS; no pending migrations |
| `npm run format:check` | 0 | PASS |
| `npm run lint` | 0 | PASS |
| `npm run typecheck` | 0 | PASS |
| `npm run test:cov` | 0 | PASS; 15 suites / 131 tests, zero snapshots |
| `npm run test:integration` | 0 | PASS; 8 suites / 87 tests, zero snapshots |
| `npm run test:contract` | 0 | PASS; 1 suite / 8 tests, including complete runtime/canonical OpenAPI inventories |
| `npm run test:e2e` | 0 | PASS; 3 suites / 15 tests, zero snapshots |
| `npm run build` | 0 | PASS |

Coverage: **76.14% statements, 68.56% branches, 74.84% functions, 76.27% lines**. Configured global thresholds (60/60/50/60%) pass. Integration tests include actual PostgreSQL rollback after writes/revocation, credential/session races, protected HTTP validation, real rate limiting, domain regressions and migration compatibility.

Warnings/limitations: injected profile/classroom transaction faults intentionally produce generic exception logs while rollback assertions pass. The password fault tests capture and inspect the logger with synthetic credential-bearing errors and find no credential in logs/responses. Jest reports a delayed shutdown on some focused invocations, but the full backend gate commands above exit 0 without forced exit. No test targeted the Compose development database. No package, lockfile, Prisma schema or migration was changed.

Results consolidate into [profile-password-validation.md](./profile-password-validation.md). These automated checks do not close Android/TalkBack observations.
