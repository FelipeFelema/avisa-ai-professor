# Research: Admin Teacher Invite Management

**Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Pesquisa baseada no checkout atual, com investigações somente leitura de backend e mobile e conferência de fontes primárias. Todas as escolhas técnicas foram resolvidas; a emenda constitucional é um pré-requisito de governança explícito, não uma lacuna técnica. Esta pesquisa não valida execução da feature.

## 1. Contrato de geração restrito

**Decision**: alterar o POST existente para corpo fechado com um campo obrigatório `role: PROFESSOR`; remover `expiresInDays` e qualquer possibilidade ADMIN. Serviço fixa papel e validade. Preservar campos de resposta existentes e operationId.

**Rationale**: `backend/src/invites-code/dto/create-invite-code.dto.ts` já usa metadata de validação/OpenAPI; manter um literal validado evita depender de uma classe DTO vazia. `configure-app.ts` já habilita whitelist e rejeição de extras. Restringir também tipos/service/cadastro impede bypass por chamadas internas.

**Alternatives considered**: endpoint paralelo deixaria caminho antigo privilegiado aberto; aceitar ADMIN e convertê-lo viola FR-006; manter duração configurável contraria o escopo; corpo vazio requereria tratamento de validação específico sem benefício material.

**Evidence**: controller/service/DTO e `types/invite-code-role.types.ts` atuais aceitam PROFESSOR e ADMIN; controller possui JWT + RolesGuard ADMIN. `backend/test/openapi.contract.spec.ts` compara runtime com baseline da spec 001, portanto ambos deverão ser atualizados na implementação.

## 2. Entropia, colisão e relógio

**Decision**: `PROF-` mais 16 bytes de `randomBytes` em hex maiúsculo (128 bits); unique existente e até três tentativas totais, restritas a colisão de `code`. Persistir criação e expiração a partir de um único instante com delta 604800000 ms.

**Rationale**: a geração atual usa três bytes (24 bits), sem tratamento de colisão, e calcula expiração separada do default de criação. A escolha de 16 bytes é decisão de design para um segredo de cadastro; não é uma exigência numérica da spec. A API criptográfica é suportada no Node 22. [Node.js 22 crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptorandombytessize-callback)

**Alternatives considered**: timestamp/contador é previsível; manter 24 bits aumenta colisões e espaço enumerável; aumentar entropia sem unique não prova unicidade. Repetição de POST pelo cliente não trata uma resposta perdida. Cada retry por unique ocorre depois do rollback e em transação nova.

Não exigir novo formato dos convites PROFESSOR históricos: o validador público aceita registros existentes válidos, inclusive de formato antigo. O schema mobile de resultado de geração pode exigir o formato novo, pois só recebe convites novos.

## 3. Autoridade de sessão e papel

**Decision**: reutilizar guards existentes e revalidar User/AuthSession sob locks na transação da emissão. Mobile revalida perfil em foco/resume e trata 401/403; visibilidade local não concede acesso.

**Rationale**: `JwtStrategy` resolve sessão ativa e retorna o usuário atual do banco; o papel não vem apenas de JWT antigo. Revalidação no serviço fecha a janela entre guard e persistência, usando identidade/sid derivados do servidor. Ordem User → AuthSession é compatível com operações já presentes de perfil/senha/exclusão.

**Alternatives considered**: confiar em `role` do body/token ou esconder botão não cumpre FR-002; duplicar autenticação ou criar novo contexto ADMIN seria desnecessário. Sem canal em tempo real, mudança de papel externa só pode ser detectada ao comunicar com servidor; bloquear ações em verificação pendente/indeterminada, sem afirmar detecção instantânea offline.

## 4. Consumo atômico e vencimento estrito

**Decision**: hash de senha fora da transação; `UsersService` orquestra consumo PROFESSOR e `user.create` no mesmo `Prisma.TransactionClient`. Bloquear InviteCode por código e desativar somente se papel/estado/expiração continuam válidos. Usar instante real após lock e igualdade como vencido.

**Rationale**: `validateInviteCode` hoje desativa pelo Prisma global antes de `user.create`; erro posterior perde convite. Transação permite rollback integral. Locks serializam a disputa pelo mesmo convite, e a segunda tentativa não cria conta. [Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions), [PostgreSQL 15 row locks](https://www.postgresql.org/docs/15/explicit-locking.html)

As colunas existentes usam `TIMESTAMP(3)` sem timezone. Comparação raw usa `clock_timestamp() AT TIME ZONE 'UTC'`; `NOW()` representaria início da transação e uma conversão implícita de timezone seria incorreta. Atualizar `updatedAt` de consumo em UTC também. [PostgreSQL 15 date/time](https://www.postgresql.org/docs/15/functions-datetime.html)

**Alternatives considered**: duas operações globais separadas não oferecem rollback; checar apenas antes de aguardar lock aceita vencimento durante a espera; `gte` aceita o instante exato de expiração. Não expandir para tabelas de uso, serialização global ou transação envolvendo toda emissão de tokens.

## 5. ADMIN histórico e fixtures

**Decision**: recusar todo convite não PROFESSOR no registro público com erro genérico; manter registros históricos sem mostrar, desativar ou apagar. Provisionar ADMIN de testes pelo Prisma com hash existente e autenticar pelo login HTTP.

**Rationale**: não é necessária migração: `InviteCode` já tem code unique, role, isActive, criação e expiração. ADMIN é papel de contas legítimas existentes e não deve ser removido do enum global. Fixtures atuais em `classrooms.integration`, `users.integration`, `profile.e2e` e `account-deletion.e2e` usam o caminho público que deixará de existir.

**Alternatives considered**: excluir enum ADMIN quebraria autorização/contas; limpar convites históricos excede escopo; deixar fixtures elevarem por registro mascararia a proibição. O helper de teste não é uma API de provisionamento de produção.

## 6. Estado mobile e replay

**Decision**: hook imperativo com estado/ref local; POST autenticado com `noAuthReplay: true`, guarda de sessão/identidade/papel/foco/epoch, abort e zero retry automático. Mapper de erro retorna apenas categoria/status/mensagem segura.

**Rationale**: `mobile/src/lib/api.ts` já suporta o flag, mas em 401 apenas rejeita a resposta; hook precisa chamar `expireSession`. React Query poderia conservar código no mutation cache. AuthProvider oferece `applyProfileUpdate` e `expireSession`; código não participa desses dados globais.

**Alternatives considered**: mutação cacheada, persistência e navigation params violam segredo transitório. Confundir cancelamento com rollback do servidor é incorreto. Resultado perdido pode permanecer ativo; apresentar incerteza e permitir apenas novo gesto deliberado. Guardar somente `sessionGeneration` não detecta rebaixamento do mesmo usuário.

## 7. Clipboard e acessibilidade

**Decision**: adicionar `expo-clipboard` com `npx expo install expo-clipboard` somente na implementação; copiar código exato no gesto explícito com `setStringAsync`, tratando boolean false e rejection. Usar texto selecionável e feedback sem segredo. Revalidar perfil antes de habilitar o botão, sem await HTTP entre gesto e escrita no navegador.

**Rationale**: dependência ausente no manifest; API oficial atende Android/iOS/web e documenta retorno boolean e limitação WebKit de execução assíncrona. [Expo SDK 57 Clipboard](https://docs.expo.dev/versions/v57.0.0/sdk/clipboard/)

**Alternatives considered**: clipboard legado React Native ou plugin próprio aumenta risco de compatibilidade; leitura para conferir invade conteúdo do SO; apagar clipboard ao sair pode destruir conteúdo que a pessoa copiou depois. Controle do SO após gesto está fora do estado local da feature.

Exibir data/hora locais a partir do instante absoluto; usar tokens/componentes existentes, scroll, texto ampliado e feedback acessível sem depender de cor. Rótulo após vencimento é “Prazo encerrado”; não consultar nem afirmar estado remoto de consumo, pois listagem/consulta de convites está fora do escopo.

## 8. Constituição e limite da pesquisa

**Decision**: documentar exceção somente para planejamento, com responsável/expiração/follow-up em [plan.md](./plan.md), e exigir emenda revisada antes de implementar a nova política ADMIN.

**Rationale**: a constituição exige cadastro privilegiado por convite sem distinguir ADMIN. A spec define ADMIN manual; registrar apenas PASS esconderia a incompatibilidade. Nenhuma alteração constitucional é feita neste workflow.

**Alternatives considered**: ignorar a frase, tratá-la como já emendada ou preservar cadastro ADMIN contraria governança ou requisito explícito. Não há outra decisão técnica aguardando clarificação. Auditoria ampla, novos controles distribuídos de abuso e provisionamento ADMIN no app permanecem excluídos.
