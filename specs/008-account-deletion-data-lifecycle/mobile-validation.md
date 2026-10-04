# Mobile validation — 2026-10-04

## T062 automated gates

Commands ran from `mobile`.

| Command                                                     | Result                                                                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                         | Exit 0; TypeScript completed without errors.                                                                                     |
| `npm run lint`                                              | Exit 0; ESLint completed without errors or warnings.                                                                             |
| `npm run format:check`                                      | Exit 0; all matched files use Prettier formatting.                                                                               |
| `npx jest --ci --runInBand --coverage --forceExit --silent` | Exit 0; 60 suites / 414 tests; 89.05% statements, 83.43% branches, 90.79% functions, 90.58% lines; configured thresholds passed. |
| `npm run doctor` with network access                        | Exit 0; 21/21 checks passed.                                                                                                     |
| `npm run export:ci`                                         | Exit 0; Android, iOS and web bundles exported.                                                                                   |

The standard `npm run test:ci` first exposed branch-coverage shortfalls in `AuthProvider` and `useDeleteClassroom`; its initial run was 60 suites / 408 tests and exited 1. Regression tests were added for late login/registration responses, stale profile/session callbacks, storage failure and a session change during classroom-query cancellation. The two targeted suites passed 22/22, and the complete suite then passed 60/60 and 414/414 with coverage thresholds met. Jest emitted existing React `act` warnings and did not close all asynchronous handles on its own, so the final run used `--forceExit` after every assertion and coverage threshold passed.

The first Doctor run was blocked from its Expo API/React Native Directory checks by sandbox `EACCES` network errors and reported 19/21. The network-enabled retry passed all 21 checks. Export emitted the expected no-bytecode and terminal color warnings; it completed successfully.

## T059 privacy and regression audit

- Account deletion uses one imperative DELETE with replay disabled. The mobile service sends only the two contract fields and returns allowlisted feedback without Axios request/config/response/cause objects or submitted values. Session verification is a separate read-only request.
- The hook drops its transient request object after submission; it does not use a TanStack mutation for the deletion request. Route tests inspect empty QueryCache/MutationCache state, error feedback and field clearing. Storage/provider tests cover both token-removal attempts, private cache cleanup, retryable cleanup failure and retention of `theme-preference`.
- The full suite includes profile, profile-edit, password-change, logout/session, theme, classroom, announcement and deletion-route regressions. These automated tests establish component behavior only; they are not Android, iOS, screen-reader or visual observations.

## Evidence boundary

Expo Doctor and export validate project metadata and bundle generation. They do not prove a native app launch, Android navigation/restart behavior, keyboard/font-scale layout, visual contrast, TalkBack, VoiceOver or timed comprehension. See [android-walkthrough.md](./android-walkthrough.md) and [accessibility-validation.md](./accessibility-validation.md); both remain `NOT MEASURED` because an Android device bridge was unavailable.
