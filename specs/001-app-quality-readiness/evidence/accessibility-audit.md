# Auditoria de acessibilidade — Phase 7

Data da validação: 2026-09-06 (America/Sao_Paulo)
Escopo: T052–T057; somente os fluxos mobile de autenticação, turmas, perfil e comunicados.

## Resultado

Resultado: `ACCEPTED WITH LIMITATIONS`.

Os checks automatizados, a revisão estática e a validação manual disponível no
Android não encontraram issue crítica nas telas migradas. Não há dispositivo ou
ambiente iOS disponível nesta entrega; portanto, SC-007 não é declarado como
aprovado cross-platform. A limitação foi aceita e está registrada em
`evidence/phase-7-closure.md`.

## Matriz automatizada e estática

| Critério                | Método                                                                                                                                                          | Resultado                                                                                                     | Limite da evidência                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Contraste AA            | `mobile/tests/theme/tokens.spec.ts`; pares semânticos de texto normal e scan de hex literal nas telas                                                           | `PASS` — `tokens.spec.ts`, 2 testes; o conjunto T052 completo teve 3 suítes/7 testes; pares exigem `>= 4,5:1` | Não substitui inspeção de contraste em estados renderizados com configurações reais de acessibilidade.   |
| Touch targets           | `mobile/tests/accessibility/touch-targets.spec.tsx`; `Button`, `ScreenState`, ação de `ClassroomCard` e `AuthRolePicker` comparados com iOS `44` e Android `48` | `PASS` — `touch-targets.spec.tsx`, 2 testes                                                                   | Chips de duração e campos adicionais foram conferidos estaticamente; medição física ainda não foi feita. |
| Semântica e estados     | `mobile/tests/routes/primary-states.spec.tsx`; roles, nomes, summary, header, loading/error/empty e card de comunicado                                          | `PASS` — `primary-states.spec.tsx`, 3 testes                                                                  | A suíte cobre representantes; a confirmação final de todas as combinações depende do uso manual.         |
| Tokens e card actions   | `rg` nos 16 arquivos de feature da Phase 7 e revisão de `ClassroomCard`                                                                                         | `PASS` — nenhuma cor hexadecimal local e nenhum `Pressable` aninhado no card                                  | O arquivo `mobile/src/theme/tokens.ts` contém, intencionalmente, os valores da fundação.                 |
| Texto ampliado/wrapping | Revisão dos `ScrollView`, `flex`/`flexWrap`, campos e textos sem altura fixa nos fluxos migrados                                                                | `WARN` — estrutura preparada para wrapping                                                                    | Não houve snapshot/render em fonte ampliada no iOS/Android.                                              |
| Validação manual Android | Execução manual dos fluxos disponíveis no Android                                                                                                               | `PASS` — nenhum bloqueio crítico relatado                                                                     | Dispositivo/versão e cobertura iOS não estão disponíveis nesta entrega.                                  |
| Screen reader           | Revisão de `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` e `accessibilityState`; assertions RNTL do conjunto T052                              | `WARN` — sem issue crítica observável no código/teste                                                         | Não há evidência iOS; o resultado não é declarado cross-platform.                                       |

## Gates mobile relacionados

| Comando                                | Resultado                                                                                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm --prefix mobile run test:ci`      | `PASS` — 28 suítes, 63 testes                                                                                                            |
| `npm --prefix mobile run typecheck`    | `PASS`                                                                                                                                   |
| `npm --prefix mobile run lint`         | `PASS`                                                                                                                                   |
| `npm --prefix mobile run format:check` | `PASS`                                                                                                                                   |
| `git diff --check`                     | `PASS` — exit 0; Git apenas reportou avisos de normalização LF/CRLF                                                                      |
| `npm --prefix mobile run doctor`       | `WARN` — 19/21; schema Expo falhou com `fetch failed`/`connect EACCES` e o diretório React Native falhou com resposta externa inesperada |

A suíte mobile ainda imprime avisos históricos de `act(...)` em hooks de mutation;
eles não alteraram o exit code nem produziram falha de comportamento.

## Limitação humana aceita

A validação manual disponível foi realizada no Android. A ausência de iOS nesta
entrega impede uma conclusão cross-platform de SC-007, mas não impede o fechamento
documental da Phase 7 com limitação aceita. Uma futura entrega pode repetir os
fluxos em iOS, registrar dispositivo/versão, tamanho de fonte, contraste observado,
tamanho dos alvos e qualquer issue por severidade.

## Limite de fase

Não foram executados export bundle, workflows CI, backend ou checks de branch. Eles
pertencem à Phase 8 e posteriores.
