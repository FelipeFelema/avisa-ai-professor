# Research: Account Deletion and Data Lifecycle

**Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Pesquisa por inspeção da base atual e documentação primária, com subtarefas separadas para backend e mobile. Os pontos abaixo são decisões de planejamento; nenhum comportamento novo foi executado. Não há pendências técnicas para o design.

## R1 — Fronteira da capacidade e reautenticação

**Decision**: serviço dedicado `users/account-deletion.service.ts` em UsersModule; GET `/api/v1/users/account-deletion` para impacto e DELETE `/api/v1/users/account` para confirmação. Identidade e sid apenas da sessão. Reusar verificador de credenciais vigente, sem exigir alteração de senha/perfil ou redesenhar hashing.

**Rationale**: users já representa identidade e injeta Prisma; AuthModule importa UsersModule. Importar auth de volta criaria ciclo. Exclusão atravessa relações explicitamente, enquanto cada domínio conserva seus endpoints. O produto exige senha atual e frase, não escolha de alvo.

**Alternatives considered**: AuthService orquestrando toda a política de dados (mistura sessão e ciclo de vida); novo módulo/repositório genérico (abstração desnecessária); chamar DELETE de turma por turma (transações independentes e receipts indesejados); usar edição de perfil/senha da 007 como etapa (dependência funcional não prevista).

**Evidence**: `backend/src/users/users.module.ts`, `users.controller.ts`, `users.service.ts`; `backend/src/auth/auth.module.ts`, `auth.service.ts`; `backend/src/common/security/password-hasher.ts`. DTO de senha já restaura valor JSON original para evitar coerção pelo ValidationPipe; aplicar esse padrão no novo DTO, sem alterar pipe global.

## R2 — Impacto atual e dados sensíveis

**Decision**: GET calcula papel, elegibilidade, bloqueio último ADMIN e quatro contagens, em snapshot de leitura consistente: turmas próprias, seus comunicados, participações externas e comunicados próprios externos. Sem ids de terceiros, total de ADMINs, credencial ou frase na resposta. Carregar na entrada/foco; exclusão calcula o grafo vigente novamente.

**Rationale**: tela de Perfil e listas atuais não contêm todo o impacto; anúncios expirados precisam entrar na política. Relações podem ser inesperadas para o papel atual. Contagens não são autorização. Aviso estável explica que todos os vínculos vigentes serão tratados; não promete um número congelado.

**Alternatives considered**: derivar de listas em cache (incompleto/stale); resumo por papel apenas (falha para dados históricos); token de impacto obrigatório com expiração (novo protocolo não exigido pela spec); nomes/ids de membros (exposição desnecessária).

## R3 — Exclusão explícita sem migration

**Decision**: manter schema/FKs atuais e excluir dependentes explicitamente em uma transação. Announcement por autoria, UserClassroom por conta, Classroom por owner com cascades, receipt por owner, AuthSession por conta e User. Não criar receipt de exclusão de conta.

**Rationale**: AuthSession → User já é Cascade. Announcement/UserClassroom → Classroom já são Cascade. Ownership, autoria e membership → User são relações obrigatórias restritivas, que exigem ordem explícita. InviteCode não possui relação de autoria com User. Receipt guarda ownerId sem FK e exige coordenação própria. Exclusão de turmas elimina também conteúdo de terceiros nelas, conforme FR-011, preservando as contas.

**Alternatives considered**: cascades amplas em User (ampliam sem necessidade os efeitos de qualquer writer); soft delete/anonimização/transferência (contrários à spec); criar receipt da conta (retém identidade e não ajuda tokens já inválidos).

**Evidence**: `backend/prisma/schema.prisma`; migrations `20260807203647_add_classroom_delete_cascade` e `20260824_add_auth_sessions_and_deletion_receipts`. [Ações referenciais Prisma v7](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/relations/referential-actions) fundamentam uso das relações já declaradas. Não há migração ou alteração de dados legados nesta etapa.

## R4 — Último ADMIN e ordem de locks

**Decision**: READ COMMITTED e gate advisory transacional único, adquirido por todas as autoexclusões antes de User FOR UPDATE. Depois reler usuário/sid/hash, contar ADMINs e travar turmas próprias em ordem determinística de id. Contar depois de adquirir gate, nunca confiar na elegibilidade do GET.

**Rationale**: locks em usuários distintos não impedem duas ADMINs de observar duas contas e remover ambas. O gate faz a segunda observar o commit da primeira. READ COMMITTED permite essa nova leitura. Lock de todas as ADMINs depois de lock próprio pode causar ciclo. User bloqueia criação de novos vínculos à conta, e Classroom bloqueia novos descendentes nas turmas removidas. Hash/verificação de senha ficam fora dos locks; hash snapshot é rechecado dentro.

**Alternatives considered**: count sem gate (write skew); mutex em memória (não coordena processos); lock de tabela User (impacto amplo); Serializable com retries automáticos (contraria operação sem repetição e exige política adicional); snapshot RepeatableRead na exclusão (contagem pode preceder espera). RepeatableRead é adequado somente para o resumo de leitura, sem gate destrutivo.

**Sources**: [PostgreSQL 15: locks](https://www.postgresql.org/docs/15/explicit-locking.html), [implementação oficial de verificações FK](https://github.com/postgres/postgres/blob/REL_15_STABLE/src/backend/utils/adt/ri_triggers.c), [transações Prisma v7](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions). Inferência aplicada ao schema: conflitos de lock de FK ajudam a estabilizar novas relações; os testes reais deverão comprovar os interleavings locais.

**Limits**: operações futuras que rebaixem/removam ADMIN precisam adquirir o gate. Operações SQL externas não coordenadas não estão cobertas. Timeout/deadlock implica rollback e falha sanitizada, sem retry automático. Dimensionar transação/espera com fixtures reais; não inventar latência medida.

## R5 — Receipt sem FK e operações de turma

**Decision**: único writer `ClassroomsService.delete` adquire primeiro User lock, confirma conta existente e depois mantém leitura/criação de receipt e remoção da turma na mesma transação. Conta removida → 401; conta existente conserva ownership e idempotência atuais. AccountDeletionService não chama esse serviço.

**Rationale**: sem FK, um DELETE de turma autorizado antes da exclusão poderia inserir receipt depois da limpeza da conta. Coordenação por owner fecha essa race. Se writer vencer, exclusão da conta apaga seu receipt; se conta vencer, writer não pode criá-lo. Nenhuma alteração de schema é necessária para o conjunto de writers observado.

**Alternatives considered**: FK nova/cascade (exige migration e tratamento de legado, evitável aqui); segunda limpeza após commit (não atômica); remover idempotência de turma (regressão).

**Evidence**: `backend/src/classrooms/classrooms.service.ts`, método delete; `backend/test/classrooms.integration.spec.ts`. Testar também o caminho de repetição e a recuperação atual de conflito de unicidade; não aceitar novo receipt ou falso sucesso de sessão removida nesses caminhos.

## R6 — Login, refresh e sessão persistida

**Decision**: manter JWT/sid/TTL e verificação persistida atuais. Completar coordenação de refresh e emissão de sessão com User lock; revalidar usuário/sessão ativa/hash de refresh e rotacionar pelo TransactionClient. Preparar hash fora da transação; retornar tokens somente após commit; desaparecimento/revogação/rotação concorrente → 401 sanitizado.

**Rationale**: login já usa snapshot de senha com lock. Refresh atualmente lê/verifica sessão e faz rotate fora da transação; race com exclusão pode produzir erro Prisma em vez de 401. A FK impede restauração de User ausente, mas contrato e consistência de sessão precisam do protocolo. Sessões criadas antes serão removidas; aquelas tentadas após não são criadas. As estratégias consultam sessão atual, logo JWT antigo não basta.

**Alternatives considered**: blacklist só de access token (não resolve todas as sessões); revogar apenas sid iniciador (insuficiente); upsert de refresh (poderia recriar vínculo); substituir autenticação (fora de escopo).

**Evidence**: `backend/src/auth/auth.service.ts`, `auth-session.service.ts`, `strategies/jwt.strategy.ts`, `strategies/refresh.strategy.ts`.

## R7 — DELETE sem replay e confirmação transitória

**Decision**: flag Axios opt-in para não renovar/reexecutar DELETE; service/hook imperativos sanitizam falhas e guardam apenas feedback seguro. Form local Zod exato, ref single-flight e nenhuma mutation com senha/frase no QueryClient. Campos sem autofill, autocorreção/capitalização; senha com secureTextEntry.

**Rationale**: `api.ts` hoje faz refresh/replay de qualquer primeiro 401. `query-client.ts` já tem mutations sem retry, porém isso não desativa replay Axios nem retenção de variables em mutation cache. `useChangePassword.ts` fornece padrão local reaproveitável; não é necessário alterar comportamento público da troca de senha.

**Alternatives considered**: usar mutation com retry false apenas (não cobre interceptor/cache); confirmação em modal existente (não acomoda formulário/resumo/teclado tão bem quanto tela dedicada); repetir DELETE após refresh (contrário a FR-020).

## R8 — Limpeza sob concorrência e resposta perdida

**Decision**: geração compartilhada de sessão invalidada sincronamente, fila de escrita/remoção SecureStore e guards para respostas de geração antiga. Cancelar queries privadas, limpar cache e user mesmo com falha de armazenamento, tentar remover ambas as chaves. Propagar AbortSignal onde faltar e impedir efeitos de mutations antigas. Tema permanece separado.

**Rationale**: AuthProvider aguarda clearTokens antes de limpar user/cache; uma falha impede limpeza. Interceptor pode salvar refresh tardio após logout. Bootstrap/profile/mutations pendentes podem repovoar estado. Cancelamento exige consumo de signal; guards de geração cobrem o que não puder ser abortado. Não prometer limpeza de chave que falhou: manter telas protegidas fechadas e oferecer recuperação.

**Alternatives considered**: queryClient.clear isolado (não coordena storage/provider/callbacks); AsyncStorage.clear (apaga tema); logout remoto como requisito (endpoint vigente não existe e conta já não autoriza sessão); refetch após sucesso (consulta identidade removida).

**Decision for response loss**: estado neutro indeterminado e ação “Verificar sessão”, somente de leitura, distinguindo validade, invalidação definitiva e rede desconhecida. Refresh de leitura não pode reduzir qualquer falha de transporte a “conta excluída”. Uma resposta 200 não prova rollback do DELETE. Nova tentativa manual exige resumo fresco, senha/frase novas; 401 definitivo limpa e informa sessão encerrada, sem alegar exclusão confirmada na ausência de 204.

**Evidence**: `mobile/src/lib/api.ts`, `providers/AuthProvider.tsx`, `storage/auth.storage.ts`, `storage/theme.storage.ts`, hooks/services privados e `app/(app)/_layout.tsx`. [Cancelamento TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) e [usePreventRemove React Navigation](https://reactnavigation.org/docs/use-prevent-remove/) fundamentam signal/guardas. A guarda de rota não impede encerramento do app; recuperação após reinício permanece necessária.

## R9 — Validação e alcance da evidência

**Decision**: matriz de role/grafo, barreiras determinísticas/fault injection em PostgreSQL real, inspeção de ausência de dados sensíveis, testes de provider/interceptor/cache e walkthrough Android/AT separado. Sincronizar Swagger/contrato canônico durante implementação.

**Rationale**: mocks não provam FKs, rollback ou bloqueio último ADMIN concorrente. Testes automatizados não provam uso com TalkBack, teclado físico, escala de fonte ou compreensão em dois minutos.

**Alternatives considered**: somente unitários (insuficiente); tratar export/Doctor como evidência de aparelho (não observa interação); executar limpeza no banco de desenvolvimento (incompatível com helper seguro).

**Evidence**: `.github/workflows/backend-ci.yml`, `mobile-ci.yml`; `backend/test/helpers/test-database.helper.ts`, `profile-password.helper.ts`, `openapi.contract.spec.ts`; `mobile/tests/lib/api-session.spec.ts`, `providers/AuthProvider.spec.tsx`. Comandos e resultados esperados em [quickstart.md](./quickstart.md).
