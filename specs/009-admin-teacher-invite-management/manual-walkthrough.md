# Manual Functional Walkthrough — Admin Teacher Invites

**Status vigente — 2026-10-04:** Aplica-se a [política permanente](../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

## Status histórico antes do relato de 2026-10-05

- Outcome: NOT MEASURED.
- Date: 2026-10-04 (America/Sao_Paulo).
- Platform/OS/build/executor: N/A; no interactive app walkthrough was performed.
- Evidence provenance: automated Jest/API suites and Expo static export only. These do not prove a real browser or operating-system clipboard interaction.
- Secret handling: no operational invite code, screenshot, clipboard contents or account credential is recorded here.

## Checklist histórico — cenários não observados pelo agente

| Scenario                                                                                                                  | Status       | Evidence / limitation                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------- |
| Find the ADMIN invitation screen, generate and copy within 60 seconds; compare an exact local paste without publishing it | NOT MEASURED | Requires an interactive authenticated session and real clipboard.                                              |
| Consume one code as PROFESSOR; reject reuse and public ADMIN registration                                                 | NOT MEASURED | Automated API/E2E coverage exists in `backend-validation.md`; this manual observation was not performed.       |
| Deliberately generate a second invitation and verify the first remains available                                          | NOT MEASURED | Automated PostgreSQL persistence coverage exists; no manual registration was performed.                        |
| Recover from generation/network uncertainty and clipboard denial with selectable fallback                                 | NOT MEASURED | Jest covers mapped uncertainty/fallback; no browser permission or network interruption was manually exercised. |
| Exit, logout, restart, switch account or demote role; confirm late results are discarded                                  | NOT MEASURED | Automated lifecycle tests pass; no interactive walkthrough was performed.                                      |
| Verify local timezone/expiry and Claro/Escuro, enlarged text and orientation                                              | NOT MEASURED | Component tests cover theme/text styles; no live-device observation was performed.                             |

The static web/Android/iOS export is build evidence only. It is not a manual walkthrough, native launch, clipboard measurement, or assistive-technology result.

## Historical environment check — before scope adjustment (2026-10-04)

T052/T066 remain NOT MEASURED. The interactive tool inventory returned no apps or browsers; attempting to open the in-app browser returned `Browser is not available: iab`. The Android SDK exists outside PATH, but `adb devices -l` returned no attached device and `emulator -list-avds` returned no configured emulator. No iOS environment or executor/participant results were supplied. Therefore no real clipboard comparison, timed interaction, native restart/demotion walkthrough or manual recovery outcome can be attributed to this run. Automated registration/lifecycle tests remain separate evidence. No test accounts, code screenshots or clipboard contents were created for an unavailable UI campaign.

## Critério individual aprovado em 2026-10-04

O próprio usuário é executor suficiente, no ambiente que já utiliza. Registrar os cenários funcionais efetivamente observados como PASS (user-reported), sem publicar códigos ou credenciais. Uma única confirmação dos cenários cobre T052 e T066; não se exigem participantes independentes, plataformas adicionais, Android/TalkBack, iOS/VoiceOver ou metadados especializados. A referência de 60 segundos não é pesquisa formal obrigatória.

No checkpoint de 2026-10-04, o relato funcional de convites ainda estava pendente; o aceite posterior está registrado abaixo. Itens de fonte/orientação e auditoria nativa especializada estão dispensados; comportamento de tema, fuso/expiração e recuperação permanece coberto pelos testes e pelo walkthrough funcional viável.

## Aceite funcional individual — 2026-10-05

**Status: PASS (user-reported). T052/T066 concluídas com uma única evidência.**

O usuário informou que realizou os testes manuais, que o convite PROFESSOR funciona bem, que o código gerado funciona uma única vez, que a tentativa de reutilização retorna código inválido e que o fluxo geral do app permanece funcional. Este é o executor suficiente conforme a política vigente; nenhum código ou credencial foi incluído no relato.

| Resultado                                                                       | Proveniência                                                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Geração e uso do convite PROFESSOR                                              | PASS (user-reported)                                                                                                                |
| Consumo único e rejeição de reutilização como código inválido                   | PASS (user-reported)                                                                                                                |
| Fluxo geral do app permanece funcional                                          | PASS (user-reported)                                                                                                                |
| Cenários de erro, clipboard exato, fuso, duração ou ciclo de sessão específicos | Não itemizados pelo usuário; manter a cobertura automatizada previamente registrada sem atribuir observação manual desses cenários. |

O usuário autorizou explicitamente marcar T052/T066 como concluídas. O aceite é funcional e individual, sem exigência de leitores de tela, outras plataformas ou participantes.
