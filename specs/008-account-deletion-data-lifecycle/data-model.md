# Data Model: Account Deletion and Data Lifecycle

**Spec**: [spec.md](./spec.md) | **Contract**: [contracts/account-deletion.md](./contracts/account-deletion.md)

## Persistent entities — schema vigente

Não há tabela, coluna, enum ou migration nova. `backend/prisma/schema.prisma` e migrations existentes permanecem a fonte de verdade.

| Entidade | Campos relevantes | Relações/política |
| --- | --- | --- |
| User | id, name, email único, password hash, role, createdAt, updatedAt | Conta alvo; excluir fisicamente. E-mail fica disponível após commit. |
| AuthSession | id/sid, userId, refreshTokenHash, expiresAt, revokedAt, timestamps | FK User com Cascade; excluir todas, incluindo iniciadora/revogadas/expiradas. |
| Classroom | id, name, ownerId, timestamps | FK User obrigatória/restritiva; excluir por ownerId, independentemente do papel atual. |
| UserClassroom | userId + classroomId (PK composta) | FK User restritiva; FK Classroom Cascade. Excluir participação própria externa e todas as participações das turmas próprias. |
| Announcement | id, title, content, expiresAt, authorId, classroomId, timestamps | FK autor restritiva; FK Classroom Cascade. Excluir autoria própria em qualquer turma, mais todo conteúdo das turmas próprias. |
| ClassroomDeletionReceipt | classroomId (PK), ownerId, deletedAt | Sem FK User; apagar por ownerId e coordenar seu writer para impedir recriação após remoção. |
| InviteCode | id, code único, role, isActive, expiresAt, timestamps | Não possui criador/User; preservar integralmente. |

## Política por vínculo

| Predicado vigente | Resultado |
| --- | --- |
| User.id = identidade autenticada | Perfil/credencial excluídos. Nenhuma outra User é removida. |
| AuthSession.userId = conta | Todas removidas. JWTs antigos recusados por sessão ausente. |
| Classroom.ownerId = conta | Turma e TODOS os comunicados/participações removidos, inclusive de terceiros; preservar as User dos participantes/autores. |
| UserClassroom.userId = conta, turma de outro owner | Somente essa participação removida. |
| Announcement.authorId = conta, turma de outro owner | Somente esse comunicado removido, ativo ou expirado. |
| Receipt.ownerId = conta | Receipt removido, sem substituição por tombstone da conta. |
| Sem ownership/autoria/participação com conta | Preservado. |

Papéis não alteram os predicados. PARENT/ADMIN históricos com ownership/autoria seguem a mesma política de PROFESSOR; o papel atual define apenas aviso de acesso e a proteção de último ADMIN.

## Transaction protocol

1. Validar contrato/frase; ler User e verificar senha com utilitário vigente fora da transação. Guardar snapshot do hash apenas transitório.
2. Iniciar transação READ COMMITTED. Adquirir advisory lock transacional de chave fixa/namespace documentados, exclusivo da autoexclusão. SQL parametrizado; nenhum lock de sessão persistente.
3. Adquirir User FOR UPDATE pela identidade autenticada; reler User, sid pertencente à conta, revokedAt nulo e expiresAt futuro. Ausência = 401; hash diferente = 409 `CREDENTIAL_CHANGED`.
4. Se papel vigente ADMIN, contar ADMINs depois de adquirir gate. Total menor ou igual a um bloqueia antes de qualquer escrita, com 409 `LAST_ADMIN_REQUIRED`.
5. Travar Classroom próprias FOR UPDATE em ordem de id; determinar grafo vigente. Locks/FKs coordenam novas relações com User/Classroom. Sem transferência de ownership.
6. Excluir Announcement por authorId; UserClassroom por userId; Classroom por ownerId com cascades; ClassroomDeletionReceipt por ownerId; AuthSession por userId; User por id. Tudo pelo mesmo TransactionClient. As cascades eliminam também conteúdo de outras autorias nas turmas próprias.
7. Commit; só então responder 204. Falha em qualquer etapa reverte todas as exclusões. Não repetir automaticamente.

As sessões são apagadas explicitamente para clareza da operação; Cascade User→AuthSession permanece defesa do schema. Não há filtro de anúncio ativo ou de papel em deleteMany.

### Writers concorrentes

- Login/emissão/refresh usam User lock e rechecagem dentro da transação. Rotação não pode criar sessão; claims vêm de User atual. Hash preparado fora dos locks.
- ClassroomsService.delete adquire User antes de receipt/turma e revalida existência, incluindo caminhos de repetição/conflito. Nenhum receipt novo após exclusão da User.
- Relação inserida antes da exclusão entra no grafo; inserção concorrente bloqueada por FK/locks não pode confirmar referência a User/Classroom removidos. Cobrir criação de turma, participação e autoria com banco real.
- Gate vem antes de User; User antes de Classroom/sessões/receipts. Sem gate global na consulta de impacto ou nos endpoints normais. Deadlock/timeout deve reverter e ser sanitizado.
- Futuras remoções/rebaixamentos ADMIN precisam aderir ao gate; operações administrativas SQL externas não são um contrato deste produto.

## Transient entities

### AccountDeletionImpact

| Campo | Tipo | Significado |
| --- | --- | --- |
| role | PARENT / PROFESSOR / ADMIN | Papel atual da própria conta. |
| canDelete | boolean | Elegibilidade naquele snapshot; não substitui decisão no DELETE. |
| blockReason | `LAST_ADMIN_REQUIRED` ou null | Só bloqueio da própria conta; não revela total/ids de outras ADMINs. |
| ownedClassroomsCount | inteiro ≥ 0 | Turmas a remover por ownership. |
| announcementsInOwnedClassroomsCount | inteiro ≥ 0 | Todos os comunicados nas turmas próprias, qualquer autor/expiração. |
| externalMembershipsCount | inteiro ≥ 0 | Participações da conta em turmas preservadas. |
| authoredAnnouncementsInOtherClassroomsCount | inteiro ≥ 0 | Autoria própria em turmas preservadas, qualquer expiração. |

Calcular contagens/papel/elegibilidade em snapshot consistente de leitura. Sem User id/name/email/password/sid ou ids de terceiros. Não persistir em dispositivo ou servidor. Não há token de versão: o aviso informa que vínculos vigentes na confirmação serão tratados.

### DeleteAccountRequest

`currentPassword`: string não vazia, preservada integralmente, sem novo limite de senha sobre credenciais existentes. `confirmationPhrase`: string exatamente `EXCLUIR MINHA CONTA`. Ambos obrigatórios/write-only; nenhum trim, normalização, coerção ou field desconhecido. Sem id/role/email/contagens.

### Local session generation

Contador em memória e fila de operações sobre tokens; não são dados da conta persistidos. Invalidar geração antes de qualquer await de limpeza. Respostas antigas não podem aplicar User, salvar tokens, repovoar caches ou disparar efeitos de mutations. Cancelamento por AbortSignal complementa a guarda; não a substitui.

### Device preference

Tema `light`/`dark`, chave `theme-preference`, pertence à instalação. Token keys em SecureStore, User/contexto e cache autenticado são limpos; nenhuma limpeza global de AsyncStorage. Se remoção de token falhar, fechar estado autenticado em memória e oferecer recuperação, sem afirmar que persistência já foi apagada. No próximo bootstrap, validar sessão no servidor antes de expor conteúdo.

## State transitions

| Estado | Transições permitidas |
| --- | --- |
| Loading impact | Ready com zero ou mais relações; Blocked último ADMIN; Error com retry de leitura; Session invalid. |
| Ready | Editing; Cancel/Back com descarte; Pending apenas com senha/frase válidas. |
| Blocked | Aviso claro, cancel/back, recarregar resumo; nenhum envio permitido. |
| Pending | Success após 204; Validation/Conflict/Recoverable error; Indeterminate; Session invalid. Sem nova submissão ou saída voluntária que esconda resultado. |
| Indeterminate | Descartar campos; verificação de leitura; back após pending; nenhuma repetição automática do DELETE. |
| Verification valid | Resumo fresco/Ready e nova confirmação manual; não declarar rollback anterior. |
| Verification indeterminate | Permanecer com orientação de conexão; sem mensagem de sucesso/falha definitiva. |
| Success | Invalidar geração, limpar sessão/cache/form, autenticação com feedback sem identidade. |
| Session invalid | Mesma limpeza e autenticação, feedback neutro de sessão encerrada; sem atribuir exclusão sem 204. |

Cancelamento/blur/unmount/expiração/sucesso/resultado incerto descartam senha/frase. Morte do processo não é bloqueável por guarda de rota; bootstrap e invalidação server-side sustentam recuperação.
