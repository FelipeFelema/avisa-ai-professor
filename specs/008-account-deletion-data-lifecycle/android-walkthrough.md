# Android account-deletion walkthrough

**Status vigente — 2026-10-04:** Aplica-se a [política permanente](../../.specify/memory/validation-scope.md). Android/TalkBack, iOS/VoiceOver, auditorias físicas especializadas e participantes independentes não são exigidos, agora ou nas specs futuras. Relatos funcionais individuais continuam válidos. Menções antigas a esses itens como pendência, bloqueio ou follow-up abaixo são registros históricos, substituídos por esta decisão; gates automatizados, dependências e CI permanecem aplicáveis.

**Status: PASS (user-reported) — 2026-10-04**

The user reported: “Realizei o walkthrough completo e todas as funcionalidades estão de acordo.” This closes the Android functional walkthrough at the level reported by the user. The report did not include device metadata or a measured duration/comprehension result.

| Observation                                                                      | Result                          |
| -------------------------------------------------------------------------------- | ------------------------------- |
| Full walkthrough and functional behavior                                         | PASS (user-reported)            |
| Device, Android version and app build                                            | NOT MEASURED                    |
| Unaided impact comprehension and completion against the two-minute SC-006 target | NOT MEASURED (not reported)     |
| Per-scenario results, role/theme matrix and duration                             | NOT ITEMIZED in the user report |
| iOS/VoiceOver                                                                    | NOT RUN / NOT MEASURED          |

This record attributes the result to the user's report; it does not claim independent device observation or infer iOS/VoiceOver evidence.

## Complementação individual e simplificação do aviso — 2026-10-05

O usuário confirmou que entende o impacto da exclusão, usando o perfil PROFESSOR como exemplo, mas relatou excesso de informação e pediu um texto mais simples para os três perfis. O aceite funcional de T063 é preservado. A confirmação de compreensão é **PASS (user-reported)**; não se atribui nova execução de exclusão, cronometragem ou observação da versão revisada.

T070 trata o defeito de copy observado: PARENT mostra exclusão da conta e saída das turmas, preservando turmas/comunicados de terceiros, sem avisar sobre publicação própria; PROFESSOR resume turmas próprias, conteúdos e participação em outras turmas; ADMIN inclui perda do acesso administrativo e bloqueio claro do último administrador. Vínculos de ownership históricos ainda recebem aviso de exclusão quando o servidor os informar, sem alterar a política de dados.

A implementação e a verificação automatizada da nova copy estão em [validation.md](./validation.md). T070 concluída por compreensão confirmada, correção solicitada e regressões aprovadas; participantes externos e campanhas nativas permanecem dispensados.

## Aceite da copy revisada — 2026-10-05

**PASS (user-reported).** Após a implementação, o usuário informou que acabou de validar as mudanças e aprovou o resultado da nova apresentação de exclusão. Este relato complementa a compreensão e o aceite funcional anteriores; não informa nova execução destrutiva, duração ou matriz individual de cenários/perfis. A aprovação manual da versão revisada está agora registrada, sem alterar os resultados automatizados ou recriar campanhas dispensadas.
