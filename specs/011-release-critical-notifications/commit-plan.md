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
