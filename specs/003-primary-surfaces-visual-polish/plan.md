# Implementation Plan: Primary Surfaces Visual Polish

**Branch**: `003-primary-surfaces-visual-polish` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-primary-surfaces-visual-polish/spec.md`

## Summary

A feature melhorará a hierarquia visual, a legibilidade e a consistência das
superfícies Home e Turmas no aplicativo mobile, preservando os tokens claros e
minimalistas já usados pela autenticação. A implementação reutilizará o
`ClassroomCard`, os estados compartilhados e os tokens de `mobile/src/theme`,
sem criar uma segunda linguagem visual.

O único ajuste de dados será aditivo e read-only: o resumo do último comunicado
passará a expor `expiresAt` nos endpoints existentes de listagem de turmas.
Esse campo alimentará uma função pura no mobile que calcula dias de calendário
na localidade do aparelho, limita o resultado inferior a zero e produz
`Expira hoje`, `Expira em 1 dia` ou `Expira em X dias`. Nenhuma regra de
seleção, validade, autorização, busca ou mutation será alterada.

Na Home, o cabeçalho ganhará semântica e escala coerentes, os cards exibirão o
prazo quando houver comunicado ativo e carregamento, erro, vazio e sucesso
serão estados distintos. Em Turmas, o cabeçalho, a busca, as duas seções e as
ações por perfil serão agrupados visualmente; a busca receberá somente um
ícone decorativo e manterá exatamente seu estado e sua requisição atuais.

## Technical Context

**Language/Version**: TypeScript 6.0.3 no mobile, TypeScript 5.9.3 no
backend, Node.js 22+

**Primary Dependencies**: React 19.2.3, React Native 0.86.3, Expo SDK 57,
Expo Router, `@expo/vector-icons`, TanStack React Query, Jest/RNTL, NestJS 11,
Prisma 7.6, PostgreSQL 15+

**Storage**: PostgreSQL existente via Prisma; nenhuma tabela, relação,
coluna ou migration será criada. `expiresAt` já existe em `Announcement` e
somente será incluído no DTO/projeção do resumo.

**Testing**: Jest/RNTL para função de expiração, componentes e rotas mobile;
Jest unitário para `ClassroomsService`; integração para as listagens de
turmas; contrato OpenAPI; `typecheck`, `lint`, `format:check`, build backend,
Expo Doctor e export do mobile; walkthrough manual Android com matriz de
estados, perfis, texto ampliado e conteúdo longo

**Target Platform**: Android como alvo manual da versão inicial. Os
componentes continuarão usando primitivas React Native compatíveis com iOS,
mas evidência manual de iOS não será inferida.

**Project Type**: Monorepo com API NestJS/Prisma e aplicativo mobile
Expo/React Native; esta feature altera o contrato de resumo de turmas e as
superfícies mobile Home/Turmas.

**Performance Goals**: O polimento não adicionará requisições, debounce,
polling ou nova persistência. Cada render calculará o rótulo a partir do
`expiresAt` já recebido; as listagens continuarão com uma consulta por hook e
as mutations continuarão com o mesmo número de chamadas.

**Constraints**: manter `/api/v1`, a seleção do comunicado ativo, as
permissões por perfil/ownership, a navegação e as mutations existentes; não
introduzir dependência nova, tema escuro, mudanças em detalhe/Perfil ou
correção funcional da pesquisa; manter português visível, tokens semânticos,
alvos de toque de pelo menos 48 dp no Android e layout sem alturas fixas para
acomodar texto ampliado.

**Scale/Scope**: duas telas autenticadas, um card compartilhado, um cabeçalho
de Home, um estado vazio compartilhado, o campo de busca com suporte opcional
a ícone, dois endpoints de resumo já existentes, testes unitários/
integração/contrato e uma matriz manual Android.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio/gate | Resultado | Aplicação ao plano |
|---|---|---|
| I. Domain-Modular Architecture | PASS | O backend permanece no módulo `classrooms`, com DTO e service responsáveis pelo resumo; o mobile mantém a separação Expo Router → components → hooks/services/types/lib. O vínculo com `Announcement` já existe na projeção de `ClassroomSummary` e não cria novo módulo. |
| II. Secure, Explicit API Contracts | PASS | A mudança de API é aditiva, versionada e documentada: `LastAnnouncementSummary.expiresAt` será refletido no DTO, no OpenAPI canônico e nos testes. Não há nova entrada, token, permissão ou segredo. |
| III. Testable Delivery | PASS | A função de calendário terá teste unitário; rotas cobrirão estados, hierarquia, perfis, ações, texto longo e acessibilidade; backend cobrirá as duas listagens e o contrato; os quality gates existentes permanecem obrigatórios. |
| IV. Data Integrity and Safe Evolution | PASS | `Announcement.expiresAt` já é a fonte persistida e não será alterada. Nenhuma migration é necessária; a query continuará filtrando comunicados ativos e ordenando o mais recente. |
| V. Predictable and Accessible User Experience | PASS | Home distinguirá loading/error/empty/success; labels e roles existentes serão preservados ou explicitados; a busca manterá nome e função; ações continuarão separadas do toque de abrir o card e todos os controles manterão o alvo mínimo. |
| Restrições de produto e plataforma | PASS | O escopo fica limitado a Home, Turmas e elementos compartilhados diretamente usados por elas; Android é o alvo de evidência e iOS permanece `NOT MEASURED` quando não houver prova. |

Não há violação constitucional a justificar. O ajuste cross-layer é necessário
porque FR-009 exige transportar ao cliente um atributo já persistido, sem
duplicar a consulta de detalhe nem alterar a regra de negócio.

## Research and Design Decisions

As decisões completas e as alternativas estão em [research.md](./research.md).

1. **Contrato mínimo de resumo**: adicionar `expiresAt` a
   `LastAnnouncementSummary` no DTO, nas duas projeções Prisma, no tipo mobile
   e no contrato OpenAPI. A seleção do comunicado ativo e as regras de acesso
   permanecem intocadas.
2. **Prazo por calendário local**: criar uma função pura em
   `mobile/src/lib/classroom-expiration.ts`, comparando as partes de data local
   em UTC para evitar efeitos de horário de verão. Comunicado sem resumo,
   timestamp inválido ou já expirado no instante de renderização não recebe
   indicador; datas futuras usam as três formas textuais da spec.
3. **Card único com contexto explícito**: evoluir `ClassroomCard` para aceitar
   opcionalmente o momento de expiração. A Home habilita o indicador; Turmas
   mantém a ordem e os dados do card, mas não ganha uma ação ou regra nova.
   O conteúdo clicável continuará separado do botão `Entrar`, `Sair` ou
   `Excluir turma`.
4. **Estados previsíveis**: Home usará `ScreenState` para loading e erro com
   retry antes de decidir entre sucesso e vazio. `EmptyClassroomState` receberá
   texto contextual opcional para servir à Home, `Minhas turmas` e
   `Turmas disponíveis` sem confundir vazio com falha.
5. **Hierarquia semântica em Turmas**: agrupar introdução, busca, `Minhas
   turmas` e `Turmas disponíveis` em blocos com cabeçalhos acessíveis; manter
   `Criar turma` somente para `PROFESSOR`. O campo receberá um `Ionicons`
   `search-outline` decorativo por uma prop opcional de `FormField`; o valor,
   callback, query key, parâmetro HTTP, loading, resultado e erro não mudam.
6. **Layout tolerante**: usar tokens de `theme`, wrapping natural, `flexShrink`
   onde houver cabeçalho ou texto variável, nenhuma altura fixa para conteúdo e
   ação em subtree própria. O indicador de expiração terá texto explícito e não
   dependerá apenas de cor.

## Phase 0: Research Output

O resultado da pesquisa está em [research.md](./research.md). O baseline real
confirmou que:

- Home já usa `useMyClassrooms`, mas descarta o estado de erro e renderiza
  `null` durante loading;
- Turmas já separa as duas listas e preserva as mutations, porém precisa de
  agrupamento visual e busca com ícone;
- `ClassroomCard` é compartilhado pelas duas superfícies e já separa o
  `Pressable` de abrir do botão de ação;
- o backend filtra `expiresAt >= new Date()` e seleciona o último comunicado,
  mas hoje não o inclui no resumo retornado;
- não são necessários novos pacotes, tabelas ou padrões de busca.

Todos os pontos técnicos foram resolvidos; não há `NEEDS CLARIFICATION`
pendente.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): modelo lógico do resumo, atributo de
  expiração derivado e estados das superfícies; explicita a ausência de
  migration.
- [contracts/primary-surfaces.md](./contracts/primary-surfaces.md): contrato
  de resposta dos dois endpoints e contrato de UI/acessibilidade para Home e
  Turmas.
- [quickstart.md](./quickstart.md): comandos direcionados de validação,
  pré-requisitos de banco e roteiro Android para gerar evidência.

## Project Structure

### Documentation (this feature)

```text
specs/003-primary-surfaces-visual-polish/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── primary-surfaces.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── src/classrooms/
│   ├── dto/classroom-summary.dto.ts
│   ├── classrooms.service.ts
│   └── classrooms.service.spec.ts
├── test/
│   ├── classrooms.integration.spec.ts
│   └── openapi.contract.spec.ts
└── ...

mobile/
├── app/(app)/(tabs)/
│   ├── index.tsx
│   └── classrooms.tsx
├── src/
│   ├── components/home/
│   │   ├── ClassroomCard.tsx
│   │   ├── EmptyClassroomState.tsx
│   │   └── HomeHeader.tsx
│   ├── components/ui/FormField.tsx
│   ├── lib/classroom-expiration.ts
│   └── types/classroom.ts
└── tests/
    ├── lib/classroom-expiration.spec.ts
    ├── routes/home.spec.tsx
    ├── routes/classrooms-list.spec.tsx
    ├── routes/primary-states.spec.tsx
    ├── services/classroom.service.spec.ts
    └── accessibility/touch-targets.spec.tsx

specs/001-app-quality-readiness/contracts/openapi.json
```

**Structure Decision**: manter a arquitetura existente. O módulo `classrooms`
continua sendo dono do resumo de turma e sua projeção de anúncio; o mobile
continua compondo as rotas com componentes `home`, `ui`, tipos e lib testável.
O contrato OpenAPI canônico da spec 001 será atualizado na implementação para
refletir a mudança aditiva, mas não será duplicada uma camada de API no
mobile. Nenhuma dependência, pacote ou diretório backend novo é necessário.

## Validation and Handoff

A execução futura deverá validar primeiro a função de expiração e os testes
direcionados de backend/mobile, depois os quality gates completos aplicáveis.
O walkthrough Android deverá cobrir Home e Turmas para `PARENT` e
`PROFESSOR`, quatro estados da Home, listas preenchidas/vazias, busca com
resultado/sem resultado/erro, ações por ownership, prazos hoje/1/X dias,
professor ausente, textos longos e texto ampliado. A evidência será registrada
em uma matriz própria da feature usando `PASS`, `WARN`, `FAIL`, `NOT RUN` e
`NOT MEASURED`; iOS e qualquer auditoria manual não executada não serão
inferidos a partir de testes ou export.

Esta execução termina na fase de design. `tasks.md` não é criado por
`speckit-plan`; a decomposição dependency-ordered será feita posteriormente
por `speckit-tasks` quando autorizada.

## Post-Design Constitution Check

| Gate | Resultado | Evidência de design |
|---|---|---|
| Arquitetura e limites | PASS | A alteração de resumo fica em `classrooms`; a apresentação fica em componentes/rotas mobile existentes e a função de calendário é isolada e testável. |
| Segurança e contratos | PASS | `expiresAt` é um campo de resposta documentado; não há input novo, mudança de autorização, token, segredo ou endpoint. |
| Testabilidade e gates | PASS | O contrato aponta testes unitários, de rota, serviço, integração e OpenAPI, além dos comandos de qualidade backend/mobile e da evidência Android. |
| Dados e evolução | PASS | A origem permanece `Announcement.expiresAt`; não há alteração de schema ou migration e o filtro de ativo será coberto. |
| UX previsível/acessível | PASS | Os estados têm semântica distinta, a ordem das seções é explícita, o ícone de busca é decorativo e os controles preservam nomes, funções e alvos. |

Resultado pós-design: PASS. O plano está pronto para a geração posterior de
`tasks.md` e para implementação faseada conforme o limite da spec.

## Complexity Tracking

Não aplicável: não há violação constitucional nem componente arquitetural
extraordinário a justificar.
