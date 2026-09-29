# Data Model: Primary Surfaces Visual Polish

**Data**: 2026-09-26

## Persistência

Não há entidade nova, alteração de schema Prisma ou migration. A fonte de
verdade continua sendo:

- `Announcement.expiresAt`, persistido como `DateTime`;
- a relação `Classroom.announcements`;
- a relação de participação `UserClassroom`, usada para separar minhas e
  disponíveis;
- `Classroom.ownerId`, usado para preservar a distinção entre excluir e sair.

## Modelo lógico de resposta

### `ClassroomSummary`

Representa a linha de uma turma nas duas listagens já existentes.

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `id` | UUID | sim | Identificador da turma. |
| `name` | string | sim | Nome atual da turma; continua sujeito aos limites existentes. |
| `ownerId` | UUID | sim | Identidade do proprietário, usada para a apresentação da ação. Não concede autorização ao cliente. |
| `teacher` | `TeacherSummary \| null` | sim | Proprietário/professor resumido; `null` mantém o caso de professor não identificável. |
| `lastAnnouncement` | `LastAnnouncementSummary \| null` | sim | Último comunicado ativo selecionado pela regra já existente; `null` significa ausência de comunicado ativo no momento da consulta. |

### `TeacherSummary`

| Campo | Tipo | Obrigatório |
|---|---|---:|
| `id` | UUID | sim |
| `name` | string | sim |

### `LastAnnouncementSummary`

| Campo | Tipo | Obrigatório | Regra |
|---|---|---:|---|
| `id` | UUID | sim | Identificador do comunicado selecionado. |
| `title` | string | sim | Título exibido no card. |
| `createdAt` | ISO date-time | sim | Mantém a informação atual do resumo. |
| `expiresAt` | ISO date-time | sim | Novo campo aditivo; vem do mesmo registro ativo selecionado, sem alterar a seleção. |

Quando `lastAnnouncement` for `null`, nenhum campo de anúncio é enviado e o
card mostra `Nenhum comunicado disponível.` sem prazo.

## Regras de seleção e integridade

1. `findMyClassrooms` continua filtrando por `UserClassroom` do usuário
   autenticado.
2. `findAvailableClassrooms` continua excluindo turmas em que o usuário já é
   membro e preserva o parâmetro `search` existente.
3. Ambas as queries continuam filtrando `expiresAt >= now`, ordenando por
   `createdAt desc` e limitando a um comunicado.
4. O servidor permanece autoridade para autenticação, autorização,
   membership, ownership e validade; `ownerId` no mobile é apenas dado de
   apresentação.
5. A adição de `expiresAt` é somente leitura e não modifica criação,
   atualização, exclusão ou invalidação de cache.

## Modelo derivado de apresentação

### `ExpirationLabel`

Não é persistido nem enviado pela API. É derivado no mobile de
`lastAnnouncement.expiresAt` e do instante local de renderização:

| Condição | Resultado |
|---|---|
| Sem anúncio, timestamp inválido ou instante já passado | sem indicador (`null`) |
| Mesmo dia civil local e ainda ativo | `Expira hoje` |
| Próximo dia civil local | `Expira em 1 dia` |
| Dois ou mais dias civis locais | `Expira em X dias` |

A diferença é calculada usando ano/mês/dia locais, não milissegundos de
24 horas. O resultado nunca é negativo.

## Estados das superfícies

### Home

| Estado da query | Conteúdo esperado |
|---|---|
| loading | `HomeHeader` e `ScreenState(kind="loading")`; nenhum empty state. |
| error | `HomeHeader` e `ScreenState(kind="error")` com retry; nunca mensagem de lista vazia. |
| success + lista vazia | `HomeHeader` e `EmptyClassroomState` com CTA `Ver turmas`. |
| success + lista preenchida | `HomeHeader` e um `ClassroomCard` por resumo; prazo somente quando aplicável. |

### Turmas

| Estado | Conteúdo esperado |
|---|---|
| minhas turmas loading/error | estado próprio da query de participação, sem misturar com disponíveis. |
| minhas turmas vazia | `EmptyClassroomState` associado a `Minhas turmas`. |
| disponíveis loading/error | estado próprio abaixo de `Turmas disponíveis`, preservando busca. |
| disponíveis vazia | empty state com título e texto explicitamente associados à seção. |
| listas preenchidas | cards na ordem original e ações determinadas por perfil/ownership. |

Esses estados são de apresentação e não criam estados persistentes ou novas
transições de domínio.
