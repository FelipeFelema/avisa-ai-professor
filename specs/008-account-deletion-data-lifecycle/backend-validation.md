# Backend validation — 2026-10-04

## Environment and database safety

- Node.js 22.14.0, npm 11.10.1, Windows PowerShell, and the repository's installed Prisma tooling.
- PostgreSQL was reachable locally. `psql` confirmed the selected database was `avisa_ai_test`; each database command set `DATABASE_URL` in that command process and checked host plus database path before execution. The integration safety helper also accepts only a local database with `test` in its name. Connection credentials are intentionally omitted from this report.
- `prisma migrate deploy` found 11 existing migrations and no pending migrations. No migration was added for account deletion.
- After the serial integration/contract/E2E runs, a read-only Prisma count returned zero users, classrooms, announcements and sessions in `avisa_ai_test`; fixture cleanup left the test database empty.

## T061 automated gates

All commands ran from `backend`. Database integration, contract and E2E suites ran serially against the isolated `avisa_ai_test` database.

| Command                         | Result                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run prisma:validate`       | Exit 0; Prisma schema valid.                                                                                                     |
| `npm run prisma:generate`       | Exit 0; Prisma Client generated.                                                                                                 |
| `npm run prisma:migrate:deploy` | Exit 0; 11 migrations found, none pending.                                                                                       |
| `npm run format:check`          | Exit 0; all matched TypeScript files formatted.                                                                                  |
| `npm run lint`                  | Exit 0; no lint errors.                                                                                                          |
| `npm run typecheck`             | Exit 0; no TypeScript errors.                                                                                                    |
| `npm run test:cov`              | Exit 0; 17 suites / 200 tests; 78.03% statements, 70.88% branches, 77.34% functions, 78.44% lines; configured thresholds passed. |
| `npm run test:integration`      | Exit 0; 11 suites / 132 tests, including auth, classroom, password, account-deletion and concurrency regressions.                |
| `npm run test:contract`         | Exit 0; 1 suite / 9 tests; runtime and canonical OpenAPI contract.                                                               |
| `npm run test:e2e`              | Exit 0; 4 suites / 39 tests.                                                                                                     |
| `npm run build`                 | Exit 0; NestJS production build completed.                                                                                       |

The targeted concurrency command `npm run test:integration -- --runTestsByPath test/account-deletion.concurrency.integration.spec.ts` exited 0 with 1 suite / 17 tests. npm 11 printed an argument-forwarding warning, but Jest ran the requested file. Full integration was then run separately and passed.

## T059 sensitive-data and regression audit

- Backend request handling takes only the authenticated subject/session and the closed two-field DTO. Password verification occurs before the transaction and row/advisory locks. Database failures are converted to a constant sanitized response; the account-deletion service/controller path does not log the request body or original database/crypto error.
- E2E response assertions reject credential, token, third-party identifier and internal error leakage. The account-deletion HTTP, auth/session, classroom receipt/idempotency, password, invite, profile, logout and OpenAPI regressions were included in the passing backend suites above.
- The transaction uses one ordered Classroom lock query and a fixed set of bulk deletes for announcements, memberships, owned classrooms, receipts and sessions; it does not issue a request per classroom. The service passes only `isolationLevel` as a transaction option.

## T060 measurements

`test/account-deletion.concurrency.integration.spec.ts` created synthetic disposable Professor graphs and measured the transaction callback through commit. Each owned classroom contained ten announcements and one third-party membership. The service request column is a direct in-process service call, not end-to-end HTTP; it includes password verification and local database round trips.

| Owned classrooms | Announcements | Third-party memberships | Transaction (ms) | Service call (ms) |
| ---------------: | ------------: | ----------------------: | ---------------: | ----------------: |
|                1 |            10 |                       1 |            18.84 |            368.25 |
|               10 |           100 |                      10 |             9.31 |            359.81 |
|               50 |           500 |                      50 |            11.09 |            378.07 |

A second connection attempted the same transaction-scoped advisory gate while the first transaction held it. PostgreSQL reported the waiter with `wait_event_type = 'Lock'`; after releasing the first transaction, the observed wait was 6.87 ms. These are local synthetic measurements, not an SLO or a production estimate.

The mobile Axios client timeout is 10,000 ms (`mobile/src/lib/api.ts`). The installed Prisma interactive-transaction defaults inspected during validation are `maxWait = 2,000 ms` and `timeout = 5,000 ms`; the account-deletion transaction does not override them. The measured calls completed below those limits in this environment. The client still treats a timeout/lost response as indeterminate and never automatically retries the DELETE.
