# Data Model: Detail Surfaces Visual Polish

Esta feature só reorganiza dados já recebidos pelo mobile. Não cria entidade, campo, migração, contrato de API ou persistência local. Os tipos existentes em `mobile/src/types/classroom.ts` e `mobile/src/types/announcement.ts` continuam sendo a fonte de dados para a apresentação.

## Turma detalhada

**Fonte**: `useMyClassrooms()` encontra `ClassroomSummary` por `id`; `useClassroomAnnouncements(classroomId)` fornece a lista existente.

| Dado existente | Uso na UI | Regra preservada |
|---|---|---|
| `ClassroomSummary.id` | rota e destino do novo comunicado | Mesmo identificador |
| `name` | contexto principal e alvo da confirmação | Sem transformação ou truncamento essencial |
| `ownerId` | escolha de `Excluir turma` ou `Sair da turma` | `user?.id === ownerId`; autorização permanece no servidor |
| `teacher`, `lastAnnouncement` | permanecem no resumo; não exigem dado adicional nesta tela | Sem mudança de contrato |
| Lista `Announcement[]` | cards ou estado vazio | Consulta, ordem e visibilidade atuais |

**Valor derivado de apresentação**: `isOwner` escolhe a variante da ação. `user?.role === 'PROFESSOR'` continua controlando a visibilidade de `+ Novo`; a spec não cria novo critério de ownership para criação.

**Estados**: carregando turma → erro de turma com retry, ausente com retorno seguro, ou turma encontrada; depois carregando comunicados → erro/404 com retry ou retorno, lista vazia, ou lista preenchida. Com turma conhecida e usuário disponível, a ação contextual segue a lista, o vazio ou o estado de carregamento/erro recuperável dos comunicados. Não aparece para turma ausente/404 ou sem usuário identificável.

**Ação contextual**: fechamento/cancelamento → confirmação → pending → sucesso com `/classrooms` ou erro com mensagem e possibilidade de recuperação. O bloqueio de toque repetido permanece o atual.

## Comunicado

**Fonte**: `Announcement` existente. Nenhuma projeção ou seleção nova.

| Dado existente | Uso no card | Uso no detalhe |
|---|---|---|
| `id`, `classroomId` | abrir `/announcements/{id}` | destinos de edição/volta e mutation atual |
| `title` | texto principal | heading principal e alvo da confirmação |
| `author.id`, `author.name` | nome do professor | autoria e comparação com `user?.id` para ações |
| `content` | prévia legível | corpo integral com parágrafos/quebras |
| `createdAt` | sem novo uso | valor associado a `Publicado em`, formato atual `pt-BR` |
| `expiresAt` | rótulo secundário derivado | valor associado a `Expira em`, formato atual `pt-BR` |

**Rótulo derivado**: `getClassroomAnnouncementExpirationLabel(expiresAt, now)` retorna exatamente `Expira hoje`, `Expira em 1 dia`, `Expira em X dias` ou `null` para ausência, data inválida ou instante passado. A função não decide a validade do comunicado no servidor e não retira itens da lista.

**Estados do detalhe**: loading, erro recuperável, item ausente/404 com saída segura e sucesso. No sucesso, só o autor vê `Editar` e `Excluir`; a exclusão segue confirmação → pending → sucesso com `router.back()` ou erro apresentado no diálogo.

## Perfil autenticado

**Fonte**: `useAuth().user` existente, sem novos campos.

| Dado existente | Apresentação |
|---|---|
| `name` | Nome e inicial do avatar já derivada pela tela |
| `email` | E-mail legível com quebra natural |
| `role` | Perfil, mantendo o valor atual |

**Estados**: `isLoading` → carregamento; ausência de `user` → mensagem e ação `Entrar`; usuário presente → identidade e ações. `Editar perfil` mantém `/profile/edit`. `Sair da conta` mantém estado de processamento, logout e `/login`.

## Integridade e validação

- Nenhuma alteração em `backend/prisma/schema.prisma`, migrations, DTOs, OpenAPI, serviços ou hooks.
- Nenhum estado visual deve esconder um controle válido ou expor ação para papel/autoria indevidos.
- Textos longos, largura estreita e fonte ampliada devem manter os valores e ações acessíveis, sem depender só de cor/ícone.
