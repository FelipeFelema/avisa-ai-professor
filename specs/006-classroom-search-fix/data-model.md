# Data Model: Classroom Search Fix

**Data**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

Este modelo descreve valores e estados de aplicação. Não introduz tabela, coluna, relação, migration ou dado persistido.

## Entidades existentes

| Entidade           | Campos/relação relevantes                           | Efeito da feature                                                                     |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Classroom          | id, name, ownerId; owner e memberships              | Critério de substring em name, sem alteração da entidade.                             |
| UserClassroom      | userId + classroomId                                | Disponíveis exige ausência da membership da pessoa atual; servidor mantém autoridade. |
| ClassroomSummary   | id, name, ownerId, teacher, lastAnnouncement        | Resposta existente intacta; comunicado mantém createdAt/expiresAt.                    |
| Sessão autenticada | Identidade validada por JWT e mecanismos existentes | Define userId da listagem; expiração segue fluxo atual.                               |

## Termos da busca

| Valor           | Tipo/validação                   | Responsabilidade                                                             |
| --------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| rawText         | string, inclusive texto inválido | Campo exibe imediatamente o texto digitado, sem truncamento.                 |
| normalizedTerm  | rawText.trim()                   | Preserva espaços internos, caixa, acentos, números e pontuação.              |
| validationError | mensagem ou null                 | Mais de 80 pontos de código normalizados bloqueia query. Vazio é válido.     |
| settledTerm     | termo válido estabilizado        | Atualizado após 300 ms desde a última edição; valor enviado/chave observada. |
| waiting         | boolean                          | Pausa pendente; não apresenta resultados/erro de critério anterior.          |
| timer           | referência local cancelável      | Uma pausa por hook, limpa em edição e desmontagem.                           |

O comprimento é contado por pontos de código, sem equivalência de grafemas ou normalização Unicode. Backend usa class-validator com predicado correspondente; mobile usa Zod. Espaços externos não consomem o limite. Valores não textuais ou múltiplos são inválidos na fronteira HTTP.

Termos com o mesmo resultado de trim usam a mesma chave; ausência, vazio e espaços correspondem a `''` no cache e parâmetro omitido no cliente. Caixa distinta pode manter chaves diferentes, mas a API retorna o mesmo critério case-insensitive. Não é necessário alterar caixa para deduplicar.

## Estado de apresentação

| Estado   | Condição                                                 | Conteúdo em disponíveis                                         |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| invalid  | Termo atual acima do limite                              | Feedback do campo; nenhuma consulta inválida ou cards antigos.  |
| waiting  | Edição ainda não estabilizada                            | Feedback de espera; sem erro, vazio ou cards do termo anterior. |
| loading  | Primeira carga, dados invalidados/stale ou refetch atual | Loading da seção; nenhum card incompatível acionável.           |
| error    | Falha da query atual válida/estabilizada                 | Mensagem + retry; rawText preservado.                           |
| results  | Dados atuais não vazios                                  | Cards existentes com ações preservadas.                         |
| no-match | Dados atuais vazios e settledTerm preenchido             | Mensagem com termo e limpeza acessível.                         |
| empty    | Dados atuais vazios e settledTerm vazio                  | Empty state geral existente.                                    |

Prioridade: validação → espera → erro atual → loading/refresh → resultado/vazio. Erro de refresh tem prioridade sobre dados antigos em cache. `isLoading` isolado não prova atualidade; considerar habilitação, termo e freshness/fetching da query. Query stale reativada deve iniciar atualização, sem permanecer indefinidamente escondida por configuração incompatível.

Na primeira montagem, a consulta inicial sem filtro pode iniciar imediatamente: não houve edição. Em qualquer edição, inclusive limpeza e mudança de espaços externos, nenhuma nova consulta causada por ela inicia antes da pausa; se o critério equivalente já está atual, não se duplica a consulta. Refetch por retry, participação ou infraestrutura existente tem causa distinta e não consulta valor intermediário.

## Transições

1. Editar atualiza rawText imediatamente, valida normalizedTerm e cancela a pausa anterior. Input inválido desabilita consulta e substitui feedback anterior por validação.
2. Input válido inicia a espera. Após 300 ms, settledTerm recebe o termo mais recente e habilita a query. Não criar query por cada valor intermediário.
3. Resposta/erro só aparece se pertence à chave do termo atual estabilizado. Resposta de A não muda estado de B; desmontagem/troca consome o signal de cancelamento.
4. Limpar define rawText vazio e remove imediatamente validação, erro e nenhuma correspondência anteriores. Ao estabilizar, retorna à consulta sem filtro.
5. Retry mantém rawText e consulta exatamente o termo atual válido/estabilizado; não fica disponível para termo antigo durante espera.
6. Alternar tema recalcula estilos sem remontar hook/timer/rota, perder texto ou iniciar outra consulta.

## Cache e participação

| Identidade                                    | Papel                                                        |
| --------------------------------------------- | ------------------------------------------------------------ |
| `['classrooms', 'my']`                        | Todas as memberships da pessoa, independente de busca.       |
| `['classrooms', 'available']`                 | Prefixo para cancelamento/invalidação de todas as variantes. |
| `['classrooms', 'available', normalizedTerm]` | Variante específica de disponíveis, incluindo termo vazio.   |

Após sucesso confirmado de join/leave/delete: cancelar consultas antigas de listas, invalidar my e prefixo de disponíveis, aguardar refetch ativo. Dados de disponíveis anteriores à invalidação não são mostrados como atuais. Variantes inativas devem atualizar antes de mostrar seus cards ao serem retomadas. Não esperar staleTime de cinco minutos.

Join remove a elegibilidade nos disponíveis e acrescenta membership em my via resposta autoritativa. Leave faz o inverso se a turma ainda existir/elegível. Delete elimina a turma dos resultados e preserva as regras de exclusão existentes. Failure/cancel/pending da mutation não modifica participação como sucesso. Sem inserções especulativas a partir de resposta void; erro de atualização das listas é comunicado pela query, separado do sucesso já confirmado da mutation.

## Invariantes

- “Minhas turmas” não recebe termo ou estados de busca.
- Somente dados do termo atual e da participação atual podem oferecer “Entrar”.
- Membership, ownership, autorização e exclusão não mudam no banco/servidor.
- Cache invalidado não reapresenta variante incompatível ao revisitar.
- Nenhuma persistência, histórico de busca, ranking, paginação ou busca offline.
