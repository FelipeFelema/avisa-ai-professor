# PR draft — Spec 010

Draft only. No PR created; T073/T074 remain open. Update validation evidence and unresolved gates before requesting review/merge. The previous Spec 011 draft was removed from this branch; no Spec 011 files belong in this PR.

## Title

feat(push): add explicit device opt-in and authenticated test notifications

## Description

Users can enable notifications explicitly from Profile → Notifications and send a neutral test to their current eligible installation. Opening the app does not request permission automatically. Backend acceptance, provider handoff and observed notification display remain separate outcomes; an uncertain send is not replayed automatically.

### Changes

- Add installation capabilities, session/account-bound registrations, versioned lifecycle transitions, token rotation, opt-out/logout reconciliation and account-deletion cascade with isolation/concurrency coverage.
- Add authenticated Expo push dispatch, persistent single-flight/cooldown and restart-safe receipt processing. Test requests cannot select recipients; public responses and logs exclude private tokens/capabilities/provider IDs. No announcement or other business notification rules are implemented.
- Add the mobile consent/settings flow, guarded SDK loading, permission reconciliation, foreground presentation deduplication and navigation on test-notification taps.
- Preserve existing app configuration while moving to `app.config.ts`; add Android preview APK configuration, EAS-provided Google Services file support and storage backup exclusions. Local preview uses the configured LAN API; private FCM/service-account and backend access credentials stay outside source and bundle.
- Extend the canonical OpenAPI contract and regression suites. Fix Jest dynamic imports through a test-only transform without changing production PushProvider behavior or adding dependencies.
- Prevent push HTTP responses, including 429s, from triggering their own reconciliation loop. Keep the existing rate limits, single-flight and test cooldown; add a regression covering foreground return with the real API/provider/lifecycle stack.

### Validation recorded so far

- Backend local checkpoint (2026-10-05): Prisma validation/generation/migrations on isolated `avisa_ai_test`, format/lint/typecheck/build and coverage passed; 26 suites / 301 unit tests, 19 suites / 176 integration tests, 1 suite / 9 contract tests and 6 suites / 70 e2e tests. Branch coverage 60.12%, meeting the configured gate. These are historical local results, not a new final run or remote CI.
- Mobile follow-up (2026-10-06): 81 suites / 585 tests with coverage, natural exit 0; typecheck/lint passed. The four PushProvider failures were reproduced as a Jest/Node dynamic-import harness failure and resolved only in test configuration. An initial separate timeout was investigated and the full gate passed on repeat; see the evidence document.
- Provisioning: EAS preview file variable and FCM V1 confirmed, Enhanced Push Security enabled, private backend configuration present, additive migration applied to local `avisa_ai`, PushModule startup/configuration available. Android LAN health check: PASS (user-reported). This does not prove push delivery.
- Submitted build archive was inspected for excluded private credentials/environment files and secret matches. Runtime/dependency files remained unchanged during the subsequent harness/documentation work.

### Open gates

- A physical walkthrough exposed a reconciliation feedback loop after returning from Android settings. The mobile fix passed the full local gate (82 suites / 591 tests); a new APK and physical retest are required. See [429 diagnosis](walkthrough-t073-429-diagnosis.md). The owner has manually submitted the second preview build; its APK and physical retest are pending.
- The first preview build finished but its installed APK failed the settings-return scenario. The second preview build result and individual push retest are pending; T073/T074 are not complete.
- Expo Doctor: 20/21; SDK patch alignment check reports five packages. No dependency upgrade or check suppression was performed while this build is pending.
- Final local gates and FR/SC evidence consolidation must follow the walkthrough. Backend CI/Mobile CI have not run remotely for this work.

### Review notes

Migration `20261005130000_push_notification_foundation` is additive. Operational recovery disables push and preserves the new tables; no destructive rollback is required. Android local preview needs the phone and backend on the same LAN. Storage backup exclusions also affect restoration of existing AsyncStorage preferences, including theme; existing theme/session behavior is covered by regression tests.

References: [final validation](final-validation.md), [follow-up evidence](validation-follow-up-2026-10-06.md), [closing checklist and commands](closeout-checklist.md), [Git scope review](git-scope-review.md).
