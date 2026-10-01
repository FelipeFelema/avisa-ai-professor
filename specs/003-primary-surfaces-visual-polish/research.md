# Research: Primary Surfaces Visual Polish

**Data**: 2026-09-26

**Escopo**: resolver as decisões técnicas da spec 003 sem implementar o
comportamento.

## 1. Baseline observado no repositório

O mobile é um aplicativo Expo Router/React Native com TypeScript, TanStack
React Query, `@expo/vector-icons`, Jest e React Native Testing Library. As
rotas primárias são:

- `mobile/app/(app)/(tabs)/index.tsx` para Home;
- `mobile/app/(app)/(tabs)/classrooms.tsx` para Turmas.

As duas rotas usam `useMyClassrooms` e `ClassroomCard`. Turmas também usa
`useAvailableClassrooms(search)`, as mutations de entrar/sair/excluir e a
comparação explícita de `ownerId` para escolher a ação destrutiva. O
`ClassroomCard` já mantém o conteúdo de abrir turma em um `Pressable` separado
do botão de ação, o que permite ajustar layout sem tornar o card inteiro uma
ação ambígua.

Home renderiza o cumprimento e o título através de `HomeHeader`, mas descarta
erro e refetch da query e retorna vazio enquanto carrega. Turmas já possui os
blocos funcionais na ordem introdução, busca, minhas turmas e turmas
disponíveis; a hierarquia é atualmente apenas uma sequência de `View`,
`Text` e componentes de estado.

O tipo mobile `ClassroomSummary` e o DTO backend
`LastAnnouncementSummaryDto` contêm `id`, `title` e `createdAt`, mas não
`expiresAt`. Já o Prisma `Announcement` persiste `expiresAt`, e as duas
queries do `ClassroomsService` filtram `expiresAt >= new Date()`, ordenam por
`createdAt desc`, limitam a um registro e projetam os demais campos do resumo.
Logo, o dado necessário existe na fonte correta e falta apenas atravessar o
contrato de resumo.

Os tokens de `mobile/src/theme/tokens.ts` e as regras de
`mobile/docs/visual-foundation.md` já definem cores, tipografia, espaçamento,
contraste, estados e alvos de toque. Nenhuma dependência de design ou de
calendário está instalada ou é necessária.

## 2. Decisão: extensão mínima do resumo de comunicado

**Decision**: adicionar `expiresAt` como `date-time` obrigatório dentro de
`LastAnnouncementSummary` quando `lastAnnouncement` não for nulo. Atualizar a
projeção `select` e o mapeamento de retorno nas duas listagens (`findMy` e
`findAvailable`), o DTO, o tipo TypeScript mobile e o contrato OpenAPI
canônico.

**Rationale**:

- FR-009 exige que a Home tenha o momento de expiração sem mudar qual anúncio
  é selecionado ou quem pode vê-lo.
- O filtro de anúncio ativo e a ordenação já estão no módulo `classrooms`,
  portanto a mudança preserva a regra atual e evita uma segunda requisição ao
  detalhe de comunicado.
- É uma alteração aditiva e explícita de contrato, coberta pelo teste de
  serviço, pela integração das listagens e pelo teste executável de OpenAPI.
- `expiresAt` não muda persistência, ownership, autorização, invalidation ou
  semântica da busca.

**Alternatives considered**:

- **Buscar o detalhe de cada comunicado na Home**: rejeitado por adicionar
  N+1 requisições, latência e uma nova dependência entre telas.
- **Calcular o prazo no backend e retornar texto pronto**: rejeitado porque
  mistura localidade/apresentação no contrato e não permite recalcular o dia
  local durante uma sessão.
- **Alterar o endpoint de detalhe ou criar endpoint novo**: rejeitado; o
  resumo existente já é consumido pelas duas superfícies e é suficiente.
- **Alterar o schema Prisma**: rejeitado; `Announcement.expiresAt` já é a
  fonte persistida.

## 3. Decisão: dias de calendário na localidade do aparelho

**Decision**: criar uma função pura `getClassroomAnnouncementExpirationLabel`
em `mobile/src/lib/classroom-expiration.ts`. Ela receberá `expiresAt` e um
`now` opcional para testes. A função:

1. interpreta o timestamp ISO recebido pela API;
2. retorna `null` para timestamp inválido, anúncio ausente ou instante já
   expirado;
3. converte `now` e `expiresAt` para seus componentes de ano/mês/dia locais e
   compara essas tuplas como datas UTC, evitando que horário de verão altere a
   diferença de calendário;
4. limita qualquer diferença inferior a zero a zero;
5. retorna exatamente `Expira hoje`, `Expira em 1 dia` ou `Expira em X dias`.

O componente chama a função somente quando existe título de comunicado e
passa o resultado como indicador secundário. Se o cache permanecer aberto
após o instante de expiração, o indicador desaparece no próximo render em vez
de mostrar número negativo; a query continua sendo a autoridade para qual
comunicado ativo foi entregue.

**Rationale**:

- A spec mede data de calendário, não horas restantes.
- Usar `Date#getFullYear`, `getMonth` e `getDate` respeita a localidade do
  aparelho sem precisar de biblioteca ou de locale hard-coded para cálculo.
- O parâmetro `now` torna os casos hoje/amanhã/vários dias e a borda de
  expiração determinísticos em Jest.

**Alternatives considered**:

- **Dividir milissegundos restantes por 24 horas**: rejeitado; horários
  diferentes e transições de DST produziriam rótulos errados para o mesmo dia
  civil.
- **Usar `Math.ceil` sobre horas restantes**: rejeitado; um comunicado que
  vence amanhã cedo poderia virar dois dias dependendo do horário atual.
- **Retornar o texto do servidor**: rejeitado; a localidade e o instante de
  renderização pertencem à apresentação mobile.
- **Mostrar prazo negativo ou número de horas**: rejeitado explicitamente por
  FR-008.

## 4. Decisão: um card compartilhado, com variações de contexto

**Decision**: manter `ClassroomCard` como o ponto único de identidade visual.
Adicionar uma prop opcional para o momento de expiração e um bloco textual
secundário derivado. A Home passa o `expiresAt`; Turmas continua passando os
mesmos dados e ações existentes. Nome, professor, comunicado e ação seguem a
mesma ordem básica; a variação de prazo é habilitada apenas no contexto em
que a spec a exige.

O conteúdo de abrir turma permanece um `Pressable` próprio. A ação de entrar,
sair ou excluir continua em `Button` fora desse `Pressable`, com `ownerId`
determinando a ação e sem depender somente de cor. O card não receberá
`numberOfLines` nem altura fixa; títulos e nomes poderão quebrar linha, e o
botão ficará em uma área própria abaixo do conteúdo.

**Alternatives considered**:

- **Criar um card separado para Home**: rejeitado; duplicaria ordem,
  espaçamento e correções de acessibilidade justamente no elemento que a spec
  quer consistente.
- **Tornar o card inteiro um único Pressable**: rejeitado; confundiria abrir
  turma com entrar/sair/excluir e violaria a distinção de ações.
- **Usar `numberOfLines` para conter textos longos**: rejeitado; poderia
  ocultar informação essencial sem alternativa de leitura.
- **Criar uma biblioteca visual nova**: rejeitado; os tokens e componentes
  existentes cobrem o caso e uma dependência nova exigiria lockfile e Doctor.

## 5. Decisão: estados e blocos sem alterar queries

**Decision**: Home passará a consumir `isError` e `refetch` de
`useMyClassrooms`, mantendo a ordem de decisão `loading → error → success`
(`empty` ou cards). O cabeçalho permanecerá disponível na composição da Home,
enquanto o conteúdo da lista mostrará `ScreenState` para loading/erro e
`EmptyClassroomState` para sucesso vazio. Erro nunca cairá no mesmo ramo do
vazio.

`EmptyClassroomState` receberá textos opcionais, preservando os defaults
atuais para Home/Minhas turmas e permitindo um título explicitamente ligado a
`Turmas disponíveis`. Turmas continuará carregando erro da lista própria como
estado de erro e erro da busca dentro da seção correspondente.

**Rationale**:

- `ScreenState` já expõe role `summary`, heading e ação de retry.
- A alteração fica na composição da rota; hooks, query keys, parâmetros e
  mutations não precisam de nova semântica.
- Títulos de seção acessíveis tornam inequívoca a associação dos estados
  vazios sem misturar as listas.

## 6. Decisão: ícone de busca opcional e decorativo

**Decision**: evoluir `FormField` com uma prop opcional de ícone inicial,
renderizada com `Ionicons` e `accessible={false}`. Somente o campo `Buscar
turmas` informará `search-outline`; o `TextInput` continuará com label
acessível `Buscar turmas`, mesmo valor, `onChangeText`, estado disabled/foco e
placeholder. Não será introduzido debounce, normalização, novo parâmetro ou
tratamento de erro.

**Rationale**: `@expo/vector-icons` já é dependência instalada, o ícone é
apresentação e um prop opcional evita alterar todos os demais campos.

**Alternatives considered**:

- **Colocar o ícone como novo botão**: rejeitado; criaria controle sem ação e
  ruído para leitores de tela.
- **Implementar busca nova para acompanhar o ícone**: rejeitado por FR-014 e
  pela separação com `006-classroom-search-fix`.
- **Duplicar o `TextInput` diretamente na tela**: rejeitado; perderia o
  contrato comum de label, erro, helper e acessibilidade de `FormField`.

## 7. Decisão: validação e evidência

**Decision**: cobrir a mudança em camadas:

- unidade da função de calendário para hoje, um dia, vários dias, expiração,
  ausência e timestamp inválido;
- serviço backend para `expiresAt` nas duas listagens, manutenção do filtro de
  ativo e mapeamento nulo;
- contrato OpenAPI para a propriedade date-time obrigatória do resumo;
- rotas/componentes mobile para hierarquia, quatro estados, indicador,
  ações/roles, busca, perfis, long text e alvos de toque;
- gates backend/mobile e walkthrough Android.

O walkthrough será registrado separadamente pela implementação. Empacotamento,
Doctor e testes automatizados não serão usados como substitutos de leitura
manual, escala de texto ou auditoria de iOS.

## Conclusão

As decisões resolvem todos os detalhes técnicos necessários para gerar as
tasks: o contrato é aditivo, a fonte de dados já existe, a apresentação fica
testável e o escopo permanece limitado às superfícies primárias e seus
elementos diretamente compartilhados.
