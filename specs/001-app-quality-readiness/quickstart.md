# Quickstart Validation Guide

Use this guide after implementation to prove the feature end to end. It intentionally references the contracts instead of duplicating implementation code.

## Prerequisites

- Node.js 22+
- npm
- Docker and Docker Compose
- A simulator/device or Expo web target for mobile validation
- Repository dependencies synchronized with their lockfiles
- A disposable PostgreSQL test database for integration/e2e checks

Review first:

- [Implementation plan](./plan.md)
- [Data model and invariants](./data-model.md)
- [OpenAPI design contract](./contracts/openapi.json)
- [Mobile interaction contract](./contracts/mobile-interactions.md)
- [Quality gate contract](./contracts/quality-gates.md)

## 1. Prepare local services

From the repository root:

```bash
docker compose up -d
docker compose ps
```

Expected: PostgreSQL 15 is healthy and listening on port 5432.

Prepare the backend:

```bash
cd backend
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate deploy
```

Create `backend/.env` from `.env.example` and use development-only JWT secrets. Set `NODE_ENV=development`; OpenAPI is enabled outside production unless `API_DOCS_ENABLED=false`.

Prepare the mobile app in another terminal:

```bash
cd mobile
npm ci
```

Create `mobile/.env` from `.env.example` and point `EXPO_PUBLIC_API_URL` to `http://localhost:3000/api/v1` or the host IP reachable from a physical device.

## 2. Start and discover the API

```bash
cd backend
npm run start:dev
```

Validate:

1. `GET http://localhost:3000/api/v1/health` returns `200` with `{"status":"ok"}`.
2. `http://localhost:3000/api/v1/docs` opens Swagger UI.
3. `http://localhost:3000/api/v1/docs/openapi.json` returns the generated contract.
4. The UI groups exactly 19 operations under health, auth, users, classrooms, announcements and invite-codes.
5. Protected operations show Bearer authentication and their role/owner/author rules.
6. Register or sign in with disposable development data, paste the access token through Authorize and successfully execute one protected GET and one protected mutation.

For SC-006, a developer who did not implement the reference receives only this checked-in entry point and disposable credentials. Start the timer when the docs location is provided, stop after both operations succeed, and record participant, start/end time, assistance, operations and result in `evidence/us4-openapi.md`. More than 15 minutes or assistance beyond the checked-in instructions blocks acceptance.

Never paste production tokens or real invite codes into screenshots/logs.

Production denial check: start the application with `NODE_ENV=production` in a disposable validation environment and verify both docs URLs return unavailable/not found even if `API_DOCS_ENABLED=true` is present.

## 3. Run backend gates

Use a disposable database such as `avisa_ai_test`, never the developer database containing useful data. In PowerShell, set the test connection for the current terminal before running boundary suites:

```powershell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/avisa_ai_test"
```

Run the same checks required by CI:

```bash
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run format:check
npm run lint
npm run typecheck
npm run test:cov -- --runInBand
npm run test:integration -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

Expected:

- Unit coverage remains at or above the configured threshold.
- Integration proves owner-only deletion, PostgreSQL cascades, owner leave denial, profile normalization/conflicts and forbidden fields.
- Integration proves the `AuthSession` migration/rotation/revocation and the transactional deletion receipt, including initial, repeated and concurrent DELETE behavior.
- E2E proves the critical classroom and profile journeys using the shared production-like bootstrap, including two simultaneous sessions.
- Contract tests prove all 19 OpenAPI operations, responses and security metadata.
- No suite cleans or mutates a non-test database.

## 4. Run mobile gates

```bash
cd mobile
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run test:ci
npm run export:ci
```

Expected:

- Jest Expo/RNTL covers cancellation, single-flight, owner visibility, profile sync, announcement confirmation and accessible states.
- New critical modules meet 80% statements/lines/functions and 70% branches.
- Expo Doctor uses the lockfile-pinned dependency.
- Expo export bundles the supported platforms without missing modules/assets.

Then start the app:

```bash
npm start
```

## 5. Validate classroom deletion

Prepare a professor owner, a second professor or parent member, a classroom and at least one active announcement.

1. Sign in as the owner and open the classroom.
2. Verify “Excluir turma” is visible and “Sair” is not.
3. Open deletion confirmation. It must name the classroom and state that participants and announcements are removed.
4. Cancel. Refresh both clients and verify nothing changed.
5. Open again and double-tap confirm rapidly. Verify the UI sends one request, shows busy/disabled state and reports one success.
6. Verify the app replaces the route with the classroom list and the classroom disappears permanently.
7. In an integration/controlled-client test, let the first owner DELETE commit but discard its response; repeat the same owner DELETE and verify a second empty `204`, one physical deletion, absent memberships/announcements and safe return to the refreshed list.
8. Verify a non-owner receives `403` while a fresh classroom exists; after deletion, a caller without the matching owner receipt receives `404`; an anonymous client receives `401`.
9. On the other participant, refresh the old detail. Verify an accessible not-found state and safe route back, not stale content or crash.
10. Verify rollback/failure cannot leave a receipt for a classroom that was not deleted.

## 6. Validate profile update

For each supported role, validate name-only, email-only and both together. Use two independent device/browser sessions for the email scenario.

1. Open profile edit; role is read-only.
2. Enter invalid values and verify field feedback appears before confirmation.
3. Enter valid changes. The confirmation lists only changed normalized fields.
4. Cancel and verify values remain editable while stored/current profile remains unchanged.
5. Submit with no effective change and verify no request is sent.
6. Confirm a valid name-only update and verify the profile and home greeting update within two seconds, every additional discovered current-account identity display remains consistent, and the second session remains valid.
7. Attempt a duplicate email and verify `409` maps to the email field without losing form values.
8. Try `password`, `role` or unknown fields through Swagger/API and verify `400`.
9. With sessions A and B active, change the email from A. Verify A remains authenticated and shows the new identity within two seconds.
10. On B, verify the next protected access and refresh both receive `401`; the app clears Secure Store, query cache and `AuthContext`, then routes to login.
11. Verify the old email no longer signs in and the normalized new email does; refresh A and confirm only A's `sid` rotates and remains active.
12. Validate migration from a representative legacy `refreshTokenId`/hash: an old access token without `sid` refreshes into a session-aware token or follows the normal sign-in recovery without stale authenticated UI.

## 7. Validate confirmation consistency

Exercise all rows in the [confirmation matrix](./contracts/mobile-interactions.md#confirmation-matrix):

- profile update;
- classroom delete;
- non-owner classroom leave;
- announcement update;
- announcement delete.

For each, capture evidence that cancel sends no request, confirm identifies the target, pending blocks duplicates, failure keeps useful context and success invalidates/navigates correctly. Creation, join, navigation and sign-out do not require this confirmation.

## 8. Validate visual and accessible behavior

Review authentication, classroom, announcement and profile primary screens against `mobile/docs/visual-foundation.md`:

- semantic tokens replace literal feature colors;
- normal text targets 4.5:1 contrast;
- controls meet at least 44×44 point touch targets on iOS and 48×48 density-independent pixel targets on Android;
- loading, empty, error, success and not-found are explicit;
- screen reader announces meaningful label, role and busy/disabled state;
- destructive actions use wording/icon as well as color;
- Portuguese content and large text wrap without hiding actions;
- no nested actionable `Pressable` remains in classroom cards.

Record product-owner approval and accessibility evidence. Critical findings block acceptance.

## 9. Validate commit and merge enforcement

Run the root commit validation command defined by the implementation and verify the feature history follows Conventional Commits.

In GitHub, confirm rulesets/branch protection for `develop` and `main` require these stable checks:

- `Backend CI / Run backend checks`
- `Mobile CI / Run mobile checks`
- `Commit Conventions / Validate commits`

Also require an up-to-date branch and restrict bypass. Open a disposable validation PR with one required check failing and verify merge is blocked. Without active rulesets/branch protection and this evidence, the feature is incomplete even if every workflow definition is committed.

## 10. Acceptance evidence checklist

- [ ] Backend, mobile and commit workflows pass.
- [ ] Rulesets/branch protection require all three stable checks on `develop` and `main`, and evidence shows a failing required check blocks merge.
- [ ] Deliberate failures in formatting, static correctness, build/export, automated behavior/contract, environment/dependency health and commit convention are detected according to the matrix in `contracts/quality-gates.md`.
- [ ] OpenAPI read + protected mutation completed within 15 minutes by a new developer.
- [ ] Classroom delete and profile edit timed scenarios meet SC-002/SC-003.
- [ ] Confirmation cancellation produced zero persisted changes in every scoped action.
- [ ] A lost classroom-delete response followed by the same owner retry returns `204`, performs one deletion and returns the app to the refreshed list.
- [ ] An email change keeps the initiating session active and causes every other session to receive `401` and clear local authenticated state.
- [ ] Visual foundation approved; accessibility audit has no critical issue.
- [ ] Representative first-attempt task rate meets SC-008.
- [ ] Historical ownership migration is confirmed safe for target environments.
- [ ] All evidence links are attached to the delivery review.
