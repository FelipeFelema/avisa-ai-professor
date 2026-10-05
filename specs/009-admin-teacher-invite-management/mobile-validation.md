# Mobile Validation — Admin Teacher Invites

**Status vigente — 2026-10-04:** Aplica-se a [política permanente](../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

## Phase 3 — User Story 1

- Date: 2026-10-04 (America/Sao_Paulo).
- Scope: T021–T024 and T033–T037; clipboard and all later phases remain unstarted.
- Focused tests: PASS, 6 suites / 69 tests:
  - `tests/services/teacher-invite.service.spec.ts`
  - `tests/hooks/useTeacherInvite.spec.tsx`
  - `tests/routes/admin-teacher-invites.spec.tsx`
  - `tests/routes/profile.spec.tsx`
  - `tests/validations/teacherInvite.schema.spec.ts`
  - `tests/lib/api-session.spec.ts`
- Quality checks: PASS, `npm run typecheck`, ESLint on the Phase 3 implementation/tests, and Prettier check on those files.
- Service: sends only `{ role: 'PROFESSOR' }` with the current session generation, abort signal and `noAuthReplay`; validates/project safe response fields; timeout, cancellation, server and malformed outcomes are uncertain and never auto-replayed.
- Hook/lifecycle: synchronous generation lock; current-profile recheck on focus/resume; 401 expires only the matching session generation; 403 clears and reconciles. Late profile/POST responses are ignored, and local result/feedback clears on blur, background, logout, account/role change and unmount.
- Screen/profile: only ADMIN sees the Perfil action; the route redirects unauthenticated/non-ADMIN users, shows a selectable code and local timestamps, and presents fixed PROFESSOR/seven-day/one-use purpose with accessible busy and non-secret feedback states.
- Secret handling: automated fixtures use synthetic values; tests confirm no Axios error payload is retained and no invite appears in query/mutation cache. Clipboard is not implemented in Phase 3.
- Evidence limits: no Expo Doctor/export, CI provenance, native launch, clipboard, TalkBack, VoiceOver, physical device or manual walkthrough was performed. Those outcomes remain NOT MEASURED or are scheduled for later phases.

## Phase 4 — User Story 2

- Date: 2026-10-04 (America/Sao_Paulo).
- Focused automated validation: PASS, 4 suites / 52 tests covering `useTeacherInvite`, the ADMIN invitation route, session boundaries and the HTTP service. Tests assert exact-string copy, true/false/rejection, synchronous duplicate blocking, no extra request on copy, expired/pending/unauthorized guards, selectable fallback, explicit non-revoking generation, and theme/text scaling.
- Session/persistence validation: PASS. Late copy results are discarded on visit/account/role changes; logout/restart do not restore code or feedback; a pending deliberate generation does not restore after restart. Tests inspect AsyncStorage calls and React Query query/mutation caches in memory and assert there are no clipboard reads or automatic clipboard clears.
- Focused typecheck, ESLint and Prettier checks pass.
- Clipboard evidence limit: Jest uses an `expo-clipboard` mock. It proves client behavior and the exact string passed to the API, not an operating-system clipboard write, browser permission, or native behavior.

## Phase 5 — Audit and mobile gates

- Audit T049: the mobile API maps Axios status to fixed local messages and retains no response/config/request/cause. A caller-supplied synthetic `TeacherInviteError` message is not echoed by the feedback mapper. The hook has no logging, persistence, navigation parameters, or React Query mutation/query path for the invite; tests verify no secret in in-memory query/mutation caches or AsyncStorage calls.
- Typecheck, ESLint and Prettier: PASS (`npm run typecheck`, `npm run lint`, `npm run format:check`).
- Jest: 64 suites / 483 tests passed. The package command completed all assertions and printed `act(...)` and open-handle warnings but remained alive; the equivalent Jest invocation with `--forceExit --silent` exited 0 with the same 64/483 results. No assertion failed; retain the open-handle limitation.
- Follow-up diagnostic: `jest --ci --runInBand --coverage --detectOpenHandles` also passed all 64 suites / 483 tests, then remained alive without printing an identifying handle. It was interrupted after the completed summary; do not count it as a natural zero exit.
- Expo Doctor: the sandboxed attempt reached 19/21 checks, with two Expo API checks blocked by `EACCES`. The requested network-enabled read-only retry was approved and passed 21/21.
- Static export: PASS, `npm run export:ci`; web, Android and iOS bundles were produced. This does not prove native launch, clipboard operation, TalkBack, VoiceOver, or device layout.
- Provenance: these are local results. `Mobile CI / Run mobile checks` was not inspected and is not inferred from them.
- Manual and native measurements: NOT MEASURED; see `manual-walkthrough.md`, `android-accessibility.md` and `ios-accessibility.md`.

## Convergence — T051/T056 final validation (2026-10-04)

The original `npm run test:ci` now exits 0 naturally. No force-exit flag, coverage/threshold reduction, process-wide timer suppression or production-cache change was introduced.

### Cause and correction

The native Jest preset supplies `window`, which makes React Query use browser-style five-minute garbage-collection timers. Temporary instrumentation first identified timers in `theme-surfaces`, `auth-navigation-ux` and `private-session-boundaries`; process-level async resource tracing then located the remaining five-minute mutation timer in `private-session-effects`. Session tests intentionally clear caches while an observer is still mounted, so its later detach can schedule GC on an entry no longer reachable through the cache. Controlled pending mutations with zero GC also poll indefinitely when disposal races an unawaited unmount. Ordinary `--detectOpenHandles` had missed these paths.

- The shared render helper explicitly unmounts views, cancels queries and clears registered per-test clients after each test. Clients whose tests do not exercise timed collection use `gcTime: Infinity`, with explicit disposal; specialized classroom-cache helpers retain their realistic freshness/GC configuration.
- The two session-boundary suites use the same no-scheduled-GC test policy for intentionally detached entries. Their actual cache/session assertions remain unchanged.
- Classroom helper disposal destroys mutation GC resources before clearing the cache, and join/delete suites now await asynchronous RNTL unmount before disposing observers/cache.
- A real MutationObserver regression proves that disposal of a pending controlled mutation leaves zero timers even after advancing the test clock. Existing assertions remain intact. All temporary diagnostic scripts were removed.

Narrow checks passed with natural zero exit: the three initial affected suites (17 tests), join/delete/classroom helper suites (14 tests before the new regression), and `private-session-effects` (1 test). The final full gate includes the new regression.

| Final command          | Observed outcome                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | Exit 0.                                                                                                                                |
| `npm run lint`         | Exit 0.                                                                                                                                |
| `npm run format:check` | Exit 0.                                                                                                                                |
| `npm run test:ci`      | Natural exit 0; 64 suites / 484 tests; 89.78% statements, 83.74% branches, 91.53% functions, 91.34% lines; configured thresholds pass. |
| `npm run doctor`       | Sandbox attempt: 19/21, exit 1 because two external API checks hit EACCES. Approved network-enabled retry: exit 0, 21/21.              |
| `npm run export:ci`    | Exit 0; web, Android and iOS bundles generated.                                                                                        |

Existing non-failing React `act` warnings remain in test output; the final package command no longer prints the Jest non-exit warning. Assertions include profile, password, account deletion, auth/API-session, registration, theme, search, classroom and announcement regressions plus both invitation stories.

T051 and T056 are complete. T057 is partial: compatible fixes lowered the production audit from 61 to 58 entries; [dependency-audit.md](./dependency-audit.md) lists fixed versions, reach and unresolved roots. The audit still exits 1 and is not represented as a clean gate.

Provenance remains local working-tree validation. No `Mobile CI / Run mobile checks` or final-revision commit-convention run exists for these uncommitted changes; T069 remains open. Export proves bundling, not native launch, timed usability, clipboard permissions, TalkBack, VoiceOver or physical contrast/touch targets.

## Relato de CI e limite da revisão local — 2026-10-05

**PASS (user-reported)** para o funcionamento do CI nos PRs das specs 001–009, conforme relato explícito do usuário. O relato não trouxe URLs, IDs de execução, artefatos ou SHA de revisão; nenhum resultado por job específico é inventado. Os workflows locais Backend CI, Mobile CI e Commit Conventions continuam presentes e não foram alterados neste ajuste.

A nova copy de exclusão e a documentação deste fechamento estão no working tree, sem commit/push/PR. Portanto **T069 permanece aberta exclusivamente para vincular as execuções à revisão final quando ela existir no GitHub**. O relato confirma a confiança no CI existente e não é convertido em prova de execução do GitHub sobre essas alterações locais. Não é necessário refazer a implementação de CI; falta apenas a evidência correspondente à revisão final. Nenhum envio remoto é autorizado implicitamente.

## Revalidação após a copy de exclusão — 2026-10-05

Escopo: somente `mobile/app/(app)/profile/delete-account.tsx` e `mobile/tests/routes/profile-delete-account.spec.tsx`, além de registros de aceite/consolidação. Formulário, senha atual/frase exata, revisão antes da confirmação, bloqueios, uma única solicitação, sessão e tratamento de resultado incerto permanecem cobertos pelas regressões existentes.

| Comando                                                                                 | Resultado observado                                                                                                                                                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand --runTestsByPath tests/routes/profile-delete-account.spec.tsx` | Exit 0; 1 suite / 15 testes. O npm consumiu as flags e executou `jest tests/routes/profile-delete-account.spec.tsx`; a execução completa abaixo usa o comando original sem flags extras. |
| `npm run typecheck`                                                                     | Exit 0.                                                                                                                                                                                  |
| `npm run lint`                                                                          | Exit 0.                                                                                                                                                                                  |
| Prettier dos dois arquivos alterados                                                    | Exit 0; formatação aplicada.                                                                                                                                                             |
| `npm run test:ci`                                                                       | Exit 0 natural; 64 suites / 485 testes, sem forceExit. Cobertura: 89.78% statements, 83.74% branches, 91.53% functions, 91.34% lines; thresholds aprovados.                              |
| `npm run export:ci`                                                                     | Exit 0; web/Android/iOS gerados.                                                                                                                                                         |

Os warnings de `act` já conhecidos não falharam assertions ou o encerramento. O teste completo foi repetido uma vez para recuperar a coleta do exit status após uma falha na orquestração dos resultados; ambas as execuções tiveram 64 suites / 485 testes aprovados. Doctor não foi repetido porque configuração/dependências não mudaram neste ajuste; o resultado anterior 21/21 permanece identificado no checkpoint de 2026-10-04. Não há nova afirmação de execução nativa, de participante ou de CI remoto.

Fechamento documental: `npm run format:check` terminou com exit 0; as referências e os status foram conferidos na consolidação, com `git diff --check` aprovado.
