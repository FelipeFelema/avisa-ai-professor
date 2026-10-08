# Research: decisões para a Spec 012

**Status**: decisões de planejamento concluídas; comprovação operacional futura. **Data**: 2026-10-07.

Base: [inspeção read-only](baseline-inspection-2026-10-07.md), pesquisa delegada somente leitura de auth/authz/push e constitution 2.1.0. Sem esclarecimento necessário para produzir o plano. Hospedagem e configuração real serão inventariadas antes da execução operacional, sem inferir valores.

## R1 — Assessment antes de remediação

**Decision**: Inventário de superfícies, finding rastreável, teste negativo/reprodução antes de mudança e reteste depois. Remediação significativa recebe registro de decisão e apresentação ao proprietário antes de código.

**Rationale**: Há controles robustos e testes; ausência de detalhe explícito não demonstra vulnerabilidade.

**Alternatives considered**: Redesenhar auth/push ou instalar infraestrutura enterprise sem achado; rejeitados por escopo/risco.

## R2 — Auditoria atual e inclusão no artefato

**Decision**: `npm audit --json` e `npm audit --omit=dev --json` em backend/mobile; capturar saída/exit code e correlacionar lockfile, `npm explain`/`npm ls`, advisories primários e export Android production com sourcemap/metadados de módulos. Revalidar no artefato final se dependências/configuração mudarem.

**Rationale**: dev=false e omit-dev não provam execução Android. Audit consulta advisories atuais e exit code não zero por findings exige triagem, não falsa atribuição a infraestrutura. [Documentação npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/).

**Alternatives considered**: Reutilizar contagens da 010 ou `npm audit fix --force`; rejeitados. Atualização transitiva/override seletivo compatível exige justificativa/teste/lockfile; nenhum pin antes da triagem atual.

## R3 — Push: credenciais e limites da prova

**Decision**: Verificar Enhanced Push Security no EAS e FCM V1 com prova sanitizada; credencial de envio Expo e JSON de service account fora de Git/bundle. `google-services.json` é configuração cliente, distinta da chave privada de service account; revisar conteúdo sem tratá-los como equivalentes.

**Rationale**: Segurança aprimorada acrescenta autenticação ao envio; tickets/receipts documentam estágios do provedor, não comprovam sozinhos visualização pelo usuário. [Expo: envio e proteção adicional](https://docs.expo.dev/push-notifications/sending-notifications/).

**Alternatives considered**: Bearer Expo no mobile, inferir configuração externa pelos unit tests ou garantir entrega exatamente uma vez pelo provedor; rejeitados.

“Expo Push Token somente no backend”: o cliente precisa obter transitoriamente o token da instalação e enviá-lo pela API autenticada. Não persistir/exibir/logar token no cliente nem embutir valor real no artefato. Persistência e uso para envio são backend; `EXPO_PUSH_ACCESS_TOKEN` nunca chega ao cliente. Capability local fica em SecureStore conforme 010, com hash no backend, viabilizando revogação offline.

Na execução, conferir as associações de projeto/package com a [documentação FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/) e revisar variáveis públicas, que são incluídas no código cliente conforme a [documentação de environment variables](https://docs.expo.dev/guides/environment-variables/).

## R4 — Intenção por usuário/dispositivo

**Decision**: Primeiro uso contextual; escolha local versionada por userId autenticado + installationId. Relogin pode recuperar intenção e oferecer confirmação explícita para novo binding, sem reabrir registro terminal. Logout neutraliza vínculo remoto e mantém só intenção isolada. Outra conta não herda; preferência v1 sem dono não vira consentimento v2.

**Rationale**: Intenção, permissão nativa, binding e sessão são estados distintos. Confirmação explícita atende à avaliação sem introduzir consentimento silencioso.

**Alternatives considered**: Preferência global, religar automaticamente em qualquer login, reabrir REVOKED; rejeitados. Se avaliação não provar segurança, manter ativação manual atual e registrar decisão no checkpoint US5, sem nova spec.

## R5 — Produção e recovery

**Decision**: Perfil production dedicado, API HTTPS sem fallback local nesse perfil, diagnostics false e secrets segregados. Ensaio deploy/recovery em `avisa_ai_test`; fail-fast/sanitização conforme finding. Runbook distingue falha parcial, restore e rollback de app compatível.

**Rationale**: migrate deploy aplica migrations; migrate resolve registra estado, não desfaz SQL nem substitui backup. Sem promessa de rollback automático. [Prisma: recovery de migrations](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing).

**Alternatives considered**: reset em banco real, downgrade cego ou preview como production; rejeitados.

## R6 — Gate único, escopo individual e autorização

**Decision**: Gate agrega prova local, audit triado, walkthrough individual, smoke production e CI final. Planejamento é `NOT EVALUATED`; fechamento é READY ou BLOCKED. iOS/campanhas especializadas são `DISPENSADA POR ESCOPO`, sem tarefas executáveis.

**Rationale**: Constituição e autorização atual. Artefatos não autorizam implementar, operar produção, build externo/publicar, commit/push/PR ou alterar credentials/painéis.

**Alternatives considered**: READY com CI 011 ou nova spec automática; rejeitados.
