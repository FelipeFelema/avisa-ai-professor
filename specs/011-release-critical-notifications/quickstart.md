# Quickstart Validation: Release Critical Notifications

Full P0 + P1 implementation authorized on 2026-10-07. This guide lists repeatable validation commands; observed outcomes are recorded only in [final-validation.md](final-validation.md). Release depends on the completed foundation. Local build/export are included in the validation. Runtime preparation was authorized on 2026-10-07; see [walkthrough-preparation-2026-10-07.md](walkthrough-preparation-2026-10-07.md). Installed artifact, phone connectivity and observed delivery remain separate evidence. P1 worker is implemented, independently toggled and defaults false.

Android preview for the current 011 WIP was authorized and submitted on 2026-10-07: see [build/snapshot evidence](eas-preview-build-2026-10-07.md). Installation and the staged owner walkthrough are still pending; no physical task is closed by build submission.

## Prerequisites and isolation

The business flag is read when a new resource is saved: `true` writes the internal pending marker even if transport is temporarily unavailable. Disabled/legacy publications stay null and are never backfilled. The worker reconciles pending markers on startup/every30s (20 resources,100 claims,two HTTP calls concurrently). A failed pre-send transaction leaves recovery pending; once SENDING commits, uncertain outcomes become UNKNOWN without resubmission. A completed empty snapshot never gains later recipients. Receipt checks start after15min, stop at24h and keep uniqueness tombstones after seven-day detail redaction. No HTTP call holds a database transaction.

Operational P0 enablement: reviewed migration/generated client first, existing authenticated010 transport plus `ANNOUNCEMENT_PUSH_ENABLED=true`, `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false`, then restart. Rollback disables the business flag and restarts; retain additive tables and marker/tombstones. Re-enable recovers pending resources only while still active. This document contains no access token or private credential.

- Spec 010 is merged in develop. Real walkthrough still needs consent/register/test, authenticated transport, existing FCM configuration and backend connectivity; merged code alone does not prove device receipt.
- Reviewed additive 011 migration and generated Prisma client after implementation. Show full reviewed SQL/environment before applying it to a real database; never execute integration fixtures against `avisa_ai`.
- Local test PostgreSQL `avisa_ai_test`, with existing assertSafeTestDatabase guards plus exact database check below. All automated provider sends/receipts mocked.
- Synthetic fixtures: professor/member A, another member A, author active installation, member B only, inactive/expired-session/revoked/token-rotated registrations and two installations for one eligible member. Multiple accounts may be used sequentially by the owner; no independent participants required.

## Automated commands — backend

```powershell
Set-Location C:\src\avisa-ai-professor\backend
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/avisa_ai_test'
$env:NODE_ENV='test'
$env:JWT_ACCESS_SECRET='test_access_secret'
$env:JWT_REFRESH_SECRET='test_refresh_secret'
$env:EXPO_PUSH_ENABLED='false'
$env:ANNOUNCEMENT_PUSH_ENABLED='false'
$env:ANNOUNCEMENT_PUSH_REMINDERS_ENABLED='false'
$notificationTestDatabase=[Uri]$env:DATABASE_URL
if ($notificationTestDatabase.Host -notin @('localhost','127.0.0.1') -or $notificationTestDatabase.AbsolutePath -ne '/avisa_ai_test') { throw 'Unsafe test database' }
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:cov
npm.cmd run test:integration
npm.cmd run test:contract
npm.cmd run test:e2e
npm.cmd run build
```

Each command must pass before proceeding; record each exit code, natural cleanup and coverage gates. Fixture config enables business dispatch locally against mocks only; setting EXPO_PUSH_ENABLED=false outside fixtures prevents real sends. Add task-specific official-script filters during implementation, without replacing full final gates.

## Future automated commands — mobile

```powershell
Set-Location C:\src\avisa-ai-professor\mobile
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test:ci
npm.cmd run doctor
npm.cmd run export:ci
```

Keep 010's dynamic-import harness and feedback regression active. Doctor must include online checks. Current 2026-10-07 run passed 21/21 after a network-enabled retry; no dependency change. Record actual applicable GitHub workflow results only after publication is authorized; local runs do not prove remote CI.

## Required P0 scenarios

| Scenario                                                  | Expected evidence                                                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Publish A with candidates in A and B                      | 201 normal DTO; only eligible A installations, author excluded; B/inactive sessions zero sends.                                        |
| No audience, later membership/activation                  | One empty materialized event; no replay to late arrivals.                                                                              |
| Fanout error after saved publication                      | Communicado remains; pending marker survives; restart recovers unique event/candidates.                                                |
| Provider unavailable/rejected/timeout                     | Publication unaffected; terminal/unknown send state; no implicit republish or resend.                                                  |
| Two workers, same event, stale claim                      | One snapshot and one send per installation; claim version fences stale writer.                                                         |
| Crash before/after SENDING and after accepted HTTP        | Before boundary recover safely; after boundary UNKNOWN or accepted receipt reads, no second submit.                                    |
| Rotation, logout, opt-out, reassociation, leave, deletion | Mutation preceding final authorization suppresses; late receipt cannot invalidate replacement binding; no deadlock/cross-account send. |
| Closed payload/privacy                                    | Generic text only; no secrets/content/recipient identifiers in logs/responses; unknown/extra route ignored.                            |
| Foreground + live tap + cold-start tap                    | Presentation without spontaneous navigation/prompt; tap opens fresh authorized detail once.                                            |
| Stale detail cache + access loss / new account            | Fresh normal GET; 404/unavailable or new account's authorization; no old content.                                                      |
| Regression 010                                            | Consent/test/cooldown/logout behavior unchanged; no connectivity→push-response reconciliation loop.                                    |

Mock tests prove submission/count/state behavior. They do not prove physical display or external exactly-once delivery.

## Owner walkthrough — after runtime setup / installed 011 artifact

1. Professor publica um comunicado na turma A; responsável A com consentimento/registro elegível observa o push genérico. Registre publicação e recebimento separadamente.
2. Responsável apenas da turma B, também com push ativo, recebe zero avisos desse comunicado.
3. Toque no aviso abre o comunicado correto com a conta atual. Após remover acesso ou excluir o comunicado, um toque posterior mostra indisponibilidade.
4. Para reminder, publique com duração de três dias; após receber o P0 e aguardar um ou dois minutos, edite para um dia. A API aceita somente 1, 3, 7, 15 ou 30 dias; não aceita expiresAt absoluto. Assim a expiração atual fica aproximadamente24h à frente e createdAt precede a janela, sem backdate nem alterar o relógio. Com ambos os flags habilitados, observe o texto “Comunicado próximo da expiração” / “Um comunicado da sua turma expira em breve.” e toque para abrir o detalhe.
5. Aguarde novos ciclos e, se viável, reinicie o backend mantendo o mesmo expiresAt: não deve haver outro reminder para aquela instalação/ocorrência. Duas instalações elegíveis podem receber uma cada.
6. Exclua outro comunicado antes da janela: zero reminder. O caso sem expiresAt não é exposto pela API atual; está coberto pela guarda automatizada e não deve ser declarado PASS físico.
7. Faça logout/troque para conta sem acesso e toque em um aviso anterior: nenhum conteúdo da sessão antiga. Confirme que opt-out/teste neutro 010 continuam funcionando.

Owner may be sole executor. Record build, environment, measured timings only when measured, and `PASS (user-reported)` only for reported cases. Specialized campaigns/participants are DISPENSADA POR ESCOPO; do not create substitute tasks.

## P1 operation and controlled timing

After both reviewed migrations and client generation, enable the existing transport, ANNOUNCEMENT_PUSH_ENABLED=true and ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=true, then restart. Reminder startup/every60s selects at most20 eligible resources; existing dispatch worker startup/every30s sends them with its normal bounds. No external queue, new token registry or new adapter. No per-resource timers.

Only current expiresAt is considered. Select when now >= expiresAt-24h and expiresAt>now, with createdAt<=expiresAt-24h and non-null 011 marker. Short-lived new publications (<24h), legacy disabled publications, missing expiry, deleted and expired resources are excluded. Resume late only while active. Empty audience is a completed occurrence.

Unique occurrenceKey is publication for NEW and expiration:<expiry milliseconds> for EXPIRING. A new current expiry can produce one different occurrence; pending dispatches from the replaced expiry are suppressed before SENDING. Returning to an already materialized expiry value does not regenerate it. A previously authorized SENDING request may still arrive after an edit/deletion, and cannot be retracted; generic content and fresh authorized GET protect access.

Disable reminder flag to stop new reminder selection/submission while NEW continues. Re-enable resumes only current valid unsent work. SENDING/UNKNOWN/REJECTED and accepted outcomes never resubmit; receipt retries only query provider state. Tombstones stay while the announcement exists.

Current API always requires expiry derived from durationInDays. The no-expiresAt safety case is covered defensively in unit tests and SQL selection; this spec adds no nullable-expiry API mode.

## Reviewed migration and recovery

Disable business flag (and optional reminder flag), stop new business dispatches, preserve tables/markers and 010 test functionality. Restart may resume only still-valid PENDING/CLAIMED work; SENDING/UNKNOWN never resend. No destructive down migration. Final evidence must map FR-001–015/SC P0 to tests and actual walkthrough; FR-016–019 are included in full 011 validation. Do not close 010 tasks from 011 documentation.

The follow-up SQL is [20261007120000_announcement_expiration_occurrences/migration.sql](../../backend/prisma/migrations/20261007120000_announcement_expiration_occurrences/migration.sql): add private occurrenceKey with publication default, preserve any reserved EXPIRING row using current expiry, create replacement unique index, remove the old uniqueness index and add a kind/key CHECK. Existing events/dispatches are retained. Automated gates migrated only localhost/avisa_ai_test. The later authorized operational preparation applied both migrations to localhost/avisa_ai after a private backup, without fixtures/reset; see the dated walkthrough preparation. Do not reverse the ledger or replay sends during recovery.

On this Windows tool runtime, npm default cmd shell failed before executing scripts. The same official scripts passed with `npm.cmd --script-shell=powershell.exe run <script>`; no package or persistent npm config was changed.
