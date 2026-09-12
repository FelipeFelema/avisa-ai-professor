# Mobile Interaction Contract

## Architectural boundary

The implementation must preserve the existing mobile layers:

```text
Expo Router screen
  → reusable component / React Hook Form controller
  → domain hook (React Query mutation/query)
  → domain service (Axios only)
  → /api/v1

AuthProvider owns the authenticated profile.
Secure Store owns only access/refresh tokens.
React Query owns remote lists/details and invalidation.
```

Screens may coordinate confirmation, navigation and feedback, but they must not construct raw Axios requests, duplicate cache keys or embed reusable validation/business rules.

## Routes and ownership

| Route | Purpose | Required state/action |
|---|---|---|
| `/(app)/(tabs)/profile` | Read current account | Shows name, email, read-only role and “Editar perfil”. |
| `/(app)/profile/edit` | Edit own name/email | React Hook Form + Zod; diff; confirmation; preserves values on cancel/failure. |
| `/(app)/(tabs)/classrooms` | List joined/available classrooms | Uses `ownerId` to show “Excluir” to owner and “Sair” to non-owner; join remains unconfirmed. |
| `/(app)/classrooms/[id]` | Classroom announcements/actions | Resolves name/ownership from `my-classrooms`; owner-only delete; safe not-found exit. |
| `/(app)/announcements/[id]` | Read/manage one announcement | Author-only update/delete; both use shared confirmation behavior. |
| `/(app)/announcements/[id]/edit` | Edit announcement | Preserve existing WIP; validate, diff/summary and confirm before PATCH. |

`mobile/app/(app)/classrooms/[id]/edit.tsx` is an obsolete duplicate of the announcement editor. It may be removed only after the correct WIP route above has been consolidated and tested.

## Typed client contracts

### Auth/profile

- `UserRole = 'PARENT' | 'PROFESSOR' | 'ADMIN'`.
- `AuthUser` contains `id`, `name`, `email`, `role` and optional server timestamps if consumed.
- `UpdateProfileRequest` contains only optional `name` and `email`, with at least one property after diffing.
- `authService.updateProfile(request)` calls `PATCH /users/profile` and returns `AuthUser`; an effective email change keeps the request's server-side `sid` active and revokes every other session.
- `AuthProvider.applyProfileUpdate(user)` replaces the current profile without persisting it separately; `expireSession()` clears tokens, query cache and context when the backend returns `401` for a revoked session.

### Classroom

- `ClassroomSummary` adds `ownerId`.
- `teacher` is the actual owner projection, not the first professor membership.
- `classroomService.deleteClassroom(id)` calls `DELETE /classrooms/{id}` and expects `204` both for the first owner deletion and for a repeated owner request recognized by the deletion receipt.
- `useDeleteClassroom` owns mutation state and classroom/announcement invalidation; the screen/controller navigates only after success.

### Query keys

Use factories rather than literal arrays in screens/hooks:

- `authKeys.profile()`
- `classroomKeys.my()`
- `classroomKeys.available(search?)`
- `classroomKeys.detail(id)` if introduced later
- `announcementKeys.all()`
- `announcementKeys.byClassroom(classroomId)`
- `announcementKeys.detail(id)`

No new `GET /classrooms/{id}` is required in this increment; direct classroom navigation may load `my-classrooms` and select by id. A missing item after refresh is a not-found state.

## Confirmation matrix

| User action | Trigger | Summary required | Confirm label | On cancel | On failure | On success |
|---|---|---|---|---|---|---|
| Update profile | Valid changed fields | “Nome: before → after” and/or “E-mail: before → after” | `Salvar alterações` | Keep form values; no PATCH | Keep form/dialog; field-level 409 on email or Portuguese recovery message | Apply returned user to AuthContext; invalidate identity-bearing queries; return to profile with success feedback |
| Delete owned classroom | `user.id === ownerId` | Classroom name; participants and announcements will be removed permanently; irreversible | `Excluir turma` | No DELETE | Stay in context; 403/404/network message and allow a newly confirmed explicit retry after an ambiguous network result | Invalidate classroom/announcement queries; `router.replace('/classrooms')`; same behavior for first or repeated owner `204` |
| Leave classroom | User is member and not owner | Classroom name; membership/access will be removed | `Sair da turma` | No POST | Stay in list/detail; recovery message | Invalidate joined/available/announcement queries; safe list state |
| Update announcement | Author and valid changed values | Announcement title and changed fields | `Atualizar comunicado` | Keep editor values; no PATCH | Keep editor/dialog and values | Invalidate detail/list/classroom summary; navigate back only after invalidation |
| Delete announcement | Author | Announcement title; irreversible | `Excluir comunicado` | No DELETE | Stay on detail; recovery message | Invalidate detail/list/classroom summary; navigate back |

Create classroom, create announcement, join classroom, navigation and sign-out are outside the update/delete confirmation requirement.

## Confirmation component contract

`ConfirmationDialog` must support:

- `visible`, title, target label, structured summary rows/consequences;
- `variant: 'neutral' | 'destructive'`;
- cancel and confirm labels/callbacks;
- `pending` and optional `errorMessage`;
- Android `onRequestClose` mapped to cancel when not pending;
- `accessibilityViewIsModal`, meaningful heading/labels, focus containment/restoration where supported;
- confirm control with `accessibilityState={{ disabled, busy }}`;
- destructive communication by wording and icon in addition to color.

The controller must set a synchronous in-flight guard before awaiting the mutation. A second tap while in flight is ignored. All React Query mutations default to `retry: false`; after an ambiguous timeout/network result, a user retry is a new explicit confirmation. A repeated classroom DELETE that receives the receipt-backed `204` follows the normal success path rather than displaying a false error.

## Form and validation contract

### Profile

- Initialize from current `AuthUser`.
- Name: trim, 3–100 chars, accented letters/spaces/hyphen/apostrophe only.
- Email: trim, lowercase, valid, max 255.
- Role: rendered read-only and never included in payload.
- Only changed normalized fields are sent.
- No effective changes: show “Nenhuma alteração para salvar”, do not open dialog and do not call service.
- HTTP `409`: attach “Este e-mail já está em uso.” to email field.
- Other failures: preserve inputs and show a Portuguese recovery message.

### Announcement update

- Reuse the existing Zod limits: title 3–120, content 3–2000 and duration `1|3|7|15|30`.
- Confirmation opens only after validation and must identify what changes.
- The correct route is `announcements/[id]/edit`.

## Cache and session synchronization

### Profile success

1. Accept the public profile returned by PATCH.
2. Replace `AuthContext.user` immediately.
3. Re-render the two direct current-account identity displays—the profile and the home greeting through `HomeHeader`—within two seconds; any additional direct display found during implementation joins this inventory and its route test.
4. Invalidate data that embeds names (`my-classrooms`, available classrooms, announcement lists/details).
5. Do not write the profile to Secure Store.
6. Keep the current JWT pair and server-side `sid`; the backend resolves current profile data from the active session/user and revokes every other `sid` only when email effectively changed.

Another device whose session was revoked receives `401` on its next protected access or refresh. The Axios/auth bridge must then clear Secure Store, React Query cache and `AuthContext` together and replace the route with login. Name-only and normalized no-op updates leave other sessions active.

If refresh fails and Axios clears tokens, it must also notify the auth provider/session boundary so UI state cannot remain authenticated with no credentials.

### Classroom delete success

1. Remove/cancel relevant classroom and announcement queries.
2. Invalidate joined and available lists.
3. Replace route with `/classrooms` so Back cannot return to deleted content.

If another participant is viewing a deleted classroom, the next read receiving `404` renders not-found and offers a safe route to the classroom list. A DELETE `404` means the classroom is absent without a receipt matching the current owner and is not globally converted into success by the mobile client.

## Error mapping

| Status/condition | User behavior |
|---|---|
| `400` validation | Prefer field-level message when field is known; keep values. |
| `401` | Trigger session-expired flow, clear tokens/cache/context and route to login. |
| `403` | “Você não tem permissão para realizar esta ação.” Keep context. |
| `404` classroom/announcement read, or DELETE without matching owner receipt | Explicit not-found state and safe navigation; never crash or render stale success. A matching repeated owner DELETE is represented by backend `204`, not client-side `404` remapping. |
| `409` duplicate email | Field error on email. |
| `409` owner leave | Explain that the owner must delete the classroom instead. |
| timeout/offline/5xx | “Não foi possível concluir. Verifique sua conexão e tente novamente.” Keep context and require new confirmation before retry. |

## Visual foundation contract

The approved direction is an evolution of the existing green/neutral identity. Runtime tokens and `mobile/docs/visual-foundation.md` must cover:

- semantic colors: background, surface, primary, text, muted, border, info, success, warning, danger and on-color variants;
- WCAG 2.2 AA target of 4.5:1 for normal text and 3:1 for large text/meaningful UI boundaries where applicable;
- typography sizes with line-height and weight roles;
- spacing, radius and elevation scales;
- minimum interactive target of 44×44 points on iOS and 48×48 density-independent pixels on Android (44×44 logical units on web/fallback);
- button variants primary/secondary/ghost/destructive and default/pressed/disabled/busy states;
- field default/focus/error/disabled states and helper/error text;
- screen loading/empty/error/success/not-found patterns with next action;
- destructive controls identified by label/icon and placement, never color alone;
- Portuguese content tested for wrapping and dynamic text sizes.

Literal `#DC2626`/`#FFF` values in feature screens must be replaced with semantic tokens. `ClassroomCard` must not nest one actionable `Pressable` inside another; card navigation and its action are sibling affordances.

## Required automated behavior scenarios

- Cancel every confirmation and assert zero service calls.
- Double-tap confirm and assert exactly one request.
- After an ambiguous classroom deletion response, an explicit reconfirmed retry that receives `204` invalidates caches and returns to the classroom list without a false error.
- Pending state disables controls and exposes busy semantics.
- Profile no-op sends no request; success synchronizes context; `409` maps to email.
- Classroom delete is visible only to owner; non-owner has leave; owner leave is unavailable.
- Classroom delete 403/404/offline preserves context; success replaces route and invalidates caches.
- Announcement update/delete share the dialog and preserve editor/detail state on failure.
- Loading, empty, error and not-found render meaningful accessible content.
- Two-session profile scenario: email change keeps the current session/profile active, while a `401` on the revoked device clears Secure Store, query cache and AuthContext together.
- Platform target helpers/components enforce 44×44 on iOS and 48×48 on Android; the audited color matrix meets WCAG 2.2 AA.
