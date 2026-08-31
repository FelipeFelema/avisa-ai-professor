# Quality Gate Contract

## Readiness rule

A change is ready only when every applicable required repository gate passes and every external/manual gate required for the release has recorded evidence. A workflow definition alone does not block merge; GitHub rulesets/branch protection must mark the stable check names as required. Until this enforcement is active and proven with a blocked failing change, the feature is incomplete.

## Backend CI contract

**Stable check**: `Backend CI / Run backend checks`

| Order | Gate | Planned command | Failure proves |
|---|---|---|---|
| 1 | Deterministic install | `npm ci` | Lockfile/dependency drift. |
| 2 | Prisma schema | `npx prisma validate` | Invalid datasource/schema. |
| 3 | Prisma client | `npx prisma generate` | Client generation mismatch. |
| 4 | Database migration | `npx prisma migrate deploy` | Committed migrations cannot build an isolated PostgreSQL 15 DB. |
| 5 | Formatting | `npm run format:check` | Non-conforming backend format. |
| 6 | Lint | `npm run lint` | Static/code-quality issue. |
| 7 | TypeScript | `npm run typecheck` | Type error independent of emitted build. |
| 8 | Unit + coverage | `npm run test:cov -- --runInBand` | Service/guard/normalizer regression or current 60/60/50/60 global floor. |
| 9 | Integration | `npm run test:integration -- --runInBand` | HTTP/auth/persistence/FK boundary regression. |
| 10 | OpenAPI contract | Included in integration or a dedicated `npm run test:contract` | Missing operation/schema/security/response metadata. |
| 11 | End-to-end | `npm run test:e2e -- --runInBand` | Critical journey/bootstrap regression. |
| 12 | Production build | `npm run build` | Nest compilation/emission failure. |

The CI PostgreSQL service remains isolated. Local integration/e2e commands must use a clearly named test `DATABASE_URL`; helpers must refuse destructive cleanup against an unrecognized development/production database.

### Mandatory backend scenarios

- First owner classroom deletion returns empty `204` and permanently cascades memberships/announcements.
- A repeated/concurrent DELETE by the same owner returns `204`, uses the deletion receipt, creates no duplicate effect and produces no `P2025`/`500`.
- Professor non-owner and parent receive `403` while the classroom exists; anonymous receives `401`; an absent classroom without a matching owner receipt receives `404`.
- Owner cannot leave its classroom.
- For each supported role (`PARENT`, `PROFESSOR`, `ADMIN`), profile name-only, email-only and both succeed with equivalent self-service authorization; trim/case/accents/limits agree with DTO.
- Duplicate email is `409`; empty/no fields, password, role and unknown properties are rejected.
- Normalized no-op performs no write.
- Two simultaneous sessions are independently valid before an email change; the initiating session remains valid with current identity, while every other access and refresh receives `401` on its next attempt.
- Name-only/no-op leaves other sessions active; refresh rotates only the matching `sid`; missing, expired, revoked or mismatched sessions receive `401`.
- The migration preserves a legacy refresh pair as `AuthSession`; a legacy access token without `sid` refreshes into the new format or follows the normal sign-in path.
- Login accepts normalized email; after update, old email fails and new email succeeds.
- OpenAPI contains the exact 19 path/method combinations, schemas, tags, summaries, security and relevant errors.
- Docs UI/JSON are available in development/test and unavailable in production.

## Mobile CI contract

**Stable check**: `Mobile CI / Run mobile checks`

| Order | Gate | Planned command | Failure proves |
|---|---|---|---|
| 1 | Deterministic install | `npm ci` | Lockfile/dependency drift. |
| 2 | TypeScript | `npm run typecheck` | Route/component/service contract mismatch. |
| 3 | Lint | `npm run lint` | Static/code-quality issue. |
| 4 | Formatting | `npm run format:check` | Non-conforming mobile format. |
| 5 | Expo health | `npm run doctor` | Expo dependency/config incompatibility; `expo-doctor` is lockfile-pinned. |
| 6 | Behavior tests | `npm run test:ci` | Schema/component/hook/route behavior regression. |
| 7 | Coverage | Part of `test:ci` | New critical modules below 80% statements/lines/functions or 70% branches. |
| 8 | Bundle export | `npm run export:ci` | Metro/module/assets cannot bundle for supported platforms. |

Tests use Jest Expo and React Native Testing Library and live outside `mobile/app/`. Thresholds apply to new critical modules (`ConfirmationDialog`, profile validation/mutation/session sync, classroom deletion and confirmed announcement mutations); broader legacy coverage is reported without creating arbitrary failing floors.

### Mandatory mobile scenarios

- Cancel means zero network mutations for profile, classroom leave/delete and announcement update/delete.
- Rapid duplicate confirm yields exactly one service call; pending controls are disabled/busy. A newly confirmed retry after an ambiguous delete response treats the receipt-backed `204` as success and returns to the list.
- Profile no-op makes no request; success updates the profile and home greeting within two seconds and keeps every other discovered current-account identity display consistent; `409` is a field error.
- Delete is shown only for `ownerId`; non-owner sees leave; owner cannot leave.
- Success invalidates exact query keys and navigates safely; failures preserve screen/form context.
- Deleted/missing classroom or announcement renders accessible not-found state.
- Loading, empty, error and success patterns expose meaningful labels/roles/states.
- Revoked-session `401` on access/refresh clears tokens, cache and AuthContext consistently, while the device that changed email remains authenticated.
- Platform-aware primitives enforce 44×44 points on iOS and 48×48 density-independent pixels on Android; automated color checks and manual audit prove WCAG 2.2 AA.

## Conventional Commit CI contract

**Stable check**: `Commit Conventions / Validate commits`

- Checkout uses full history needed for the PR range.
- Root tooling uses lockfile-pinned `@commitlint/cli` and `@commitlint/config-conventional`.
- Every commit in the PR range must match Conventional Commits 1.0.0, normally `type(scope): description`.
- Merge strategy/ruleset must agree with this policy; validating only the PR title is not a substitute unless squash-only merge is also enforced externally.

## Deliberate failure matrix

SC-009 requires a disposable validation change for every required category below. Each change must make the expected stable check fail for the intended reason, retain an actionable log and be reverted or discarded after evidence capture.

| Required category | Representative controlled failure | Expected detection |
|---|---|---|
| Formatting | Introduce a safely disposable formatting violation in backend or mobile code. | The corresponding `format:check` step fails and identifies the file. |
| Static correctness | Introduce a lint or TypeScript error in a disposable path. | The corresponding lint/typecheck step fails with the originating rule or type. |
| Buildability | Introduce a disposable Nest compilation error or Expo export/module-resolution error. | Backend build or mobile bundle export fails before readiness. |
| Automated behavior and contract | Invert one assertion in a unit/integration/e2e/OpenAPI/RNTL test. | The owning behavior or contract suite fails and identifies the scenario. |
| Environment and dependency health | Use a disposable lockfile mismatch, invalid migration/schema fixture or Expo dependency/config mismatch. | Deterministic install, Prisma validation/migration or Expo Doctor fails without touching a useful database. |
| Repository convention | Validate a disposable non-Conventional Commit in the PR range. | `Commit Conventions / Validate commits` rejects the range. |

## OpenAPI completeness contract

The generated document is tested structurally, not with one full snapshot. It must include:

- exactly 19 supported operations under `/api/v1` across `health`, `auth`, `users`, `classrooms`, `announcements` and `invite-codes`;
- unique `operationId`, tag and non-empty summary for each;
- path/query/body schemas and response DTO references where applicable;
- Bearer security for protected operations;
- textual role, owner and author requirements;
- success plus relevant `400`, `401`, `403`, `404`, `409`, `429` responses;
- no real token, invite code, password or environment secret in examples.

`contracts/openapi.json` is the Phase 1 design baseline. Runtime Nest metadata is the executable source after implementation; the contract test detects drift between the implementation and expected inventory.

## External and manual gates

| Gate | Owner/system | Required evidence | Blocking condition |
|---|---|---|---|
| GitHub ruleset for `develop` and `main` | Repository admin | Ruleset screenshot/export showing required Backend, Mobile and Commit checks, up-to-date branch and no unauthorized bypass; failing PR demonstrating merge blocked | Missing/optional checks or absent blocking proof means the feature cannot be completed. |
| Visual direction approval | Product owner | Approval of `mobile/docs/visual-foundation.md` and representative screens | Broad redesign cannot be accepted without approval. |
| Accessibility audit | Maintainer/reviewer | Contrast, touch target, dynamic text and screen-reader checklist with no critical issue | Any critical unresolved issue blocks SC-007. |
| Usability validation | Product owner/test participants | Timed classroom deletion/profile edit and representative task results | SC-002, SC-003 and SC-008 thresholds not met. |
| OpenAPI onboarding exercise | Developer who did not implement the reference | Start/end time, result and notes showing one protected read and one protected mutation completed from the documented entry point | More than 15 minutes, assistance beyond the checked-in instructions or an incomplete operation blocks SC-006. |
| Historical owner migration audit | Deployment owner | Confirmation migration is applied, or reviewed backfill/recovery plan for populated environment | Do not deploy ownership-dependent feature into an incompatible DB. |

EAS/Maestro device E2E is a recommended later layer, not a required gate for this increment. It requires Expo project/account/build configuration outside the repository. RNTL integration tests are the required automated mobile behavior gate in scope.

## Required check mapping

| Requirement group | Primary automated evidence | Additional evidence |
|---|---|---|
| FR-001–005, SC-001/002 | Backend integration/e2e cascade+receipt+retry+auth; mobile owner deletion tests | Timed usability deletion scenario |
| FR-006–009, SC-003/005 | Backend role-matrix and multi-session profile integration/e2e; mobile profile/home/context/session-expiry tests | Timed profile scenario |
| FR-010–013, SC-004 | RNTL confirmation/double-submit/failure tests | Manual cross-platform check |
| FR-014–017, SC-007/008 | Component accessibility assertions, lint/typecheck/export | Visual approval, accessibility and usability audits |
| FR-018–020, SC-006 | OpenAPI contract + environment gating tests | Timed quickstart exercise of read/protected mutation by a developer who did not implement the reference |
| FR-021–024, SC-009/010 | All CI checks plus mutation tests and the deliberate failure matrix | Branch protection evidence |
| FR-025 | Existing regression suites | Reviewer verification of unchanged role/language rules |

## Failure reporting

Each job/step must have a stable descriptive name, fail fast with the originating command, retain Jest/coverage artifacts when useful and avoid masking failures with unconditional success. A required failure marks the feature not ready; it must identify component, gate and actionable log rather than only a generic aggregate failure.
