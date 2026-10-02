# UI Contract: Detail Surfaces Visual Polish

**Escopo**: somente as três superfícies móveis da spec 004 e `AnnouncementCard`. Este contrato documenta apresentação e comportamento observável. A API `/api/v1`, tipos, permissões no servidor e persistência não mudam.

## Detalhe da turma

**Ordem no sucesso**: navegação secundária → nome da turma como contexto → seção `Comunicados` com `+ Novo` quando a condição atual de `PROFESSOR` for verdadeira → cards na ordem recebida ou estado `Nenhum comunicado` → ação contextual no fim.

| Condição | Controle final | Tratamento | Resultado preservado |
|---|---|---|---|
| `user?.id === classroom.ownerId` | `Excluir turma` | destrutivo, confirmação com nome/consequência | mutation atual, pending, erro, bloqueio duplicado e `/classrooms` no sucesso |
| Membro não proprietário | `Sair da turma` | destrutivo, confirmação com nome/consequência | mutation atual, pending, erro, bloqueio duplicado e `/classrooms` no sucesso |

`+ Novo` mantém o critério atual `user?.role === 'PROFESSOR'` e abre `/classrooms/{id}/new-announcement`. A spec não redefine autorização de criação. Quando a turma já é conhecida e o carregamento ou erro recuperável é da lista, o contexto e controles válidos permanecem acessíveis após o respectivo `ScreenState`; retry continua disponível. Turma não encontrada, 404 ou usuário não identificável não oferece ação destrutiva sobre um recurso indisponível. Erro na consulta da turma mantém retry e retorno seguro.

Cada `AnnouncementCard` mantém título, `Professor • {nome}`, prévia de conteúdo e prazo secundário quando válido. O card é um único controle acessível que abre `/announcements/{id}`. O rótulo de prazo é `Expira hoje`, `Expira em 1 dia` ou `Expira em X dias` via helper existente; entrada ausente, inválida ou expirada não mostra prazo negativo ou enganoso. O card não filtra comunicado nem altera sua validade.

## Detalhe do comunicado

**Ordem no sucesso**: navegação secundária → título com semântica de heading → autoria do professor → grupo de metadados (`Publicado em` e valor, `Expira em` e valor) → conteúdo integral → ações do autor, se aplicáveis.

- O título é o principal texto; autoria e datas são informações secundárias claramente associadas.
- Datas mantêm os valores atuais em `pt-BR`. Corpo mantém as quebras de linha e não recebe limite de linhas.
- `Editar` abre `/announcements/{id}/edit` e `Excluir` abre a confirmação somente se `user?.id === announcement.author.id`. Não se reserva espaço de ação para não autores.
- A exclusão mantém consequência, cancelamento, estado pendente, bloqueio de toque repetido, erro e volta segura após sucesso.
- Loading, erro com retry, 404/ausência e `SecondaryScreen` mantêm a saída segura da spec 002.

## Perfil

**Ordem no sucesso**: cabeçalho `Meu perfil` → identidade com avatar derivado do nome → Nome → E-mail → Perfil → `Editar perfil` → `Sair da conta`.

- Os valores permanecem `user.name`, `user.email` e `user.role`, com quebra natural para conteúdo extenso.
- `Editar perfil` abre `/profile/edit`; `Sair da conta` mantém variante destrutiva, estado de processamento, `logout()` e `/login`.
- Loading e usuário ausente continuam estados distintos; usuário ausente oferece `Entrar`.
- Nenhum campo, controle de senha, exclusão de conta ou nova ação é introduzido.

## Acessibilidade e layout

- Headings e grupos seguem a ordem visual e de leitura; controles têm nomes que expressem a ação, papel e foco adequados.
- Ícones e cor reforçam o texto; não são a única forma de comunicar prazo ou destruição.
- Usar tokens de contraste e alvo mínimo do projeto: 48 dp no Android e 44 pt no iOS. Evitar altura fixa para texto variável; permitir largura flexível, wrapping e rolagem.
- Validar com a menor largura disponível, texto ampliado, nome/e-mail/título/corpo longos e ordem de leitura por tecnologia assistiva quando houver ferramenta/dispositivo. Evidência não observada fica `NOT MEASURED`.

## Não alteração de contrato externo

Sem endpoint, DTO, payload, autorização, migration, dependência ou chamada de rede nova. `useMyClassrooms`, `useClassroomAnnouncements`, `useAnnouncement`, `useAuth` e hooks de mutation continuam responsáveis pelos mesmos dados e efeitos.
