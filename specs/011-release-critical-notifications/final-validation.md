# Validation — Spec 011

## Current final product follow-up — 2026-10-07

**Owner report:** Overall physical P0/P1 walkthrough previously reported **PASS (user-reported)**. Final owner report on 2026-10-07: new-announcement notification correctly displayed classroom + title **PASS (user-reported)**; expiration reminder correctly displayed classroom + announcement title **PASS (user-reported)**. Owner confirms the current APK is preview, so retaining the diagnostic test action is expected, and explicitly accepts automated/configurational validation that production hides it. No unreported individual scenario, device/build ID, timing, receipt or handoff is inferred.

**Disposition:** T060 CLOSED by owner acceptance; T062–T064 verified. **T061 COMPLETED after actual successful remote Backend CI, Mobile CI and Commit Conventions on c57b0a48bc2a1154a6cb68cc218d68d0b17fe5ae; 64/64 checked.** The final documentary closure commit must receive its own green checks before reporting ready for merge. Production-artifact smoke stays in the final release gate, not a claimed physical PASS. Earlier OPEN/PENDING/NOT RUN notices below are superseded historical checkpoints.

### Product result and privacy

- New announcement: `Novo comunicado • {nome da turma}` / announcement title. Missing/null/blank title fallback: `Novo comunicado disponível`.
- Expiration reminder: `Comunicado próximo da expiração • {nome da turma}` / `{título do comunicado} expira em breve.`. Missing/null/blank title fallback: `Um comunicado expira em breve.`. Missing/blank classroom name: `Sua turma`. Whitespace normalized; text bounded to domain limits 80/120.
- Current classroom name/title are read under existing locks in final authorization and passed only in the in-memory send snapshot. No full body, personal data or additional context included. `data` remains exactly version/type/announcementId/dispatchId. Existing membership/session/binding checks, expiry, TTL, idempotence/no-resubmit and REST authorization remain unchanged. No schema/migration/dependency change.
- Diagnostic test button and feedback render only in local development (`__DEV__`) or explicit EAS preview/development profile (`extra.pushDiagnosticsEnabled === true`). Production/absent/unknown profiles generate false, including when inherited extra had true. Existing authenticated endpoint/infrastructure, cooldown and opt-in/logout lifecycle remain intact.

### Executed gates — final follow-up

| Component | Check | Result |
| --- | --- | --- |
| Backend | typecheck / lint / format:check | PASS, each exit0 on final revision |
| Backend | test:cov | PASS, exit0; 31 suites / 388 tests; S73.85%, B64.98%, F73.10%, L74.65% |
| Backend | test:integration | PASS, exit0; 25 suites / 236 tests; natural cleanup |
| Backend | test:contract | PASS, exit0; 1 suite / 10 tests |
| Backend | test:e2e | PASS, exit0; 7 suites / 78 tests; natural cleanup |
| Backend | build | PASS, exit0 |
| Mobile | typecheck / lint / format:check | PASS, each exit0 |
| Mobile | test:ci | PASS, exit0; 87 suites / 636 tests; S85.99%, B78.15%, F90.31%, L88.51% |
| Mobile | doctor | PASS, exit0; 21/21 online checks |
| Mobile | export:ci | PASS, exit0; Android/iOS/web local export |
| Repository | git diff --check | PASS, exit0 |

New tests first failed against the earlier generic copy and production-visible button. Final coverage verifies new/reminder exact copy, null/absent/blank fallback, bounded text, unchanged closed data/transport, current metadata after edits between claim and authorization, no full-body/personal/secret leakage and no metadata in logs. Configuration/UI tests cover development/preview/production/default visibility, inherited flag override and preserved opt-out; full mobile suite retains lifecycle/navigation/session regressions.

Test-only corrections: the new app.config fixture initially omitted required ConfigContext fields; added typed fields. The fallback mock initially reused a consumed Response, then used async without await; it now creates a fresh Response via Promise.resolve per call. Final gates rerun successfully without weakening thresholds or production error handling. Unit and integration transport is mocked. Destructive database fixtures ran only on guarded localhost/avisa_ai_test. During automated gates, real-local database/backend were not restarted/reset. A subsequent owner-requested backend restart is recorded below. Logs are ignored under `.codex/spec011-product-followup/`. No forceExit. The normal sandbox could not start (setup refresh errors); approved external-shell execution completed validation. Existing Nest fault-injection/React act/pg warnings remain qualified log history, not real delivery evidence.

### Build and visual validation

Copy changes are backend-only: after deploying/restarting the updated backend, the installed 011 app can display the new copy using its unchanged payload parser. No new app build required for copy alone. Owner subsequently authorized restart: old PID19772 → new PID5964 using node -r dotenv/config dist/src/main.js, existing configuration and final local build. Local health returned HTTP200/status=ok; LAN health returned HTTP200 and stderr was empty at checkpoint. No database reset/migration/credential change. The subsequent final copy observations are owner-reported above.

The button gate changes mobile JS/app configuration. Current standalone APK embeds the previous bundle; this project has no expo-updates dependency/configuration. A production app artifact is needed for the future physical smoke of the visual gate; owner accepts existing automated/configurational evidence now. Preview keeps the diagnostic action; production hides it. Owner confirms the current APK is preview, where presence is expected. To visually check absence at the final release gate, use the production artifact; another preview build still intentionally shows it. No native module/credential change, EAS submission, publication, staging, commit, push or PR performed.

Future Spec 012 ideas recorded in spec.md: first-use contextual invitation with explicit CTA before native permission prompt; study per-user/device preference persistence with safe logout revocation and no inheritance between accounts. No implementation or lifecycle change here.

### Approved final commits and focused checks — 2026-10-07

Owner approved exact three subjects, isolated staging and pre-commit cached name/status + whitespace checks, focused tests, push/PR into develop and subsequent remote CI. Backend `9ee7ceee3aa9d5b87eb745512d8ed2c8193b8060` and mobile `4674e0452af6c76fc77e7cc736edcf08d1baec6f` created with only their approved seven/five files. Commitlint and staged checks passed for both.

| Group | Narrow checks | Result |
| --- | --- | --- |
| Backend | Adapter, authorized snapshot/service and dispatch worker unit | PASS, natural exit0; 3 suites /74 tests |
| Backend | Privacy/context, dispatch authorization and reminders integration | PASS, natural exit0; 3 suites /40 tests, only guarded localhost/avisa_ai_test, provider mocked |
| Mobile | Profile/config, consent lifecycle and test lifecycle | PASS, natural exit0; 4 suites /39 tests |
| Documentation | T060 closed/only T061 open at third commit, exact nine-file scope, local links and git whitespace | PASS, exit0 before c57b0a4; 63/64 tasks at that checkpoint, CI not yet run |

Third approved commit consolidates this evidence and retains T061 OPEN until real remote results. Logs ignored in `.codex/spec011-final-commits/`. Worktree cleanliness is checked after the third commit before standard feature-branch push. Publication is now authorized; no merge, new EAS build or Spec 012 work.

### Actual remote CI and T061 closure — 2026-10-07

[PR #54](https://github.com/FelipeFelema/avisa-ai-professor/pull/54), base `develop`, head `011-release-critical-notifications`. Three approved final commits created: backend `9ee7ceee3aa9d5b87eb745512d8ed2c8193b8060`, mobile `4674e0452af6c76fc77e7cc736edcf08d1baec6f`, documentary `c57b0a48bc2a1154a6cb68cc218d68d0b17fe5ae`. Worktree/index were clean before normal branch push; no force-push. Exact staged name/status and whitespace checks preceded every commit; all six Spec 011 commit subjects passed local Commitlint.

Publication created the PR and triggered the three existing pull_request workflows; no duplicate workflow_dispatch was needed. GitHub API reports all runs, jobs and head check-runs completed/success for head `c57b0a48bc2a1154a6cb68cc218d68d0b17fe5ae`. Observation: `2026-10-07T21:42:35.585461+00:00`. PR merge ref at this checkpoint: `43b401c2e4701f9ad1b7332de215eb4a5c96ee41`, with parents including head `c57b0a48bc2a1154a6cb68cc218d68d0b17fe5ae` and develop base `416256032a645e7335229a42bb2a825d174c85c0`; workflow/check-run head_sha is the feature head, while standard PR checkout tests GitHub's merge ref. This records actual CI, not local test or device-display inference.

| Workflow | Actual run | Actual job | Result |
| --- | --- | --- | --- |
| Backend CI | [37690901403](https://github.com/FelipeFelema/avisa-ai-professor/actions/runs/37690901403) | [Run backend checks / 113030509114](https://github.com/FelipeFelema/avisa-ai-professor/actions/runs/37690901403/job/113030509114) | PASS — completed/success, attempt 1 |
| Mobile CI | [37690901274](https://github.com/FelipeFelema/avisa-ai-professor/actions/runs/37690901274) | [Run mobile checks / 113030509452](https://github.com/FelipeFelema/avisa-ai-professor/actions/runs/37690901274/job/113030509452) | PASS — completed/success, attempt 1 |
| Commit Conventions | [37690901249](https://github.com/FelipeFelema/avisa-ai-professor/actions/runs/37690901249) | [Validate commits / 113030509247](https://github.com/FelipeFelema/avisa-ai-professor/actions/runs/37690901249/job/113030509247) | PASS — completed/success, attempt 1 |

Backend CI includes Prisma validate/generate/migration on the isolated test service, formatting/lint/types, coverage/integration/contract/E2E and build. Mobile CI includes types/lint/format, online Doctor, Jest coverage and all-platform export. Commit Conventions validates the actual PR commit range. Job/step results were read from GitHub; all required checks succeeded. PR was mergeable with state clean at observation; no merge performed.

**T061 completed after these real results; all 64 tasks checked.** Owner's final P0/P1 copy acceptance remains PASS (user-reported), and the separately agreed production-artifact smoke remains NOT RUN at the final release gate without reopening T060/T061. Spec 012 is not started and must wait until the Spec 011 merge.

The owner-authorized final subject is `docs(spec011): close release critical notifications`. This evidence-only closure commit must be pushed and all three required checks must pass again on its new head before reporting merge readiness. Its final SHA/results will be verified from live GitHub and attached to PR evidence/final report; this record does not claim future results before execution. No extra repository commit is needed merely to insert its own future hash/results recursively.

## Historical pre-follow-up delivery checkpoint — 2026-10-07

Full Spec 011 including US3/P1 implemented. All requested local gates passed; physical walkthrough and actual remote CI remain pending. Historical 2026-10-06 records follow this current section and do not define today's scope or dependency status.

Branch: 011-release-critical-notifications. HEAD and develop base both 416256032a645e7335229a42bb2a825d174c85c0 at entry, with merged Spec 010. Initial P0 WIP was preserved. Current 010 T073/T074 are checked in its tasks artifact; no 010 file is modified. Constitution 2.1.0 individual validation scope applies. Prerequisites resolve 011; quality checklist16/16 checked; no extension hooks file exists.

### P1 implementation and exact guarantees

- Startup/every60s PostgreSQL selector reads the current expiresAt, excludes completed current occurrences before LIMIT20, and rechecks under the existing ordered locks. Existing startup/every30s dispatch worker owns sends, bounds100 claims/two concurrent calls and reuses ExpoPushAdapter.
- Select at now >= expiresAt-24h and before expiry, with createdAt<=expiresAt-24h and a non-null 011 marker. Short-lived new announcements, disabled/legacy resources, expired/deleted resources and missing expiry are excluded; late catch-up only while active.
- Existing event ledger gains private occurrenceKey: publication for NEW and expiration:<expiry milliseconds> for EXPIRING. Unique announcement/kind/occurrenceKey and event/installation persist across restart. Existing materialized expiry never refanouts; changing expiry suppresses its unsent old occurrence and uses only the current value. Returning to a previous value preserves its tombstone.
- Final authorization revalidates membership, original account/session/registration/revision/fingerprint, current expiry and eligibility. Two workers use the same CAS/claimVersion/SENDING boundary. Timeout, known rejection, crash after SENDING and accepted response with failed persistence never cause a second automatic submission. Receipt retry is read-only.
- Generic reminder title/body exactly match owner copy. Closed data contains version1, type=announcement-expiring, announcementId and dispatchId; no school content, account/classroom identity, token, capability or provider IDs. Mobile handles both created/expiring with the same fresh authorized GET, cache/session isolation and bounded dedupe.
- Both flags default false; disabled P1 leaves NEW operational and does not submit existing reminder pendings. No dependency change, Redis, BullMQ, second adapter/token registry or new public endpoint.

The schema still requires Announcement.expiresAt (derived from durationInDays). Missing-expiry rejection is defensively verified with mocked resource/unit tests and SQL null semantics; a real nullable Announcement cannot be created through this API. No nullable-expiry API mode or physical PASS is invented.

### Persistence and migration safety

P0 migration 20261006190000_release_critical_notifications is preserved. Follow-up 20261007120000_announcement_expiration_occurrences adds occurrenceKey, preserves NEW events/dispatches, maps any reserved EXPIRING key from current expiry, replaces only event uniqueness and enforces a kind/key CHECK. No resource/dispatch deletion or destructive down migration. Full SQL is in the migration file and reviewed through migration tests.

All destructive suites and automated-gate migration application target only localhost/avisa_ai_test. assertSafeTestDatabase and exact-name guards remain active. The later owner-authorized 2026-10-07 runtime preparation applied both reviewed migrations to localhost/avisa_ai after a private backup, preserved resource counts and enabled the existing private business/reminder flags. No fixture/reset, production logic/dependency change, new credential or installed artifact change occurred. Disabling flags preserves ledger/tombstones and 010 neutral tests; reenable recovers only still-valid unsent work.

### Automated acceptance evidence

| Requirement / scenario                                              | Executed automated coverage                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-001–005/014; exact audience and independent publication          | announcements unit/fanout/dispatch + HTTP E2E; original P0 behavior retained                                                                                                                                                                                                                           |
| FR-006–008; durable boundary, restart, two workers, rotation/logout | shared dispatch/locks/lifecycle/test/account-deletion concurrency suites; P1 two-selector/two-send-worker tests                                                                                                                                                                                        |
| FR-009/013; privacy                                                 | adapter exact-copy/timeout tests; database capture sentinels and mobile intent privacy for both types                                                                                                                                                                                                  |
| FR-010–012; authorized tap/session/cache                            | normal GET authorization; mobile navigation/provider suites run for created and expiring, including stale cache, 404, auth hydration, cold/live response and logout                                                                                                                                    |
| FR-016–019 / SC-007                                                 | controlled due at24h versus early-by1ms; expiry/deletion/legacy/short-lived/no-expiry rejection; edited expiry before/after materialization and during preselection; multi-device current recipients; restart/concurrency; rollback; timeout/rejection/persistence uncertainty; P1 off with NEW intact |
| SC-001–003/006/008                                                  | synthetic recipients, zero outsider/author sends, exact per-installation submission counts, privacy sentinels and flag-isolation assertions                                                                                                                                                            |
| SC-004/005/007 physical display/timing                              | pending owner walkthrough; fake clocks/callbacks and mock acceptance do not prove real display or real timing                                                                                                                                                                                          |

External push sends, receipts and SDK callbacks are mocked in automation. Reminder integration suite has24 scenarios; migration suite3. The controlled healthy window demonstrates due-time logic and timer cadence, not a measured provider/device delivery SLA.

### Local gates

| Component  | Gate                                           | Observed result                                                                         |
| ---------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Backend    | npm run prisma:validate                        | PASS, exit0                                                                             |
| Backend    | npm run prisma:generate                        | PASS, exit0; Prisma client7.10.0                                                        |
| Backend    | npm run prisma:migrate:deploy                  | PASS, exit0;14 migrations, only localhost/avisa_ai_test; follow-up applied              |
| Backend    | migration tests (included in full integration) | PASS;3 scenarios including follow-up preservation/uniqueness/CHECK                      |
| Backend    | npm run typecheck                              | PASS, exit0                                                                             |
| Backend    | npm run lint                                   | PASS, exit0                                                                             |
| Backend    | npm run format:check                           | PASS, exit0                                                                             |
| Backend    | npm run test:cov                               | PASS, exit0;31 suites/383 tests; S73.81%, B64.77%, F73.03%, L74.62%                     |
| Backend    | npm run test:integration                       | PASS, exit0;25 suites/236 tests,121.597s; natural cleanup                               |
| Backend    | npm run test:contract                          | PASS, exit0;1 suite/10 tests                                                            |
| Backend    | npm run test:e2e                               | PASS, exit0;7 suites/78 tests,33.131s; natural cleanup; reminder HTTP scenario included |
| Backend    | npm run build                                  | PASS, exit0                                                                             |
| Mobile     | npm run typecheck / lint / format:check        | Each PASS, exit0                                                                        |
| Mobile     | npm run test:ci                                | PASS, exit0;87 suites/625 tests; S86.03%, B78.12%, F90.51%, L88.54%; natural cleanup    |
| Mobile     | npm run doctor                                 | PASS, exit0;21/21 checks in network-enabled retry                                       |
| Mobile     | npm run export:ci                              | PASS, exit0;Android/iOS/web, .expo-ci-export ignored                                    |
| Repository | git diff --check                               | PASS, exit0;new files separately checked without whitespace diagnostics                 |

The npm default cmd shell failed before scripts started in the alternate Windows runtime. The official scripts were then executed with temporary --script-shell=powershell.exe (no persistent config/package change). Doctor's initial restricted run was19/21 due external network EACCES/Directory metadata; network-enabled native retry passed21/21. No dependency update was needed.

The first full integration attempt found one incorrect new rollback-test assertion: the test expected a raw injected exception instead of the existing sanitized PUSH_OPERATION_FAILED. Corrected assertion only; the transaction/production error handling remains unchanged. A restricted-runtime repeat then hit existing classrooms HTTP/cleanup timeouts and one auth fixture transaction timeout. Full network-enabled native repeat passed all25 suites/236 tests with the original timeouts, no forceExit and no production/harness timeout changes. This history is retained without counting a failed run as PASS.

Expected fault-injection Nest errors, existing React act warnings and pg queued-query deprecation warnings appear in logs. Final successful commands exited0 naturally. Ignored raw local logs are in .codex/spec011-validation/. These assertions prove controlled submission/state/auth behavior; external delivery/display remains pending.

### Authorized runtime preparation — 2026-10-07

See [walkthrough-preparation-2026-10-07.md](walkthrough-preparation-2026-10-07.md) for exact T060/T061 boundaries, verified real-local deployment, API/workers/configuration, remaining phone/build/registration checks and the corrected normal 3-day → 1-day reminder setup. Prisma validate/generate/deploy and backend build exited0. Startup and LAN health200 were verified; regular queries of both workers were observed without forcing a tick. Existing transport configuration yields available=true; authenticated phone view is still pending. Baseline registrations:4 REVOKED/0 eligible; ledger:0 events. This is operational evidence, not physical PASS or remote CI. No user-reported 011 outcome has been provided.

### Authorized EAS preview submission — 2026-10-07

Owner authorized the Android preview build after the actual upload archive inspection. LAN health200, expected API/package, preview SECRET Google services file metadata and matching FCM V1 Firebase association were checked. Archive:627 files /238 mobile files, zero private credential paths/markers/live-secret matches, all mobile bytes equal to checkout including the 011 WIP. Dependencies/versioned build config unchanged. Submission exit0, build [f4a1ee31-1b9c-439c-95da-0d3474ff4e47](https://expo.dev/accounts/kratinhos/projects/mobile/builds/f4a1ee31-1b9c-439c-95da-0d3474ff4e47); single initial status confirmation:IN_QUEUE, then no continuous polling. See [eas-preview-build-2026-10-07.md](eas-preview-build-2026-10-07.md) for exact scope and limitations. Build completion/install/device receipt are not yet observed; this submission does not prove physical acceptance or final-revision remote CI. T060/T061 remain open.

### Local commits and focused checks — 2026-10-07

The owner approved three exact local commit groups. Backend 8ccfab280ecdb30b506e3b0ff0b56ce7e8bdd81c and mobile 7475f4958543137415f1501f3e556429424b45b0 were created after the required staged name/status + whitespace checks. All three subjects passed local Commitlint with zero problems/warnings. This third documentary group records the checkpoint and does not close acceptance.

| Focused check | Result |
| --- | --- |
| Backend unit: announcement, config, locks, service, workers, adapter, receipts and eligibility | PASS — 9 suites /131 tests, natural exit0 |
| Backend integration: fanout/dispatch/locks/migrations/privacy/reminders and authorization | PASS — 7 suites /65 tests, natural exit0 |
| Backend OpenAPI contract | PASS — 1 suite /10 tests, natural exit0 |
| Backend announcement HTTP E2E | PASS — 1 suite /8 tests, natural exit0 |
| Mobile provider/auth/detail/navigation/presentation/privacy | PASS — 8 suites /58 tests, natural exit0 |
| Documentary acceptance, exact subjects, build identity and local links | PASS — 61 unique tasks /59 checked, T060/T061 OPEN, physical PENDING, remote CI NOT RUN, 29 local links resolved, exit0 |

All external provider operations remain mocked. Destructive fixtures run only against guarded localhost/avisa_ai_test; the real-local backend/database are not restarted/reset by these checks. Logs: .codex/spec011-commits/ (ignored). Runtime/configuration/dependency files are unchanged from the pre-commit checkpoint and the EAS snapshot. Existing EAS build remains f4a1ee31-1b9c-439c-95da-0d3474ff4e47; no new build, push or PR. **T060 OPEN; T061 OPEN; physical walkthrough PENDING; final-revision remote CI NOT RUN; no physical receipt claimed.**

### Task disposition at this checkpoint

- T001–T059: checked (59/61), including T046–T053 P1 and T058 mobile/Doctor; all previously completed task IDs preserved.
- T060: OPEN, owner functional P0/P1 walkthrough; no physical PASS fabricated.
- T061: OPEN only for final owner/remote-CI release evidence. Local consolidation, requirements mapping, operational recovery and commit proposal are prepared here.
- Spec010 files/package manifests/lockfiles are unchanged. Current T073/T074 were read as checked; their historical older open-state notes below are superseded.

### Physical walkthrough / remote CI — pending

No 011 device notification, real Expo/FCM handoff, tap, restart-delivery observation or physical reminder is reported as PASS. Follow the seven-step owner script in quickstart.md, using the deployed reviewed migrations and an installed 011 artifact. The current backend enables reminders only with both business flags and the already configured 010 transport. A default-false runtime toggle is not an implementation deferral.

Actual GitHub Backend CI, Mobile CI and Commit Conventions for the final 011 revision are **NOT RUN**. The owner explicitly authorized the three local commit groups on 2026-10-07, with focused tests and staged checks; this documentary group records design/local evidence and does not close T060/T061. The previously authorized EAS preview build and real-local runtime preparation are recorded above. Physical walkthrough remains **PENDING**, with no 011 device receipt reported. No push, PR or new build is authorized here; Spec012 is not started.

## Historical execution — 2026-10-06 (superseded checkpoint)

## Implementation checkpoint — 2026-10-06

- Branch confirmed `011-release-critical-notifications`; base `95b8b43433037f1b20a1d1013b32dae7731e562b` includes six intermediate010 commits.
- Initial status: only eight untracked011 planning artifacts; index empty. Preserve010 tasks and private environment/credentials. No commits, push, PR, EAS build or rebase authorized for this run.
- Review and execution grouping: [mvp-review.md](mvp-review.md). P0 authorized; P1 T046–T053 remains deferred until P0 is complete/validated and owner decides to proceed.
- Official prerequisites script resolves011 with tasks; requirements checklist16/16 checked,0 unchecked (spec quality only). Constitution2.1.0 and individual validation scope read. No extension hooks file exists.
- Ignore rules inspected for private environments/credentials, node_modules, generated output and coverage; no new dependency or ignore change needed.
- No011 behavior, migration, provider submission or individual walkthrough claimed PASS at setup. All subsequent evidence must cite observed commands/results.
- Spec010 T073/T074 stay open; dependency Doctor20/21 and actual remote CI remain separate gates. Local unit/integration assertions do not prove external handoff/display or physical flow.

## Phase results

Setup T001–T003: baseline/review complete; synthetic fixture exercised by PostgreSQL tests and backend typecheck.

Foundation T004–T015: PASS (local automated). Prisma format/validate/generate passed; generated additive schema diff was reviewed and CHECKs added. Deploy applied only to localhost/avisa_ai_test (13 migrations). Config tests first failed missing module; lock tests first failed missing method, then unit3 suites/19 tests passed including existing010 eligibility. Migration/lock integration2 suites/3 tests passed; legacy namespace preserved null marker/title, uniqueness/checks/cascades and observable PostgreSQL Lock wait verified. Typecheck and scoped ESLint passed. An initial migration assertion assumed Prisma CHECK error class; adapted to adapter-pg SQLSTATE23514 after inspection, without changing runtime constraints. No real database migration/provider request.

US1 T016–T032: PASS (local automated). Publication/adapter tests first failed on absent marker/business method, then passed. Publication saves its marker in the resource write; optional post-save wakeup is omitted to avoid another module dependency, with startup/every30s reconciliation instead. Fanout4 scenarios and dispatch14 scenarios cover correct audience, several installations, completed empty snapshot, recovery, concurrent claims/fences, eligibility changes, accepted-only receipts, exact revision invalidation, kill switches and retained tombstones. Locks11 scenarios include actual PostgreSQL waiting plus both winners for fanout/authorization/receipts versus owner-account deletion and final authorization versus leave/logout/revocation/rotation/reassociation/resource/classroom deletion. The account owner differs from author. HTTP P0 suite7 tests verifies normal201, exact mocked recipient tokens, unchanged normal GET authorization, rejected private request fields, provider uncertainty and accepted HTTP followed by failed persistence. Two mocked submissions for two eligible installations remain two after repeat/restart; author and outsider get zero. These prove our submission boundary, not Expo delivery/display.

US2 T033–T045: PASS (local automated). Parser/navigation tests first failed missing modules, and provider tests first failed missing business presentation/cold-start/readiness behavior. Closed version1/UUIDv4 payload, separate bounded128 receive/tap histories, anonymous adoption/TTL5min, live/last response dedupe+clear, router/auth hydration and stale callbacks are tested. Mounted detail with old cache blocks protected content while fetching; current200 is admitted, lost-membership/expired/deleted404 removes old data, late old-session200 cannot navigate/cache. Request uses captured session generation and no automatic tap retry; retry/cancel are explicit. Existing detail screen/Portuguese states/themes are reused through the hook gate, without a second detail route. Existing `push-test` channel named Notificações remains unchanged. Narrow official mobile run:8 suites/48 tests passed with natural exit; full run below also passes existing010/auth/theme/429 regression suites.

Immediate DeviceNotRegistered rejection initially failed its integration assertion (registration stayed ACTIVE). Finalization now uses the full business lock order and fenced exact-binding invalidation for both immediate rejection and receipts; current binding becomes INVALID, rotated binding stays ACTIVE. Added three unit and three integration cases; all final backend gates were repeated and passed. A late accepted outcome after classroom deletion cannot recreate ledger rows. After the full gates, the existing fanout/E2E cases were also tightened to exercise a late join after an empty snapshot and an edit after materialization; targeted official reruns passed: fanout1 suite/4 tests and P0 HTTP1 suite/7 tests, plus backend scoped ESLint/typecheck, all exit0 with natural cleanup.

P0 closure T054–T057/T059: privacy sentinels, minimal operational docs, actual SQL/unchanged REST contract review and disable/restart/recovery tests passed. Publication/update/detail DTOs never expose pending/event/dispatch fields. Adapter business data/copy are closed and generic; raw token exists only in its private transport argument/Expo recipient field, not the ledger, public responses, logs or school-content payload. No new token registry, native config, SDK, dependencies or global rate-limit/cooldown changes. New shared receipt integration keeps010 test timings intact. No EXPIRING worker or reminder payload acceptance is implemented.

## Final local gates — Node22.14.0 / Windows / 2026-10-06

All provider requests are simulated. Database commands use the exact guarded local `avisa_ai_test`, never `avisa_ai`. Gate scripts are those listed in [quickstart.md](quickstart.md), matching applicable GitHub workflows. Coverage/output folders and temporary command logs remain ignored. Local runs are not remote CI evidence.

| Component | Official command                                                        | Observed result                                                                                                                   |
| --------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Backend   | `npm.cmd run prisma:validate`                                           | PASS, exit0                                                                                                                       |
| Backend   | `npm.cmd run prisma:generate`                                           | PASS, exit0                                                                                                                       |
| Backend   | `npm.cmd run prisma:migrate:deploy`                                     | PASS, exit0; test database only,13 migrations/up to date                                                                          |
| Backend   | `npm.cmd run format:check`, `npm.cmd run lint`, `npm.cmd run typecheck` | Each PASS, exit0                                                                                                                  |
| Backend   | `npm.cmd run test:cov`                                                  | PASS, exit0;30 suites/351 tests; statements73.12%, branches63.26%, functions73.09%, lines73.87%; configured global thresholds met |
| Backend   | `npm.cmd run test:integration`                                          | PASS, exit0;24 suites/210 tests; includes010 push/lifecycle/receipts/account-deletion concurrency regressions                     |
| Backend   | `npm.cmd run test:contract`                                             | PASS, exit0;1 suite/10 tests; canonical/runtime REST inventory retained                                                           |
| Backend   | `npm.cmd run test:e2e`                                                  | PASS, exit0;7 suites/77 tests                                                                                                     |
| Backend   | `npm.cmd run build`                                                     | PASS, exit0; local compilation only                                                                                               |
| Mobile    | `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run format:check` | Each PASS, exit0                                                                                                                  |
| Mobile    | `npm.cmd run test:ci`                                                   | PASS, exit0;87 suites/615 tests; statements86.03%, branches78.12%, functions90.51%, lines88.54%; configured file thresholds met   |
| Mobile    | `npm.cmd run export:ci`                                                 | PASS, exit0; Android/iOS/web JS bundles; no EAS/native build or publication                                                       |
| Mobile    | `npm.cmd run doctor`                                                    | FAIL, exit1; first19/21 due sandbox network failures; network-enabled repeat20/21, SDK patch alignment below                      |

The first backend coverage run had321 passing tests but branches58.25% failed the60% gate: integration tests do not count toward the unit report. Added27 deterministic unit cases for authorization/fencing, nullable markers, bounded claims, receipt error/lease handling and tombstone retention; business service unit coverage now statements99.04%, branches89.02%, functions/lines100%. Thresholds/config were not weakened. A shutdown/persistence-failure test exposed `Promise.all` returning before its sibling work drained; the two-send wave now waits with `Promise.allSettled` before surfacing a generic internal failure. Repeated HTTP tests confirm no replay after that failure.

Initial mobile full run failed one ThemeProvider test because the inherited router mock lacked `useRootNavigationState`; the test harness now models that installed SDK function. One narrow run passed assertions but retained orphan query GC timers: test-only query defaults use `gcTime=Infinity` with explicit cancellation/clear, like the existing render helper. The subsequent narrow/full runs exited naturally; no forceExit/VM flag or production GC workaround. Existing dynamic-import transformation is retained. Jest React `act` warnings and pg queued-query deprecation warnings occurred; final commands exited0.

### Doctor — existing third-party gate, dependencies unchanged

| Package            | Installed | Expected |
| ------------------ | --------- | -------- |
| expo               | 57.0.26   | ~57.0.27 |
| expo-constants     | 57.0.20   | ~57.0.21 |
| expo-linking       | 57.0.11   | ~57.0.12 |
| expo-notifications | 57.0.21   | ~57.0.22 |
| expo-router        | 57.0.24   | ~57.0.25 |

These are SDK patch mismatches, with possible missing upstream fixes/compatibility corrections. Current compilation/tests/export pass; that does not waive the Doctor gate or prove native behavior. No expo install, dependency/lockfile change or new build was performed. T058 remains open solely for its unsuccessful Doctor gate; actual remote CI remains unexecuted.

## Closure disposition

- P0 code and local automated story checks complete. T001–T045 and T054–T057/T059 are checked against the observations above.
- T046–T053: **DEFERRED — optional P1**, all unchecked. No reminder worker, timer or expiring notification handling; `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false`. This does not block P0.
- T058: **OPEN — Doctor20/21**; successful individual mobile gates are recorded without marking the combined task complete.
- T060: **OPEN — individual walkthrough**, pending separately authorized migration/deployment/installed011 artifact and validated010 foundation. No physical notification or real Expo receipt was observed in this run.
- T061: **OPEN — final release consolidation**; requires remaining applicable gates, actual CI evidence and owner walkthrough. SC timing/display goals are not measured by simulated callback tests.
- Spec010 T073/T074 remain unchecked and its artifacts are untouched. Its second manually submitted build was neither queried, cancelled, restarted nor replaced.
- No Spec012, branch change, staging, commit, push, PR, rebase or real provisioning performed. No credential/private environment file tracked or staged; package/lock/native build config and010 API loop correction unchanged.

## Remaining real evidence

Authorized runtime/migration deployment and installed artifact walkthrough are not performed by test fixtures. Record only actual owner reports as `PASS (user-reported)`; never mark delivery from mock tests. Specialized campaigns/participants remain DISPENSADA POR ESCOPO, with no execution task.

## Historical pre-publication acceptance and diff review — 2026-10-07

This section applies to the current final-product diff, not the earlier implementation checkpoints. T060 is closed from the exact owner reports at the top; production-artifact smoke remains NOT RUN in the final release gate, and is not a T060 or Spec 012 dependency. T061 remains open for real checks on the final PR revision.

Reviewed the 21-file current diff: seven backend files (authorized metadata snapshot, worker forwarding, adapter copy/fallback and unit/privacy integration tests), five mobile files (build-profile boolean, runtime presentation gate, screen and configuration/UI tests), nine Spec 011 documentary files. No blocking finding in this scoped review. Existing membership/binding/lock order, minimal data fields, no-resubmit policy and opt-in/logout are preserved. No package/lockfile, schema/migration, private environment/credential or Spec 010 edit. The review retains previous observed full local gates; no production/test code changed during this documentary consolidation, so suites are not unnecessarily rerun. Whitespace, task state, proposal subjects/group coverage and local document links are rechecked.

Proposed final commits are in [commit-plan.md](commit-plan.md). The earlier proposal step did not stage, commit or publish; owner has now approved execution of those exact groups and push/PR into develop with remote checks after commits. Required remote evidence: Backend CI / Run backend checks; Mobile CI / Run mobile checks; Commit Conventions / Validate commits. Current workflows trigger on PR into develop/main and offer workflow_dispatch. Feature-branch push alone is insufficient. Record URLs, result/conclusion and actual tested final head/PR merge SHA relationship. If T061 closure introduces a documentary commit, publish it and require all applicable final-revision checks again; do not cite green results from an older head as final CI.

No Spec 012 work started. No new EAS build or production smoke performed. Remote checks remain NOT RUN at this proposal checkpoint.
