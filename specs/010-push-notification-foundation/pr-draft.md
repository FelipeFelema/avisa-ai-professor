# PR draft — Spec 010

Publication authorized on 2026-10-06 from `010-push-notification-foundation` to `develop`. T073 is complete; T074 remains open until actual Backend CI and Mobile CI pass. Spec 011 stays in its existing stash and contributes no files to this PR.

## Title

feat(push): add explicit device opt-in and authenticated test notifications

## Description

Users can enable notifications explicitly from Profile → Notifications and send a neutral test to their current eligible installation. Opening the app does not request permission automatically. Backend acceptance, provider handoff and observed notification display remain separate outcomes; an uncertain send is not replayed automatically.

### Changes

- Add installation capabilities, session/account-bound registrations, versioned lifecycle transitions, token rotation, opt-out/logout reconciliation and account-deletion cascade with isolation/concurrency coverage.
- Add authenticated Expo push dispatch, persistent single-flight/cooldown and restart-safe receipt processing. Test requests cannot select recipients; public responses and logs exclude private tokens/capabilities/provider IDs. No announcement or other business notification rules are implemented.
- Accept both an individual Expo ticket and a one-ticket array, retaining strict response validation and no automatic retry. Add regression tests for successful/error/malformed individual tickets and safe diagnostics.
- Add the mobile consent/settings flow, guarded SDK loading, permission reconciliation, foreground presentation deduplication and navigation on test-notification taps.
- Prevent push HTTP responses, including 429s, from triggering their own reconciliation loop. Preserve rate limits, single-flight and test cooldown; cover foreground return with the real API/provider/lifecycle stack.
- Move existing app configuration to `app.config.ts`; add Android preview APK configuration, EAS-provided Google Services file support and storage backup exclusions. Private FCM/service-account and backend access credentials stay outside source and bundle.
- Align the five Expo SDK patches: Expo 57.0.27, Constants 57.0.21, Linking 57.0.12, Notifications 57.0.22 and Router 57.0.25, with a synchronized lockfile. Constants remains within the existing root range `~57.0.15`.
- Extend the canonical OpenAPI contract and regression suites. Fix Jest dynamic imports through a test-only transform without changing production PushProvider behavior.

### Validation

- **Real Android push: PASS (user-reported).** The owner installed the second corrected preview APK and confirmed explicit activation, stable ACTIVE state without the 429 loop, one neutral foreground notification, notification observed after minimizing, return to Notifications by tapping, cooldown, persistent opt-out, logout/login and readable light/dark themes. Expo accepted the foreground attempt and its separately queried receipt returned `ok`.
- The exact background transition and activation duration were not measured. The second APK's ID/URL was not supplied. This physical walkthrough preceded the five SDK patch updates; the updated dependencies have automated validation and are not attributed to a newly built or physically retested APK.
- **All final local gates: PASS**, rerun on 2026-10-06 after the adapter correction and five Expo patches. Backend: Prisma validate/generate/migrate deploy, format/lint/typecheck/build; 26 suites / 318 unit tests with coverage, 19 / 176 integration, 1 / 9 contract and 6 / 70 e2e. Branch coverage 60.99%, above the configured threshold.
- Mobile: typecheck/lint/format; 82 suites / 591 tests with coverage; **Expo Doctor 21/21**, no excluded checks; Android/iOS/web export. Test processes exited naturally with code 0, without `forceExit` or increased timeouts. Destructive PostgreSQL checks used only guarded loopback `avisa_ai_test`.
- Runtime/configuration and tracked-file privacy review passed. No private credentials/environment files are included. Local validation did not run `npm ci`; actual clean-install validation belongs to remote CI.

### Dependency security decision

The owner accepted the documented triage for Spec 010 and required remediation in the future **Spec 012**. Audit is not green: production audit reports 63 affected dependency entries (15 moderate, 47 high, 1 critical); full audit reports 67 (15 moderate, 51 high, 1 critical).

- Critical `shell-quote@1.9.0` is **DEV/TOOLING ONLY** in the analyzed dependency usage and absent from the inspected production Android bundle. Remediation remains mandatory in Spec 012; this is not a claim that the installed APK binary was audited.
- Moderate `decode-uri-component@0.2.2` is present in the Android bundle, with malformed URI/query denial-of-service risk. Remediation/review is mandatory in Spec 012; no complete mitigation is claimed.
- Remaining dependency/tooling advisories are recorded for the full Spec 012 audit. No `npm audit fix` or `--force` was applied in Spec 010, and no Spec 012 implementation is included.

### Remote merge gates

Backend CI and Mobile CI are pending publication. T074 remains open until their actual results are recorded. Local PASS does not substitute for GitHub checks; merge must wait for green required checks.

### Review notes

Migration `20261005130000_push_notification_foundation` is additive. Operational recovery disables push and preserves the new tables; no destructive rollback is required. Android local preview needs the phone and backend on the same LAN. Storage backup exclusions also affect restoration of existing AsyncStorage preferences, including theme; existing theme/session behavior is covered by regression tests.

References: [final validation](final-validation.md), [follow-up evidence](validation-follow-up-2026-10-06.md), [physical walkthrough](walkthrough-t073.md), [closing checklist](closeout-checklist.md), [Git scope review](git-scope-review.md).
