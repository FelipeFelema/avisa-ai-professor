<!--
Sync Impact Report
- Version change: unratified scaffold -> 1.0.0
- Modified principles:
  - PRINCIPLE_1_NAME -> I. Domain-Modular Architecture
  - PRINCIPLE_2_NAME -> II. Secure, Explicit API Contracts
  - PRINCIPLE_3_NAME -> III. Testable Delivery
  - PRINCIPLE_4_NAME -> IV. Data Integrity and Safe Evolution
  - PRINCIPLE_5_NAME -> V. Predictable and Accessible User Experience
- Added sections: Technical & Product Constraints; Development Workflow & Quality Gates.
- Removed sections: none; scaffold placeholders and example comments were replaced.
- Follow-up TODOs: none. The constitution is ratified from the current repository baseline.
-->

# Avisa Aí Professor Constitution

## Core Principles

### I. Domain-Modular Architecture

The backend MUST keep business capabilities organized by domain modules, with
controllers responsible for transport, services responsible for application rules,
DTOs responsible for input contracts, and Prisma isolated behind the persistence
module. The current domains are `auth`, `users`, `classrooms`, `announcements`,
`invites-code`, and `prisma`. The mobile application MUST preserve the separation
between Expo Router screens and the existing `components`, `hooks`, `providers`,
`services`, `validations`, `types`, `config`, `storage`, and `theme` layers. New
cross-domain coupling MUST be explicit and justified in the feature plan.

Rationale: domain boundaries keep the API and mobile client understandable as the
product grows and make changes independently testable.

### II. Secure, Explicit API Contracts

All API endpoints MUST use the versioned REST base `/api/v1`. Every external input
MUST be validated at the boundary: backend DTOs MUST use `class-validator` with the
global whitelist and non-whitelisted-field rejection enabled, and mobile forms MUST
use the existing Zod validation layer. Authentication and authorization MUST be
enforced on the server with JWT guards, role guards, and ownership checks where
required; client-side visibility MUST NOT be treated as authorization. Passwords and
refresh tokens MUST never be stored in plaintext, secrets MUST come from environment
configuration, and changes to protected endpoints MUST include authorization tests.

Rationale: explicit contracts and defense-in-depth protect accounts and classroom
content while making failures predictable for both clients.

### III. Testable Delivery

Every backend behavior change MUST add or update unit tests in the affected module.
Changes involving persistence, authentication, authorization, or API contracts MUST
also include the relevant integration or end-to-end coverage. Mobile behavior changes
MUST pass TypeScript checking, ESLint, Prettier validation, and Expo Doctor; business
logic and validation MUST remain in testable hooks, services, or schemas rather than
being embedded unnecessarily in screens. A change is not complete while the relevant
CI checks are failing.

Rationale: layered tests catch regressions at the boundary where they are cheapest to
diagnose, while the mobile quality gates cover the currently supported client tooling.

### IV. Data Integrity and Safe Evolution

The Prisma schema and committed migrations MUST be the source of truth for PostgreSQL
structure. Database changes MUST be delivered through a reviewed migration and MUST
preserve existing data unless an explicit migration plan documents the transformation,
impact, and recovery strategy. Relationships, uniqueness, ownership, expiration, and
cascade behavior MUST be represented in the schema and covered by integration tests
when they affect user-visible behavior. CI MUST generate the Prisma client and apply
migrations before running backend validation.

Rationale: classroom membership, ownership, and announcement visibility are shared
invariants; enforcing them in the database and tested application paths prevents data
drift between the API and mobile client.

### V. Predictable and Accessible User Experience

Every user-facing flow MUST define loading, error, empty, and success behavior where
the operation can produce those states. Forms MUST provide clear validation feedback
and preserve the product's Portuguese user-facing language. Interactive mobile
controls MUST expose appropriate accessibility semantics, and reusable components and
theme tokens MUST be preferred when an existing project primitive covers the need.
Role-based actions MAY be hidden or disabled in the client for clarity, but the API
MUST remain the final authority for access decisions.

Rationale: teachers and parents depend on clear classroom and announcement states;
consistent feedback and accessibility reduce avoidable errors without duplicating
security rules in the client.

## Technical & Product Constraints

- The backend baseline is Node.js 22+, TypeScript, NestJS, Prisma, and PostgreSQL 15+.
  The mobile baseline is TypeScript, React Native, Expo SDK 57, and Expo Router.
  New dependencies MUST address a documented need and MUST keep the corresponding
  lockfile synchronized.
- The API MUST retain URI versioning and the `/api/v1` prefix. Changes to response
  shapes, validation rules, authentication flows, or role permissions MUST be called
  out as contract changes in the feature artifacts and covered by tests.
- The supported roles are `PARENT`, `PROFESSOR`, and `ADMIN`. Privileged registration
  MUST continue to use the invite-code flow, and mutations MUST enforce the relevant
  role, author, classroom owner, or administrator rule on the backend.
- Environment files and examples MUST contain configuration placeholders only. Real
  credentials, access tokens, refresh tokens, and database secrets MUST NOT be
  committed, logged, or embedded in application source.
- Local PostgreSQL development MUST remain reproducible through the repository's
  Docker Compose configuration. CI and integration tests MUST use an isolated test
  database and committed migrations rather than relying on an undeclared local state.
- Active announcements, classroom membership, account identity, and session validity
  are product invariants. A feature that changes one of these concepts MUST document
  its effect on both backend rules and mobile presentation.

## Development Workflow & Quality Gates

- Non-trivial work MUST follow the Spec Kit artifact flow: clarify the requirement in
  `spec.md`, record the technical approach in `plan.md`, derive dependency-ordered
  work in `tasks.md`, and implement only after the acceptance criteria and compliance
  implications are explicit.
- Each feature artifact MUST identify affected domains, API or data-contract changes,
  authorization implications, migration needs, and the tests that demonstrate the
  acceptance criteria. Deviations from this constitution MUST be recorded with a
  reason and a follow-up plan.
- Backend changes MUST pass `npm run format:check`, `npm run lint`, unit tests with
  coverage, integration tests, and `npm run build`. Mobile changes MUST pass
  `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npx expo-doctor`.
  The relevant GitHub Actions workflow is the merge gate for each component.
- A database migration MUST be generated and verified together with the backend
  change. API and mobile contract changes MUST be validated together whenever the
  affected client flow is available in the repository.
- A delivery is complete only when the implementation, tests, migrations, user-facing
  states, and documentation affected by the change are consistent with the approved
  feature artifacts and all applicable quality gates pass.

## Governance

This constitution is the project's highest-level engineering agreement. Feature
specifications, plans, tasks, code reviews, and implementation decisions MUST comply
with it. When a lower-level document conflicts with this constitution, the conflict
MUST be resolved in favor of the constitution or explicitly amended before work is
accepted.

Amendments MUST update this file through a reviewed change that includes a Sync Impact
Report, a concrete rationale, the affected principles or sections, and any required
migration or adoption work. The amendment MUST update `Last Amended` and leave no
unexplained placeholder. Compliance MUST be checked during feature planning and again
before delivery; exceptions MUST be documented with scope, owner, reason, expiration,
and follow-up work.

The constitution follows Semantic Versioning:

- MAJOR increments for removing or redefining a principle in a backward-incompatible
  way.
- MINOR increments for adding a principle or materially expanding governance.
- PATCH increments for clarifications, wording changes, and non-semantic corrections.

The project constitution is reviewed whenever the architecture, security model, data
model, supported clients, or delivery gates materially change. Each review MUST verify
that the principles remain testable against the repository's actual commands, workflows,
and source structure.

**Version**: 1.0.0 | **Ratified**: 2026-08-22 | **Last Amended**: 2026-08-22
