# Data Model: Admin Teacher Invite Management

**Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md) | **Contract**: [teacher-invites.md](./contracts/teacher-invites.md)

## Persistência existente

Não adicionar campos, tabela ou migração. Schema Prisma/migrations permanecem fonte de verdade. Não há autoria, histórico de uso, lista ou vínculo de convite com administrador/professor nesta feature.

### InviteCode

| Campo     | Tipo existente        | Regra da 009                                                                                                 |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| id        | String UUID, PK       | Identidade interna preservada; resposta de criação mantém campo.                                             |
| code      | String unique         | Novo: `PROF-` + 32 caracteres hex maiúsculos criptográficos. Segredo; unique é autoridade.                   |
| role      | Role                  | Toda emissão nova = PROFESSOR. Registro público recusa ADMIN/PARENT; registros históricos não são alterados. |
| isActive  | Boolean, default true | Criação retorna true; consumo bem-sucedido muda para false na mesma transação do cadastro.                   |
| createdAt | DateTime              | Emissão persiste explicitamente o instante base de geração, precisão ms.                                     |
| expiresAt | DateTime              | Novos convites: createdAt + 604800000 ms. Validade estrita `expiresAt > instante de consumo`.                |
| updatedAt | DateTime              | Atualizado no consumo; SQL raw deve fazê-lo explicitamente em UTC.                                           |

Colunas físicas de data são `TIMESTAMP(3)` existentes, representadas em UTC pelo fluxo Prisma; respostas JSON serializam ISO 8601 em UTC. Comparação raw contra relógio do banco converte `clock_timestamp()` para UTC sem timezone. Não usar dias de calendário, fuso do dispositivo nem `NOW()` anterior à espera pelo lock.

**Estados derivados**:

- Disponível: PROFESSOR, `isActive=true`, prazo futuro.
- Consumido: `isActive=false`; transição confirmada junto de um cadastro PROFESSOR.
- Vencido: prazo menor ou igual ao instante avaliado, mesmo que `isActive` permaneça true. Nenhum job de expiração é necessário.
- Não permitido: role diferente de PROFESSOR, independentemente de atividade ou prazo.

Disponível → consumido ocorre uma vez por commit de cadastro. Falha/rollback retorna ao estado prévio. Passagem do tempo altera validade derivada, sem reativação. Convites PROFESSOR legados válidos conservam seu código e expiração; validade fixa aplica-se a novas emissões da 009.

### User e AuthSession

`User` preserva id, name, email unique, password hash, role e relações atuais. Sem convite, cadastro cria PARENT; com convite válido, PROFESSOR fixo. Nunca copiar um papel arbitrário do convite/body para a conta. ADMIN existente continua autorizado por login/sessão e só é provisionado fora do cadastro público.

`AuthSession` preserva id, userId, expiresAt, revokedAt e refreshTokenHash. Emissão resolve actor/sid pelos guards, bloqueia User → AuthSession e valida vínculo, revogação, vencimento e papel ADMIN atuais. Nenhum segredo ou identificador de convite é escrito na sessão.

## Invariantes transacionais

1. Emissão revalida ator/sessão e insere somente um convite em cada sucesso. Colisão unique não persiste registro; retry interno abre transação nova. Máximo três tentativas totais.
2. Cadastro com código faz lock da linha InviteCode, desativação condicional e criação de User no mesmo `tx`; a resposta só sucede após commit. SQL parametrizado nunca interpola segredo.
3. Duas tentativas de cadastro com o mesmo convite e e-mails distintos produzem um único professor. Após esperar lock, a tentativa perdedora observa consumo ou prazo encerrado e falha genericamente.
4. Conflito concorrente de e-mail ou falha de inserção reverte consumo. O pré-check de e-mail é conveniência; unique continua decisivo.
5. Convite vencido durante espera pelo lock é recusado pela comparação de relógio atual; igualdade no vencimento é inválida.
6. ADMIN histórico recusado não é consumido, reativado, apagado nem exposto. Gerar segundo convite não altera o primeiro.
7. Sessão/tokens de cadastro seguem auth existente após criação. Convite não pode ser reutilizado para recuperar resposta perdida depois do commit da conta.

## Modelo transitório mobile

### TeacherInviteResult

Projeção validada da resposta de criação: id, code, role literal PROFESSOR, isActive literal true, createdAt, expiresAt, updatedAt. O schema verifica formato e instantes válidos, validade exata e ausência de estados incompatíveis; mapper descarta campos/erros brutos e não registra resultado. Nenhum uso desse modelo em query keys, mutation cache, contexto global, navegação ou storage.

### TeacherInviteFlow

| Elemento      | Responsabilidade                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| authorization | checking, authorized, indeterminate, invalid; reflete verificação do perfil no foco/resume.                      |
| generation    | initial, pending, result, generation-error; erro pode indicar resultado incerto.                                 |
| result        | Último convite recebido nesta visita; permanece em falha posterior enquanto autorizado.                          |
| copy          | idle, pending, success, error; independente da emissão.                                                          |
| guards        | userId, role atual, sessionGeneration, focus/operation epochs e mounted; refs síncronas de uma operação por vez. |
| expiry        | Derivado de expiresAt e relógio local; informa prazo, sem afirmar consumo remoto.                                |

**Transições**:

- Foco/resume → checking → authorized ou indeterminate/invalid. Somente authorized habilita ações; leitura não gera convite.
- Gerar → pending → result; falha → generation-error preservando último resultado recebido. Timeout/cancelamento/response inválida não permitem replay automático.
- Copiar → pending → success/error. Nunca dispara geração; erro preserva código selecionável.
- Gerar outro com sucesso substitui exibição, sem revogar anterior. Erro não renomeia anterior como novo.
- Vencimento local conserva resultado para leitura, indica prazo encerrado e desabilita copiar; geração de outro continua deliberada quando autorizada.
- Blur/unmount/logout/mudança de usuário ou papel/401/403 → limpar resultado e feedback, invalidar continuations e redirecionar conforme identidade. Background oculta/bloqueia até revalidação; não reapresentar em outra visita.

Promessas tardias somente atualizam o estado se todas as guardas continuarem válidas. Abort do cliente não comprova cancelamento/rollback no servidor. A área de transferência do SO não é armazenamento local controlado pelo aplicativo e não é lida nem limpa automaticamente.

## Proteção de dados e fixtures

Não guardar código em logs, erros Axios/Prisma/Zod, snapshots, exemplos ou arquivos de evidência. Fixtures versionadas usam placeholders/sentinelas sintéticos sem valor operacional. Testes que geram segredo no banco isolado comparam em memória e não imprimem payloads ou persistem dumps.

Helper de ADMIN é exclusivamente de testes: cria conta no banco isolado usando hash de senha e depois login HTTP. Não é endpoint, seed de produção nem procedimento de gerenciamento ADMIN. Preserve todas as relações/testes de sessões, perfil, conta, turmas e comunicados já presentes.
