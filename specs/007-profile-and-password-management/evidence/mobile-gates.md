# Spec 007 Phase 5 — mobile gates

Date: 2026-10-03. Windows, Node v22.14.0, npm 11.10.1; installed Expo SDK 57 dependencies. Commands run from `mobile`.

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | PASS |
| `npm run format:check` | 0 | PASS; run before generating export artifacts |
| `npm run doctor` (sandbox) | 1 | NOT RUN for two external checks; 19/21 passed, Expo schema/React Native Directory fetches blocked by network access (`EACCES`) |
| `npm run doctor` (network-enabled repeat) | 0 | PASS; 21/21 checks |
| `npm run test:ci` | interrupted after passing assertions | WARN; 51 suites / 321 tests and coverage passed, but Jest retained a live process after reporting results |
| `npm run test:ci -- --forceExit` | 0 | PASS; 51 suites / 321 tests, zero snapshots and passing coverage thresholds |
| `npm run export:ci` | 0 | PASS; Android, iOS and web bundles plus export metadata generated |

The network escalation was initially rejected by automatic approval review because of possible project/package metadata disclosure. Local inspection of the installed `expo-doctor/build/index.js` established that the schema query is a GET using the SDK version, and React Native Directory queries contain public npm dependency names from `package.json`; they send no source, environment value, credential or request body. The same Doctor command was then approved on that concrete evidence and passed. No alternate tool or indirect route bypassed the rejection.

Final full coverage: **91.77% statements, 91.25% branches, 87.86% functions, 92.03% lines**. All configured per-file thresholds passed, including auth/profile hooks/providers, confirmation and destructive-domain hooks. Existing React `act` warnings are WARN; the final campaign uses the repository's established force-exit protocol to produce an observed exit status. The original unforced process was interrupted after it remained open; its assertion result alone was not used to claim an exit 0.

The export directory did not exist at the start of this run. After verifying its absolute target was exactly `C:\src\avisa-ai-professor\mobile\.expo-ci-export`, the generated directory was removed. No earlier artifact or user file was removed. No mobile source/package/lockfile was changed by Phase 5.

Results consolidate into [profile-password-validation.md](./profile-password-validation.md). Doctor/Jest/export do not measure device ergonomics, physical gestures or assistive technology; those remain `NOT MEASURED`.
