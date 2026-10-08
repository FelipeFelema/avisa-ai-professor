# Decisão aprovada e implementada — SEC-001 / T010

Em 2026-10-07 o proprietário aprovou explicitamente revogação server-side somente do sid atual e recuperação offline persistida em SecureStore, proibindo access/refresh tokens, senha e dados pessoais na fila. A proposta anterior baseada em refresh foi substituída por capability opaca exclusiva de revogação. Não houve aceite de risco de replay após ACK.

## Contrato e autoridade

- GET /api/v1/auth/session-revocation exige JWT/sid ativo. O servidor usa exclusivamente sub/sid autenticados; IDs em query não selecionam vítima. Retorna somente {sid, capability}, Cache-Control: no-store.
- A capability é HMAC-SHA256, domínio avisa/session-revocation/v1 + sid, usando JWT_REFRESH_SECRET no servidor. Não é JWT nem digest de access/refresh token. Não permite leitura, login, refresh ou revogar outro sid. É estável durante rotação de tokens. Comparação canônica e timingSafeEqual precedem DB; UUID/capability e campos extras validados pelo DTO.
- POST /api/v1/auth/logout aceita somente {sid, capability}, sem JWT, rate limitado pelo guard existente. Sob lock User→AuthSession compatível com refresh, updateMany revoga apenas sid/owner e revokedAt:null. 204 vazio/no-store confirma revogação, inclusive repetição/sessão expirada/removida. Access e refresh daquele sid passam a 401; outras sessões válidas permanecem ativas. Falha de persistência retorna 500 sanitizado e mantém pendência.
- Inventário OpenAPI fechado ampliado de 27 para 29 operações com [extensão da Spec 012](../contracts/session-revocation.openapi.json), sem editar contrato histórico 001, schema Prisma ou respostas de login/register/refresh.

## Persistência e recuperação

Metadata atual e fila no SecureStore têm somente sid/capability, sem identidade, data, senha ou token de autenticação. Login/restauração só expõem usuário autenticado após obter e salvar essa metadata. Logout captura a metadata em operação serializada antes de invalidar geração e remover tokens; preserva preparação/cleanup push das 010/011. Falha de backend/rede não bloqueia conclusão local.

Fila deduplicada sobrevive ao restart. Drena no mount, resposta HTTP que prova conectividade, retorno ao foreground e a cada 30s em foreground mesmo deslogado; transporte sem bearer/refresh automático, timeout 10s. Só ACK 204 remove a entrada exata. Respostas de logout não geram loop de reconexão. Falha de escrita conserva metadata atual como recovery, posteriormente enfileirada quando tokens estão ausentes. Falha de SecureStore sinaliza recuperação local; não se declara persistência concluída quando o armazenamento falha.

Logout offline conclui localmente, com revogação remota pendente até conectividade e ACK. Cada login/register começa nova geração; cleanup/ACK de A não limpa usuário, cache, tokens, metadata ou pendência de B. Capabilities antigas podem drenar sem autenticação de B, sempre vinculadas ao sid de A.

Limite operacional: rotação de JWT_REFRESH_SECRET invalida capabilities antigas; retorno 401 não é ACK nem descartado. Rotação de chave deve ser acompanhada por revogação das sessões antigas no procedimento autorizado de recovery/configuração. Nenhuma rotação/deploy externo foi executado. Clientes anteriores sem capability não possuem recuperação retroativa; a aquisição ocorre online ao criar/restaurar sessão nesta implementação.

## Reteste e classificação

SEC-001: Alta, originalmente BLOCKER DE RELEASE; agora **MITIGADO — RESOLVED**, evidência server-side de access/refresh 401 após ACK, múltiplas sessões preservadas, manipulação de IDs negada, expiração/removal/idempotência e concorrência refresh/logout. RED original preservado como histórico nos logs privados; teste negativo continua ativo.

SEC-006: Média (disponibilidade), AuthProvider. Logout A com preparePushLogout atrasado seguido de login B apagava identidade/cache de B. Reprodução: mobile-logout-race-red, 1 FAIL/21 SKIPPED por filtro de reprodução (não checkpoint). Correção: geração independente por login/register e limpeza UI/cache somente se cleanupGeneration vigente; teste completo e teste storage real mockado PASS. Impacto demonstrado foi encerramento indevido local, sem prova de leitura cruzada. **REMEDIAR AGORA → MITIGADO — RESOLVED**.

| Componente | Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- | --- |
| backend | `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/auth.integration.spec.ts test/openapi.contract.spec.ts test/release-fixture.integration.spec.ts` | 2026-10-08T00:04:40.133Z | 2026-10-08T00:05:00.241Z | 0 |
| backend | `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts test/push.e2e-spec.ts test/announcement-push.e2e-spec.ts` | 2026-10-08T00:05:00.300Z | 2026-10-08T00:05:15.376Z | 0 |
| mobile | `node node_modules/jest/bin/jest.js --runInBand tests/providers/AuthProvider.spec.tsx tests/lib/api-session.spec.ts tests/services/session-revocation.spec.ts tests/storage/auth.storage.spec.ts` | 2026-10-08T00:02:52.203Z | 2026-10-08T00:02:55.985Z | 0 |
| mobile | `npm run test:ci` | 2026-10-08T00:03:23.866Z | 2026-10-08T00:03:57.765Z | 0 |

T010/T018 avaliadas e concluídas somente depois destes checkpoints verdes. Fases 4–6 não iniciadas; não há autorização para Git/produção/publicação.
