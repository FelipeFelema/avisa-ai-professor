# Data Model: Consolidação de Experiência e Qualidade

## Scope and persistence decision

Esta feature preserva `User`, `Classroom`, `UserClassroom`, `Announcement` e `InviteCode` e adiciona duas entidades operacionais em PostgreSQL: `AuthSession`, necessária para manter a sessão atual e revogar as demais, e `ClassroomDeletionReceipt`, necessária para reconhecer com segurança a repetição da exclusão pelo mesmo owner. Uma migration transforma o refresh token legado e cria os receipts; confirmações, descrições OpenAPI, fundação visual e resultados de gates continuam fora do banco de produto.

```text
User (owner) 1 ─────── * Classroom
User          * ─────── * Classroom   via UserClassroom
User (author) 1 ─────── * Announcement
User          1 ─────── * AuthSession
Classroom     1 ─────── * Announcement

Classroom delete ──cascade──> UserClassroom, Announcement
Classroom delete ──records───> ClassroomDeletionReceipt (ids + timestamp only)
```

## Persistent entities

### User

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key; immutable; JWT `sub` and self-service identity. |
| `name` | string | 3–100 chars after trim; only letters (including accents), spaces, hyphen and apostrophe; preserve case/internal spacing. |
| `email` | string | Valid email, max 255; trim + lowercase before lookup/write; unique. |
| `password` | string | Existing bcrypt hash; never returned; not editable by this feature. |
| `role` | `PARENT \| PROFESSOR \| ADMIN` | Existing role; immutable in profile flow. |
| `createdAt` / `updatedAt` | datetime | Server-managed. No-op update must not change `updatedAt`. |

**Relationships**:

- Owns zero or more classrooms through `Classroom.ownerId`.
- Participates in zero or more classrooms through `UserClassroom`.
- Authors zero or more announcements.
- Owns zero or more device sessions through `AuthSession.userId`.

**Profile invariants**:

- Only the authenticated `sub` can update its profile.
- Request accepts only `name` and/or `email`; empty payload or effective no-change is rejected by mobile, while the server returns current data without a write for a normalized no-op.
- `password`, `role`, `id` and unknown fields receive `400` through whitelist enforcement.
- Duplicate normalized email receives `409`; the database unique constraint is the final race-safe authority.
- Profile response contains `id`, `name`, `email`, `role`, `createdAt`, `updatedAt` only.
- A protected request resolves the current user and active `AuthSession` from `sub` and `sid`; stale JWT identity claims are not the authority for current profile data.
- A name-only update or normalized no-op does not revoke sessions.
- An effective email update and revocation of every session except the request's current `sid` occur atomically.

### AuthSession

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key and JWT `sid`; immutable. |
| `userId` | UUID string | Required FK to `User`; indexed; `ON DELETE CASCADE`. |
| `refreshTokenHash` | string | Hash of only this session's current refresh token; never exposed. |
| `expiresAt` | datetime | Upper bound for refresh; an expired session is invalid. |
| `revokedAt` | nullable datetime | Non-null means both access and refresh attempts receive `401`. |
| `createdAt` / `updatedAt` | datetime | Server-managed; refresh rotation updates only this session. |

**Invariants**:

- Access and refresh JWTs contain matching required `sub` and `sid` claims.
- Login/register create a separate active session; refresh rotates only the matching session hash.
- Every protected request validates signature/expiry and loads an active `(sid, userId)` plus current user data.
- An email update keeps the initiating `sid` active and marks every other active session for that user revoked in the same transaction as the profile write.
- A revoked, expired, missing or user-mismatched session receives `401` on both access and refresh.
- The migration creates an `AuthSession` for each non-null legacy `refreshTokenId`/`refreshTokenHash` pair before removing those fields from `User`, using the migration timestamp plus the seven-day refresh TTL as the database upper bound while JWT `exp` remains authoritative; a legacy access token without `sid` must refresh through the migrated record or sign in again.

### Classroom

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key. |
| `name` | string | 3–80 chars; existing normalization trims and uppercases. |
| `ownerId` | UUID string | Required FK to exactly one professor; immutable while classroom exists. |
| `createdAt` / `updatedAt` | datetime | Server-managed. |

**Relationships**:

- Exactly one owner via `ClassroomOwner` relation.
- Zero or more memberships via `UserClassroom`.
- Zero or more announcements.

**Invariants**:

- Owner is created as a member in the same create operation.
- Only the owner professor may delete.
- Owner cannot leave; the supported terminal action is deleting the classroom.
- Mobile visibility derives from explicit `ownerId`, never from role alone or the first professor membership.
- Deletion is terminal and cascades memberships and announcements through database FKs.
- First and repeated DELETE attempts by the owner return `204`, produce at most one physical deletion and never a `500` caused by `P2025`.
- A non-owner receives `403` while the classroom exists; after deletion, an actor without the matching receipt receives `404` without learning the original owner.

### ClassroomDeletionReceipt

Operational idempotency tombstone; it is not a recoverable classroom and stores no name, membership or announcement content.

| Field | Type | Rules |
|---|---|---|
| `classroomId` | UUID string | Primary key copied from the permanently deleted classroom; no FK to `Classroom`. |
| `ownerId` | UUID string | Original owner identifier used only to authorize the repeated DELETE; no FK that could block account evolution. |
| `deletedAt` | datetime | Server timestamp for the successful terminal transition. |

**Invariants**:

- Receipt creation and classroom deletion occur in one transaction; rollback leaves neither a false receipt nor a partial cascade.
- A missing classroom with a receipt owned by the current user returns `204`; missing receipt or different owner returns `404`.
- Concurrent owner requests converge on one receipt and one physical deletion while both return `204`.
- The receipt never enables restoration and retains no classroom name, memberships or announcements.
- The minimal receipt remains durable so the same owner's repeated DELETE continues to receive `204`; changing its retention is a future API-contract change.

### UserClassroom

| Field | Type | Rules |
|---|---|---|
| `userId` | UUID string | FK to `User`; part of composite PK. |
| `classroomId` | UUID string | FK to `Classroom`; part of composite PK; `ON DELETE CASCADE`. |

**Invariants**:

- A user has at most one membership per classroom.
- A classroom owner must retain membership while the classroom is active.
- Non-owner membership may transition to left after explicit confirmation.
- Classroom deletion removes memberships atomically.

### Announcement

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key. |
| `title` | string | 3–120 chars. |
| `content` | string | 3–2000 chars. |
| `expiresAt` | datetime | Derived from allowed duration `1, 3, 7, 15, 30` days. |
| `authorId` | UUID string | Required author; existing author-only update/delete. |
| `classroomId` | UUID string | Required classroom; `ON DELETE CASCADE`. |
| `createdAt` / `updatedAt` | datetime | Server-managed. |

**Invariants**:

- Visible only to classroom members while active.
- Update/delete remains restricted to author professor under existing membership rules.
- Update/delete requires mobile confirmation but server authorization is final.
- Classroom deletion makes the announcement inaccessible through cascade.

### InviteCode

Unchanged by this feature. It remains part of the externally documented API because admin registration is an existing supported operation.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key. |
| `code` | string | Unique, generated by server, never embedded in examples as a real secret. |
| `role` | `PROFESSOR \| ADMIN` | PARENT invite is invalid. |
| `isActive` | boolean | Single-use state. |
| `expiresAt` | datetime | Must be in the future when redeemed. |

## Transient and design entities

### ProfileChangeSet

Not persisted. Built from normalized form values and the current `AuthUser`.

| Field | Type | Rules |
|---|---|---|
| `name` | optional string | Present only when normalized value differs. |
| `email` | optional string | Present only when normalized value differs. |
| `diff` | array of `{label, before, after}` | Drives accessible confirmation summary. |

An empty change set never opens confirmation and never sends PATCH.

### ConfirmationDecision

Not persisted. Owned by the initiating mobile screen/controller.

| Field | Type | Rules |
|---|---|---|
| `action` | `update \| delete \| leave` | Determines wording and success handling. |
| `targetType` | `profile \| classroom \| announcement \| membership` | Audit/test discriminator. |
| `targetId` | optional UUID | Omitted for profile; never used as authorization proof. |
| `targetLabel` | string | Human-readable Portuguese name/title. |
| `summary` | string or diff rows | Changed values or destructive/cascading consequences. |
| `variant` | `neutral \| destructive` | Destructive is signaled by wording/icon plus color. |
| `status` | state enum | See lifecycle below. |
| `errorMessage` | optional string | Portuguese recovery message; no false success. |

### API operation description

Generated from Nest metadata and DTO classes, not persisted. Every operation has `operationId`, tag, purpose, parameters/body schema, success response, relevant error responses, Bearer security where protected and textual role/ownership/author requirements. The expected design inventory is [contracts/openapi.json](./contracts/openapi.json).

### VisualFoundation

Versioned as source/docs, not persisted. It contains semantic color roles, WCAG 2.2 AA contrast, typography and line-heights, spacing, shape, elevation, icon usage, minimum targets of 44×44 points on iOS and 48×48 density-independent pixels on Android, component variants/states, content language and accessibility rules. Runtime consumers import tokens from `mobile/src/theme`; acceptance reviewers use `mobile/docs/visual-foundation.md`.

### QualityGateResult

Produced by CI or manual review, not stored in the product database.

| Field | Type | Rules |
|---|---|---|
| `component` | `backend \| mobile \| repository \| external` | Ownership of result. |
| `gate` | string | Stable check name. |
| `status` | `queued \| running \| pass \| fail \| skipped` | `skipped` allowed only when documented as non-applicable. |
| `evidence` | URL/log/artifact reference | Must identify command/scenario and actionable failure. |
| `required` | boolean | Required `fail` prevents readiness/merge. |

## State transitions

### Confirmed mobile mutation

```text
editing/ready
  ├─ invalid or no-op ──────────────> editing/ready (no request)
  └─ valid ─────────────────────────> awaiting_confirmation
       ├─ cancel/dismiss ───────────> editing/ready (no request)
       └─ confirm ──────────────────> pending (single-flight, controls disabled)
            ├─ success ─────────────> succeeded → cache/context sync → navigation/feedback
            └─ failure ─────────────> failed → context preserved
                                           └─ explicit retry after new confirmation
                                                ├─ same completed classroom DELETE → 204 → success path
                                                └─ operation not completed → normal result
```

While `pending`, further confirm taps are ignored synchronously. Mutations do not retry automatically.

### Classroom lifecycle

```text
ACTIVE_OWNER_MEMBER
  ├─ owner leave attempt ───────────> ACTIVE_OWNER_MEMBER (409, unchanged)
  ├─ non-owner leave confirmed ─────> ACTIVE_WITHOUT_THAT_MEMBERSHIP
  └─ owner delete confirmed ────────> DELETED
                                         ├─ memberships deleted by FK cascade
                                         ├─ announcements deleted by FK cascade
                                         └─ deletion receipt recorded

DELETED + matching owner DELETE ────> DELETED (204, no-op success)
```

Clients viewing a deleted classroom transition to an explicit not-found state and replace/back out to the classroom list.

### Profile update

```text
CURRENT_PROFILE
  ├─ invalid/duplicate ─────────────> CURRENT_PROFILE + field/recovery error
  ├─ normalized no-op ──────────────> CURRENT_PROFILE (no write)
  └─ valid confirmed PATCH ─────────> UPDATED_PROFILE
                                         ├─ AuthContext replaced immediately
                                         ├─ dependent query data invalidated
                                         ├─ current AuthSession remains active
                                         ├─ if email changed: every other AuthSession revoked
                                         └─ if name-only: other AuthSessions remain active
```

### Auth session lifecycle

```text
ACTIVE
  ├─ matching refresh ──────────────> ACTIVE (hash rotated, same sid)
  ├─ email changed from another sid > REVOKED
  ├─ explicit/session failure ──────> REVOKED
  └─ expiresAt or JWT exp reached ──> EXPIRED

REVOKED or EXPIRED + access/refresh ─> 401
```

### OpenAPI availability

```text
development/test + API_DOCS_ENABLED != false → UI + JSON available
production                                  → UI + JSON unavailable
```

### Quality gate lifecycle

`queued → running → pass|fail`. A required failure terminates readiness. Repository workflows provide technical evidence; rulesets/branch protection turn their checks into merge blockers; visual/accessibility/usability evidence remains a separate manual/external gate. Missing enforcement evidence is itself a blocking failure, not an optional follow-up.

## Schema and migration impact

- **Prisma schema delta**: add `AuthSession` and `ClassroomDeletionReceipt`; add `User.sessions`; remove `User.refreshTokenHash` and `User.refreshTokenId` only after migration of non-null pairs.
- **New migration**: required. Create both tables/indexes/FKs, backfill one `AuthSession` per legacy refresh pair using the existing token id as `sid` and migration time + seven days as `expiresAt`, then remove the legacy columns. JWT `exp` can only shorten that bound. Classroom cascades remain unchanged.
- **Required verification**: `prisma validate`, migration up/down recovery review, `prisma migrate deploy` on an isolated database populated with representative legacy users, integration tests for session migration/revocation/refresh and receipt transaction/retry/cascade, plus an environment audit for the historical required `ownerId` migration before production rollout.
