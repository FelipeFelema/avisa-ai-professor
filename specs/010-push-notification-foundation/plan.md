# Implementation Plan: Push Notification Foundation

**Branch**: `010-push-notification-foundation` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/010-push-notification-foundation/spec.md`

## Summary

Criar a fundação de push para PARENT, PROFESSOR e ADMIN: consentimento explícito no Perfil, identidade privada de instalação, vínculo autenticado à sessão, rotação/invalidação, logout online/offline e teste neutro somente para a instalação corrente. Expo Notifications obtém o Expo Push Token; um novo domínio NestJS `push` persiste vínculos no PostgreSQL e usa o Expo Push Service por adaptador isolado.

Reservar um vínculo inelegível antes de ativá-lo permite salvar sua referência de revogação antes de enviar o token. Revogação é terminal para esse vínculo; rotação possui revisão separada. Elegibilidade consulta a sessão vigente no banco. Tentativas e recibos persistidos permitem retomada após reinício sem reenviar testes com resultado ambíguo. Regras de comunicado novo, expiração, membros e deep links permanecem nas specs 011/012.

## Technical Context

**Language/Version**: TypeScript; Node.js 22.12+; backend TypeScript 5.9.3; mobile TypeScript ~6.0.3, conforme manifests atuais.

**Primary Dependencies**: NestJS 11, Prisma 7.6, PostgreSQL 15+, class-validator, JWT/Passport; Expo ~57.0.26, React Native 0.86.3, Expo Router ~57.0.24, React Query, Axios, Zod, Notifications ~57.0.21, Device ~57.0.2, Constants ~57.0.15 e SecureStore ~57.0.4. Adicionar `expo-crypto` via `npx expo install` para UUID/segredo criptográfico, sincronizando lockfile. Backend usa `fetch`/crypto nativos; sem SDK adicional, Redis, Bull ou framework de agendamento.

**Storage**: três modelos novos (`PushInstallation`, `PushRegistration`, `PushTestAttempt`), uma migração aditiva; identidade/capability/pendência no SecureStore, marcador e opt-in não secretos em AsyncStorage com exclusão de backup. Expo token permanece transitório no cliente, fora dos caches genéricos.

**Testing**: Jest backend unitário/cobertura, integração PostgreSQL, E2E/Supertest e OpenAPI; Jest/RNTL mobile com SDK/provedor mockados, timers controlados, storage e geração de sessão. Gates dos workflows existentes e walkthrough individual viável, atribuído ao executor.

**Target Platform**: API NestJS/PostgreSQL e app Android/iOS em build compatível configurado. Web, Expo Go e simuladores são indisponíveis para ativação nesta feature conforme a spec; export web continua possível sem invocar SDK nativo. A restrição de simulador é decisão da spec, não limitação universal do Expo.

**Project Type**: mobile + API REST `/api/v1`.

**Performance Goals**: single-flight mobile; uma tentativa de teste em curso e no máximo uma aceita por instalação/30 s, controladas no banco; um envio/um destino por teste; payload neutro <4 KiB; timeout externo 5 s. Primeira consulta de receipt ~15 min após envio, deadline 24 h, lotes de até 100 receipts e duas chamadas externas concorrentes. SC-005 mede ativação em até 2 min, sem prometer latência de entrega.

**Constraints**: tokens/capabilities ausentes de logs, URLs e respostas públicas; configuração ausente degrada somente push; pendência não conserva JWT; vínculo revogado nunca reativa. Envio ambíguo não tem retry automático. Testes destrutivos somente em PostgreSQL local `avisa_ai_test`, com guardas ativas. Limite de posse de token/SC-007 explícito em [research.md](research.md#r3-ownership-e-posse-do-token).

**Scale/Scope**: três roles, múltiplas instalações independentes por conta, um vínculo corrente por instalação, uma tela, cinco operações HTTP de push, três tabelas. Sem hipótese de número de usuários ou SLA ainda não medido.

## Constitution Check

Gates avaliados antes da pesquisa e reavaliados após desenho sob constituição 2.1.0, incluindo `Validation Scope for This Individual Project`.

| Gate                    | Antes                                       | Após desenho / evidência planejada                                                                                                                              |
| ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Modularidade         | PASS: camadas existentes inspecionadas      | PASS: domínio push, adaptador e coordenador separado de tela; Prisma para sessão; sem dependência circular Auth/Users/Push                                      |
| II. Segurança/contratos | PASS: JWT traz id/sid confiáveis            | PASS: JWT + capability para reserva/estado/ativação/teste; revogação sem JWT limitada ao binding conhecido; DTO/header validados, colisões e ownership testados |
| III. Entrega testável   | PASS: suites/workflows identificados        | PASS: matriz automatizada cobre concorrência PostgreSQL, provider/SDK mocks, storage e session-generation                                                       |
| IV. Integridade         | PASS: schema/migrations canônicos           | PASS: migração aditiva, FKs/cascatas/uniques/CAS, recuperação conservadora e banco de teste isolado                                                             |
| V. UX                   | PASS: português/temas/primitivas existentes | PASS: estados distintos, consentimento explícito, recusa/indisponibilidade não bloqueiam app; semântica e texto ampliado por automação viável                   |
| Dependências            | PASS: Notifications/Device instalados       | PASS: único pacote novo expo-crypto justificado; plugin de backup usa infraestrutura Expo; lockfile/Doctor/export obrigatórios                                  |
| Escopo individual       | PASS: política lida antes do setup          | PASS: proprietário pode ser único executor; relatos PASS (user-reported); campanhas especializadas/participantes DISPENSADA POR ESCOPO                          |
| CI/terceiros            | PASS: workflows inspecionados               | PASS: gates e configuração externa não são dispensados pela política individual                                                                                 |

PASS nesta tabela significa conformidade do desenho, não testes executados. **Gate de aderência à SC-007: PASS (desenho), clarificação resolvida em 2026-10-05.** O proprietário delimitou explicitamente a SC-007 aos vínculos protegidos já registrados pelo fluxo controlado da aplicação. A spec foi atualizada; tentativas não autorizadas contra esses vínculos mantêm zero-envios e zero alterações na vítima. Garantia universal de posse de token desconhecido não integra o critério e não haverá desafio por notificação. Expo Push Token não constitui atestação de posse do dispositivo; rationale e alternativas rejeitadas permanecem em research R3. Não há outros gates bloqueantes de planejamento; testes, migração, configuração operacional e CI continuam exigidos na implementação.

## Project Structure

### Documentation (this feature)

```text
specs/010-push-notification-foundation/
├── spec.md                         # SC-007 e clarificação atualizadas pela decisão do proprietário
├── checklists/requirements.md      # decisão e gate de planejamento registrados
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   ├── push-api.md
│   └── mobile-and-provider.md
└── quickstart.md
```

`tasks.md` pertence a `$speckit-tasks` e não é gerado neste estágio.

### Source Code (repository root, proposed)

```text
backend/
├── prisma/schema.prisma
├── prisma/migrations/              # nova migração gerada na implementação
├── .env.example
├── src/app.module.ts
├── src/push/
│   ├── push.module.ts
│   ├── push.controller.ts
│   ├── push-registration.service.ts
│   ├── push-test.service.ts
│   ├── push-receipts.worker.ts
│   ├── expo-push.adapter.ts
│   ├── dto/
│   └── guards/installation-capability.guard.ts
├── test/push-registration.integration.spec.ts
├── test/push-lifecycle.concurrency.integration.spec.ts
├── test/push.e2e-spec.ts
├── test/openapi.contract.spec.ts
└── test/helpers/test-database.helper.ts
mobile/
├── app.config.ts                   # configuração existente + push, substitui app.json
├── eas.json                        # profile preview interno, sem credenciais
├── plugins/with-push-storage-backup.js
├── .env.example
├── package.json / package-lock.json
├── app/(app)/(tabs)/profile.tsx
├── app/(app)/profile/notifications.tsx
├── src/providers/{AuthProvider,AppProvider,PushProvider}.tsx
├── src/services/push/{push.service,push-device.service,push-lifecycle}.ts
├── src/hooks/usePushNotifications.ts
├── src/storage/push.storage.ts
├── src/validations/push.schema.ts
├── src/types/push.ts
└── tests/{services,hooks,storage,providers,routes}/
specs/001-app-quality-readiness/contracts/openapi.json
```

**Structure Decision**: conservar backend/mobile. PushModule consulta User/AuthSession via Prisma sem importar AuthModule; reutiliza JwtAuthGuard/estratégia existente. FK cascade de AuthSession e filtro de sessão ativa cobrem exclusão/revogação sem alterar login, refresh, mudança de senha/e-mail ou a transação da 008. Atualizar helpers de limpeza e testes de exclusão para novas relações. Unit tests ficam junto às classes; paths acima delimitam responsabilidades propostas.

## Delivery Boundaries

1. Fundamentos: DTOs/contratos, schema/migração, capability privada, reserva inelegível e adaptador mockável.
2. US1: Perfil/tela, SDK/configuração, consentimento, reserva persistida e ativação. Estado indisponível funciona sem credenciais reais.
3. US2: opt-out, rotação, troca de conta, pendência de revogação, session-generation, cascatas e concorrência.
4. US3: cooldown persistido, envio neutro, receipts e foreground. Nenhum seletor público de destinatário.
5. Consolidação: contrato runtime/canônico, regressão, gates, documentação operacional e walkthrough individual.

Consumidor de receipts é recuperação do transporte: nunca cria notificações nem agenda comunicados. FR-029 é aplicado ao agendamento de notificações de negócio descrito nos limites da spec; não introduzir scheduler de domínio, cron de expiração ou jobs de envio.

## Validation and Traceability

| Cobertura           | FR / SC                                        | Evidência na implementação                                                                                                  |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Permissão/config/UX | FR-001–006, 013–014, 019, 025, 028; SC-001/005 | quatro estados, config ausente, opt-in/out, foreground, temas/semântica e walkthrough atribuível                            |
| Ownership/registro  | FR-007–012, 027; SC-002/003/007/009            | 2 contas × 2 sessões × 2 instalações, capability/DTO adulterados, CAS, colisão e zero efeitos na vítima                     |
| Sessão/conta        | FR-015–019, 030; SC-004/010                    | logout online/offline/storage falho, troca de conta, refresh mesmo sid, revogação outras sessões, expiry e cascade          |
| Transporte/teste    | FR-020–024, 029; SC-004/006/009/010            | tickets/receipts, retry de consulta, token revision, cooldown multiprocesso, timeout/crash e recebimento separado do aceite |
| Privacidade         | FR-025–027; SC-008                             | sentinelas sintéticas em tokens/secrets e captura de logs/erros/URLs; nenhuma resposta bruta/cause sensível                 |

Guia em [quickstart.md](quickstart.md). Campanhas especializadas não são pendência; segurança de terceiros e CI continuam gates.

## Complexity Tracking

Sem exceção à constituição. Reserva/revogação terminal e receipts persistidos atendem logout sem JWT, respostas fora de ordem, concorrência e reinício. Um par userId/token ou timers só em memória não atende esses requisitos. Expo Crypto e configuração de backup são necessários para aleatoriedade e identidade de instalação sem hardware ID.

## Planning Completion

**Status**: concluído até Phase 1 em 2026-10-05, na branch `010-push-notification-foundation`. A decisão explícita registrada em spec Clarifications e research R3 resolve a única clarificação bloqueante. Plan, research, data model, dois contratos e quickstart estão consistentes com a SC-007 delimitada e com a constituição 2.1.0.

Verificações documentais concluídas: setup-plan e check-prerequisites com RequireSpec resolveram a feature corretamente; oito documentos não vazios, links locais existentes, sem placeholders ou bloqueio obsoleto, Prettier e git diff --check passaram. Apenas os seis documentos necessários à clarificação/fechamento foram alterados; data-model e contrato mobile/provedor permaneceram idênticos por SHA-256. Não existe `.specify/extensions.yml`; nenhum hook before_plan/after_plan registrado. Esta conclusão é do planejamento, sem execução de testes do produto, migrações, envios reais ou CI. Próximo estágio autorizado separadamente: `$speckit-tasks`; não gerar tasks nem iniciar implementação neste fechamento.
