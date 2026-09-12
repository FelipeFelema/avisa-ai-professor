# Fechamento da Phase 7 — limitações aceitas

**Data da decisão**: 2026-09-06
**Status da implementação**: `CLOSED WITH LIMITATIONS`
**Escopo**: T052–T058

## Decisão

A Phase 7 é encerrada para esta entrega com a evidência disponível e com as
limitações abaixo aceitas pelo responsável pelo produto. Este fechamento não
declara que os critérios estatísticos de usabilidade ou a cobertura iOS foram
validados; ele registra que não há outra validação disponível neste ambiente e
que os riscos residuais foram explicitamente aceitos.

## Evidência concluída

- T052–T056: testes automatizados e migração dos fluxos primários para tokens,
  primitivas compartilhadas e estados acessíveis.
- T057: auditoria automatizada/estática e validação manual disponível no Android.
- T058: teste manual individual ponta a ponta dos fluxos de registro, login,
  criação de sala, comunicados, edição de perfil, edição de comunicados,
  exclusão de sala e entrada de usuário em sala.

## Limitações aceitas

### Acessibilidade

- A validação manual foi realizada no Android.
- Não há dispositivo ou ambiente iOS disponível para esta entrega; portanto,
  nenhuma afirmação de cobertura cross-platform completa é feita.
- SC-007 permanece uma cobertura parcial: os resultados automatizados e o teste
  Android não substituem a confirmação iOS.

### Usabilidade

- O teste individual confirmou a execução funcional dos fluxos listados.
- Não houve amostra independente de professores/responsáveis, assistência
  registrada, medição populacional de tempo ou registro estatístico de primeira
  tentativa.
- SC-002, SC-003 e SC-008 permanecem `NOT MEASURED`; o teste individual não é
  apresentado como evidência estatística desses critérios.

## Disposição

T057 e T058 são marcadas como concluídas no escopo rebaselined desta entrega:
as evidências disponíveis foram executadas e as limitações foram registradas.
Os critérios originais que exigem iOS ou participantes continuam declarados
como não medidos, e podem ser revisitados em uma entrega com esses recursos.

A Phase 7 está encerrada operacionalmente, mas a decisão final de readiness da
feature deve preservar esses riscos residuais e os gates das phases posteriores.

## Addendum da Phase 10 — T073 (2026-09-09)

O recheck após T072 confirmou os resultados automatizados de tokens, estados,
semântica representativa e alvos das primitivas: 4 suítes/12 testes focados
passaram, além de typecheck, lint e Prettier nos arquivos rastreados. O scan das
telas e componentes não encontrou literais de cor locais; a nova paleta de tab
bar e backdrop está em tokens semânticos.

Este recheck também encontrou um ponto aberto no fluxo de criação de comunicado:
`TextInput`s sem rótulo explícito, chips sem role/label/estado/target e publicação
sem semântica de busy. O defeito foi corrigido na própria Phase 10: a tela agora
expõe labels/hints, seleção, disabled/busy, alerts de validação e targets de
48×48, protegidos por uma nova regressão com 1 suíte/3 testes. Assim, nenhum
issue crítico estático conhecido permanece nesse fluxo.

Não foi possível completar a parte cross-platform de T073: no host,
`adb=NOT_FOUND`, `emulator=NOT_FOUND` e `xcrun=NOT_FOUND`; não existe evidência
nova de dispositivo/simulador real, VoiceOver/TalkBack, fonte ampliada,
contraste renderizado ou medição física. O walkthrough Android de 2026-09-06 e
o empacotamento Expo não substituem essa prova. Assim, o status desta tarefa é
`BLOCKED` exclusivamente pela evidência real cross-platform ainda ausente,
SC-007 permanece parcial/`NOT MEASURED` para essa dimensão e o fechamento
histórico `CLOSED WITH LIMITATIONS` da Phase 7 é preservado.

## Addendum de escopo — T073 (2026-09-09)

O lançamento inicial foi rebaselined para Android-only. A implementação e os
gates automatizados disponíveis foram revalidados; a auditoria iOS não será
inventada nem tratada como requisito de lançamento desta iteração. T073 fica
concluída no escopo Android inicial, enquanto a cobertura iOS e a conclusão
cross-platform de SC-007 permanecem `NOT MEASURED` para follow-up futuro.
