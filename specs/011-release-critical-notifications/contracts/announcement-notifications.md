# Contracts: Announcement Notifications

P0 + P1 implementation contract, updated on 2026-10-07. No new public send endpoint, token registry or arbitrary recipient input.

## Existing REST publication and detail

| Operation                          | Preserved contract                                                                                     | Notification effect                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST `/api/v1/announcements`       | JWT + PROFESSOR + classroom membership; existing validation/limits; 201 with existing Announcement DTO | New internal marker when business notifications enabled. No provider/queue status in the response; post-save notification failure does not alter 201. |
| PATCH `/api/v1/announcements/:id`  | Existing author/member/expiry checks and DTO                                                           | No second NEW event. P1 uses only the current expiry; stale pending occurrences are suppressed and the same expiry value is never repeated.           |
| DELETE `/api/v1/announcements/:id` | Existing authorization, 204                                                                            | Cascade queued ledger; no later authorization for deleted resource.                                                                                   |
| GET `/api/v1/announcements/:id`    | JWT, current classroom membership and current expiry; 200 DTO or existing 404, normal 401 behavior     | A push ID is only a destination hint; no notification credential bypasses these checks.                                                               |

Client cannot provide recipient IDs, installation IDs, push tokens, event states or recovery marker. Whitelist/non-whitelisted rejection stays enabled. Backend serializers never expose new private fields. Update shared canonical OpenAPI in `specs/001-app-quality-readiness/contracts/openapi.json` only for truthful descriptions if necessary; no invented endpoint/response change.

## Internal event and adapter boundary

- Event NEW is derived only from a saved Announcement with pending marker; EXPIRING only from optional due selector. All recipients are queried server-side from the event's actual classroom.
- Fanout unique key `(announcementId, kind, occurrenceKey)`; dispatch key `(eventId, installationId)`; reprocessing is a no-op for a materialized event.
- Preselect before parent locks, then lock all selected Users before Classroom and other parents; only surviving preselected bindings enter the atomic snapshot. No new recipient discovery after locking. Finalization/receipts touching binding plus ledger use the same business order, including implicit FK locks.
- Extend ExpoPushAdapter with typed business message input; preserve current push-test entry point, authentication headers, response bounds and safe error mapping. No separate Expo/FCM client.
- Private adapter arguments may include current token, but private values never cross to public REST, logs, URLs, telemetry or artifacts. HTTP is called only after committed SENDING; no automatic submission retry.
- Sending uses `Novo comunicado • {nome da turma}` with announcement title as body. Reminder uses `Comunicado próximo da expiração • {nome da turma}` / `{título do comunicado} expira em breve.`. Current metadata comes only from the final authorized server-side snapshot, never client input or the earlier claim. Blank/missing name falls back to `Sua turma`; blank/missing title falls back to `Novo comunicado disponível` or `Um comunicado expira em breve.`. Whitespace normalized; name/title bounded to existing domain limits (80/120 characters). No full announcement body, personal data or additional context.
- `channelId='push-test'` reuses the existing Android channel named “Notificações”; sound default. TTL bounded to `min(3600, floor(seconds until current expiresAt))`, suppress at <1. No new native configuration/dependency required by this contract.

## Closed business payload

| Field          | Constraint                                                        |
| -------------- | ----------------------------------------------------------------- |
| version        | integer literal `1`                                               |
| type           | literal `announcement-created`; P1 admits `announcement-expiring` |
| announcementId | UUID v4 string identifying existing resource; never authorization |
| dispatchId     | UUID v4 string for dedupe; never capability                       |

`data` has no token, capability, userId, sessionId, membership proof, classroom name/id, announcement title/body, arbitrary URL/route or provider ticket. Only visible title/body permit classroom name and announcement title. Parser rejects malformed values and unexpected business fields. Keep the existing `push-test` payload/attemptId contract unchanged; unknown types are ignored without permission prompts or reconciliation.

## Presentation and tap state

| State/input                                  | Required behavior                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Known business notification in foreground    | Contextual banner/list/sound consistent with current preferences; receive dedupe 128 entries; no spontaneous navigation.                                                              |
| Live response or initial last SDK response   | Validate payload; independent tap dedupe 128 entries; clear consumed native response.                                                                                              |
| Auth/router restoring                        | One memory-only pending intent, five-minute TTL; wait for readiness.                                                                                                               |
| Anonymous cold-start intent                  | Can be adopted once by first authenticated session; fetch with that account's normal authorization.                                                                                |
| Logout/identity change or stale callback     | Cancel pending/in-flight intent and erase old detail cache; discard old session generation.                                                                                        |
| Valid tap                                    | Suppress/remove prior detail cache, perform fresh normal findOne with captured generation and no automatic tap retry, then seed current cache and navigate only after current 200. |
| 404 after lost membership/exclusion/expiry   | Clear old content and present existing Portuguese unavailable state; no stale detail.                                                                                              |
| Transient network/backend error              | Loading→actionable retry/cancel without old protected content. Retry is explicit and generation guarded.                                                                           |
| Invalid type/ID/extra URL/duplicate callback | Ignore safely; no arbitrary route, transport or authorization bypass.                                                                                                              |

Only internal destination `/(app)/announcements/[id]` is allowed. Route uses fresh-authorization gate for notification intent even if mounted previously. Basic semantics/themes and existing session cleanup remain intact. Push-test taps continue to Profile → Notifications.

## Operational flags and safe diagnostics

`ANNOUNCEMENT_PUSH_ENABLED=false` and `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false` are backend-only non-secret booleans. Business sends also require the existing authenticated 010 transport to be available. Neither creates a mobile public secret or a second access token. No credentials are changed by this delivery.

Diagnostics may report category, safe outcome code and aggregate counts; do not print tokens, capabilities, private fingerprints, provider IDs, recipient identities or school content. Use synthetic fixture IDs only in tests. Persistence/send/receipt/display outcomes remain distinct. P1 disabled creates no new EXPIRING events and submits no pending reminder dispatches; existing tombstones remain. NEW continues independently.

Reminder occurrences use `expiration:<current expiresAt milliseconds>`; NEW uses `publication`. Both keys stay private. Final authorization compares current expiry to the original occurrence, then checks membership, original eligible binding and TTL. A changed expiry may have one new occurrence, but returning to an earlier value never recreates it. Already committed SENDING cannot be retracted; full content remains behind normal GET authorization.

The test endpoint/infrastructure remains available for authorized diagnostics. The mobile action and its feedback render only under `__DEV__` or `extra.pushDiagnosticsEnabled === true`; app.config sets that boolean only for EAS preview/development profiles, overwriting inherited values and defaulting false for production/absent/unknown profiles. This presentation gate changes neither backend authorization nor opt-in/logout.
