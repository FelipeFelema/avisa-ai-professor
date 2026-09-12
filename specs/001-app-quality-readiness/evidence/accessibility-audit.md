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

| Critério                 | Método                                                                                                                                                          | Resultado                                                                                                     | Limite da evidência                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Contraste AA             | `mobile/tests/theme/tokens.spec.ts`; pares semânticos de texto normal e scan de hex literal nas telas                                                           | `PASS` — `tokens.spec.ts`, 2 testes; o conjunto T052 completo teve 3 suítes/7 testes; pares exigem `>= 4,5:1` | Não substitui inspeção de contraste em estados renderizados com configurações reais de acessibilidade.   |
| Touch targets            | `mobile/tests/accessibility/touch-targets.spec.tsx`; `Button`, `ScreenState`, ação de `ClassroomCard` e `AuthRolePicker` comparados com iOS `44` e Android `48` | `PASS` — `touch-targets.spec.tsx`, 2 testes                                                                   | Chips de duração e campos adicionais foram conferidos estaticamente; medição física ainda não foi feita. |
| Semântica e estados      | `mobile/tests/routes/primary-states.spec.tsx`; roles, nomes, summary, header, loading/error/empty e card de comunicado                                          | `PASS` — `primary-states.spec.tsx`, 3 testes                                                                  | A suíte cobre representantes; a confirmação final de todas as combinações depende do uso manual.         |
| Tokens e card actions    | `rg` nos 16 arquivos de feature da Phase 7 e revisão de `ClassroomCard`                                                                                         | `PASS` — nenhuma cor hexadecimal local e nenhum `Pressable` aninhado no card                                  | O arquivo `mobile/src/theme/tokens.ts` contém, intencionalmente, os valores da fundação.                 |
| Texto ampliado/wrapping  | Revisão dos `ScrollView`, `flex`/`flexWrap`, campos e textos sem altura fixa nos fluxos migrados                                                                | `WARN` — estrutura preparada para wrapping                                                                    | Não houve snapshot/render em fonte ampliada no iOS/Android.                                              |
| Validação manual Android | Execução manual dos fluxos disponíveis no Android                                                                                                               | `PASS` — nenhum bloqueio crítico relatado                                                                     | Dispositivo/versão e cobertura iOS não estão disponíveis nesta entrega.                                  |
| Screen reader            | Revisão de `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` e `accessibilityState`; assertions RNTL do conjunto T052                              | `WARN` — sem issue crítica observável no código/teste                                                         | Não há evidência iOS; o resultado não é declarado cross-platform.                                        |

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

## Addendum da Phase 10 — reavaliação T073 após T072

**Data da reavaliação**: 2026-09-09 (America/Sao_Paulo)
**Status T073**: `BLOCKED`
**Escopo**: rechecagem dos fluxos primários de autenticação, turmas, perfil e
comunicados depois da migração dos seis literais de T072.

Este addendum complementa a auditoria histórica acima; não substitui nem amplia
a validação manual Android registrada em 2026-09-06. O export Expo de Web/iOS/
Android é somente empacotamento e não constitui inspeção visual ou uso de
VoiceOver/TalkBack.

### Evidência automatizada e estática atual

- Contraste/tokenização — `PASS` automatizado; `NOT MEASURED` renderizado. A
  suíte focada passou em 4 suítes/12 testes (tokens, touch targets, estados
  primários e `ConfirmationDialog`). O scan de `mobile/app/**/*.tsx` e
  `mobile/src/components/**/*.tsx` encontrou zero literal hexadecimal/RGB local;
  `AUTH_THEME` deriva dos tokens em `mobile/src/theme/auth.ts`. Isso não mede
  contraste dos estados efetivamente renderizados.
- Alvos de toque — `PASS` nas primitivas cobertas; `WARN` em controle fora da
  cobertura. `touch-targets.spec.tsx` verifica iOS `44` e Android `48` para
  `Button`, `ScreenState`, `ClassroomCard` e `AuthRolePicker`. `AuthButton`,
  `AuthField`, `FormField`, `AnnouncementCard` e os chips do editor também
  declaram piso de `48` em código. A medição física não foi feita.
- Semântica/screen reader — `PASS` automatizado/estático após correção;
  `NOT MEASURED` em leitor de tela real. A regressão
  `new-announcement-accessibility.spec.tsx` falhou primeiro pela ausência de
  labels, roles, estados e targets e passou em 1 suíte/3 testes após a correção.
  Os dois `TextInput`s agora possuem labels/hints; os chips expõem role, label,
  seleção, disabled e target mínimo de 48; a publicação expõe button,
  disabled/busy e target 48; erros de validação usam role `alert`. Nenhum issue
  crítico estático permanece nesse fluxo, mas VoiceOver/TalkBack real ainda não
  foi executado.
- Texto dinâmico/wrapping — `WARN`. Os fluxos usam `ScrollView` e os grupos de
  duração usam `flexWrap`; os formulários principais não fixam altura de texto.
  `AnnouncementCard` mantém `numberOfLines={3}`
  (`mobile/src/components/announcements/AnnouncementCard.tsx:93`), portanto não
  é possível afirmar ausência de truncamento sob fonte ampliada sem
  renderização real.
- Contraste/tamanho em dispositivo — `NOT MEASURED`. Não há captura, medição ou
  registro novo de iOS/Android nesta reavaliação. O histórico Android permanece
  limitado à execução manual individual e não prova contraste renderizado,
  fonte ampliada ou tamanho físico.

### Disponibilidade de runtime e decisão

As verificações somente leitura do host em 2026-09-09 retornaram
`adb=NOT_FOUND`, `emulator=NOT_FOUND` e `xcrun=NOT_FOUND`. A busca no repositório
encontrou apenas o registro histórico de validação Android e a indisponibilidade
de iOS; não há evidência de um dispositivo/simulador real cross-platform para
repetir os fluxos, VoiceOver/TalkBack, texto ampliado, contraste renderizado ou
medição física. Por isso T073 fica `BLOCKED` e SC-007 continua sem aprovação
cross-platform, embora o defeito estático encontrado nesta reavaliação já esteja
corrigido e protegido por regressão automatizada.

### Gates executados nesta reavaliação

- `PASS`: suíte focada inicial (4 suítes/12 testes) e regressão adicional da
  criação de comunicado (1 suíte/3 testes); o conjunto relacionado com tokens,
  targets e estados passou em 4 suítes/11 testes após o fix.
- `PASS`: `npm run typecheck` e `npm run lint` em `mobile`.
- `PASS`: `npm run format:check` após a remoção do diretório de export
  descartável `.expo-ci-export`; nenhum arquivo-fonte ficou fora de formato.
- `PASS`: scan de diff (`git diff --check`) após este addendum, condicionado à
  execução final pelo coordenador no worktree compartilhado.

## Addendum de escopo — fechamento T073 (2026-09-09)

**Status:** `COMPLETED FOR ANDROID-ONLY INITIAL RELEASE; iOS DEFERRED`.

O responsável pelo produto confirmou que o primeiro lançamento será somente
Android. Portanto, T073 foi fechada com a cobertura disponível para esse
lançamento: a suíte mobile completa passou em 29 suítes/83 testes, incluindo os
testes de tokens, touch targets, estados, `ConfirmationDialog` e a regressão da
criação de comunicado; typecheck, lint, Prettier, Expo Doctor (21/21) e export
também passaram. O walkthrough Android informado pelo responsável não encontrou
issue crítica conhecida.

O export Web/iOS/Android é evidência de empacotamento, não de uso humano. A
auditoria iOS, VoiceOver, contraste renderizado, medição física e fonte ampliada
em iOS continuam fora desta iteração. Assim, o escopo Android inicial é aceito
com limitações, mas SC-007 não é apresentado como aprovação cross-platform e o
follow-up iOS permanece explícito.
