# Approved final commits — Spec 011

Branch: `011-release-critical-notifications`; proposal checkpoint HEAD `48e5aaa`. Original implementation commits `8ccfab2`, `7475f49`, `48e5aaa` remain intact. The approved groups cover the 21-file final follow-up diff, including final product changes after the initial walkthrough and the authorized T060 closure. T060 CLOSED; 63/64 tasks checked; T061 OPEN for final remote CI. Spec 012 not started.

Owner explicitly approved all three subjects, staging by exact group with cached name/status and whitespace checks, focused tests, normal feature-branch push, PR into develop and remote CI. Execution below supersedes the earlier proposal-only boundary. No merge or Spec 012 work is authorized in this run.

## Approved groups (in order)

1. **feat(push): include classroom context in announcement notifications** — 7 files
   - `backend/src/push/announcement-push.service.ts`
   - `backend/src/push/announcement-push.service.spec.ts`
   - `backend/src/push/announcement-push.worker.ts`
   - `backend/src/push/announcement-push.worker.spec.ts`
   - `backend/src/push/expo-push.adapter.ts`
   - `backend/src/push/expo-push.adapter.spec.ts`
   - `backend/test/announcement-push-privacy.integration.spec.ts`
   - Result: requested new/reminder titles and bodies using only current authorized classroom name/announcement title, safe fallbacks and bounded text; unchanged closed data, backend eligibility/idempotence and private logs. Covers T062/T063.
   - Validation already observed: typecheck/lint/format; unit31/388 with coverage; integration25/236; contract1/10; E2E7/78; build. No backend code changed since these gates.
2. **fix(mobile): hide push test action in production** — 5 files
   - `mobile/app.config.ts`
   - `mobile/src/config/push-config.ts`
   - `mobile/app/(app)/profile/notifications.tsx`
   - `mobile/tests/config/push-config.spec.ts`
   - `mobile/tests/routes/profile-notifications.spec.tsx`
   - Result: diagnostic button/feedback in local development or explicit preview/development profile only; false for production/absent/unknown profiles, overriding inherited true. Backend test endpoint, activation, opt-out/logout and cooldown unchanged. Covers T064.
   - Validation already observed: typecheck/lint/format; test87/636 with coverage; online Doctor21/21; Android/iOS/web export. Current preview presence expected; owner accepts automated/configurational production hiding. Production-artifact smoke remains final release gate, not a claimed physical PASS.
3. **docs(spec011): close owner walkthrough and consolidate final evidence** — 9 files
   - `specs/011-release-critical-notifications/spec.md`
   - `specs/011-release-critical-notifications/plan.md`
   - `specs/011-release-critical-notifications/tasks.md`
   - `specs/011-release-critical-notifications/contracts/announcement-notifications.md`
   - `specs/011-release-critical-notifications/quickstart.md`
   - `specs/011-release-critical-notifications/research.md`
   - `specs/011-release-critical-notifications/final-validation.md`
   - `specs/011-release-critical-notifications/walkthrough-preparation-2026-10-07.md`
   - `specs/011-release-critical-notifications/commit-plan.md`
   - Result: contextual-copy contract, product follow-ups, backend restart, exact final new/reminder PASS (user-reported), preview expectation, accepted production automation and T060 closure. Preserve T061 OPEN/CI NOT RUN; keep future onboarding/preference ideas as notes without starting Spec 012.
   - Validation: git diff --check, 64 unique task IDs /63 checked, only T061 open, local documentation links and Conventional Commit subjects; review all three staged scopes immediately before execution.

## Execution and remote evidence after commits

Before each proposed commit, inspect `git diff --cached --name-status` and `git diff --cached --check` against its exact group. Preserve any newly discovered WIP; exclude ignored logs/export/build output, private .env/credentials and all unrelated files. No amend/rebase/force-push is proposed. Subjects must pass local Commitlint before commits.

After these commits, owner requests normal push of the 011 feature branch and a PR **base develop / head 011-release-critical-notifications**. Do not push directly to develop or merge automatically. PR description should cover the full Spec 011 implementation plus these follow-ups, local vs remote evidence, owner-reported copy acceptance and remaining production smoke.

Monitor the final PR revision for all three workflows:

| Workflow | Job/check | Evidence needed |
| --- | --- | --- |
| Backend CI | Run backend checks | Actual success, run URL/ID and tested final revision; Prisma + guarded test DB, code gates, coverage/integration/contract/E2E/build |
| Mobile CI | Run mobile checks | Actual success, run URL/ID and tested final revision; types/lint/format/Doctor/coverage/export |
| Commit Conventions | Validate commits | Actual success for PR commit range, run URL/ID and tested final revision |

All workflows trigger on pull_request to develop/main; feature-branch push alone does not match their push filters. Workflow dispatch is available if a required run is absent; do not duplicate already-running checks without reason. Resolve actual failures without weakening gates. T061 closes only after real successful results on the final revision are consolidated, retaining production smoke as the separate final release gate. A later evidence-only closure commit must itself be pushed and checked; prior green SHA is not final-revision evidence. No merge, release publication, EAS build or Spec 012 is included.

## Historical approved implementation groups and execution — preserved

The following records predate the final walkthrough/product follow-up and do not override the current proposal/acceptance above.

# Approved local commits — Spec 011

Owner explicitly approved the three groups on 2026-10-07. Local commits are authorized after focused tests and staged name/status + whitespace checks. Preserve the original P0/P1 bytes; no runtime/configuration/dependency edit, push, PR or new build is authorized. Base: develop / 416256032a645e7335229a42bb2a825d174c85c0.

1. **feat(push): add durable announcement notices and expiration reminders**
   - backend/.env.example; backend/prisma/schema.prisma; both 011 migrations.
   - backend/src/announcements/announcements.service.ts and its unit tests.
   - Existing backend/src/push adapter, registrations, receipts/module changes and announcement-push/reminder service/worker/config/lock tests.
   - All backend/test/announcement-push suites, fixture, announcement authorization and OpenAPI contract changes; test-database cleanup order.
   - Rationale: persist event/installation idempotence and per-expiry occurrences, reuse 010 transport and auth; no schema consumer is committed before its migration.
2. **feat(mobile): open announcement notifications with fresh authorization**
   - mobile/src/components/announcements/AnnouncementPushFeedback.tsx; announcement push services/schema; useAnnouncement; AuthProvider; PushProvider.
   - All mobile announcement-push tests; existing PushProvider/reconciliation tests and SDK helper/setup extensions.
   - Rationale: accept created/expiring minimal payloads, deduplicate and guard account/cache boundaries through normal GET authorization.
3. **docs(spec011): record design and local validation evidence**
   - README.md and specs/011-release-critical-notifications/ artifacts, including this proposal.
   - Rationale: current P1 design, actual local results, reviewed migration/recovery and existing EAS snapshot/build evidence. Keep T060/T061 OPEN, physical walkthrough pending, final-revision remote CI NOT RUN and no physical receipt claim. This group does not close release acceptance.

Each group requires git diff --cached --name-status and git diff --cached --check before its commit, plus its focused checks. Omit private environments/credentials and ignored test/export/log output. Keep Spec 010 artifacts and package/lockfiles unchanged. Remote CI is pending the future authorized publication; no next spec is included.

## Local execution — 2026-10-07

- Backend commit: 8ccfab280ecdb30b506e3b0ff0b56ce7e8bdd81c. Focused unit9/131, integration7/65, contract1/10 and HTTP E2E1/8 passed, natural exit0; PostgreSQL only avisa_ai_test and provider mocked.
- Mobile commit: 7475f4958543137415f1501f3e556429424b45b0. Focused navigation/provider/account/detail/privacy tests8/58 passed, natural exit0.
- Documentation is the third approved group; it records design/local evidence, existing build and pending acceptance. Its focused checks validate T060/T061 OPEN, physical PENDING, remote CI NOT RUN and local document links. No release-closure commit is made.
- The exact approved subjects passed local Commitlint with zero problems/warnings. Backend/mobile staged scope and whitespace checks passed before their commits.
- Runtime/configuration/dependency bytes and private environments are preserved against the pre-commit checkpoint. Existing EAS build remains f4a1ee31-1b9c-439c-95da-0d3474ff4e47; no new build or remote polling is started by committing.

## Approved final group execution — 2026-10-07

- Backend: `9ee7ceee3aa9d5b87eb745512d8ed2c8193b8060`; approved seven-file staged scope; cached name/status and check passed; Commitlint zero problems/warnings. Narrow unit3/74 and guarded integration3/40 passed naturally, exit0; only localhost/avisa_ai_test and provider mocks.
- Mobile: `4674e0452af6c76fc77e7cc736edcf08d1baec6f`; approved five-file staged scope; cached name/status and check passed; Commitlint zero problems/warnings. Narrow config/profile/consent/test-lifecycle4/39 passed naturally, exit0.
- Third approved documentary subject: `docs(spec011): close owner walkthrough and consolidate final evidence`; exact nine-file group. T060 CLOSED; only T061 OPEN (63/64), remote CI NOT RUN before publication. Validate local links/task states and staged scope before creating this commit. Its hash and final remote results will be recorded in the separately authorized closure commit after CI success.
- Ignored local logs: `.codex/spec011-final-commits/`. No private environment/dependency/Spec 010 changes. GitHub CLI is absent; Git Credential Manager supplies existing authentication for standard git push and GitHub API PR/check operations without logging or persisting credentials.
