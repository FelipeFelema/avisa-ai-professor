# Tasks: Push Notification Foundation

**Input**: artefatos de `specs/010-push-notification-foundation/`: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [API](contracts/push-api.md), [mobile/provedor](contracts/mobile-and-provider.md) e [quickstart.md](quickstart.md).

**Prerequisites**: planejamento concluído; SC-007 delimitada pelo proprietário em 2026-10-05; constituição 2.1.0, incluindo `Validation Scope for This Individual Project`.

**Tests**: exigidos pela spec, pela matriz do quickstart e pela constituição. Escrever os cenários antes do comportamento correspondente e verificar falha pertinente; usar SDK/provedor mockados, sem envios reais nas suites. Percentuais dos SC referem-se à matriz finita, sem pesquisa populacional.

**Organization**: Setup → Foundation → US1 (P1) → US2 (P2) → US3 (P3) → consolidação. Todas as tarefas começam abertas; geração deste arquivo não executa implementação, provisionamento, testes do produto ou CI.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: arquivos distintos e nenhuma dependência incompleta dentro do grupo indicado em Dependencies; não significa que fases ou tarefas anteriores possam ser ignoradas.
- `[US1]`, `[US2]`, `[US3]`: histórias da spec; Setup, Foundation e consolidação não recebem label de história.
- Paths são relativos à raiz: `backend/`, `mobile/`, `specs/`. Arquivos novos são propostas do plano; criar somente quando sua tarefa for implementada.
- Preservar WIP. Nenhuma tarefa autoriza staging, commits, push, PR, publicação ou operações remotas de build/EAS.
- Toda migration/limpeza/suite destrutiva local usa exclusivamente PostgreSQL local `avisa_ai_test`, verificando host/nome e mantendo `assertSafeTestDatabase` ativo. Não usar `avisa_ai`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar dependência, configuração segura e isolamento de testes sem ativar push por padrão.

- [x] T001 Registrar baseline de branch/WIP, comandos dos manifests/workflows, fronteiras 010/011/012 e matriz FR/SC em `specs/010-push-notification-foundation/final-validation.md`, sem atribuir PASS a testes não executados nem alterar artefatos de desenho.
- [x] T002 Adicionar somente `expo-crypto` com `npx expo install expo-crypto` a partir de `mobile/`, sincronizando `mobile/package.json` e `mobile/package-lock.json`; conservar Notifications/Device/Constants/SecureStore existentes e não adicionar SDK backend, Redis, Bull ou expo-dev-client.
- [x] T003 [P] Preparar configuração backend em `backend/src/push/push.config.ts`, `backend/src/push/push.config.spec.ts` e `backend/.env.example`: `EXPO_PUSH_ENABLED` boolean default false, `EXPO_PUSH_ACCESS_TOKEN` obrigatório quando enabled e privado; configuração ausente degrada só push, exemplos contêm placeholders e suites usam configuração sintética.
- [x] T004 [P] Preparar mocks de Notifications/Device/Constants/Crypto, storage e timers em `mobile/tests/helpers/push.ts` e `mobile/jest.config.js`, preservando mocks existentes e tornando qualquer transporte externo inesperado uma falha de teste.

**Checkpoint**: dependência/configuração reproduzíveis, nenhum token real ou envio; T003 e T004 podem ocorrer juntas após T002.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: identidade privada, integridade transacional e contratos compartilhados. Bloqueia o início das histórias.

- [x] T005 [P] Escrever testes de inputs/capability em `backend/src/push/dto/push.dto.spec.ts` e `backend/src/push/guards/installation-capability.guard.spec.ts`: headers ausentes/errados, limites antes de decode, comparação segura, body extra/array/query de destino, números fora de faixa e mensagens sem eco de valores privados.
- [x] T006 [P] Escrever testes de identidade/pendência em `mobile/tests/storage/push.storage.spec.ts`: UUID/segredo criptográficos, opt-in default false, referência salva antes da ativação, pendência sem JWT/token/userId/senha, erro de leitura versus marcador realmente ausente e falha de persistência que bloqueia só push.
- [x] T007 Definir `PushInstallation` em `backend/prisma/schema.prisma` com as regras literais de data-model: id "UUID v4 criptográfico da instalação; PK"; secretHash "SHA-256 dos 32 bytes secretos; nunca segredo em claro"; lifecycleVersion "inteiro monotônico >=0; incrementa na reserva de novo vínculo"; lastTestStartedAt "timestamp nullable, cooldown 30 s por instalação entre vínculos"; nextTestAvailableAt "timestamp nullable persistido; considera instante de aceite e timeout de despacho"; testLeaseUntil "timestamp nullable, lease de envio <=15 s"; createdAt/updatedAt "timestamps server-side"; segredo existente nunca é substituído e não há FK reversa para Registration.
- [x] T008 Definir `PushRegistration` e enums em `backend/prisma/schema.prisma`: id "UUID server-side, PK, nunca reutilizado"; installationId "FK Installation, onDelete Cascade"; userId "FK User, onDelete Cascade"; sessionId "FK AuthSession, onDelete Cascade"; lifecycleVersion "inteiro positivo; unique installationId+lifecycleVersion"; platform "ANDROID/IOS, nullable em reserva"; expoToken "string nullable unique global; somente ACTIVE conserva token utilizável"; tokenFingerprint "SHA-256 nullable, privado"; tokenRevision "inteiro >=0; 0 na reserva, aumenta com token/plataforma novos"; state "RESERVED / ACTIVE / REVOKED / INVALID"; reason "nullable USER_DISABLED / LOGOUT / PERMISSION_REVOKED / SESSION_INACTIVE / TOKEN_INVALID / REPLACED"; createdAt/updatedAt/activatedAt/invalidatedAt "timestamps aplicáveis"; índices userId, sessionId e installationId+state.
- [x] T009 Definir `PushTestAttempt` em `backend/prisma/schema.prisma`: id "UUID opaco server-side, deduplicação de feedback, não seletor de destino"; installationId/registrationId "FKs cascade"; tokenRevision/tokenFingerprint "snapshot imutável, sem token em claro na tentativa"; state "SENDING / ACCEPTED / PROVIDER_HANDOFF / REJECTED / UNKNOWN"; failureCode "código sanitizado nullable"; providerTicketId "privado nullable, <=256 caracteres"; startedAt/acceptedAt/completedAt "timestamps"; nextReceiptCheckAt/receiptDeadlineAt "timestamps nullable; prazo 24 h"; receiptLeaseUntil/receiptChecks "lease/contador para recuperação worker"; índice state+nextReceiptCheckAt, sem histórico público.
- [x] T010 Gerar e revisar a migration aditiva em `backend/prisma/migrations/<timestamp>_push_notification_foundation/migration.sql`, incluindo FKs/cascatas/uniques e constraints ACTIVE com token/plataforma/fingerprint/revision>0 e demais estados sem token utilizável; executar validate/generate/deploy somente com banco isolado, sem backfill, drop ou registro ativo inicial.
- [x] T011 Atualizar `backend/test/helpers/test-database.helper.ts` para limpar Attempt → Registration → Installation antes dos dados existentes e criar `backend/test/push-migration.integration.spec.ts` cobrindo instalação nova e dados antigos preservados, unique global/composta, constraints e cascatas sem FK reversa; manter guarda e exigir local `avisa_ai_test` antes de qualquer limpeza.
- [x] T012 [P] Implementar DTOs/views e validação em `backend/src/push/dto/`: `push-installation-headers.dto.ts`, `activate-push.dto.ts`, `revoke-push.dto.ts`, `empty-push.dto.ts` e `push-view.dto.ts`; IDs UUID v4, lifecycleVersion 1..2147483647, expectedTokenRevision/tokenRevision 0..2147483647, ANDROID/IOS, permission somente GRANTED, reasons públicas somente USER_DISABLED/LOGOUT/PERMISSION_REVOKED; token sem trim de 1..512 caracteres, ExpoPushToken/ExponentPushToken com interior ASCII alfanumérico/underscore/hífen de 8..256, sem espaços/controles; body vazio estrito nas operações reserve/test e respostas fechadas sem token/userId/sid/ticket.
- [x] T013 [P] Implementar contratos Zod/tipos equivalentes em `mobile/src/validations/push.schema.ts` e `mobile/src/types/push.ts`, reproduzindo T012 e InstallationView/BindingView/TestAccepted do contrato, incluindo nullable/date-time/enums e validação de respostas, sem guardar token em cache genérico nem tratar permissão local como atestação remota.
- [x] T014 Implementar `backend/src/push/guards/installation-capability.guard.ts`, `backend/src/push/push.module.ts` e registro em `backend/src/app.module.ts`: JWT reutilizado nas quatro operações autenticadas, capability nos cinco endpoints, X-Push-Installation UUID v4 e X-Push-Capability base64url canônico de exatamente 32 bytes/43 caracteres, SHA-256/comparação constante; somente reserve autenticado cria instalação, falhas genéricas e nenhum import circular Auth/Users/Push.
- [x] T015 [P] Implementar storage em `mobile/src/storage/push.storage.ts`: identidade SecureStore UUID+32 bytes secretos gerados por Crypto, iOS WHEN_UNLOCKED_THIS_DEVICE_ONLY, marcador/opt-in não secretos AsyncStorage, opt-in false prevalecente; current binding "SecureStore bindingId/lifecycleVersion, salvo antes de ativar" e pending revocation "SecureStore installationId/segredo+bindingId/lifecycleVersion/reason; sem JWT/token/userId/senha; remover somente após 204"; falha de leitura entra em recovery e ausência confirmada de marcador reinicia somente push, sem tocar conta/tema.
- [x] T016 Criar helpers transacionais/eligibilidade em `backend/src/push/push-registration.service.ts` e testes em `backend/src/push/push-registration.service.spec.ts`: ACTIVE com token, vínculo corrente, User existente e AuthSession.userId correspondente, revokedAt=null/expiresAt>now; autenticadas travam User → AuthSession → instalações ordenadas por UUID → Registration; capability-only/receipts travam instalações → Registration sem adquirir User/AuthSession depois; SQL/unique errors sanitizados, HTTP fora de tx e REVOKED terminal.

**Checkpoint**: schema/client e contratos prontos; T005/T006/T011 passam. Não existe ativação pública nem transporte de teste neste checkpoint.

---

## Phase 3: User Story 1 — Ativar notificações neste dispositivo (Priority: P1) — MVP

**Goal**: entrada no Perfil, permissão explícita, reserva persistida e ativação confirmada para a própria sessão; recusa/indisponibilidade não bloqueiam o app.

**Independent Test**: com SDK/provedor mockados, executar not-requested/granted/denied/unavailable para as três roles; abrir tela/restaurar sessão não chama prompt. Somente escolha explícita + token real do SDK + configuração/sessão válidas permite ACTIVE; reserva perdida ou SecureStore falho não ativa. Reabrir mantém um vínculo sem duplicação.

### Tests for User Story 1

- [x] T017 [P] [US1] Escrever `backend/test/push-registration.integration.spec.ts` para reserve/state/activate, reserva idempotente, ACTIVE sem duplicatas, resposta perdida, revisão inicial, matriz de capability/ownership e ausência de configuração; preparar vínculos protegidos pelo fluxo controlado e verificar zero-envios/zero alterações na vítima nas negativas da SC-007, sem desafio por push.
- [x] T018 [P] [US1] Escrever `backend/test/push.e2e-spec.ts` para PARENT/PROFESSOR/ADMIN, JWT/capability inválidos, sessão revogada entre guard/tx, DTOs/headers/body/query extras, limites de token/inteiros, status/envelopes e no-store em sucesso/erro; mock de envio deve receber zero chamadas para reserve/state/activate.
- [x] T019 [P] [US1] Escrever `mobile/tests/services/push-device.service.spec.ts` e `mobile/tests/config/push-config.spec.ts` para Android/iOS/provisional/ephemeral, canal antes de permissão/token, projectId ausente, web/Expo Go/simulador indisponíveis, SDK/rede falhos e config de build; nenhuma reserva ou token fictício nesses estados.
- [x] T020 [P] [US1] Escrever `mobile/tests/hooks/usePushNotifications.spec.ts` e `mobile/tests/routes/profile-notifications.spec.tsx` para estados/roles, prompt somente por ação, recusa/configurações, single-flight, reserva persistida antes de PUT, opt-in false, resposta incerta, temas/labels/roles/disabled/wrapping e navegação sem bloquear outras funções.
- [x] T021 [P] [US1] Escrever `mobile/tests/plugins/with-push-storage-backup.spec.ts` para merge de configs existentes, exclusões SecureStore e database AsyncStorage em fullBackupContent/cloud-backup/device-transfer e flag iOS, usando fixtures temporárias sem prebuild destrutivo em WIP.

### Implementation for User Story 1

- [x] T022 [US1] Implementar reserve/state em `backend/src/push/push-registration.service.ts`: reserve só após fluxo explícito do cliente, RESERVED sem token, mesmo user/sid retorna binding corrente idempotente, novo vínculo incrementa lifecycleVersion; ACTIVE elegível de outra conta/sid exige DELETE, estado alheio é INACTIVE/null sem IDs; ABSENT não cria instalação, available=false sem config e session ownership revalidado na tx.
- [x] T023 [US1] Implementar ativação inicial/no-op e revogação terminal básica em `backend/src/push/push-registration.service.ts`: conferir bindingId/lifecycleVersion corrente e user/sid, expected revision, limites e config; impedir apropriação de token elegível com 409 seguro sem alterar vítima, ACTIVE igual é no-op; DELETE capability-only revoga RESERVED/ACTIVE/INVALID, limpa token, retries/cascatas/binding alheio dão 204 no-op e nunca atingem novo lifecycle. Rotação completa e colisão inelegível ficam em US2.
- [x] T024 [US1] Expor POST `/api/v1/push/installation/reserve`, GET/PUT/DELETE `/api/v1/push/installation` em `backend/src/push/push.controller.ts`: DTOs/headers/guards, limite JSON 2 KiB restrito a push, rejeição de seleção por query, RateLimitGuard existente, erros sanitizados e Cache-Control no-store inclusive falhas; ajustar CORS PUT/headers de push em `backend/src/configure-app.ts` sem relaxar contratos dos demais domínios. Rota test fica para US3.
- [x] T025 [US1] Sincronizar decorators/runtime e `specs/001-app-quality-readiness/contracts/openapi.json` para as quatro rotas de T024 e estender `backend/test/openapi.contract.spec.ts` com security schemes/headers, schemas fechados, limites, nullable, respostas e DELETE sem JWT; não anunciar a rota test antes de implementá-la.
- [x] T026 [US1] Criar `mobile/app.config.ts` substituindo `mobile/app.json` sem perder campos existentes, `mobile/eas.json` com profile preview interno e placeholders em `mobile/.env.example`: Notifications plugin, Android package, iOS bundleIdentifier, extra.eas.projectId e referência segura GOOGLE_SERVICES_FILE; preservar export/fallback sem configuração, nunca bundle EXPO_PUSH_ACCESS_TOKEN/APNs/service-account, e proteger arquivos de credentials em `.gitignore`.
- [x] T027 [US1] Implementar `mobile/plugins/with-push-storage-backup.js` e conectá-lo em `mobile/app.config.ts`: mesclar regras SecureStore existentes, confirmar nome instalado do database AsyncStorage RKStorage, excluir database em fullBackupContent e dataExtractionRules cloud-backup/device-transfer e fixar RCTAsyncStorageExcludeFromBackup=true no iOS; registrar efeito sobre backup completo de AsyncStorage sem alterar persistência normal do tema.
- [x] T028 [US1] Implementar `mobile/src/services/push/push-device.service.ts`: isDevice + android/ios + build independente configurado, projectId por Constants, canal Android push-test antes da permissão/token, leitura sem prompt e request somente por intenção explícita, mapas iOS autorizada/provisional/ephemeral, Abrir configurações e token Expo real/transitório; web não inicializa SDK/identidade/listeners/handlers.
- [x] T029 [US1] Implementar reserve/state/activate/revoke em `mobile/src/services/push/push.service.ts` e testes em `mobile/tests/services/push.service.spec.ts`: headers privados apenas no transporte, responses Zod, erros traduzidos sem raw AxiosError/config; DELETE usa cliente separado sem JWT/refresh/replay com timeout <=5 s e ACK somente 204; token nunca vai para URL/log/cache genérico.
- [x] T030 [US1] Implementar sequência explícita inicial em `mobile/src/services/push/push-lifecycle.ts`: single-flight, consultar suporte/config/SDK, escoar pendência antes de reserva, obter token, reservar, persistir binding antes de PUT; escrita falha não ativa e tenta revogação best-effort; resposta incerta consulta estado e callbacks de intenção encerrada não ativam reservas.
- [x] T031 [US1] Implementar `mobile/src/hooks/usePushNotifications.ts` e `mobile/src/providers/PushProvider.tsx`, integrar `mobile/src/providers/AppProvider.tsx` preservando bootstrap de tema/Auth: composição dos estados, geração vigente, leitura/reconciliação ao montar/foreground sem prompt nem ativação se opt-in false; hooks/serviços concentram regras fora do JSX, listeners encerrados no unmount.
- [x] T032 [US1] Adicionar entrada Notificações para todas as roles em `mobile/app/(app)/(tabs)/profile.tsx` e tela `mobile/app/(app)/profile/notifications.tsx` com SecondaryScreen/Button/ScreenState/tema: not-requested, denied, unavailable, loading, registering, active, authorized-app-disabled, error/recovery e pending cleanup; português, ações/labels/roles/disabled, texto ampliado e estado sem depender de cor ou exibir IDs/tokens; Enviar teste não é habilitado nesta fase.
- [x] T033 [US1] Integrar Desativar e recuperação básica em `mobile/src/services/push/push-lifecycle.ts` e `mobile/src/hooks/usePushNotifications.ts`: opt-in false antes de revoke, pendência persistida antes de limpar binding, remoção só após 204 correspondente, leitura de permissão separada do opt-out, nova ativação usa novo reserve; erro storage/rede não confirma desativação fictícia.
- [x] T034 [US1] Integrar proteção mínima de logout/troca de sessão em `mobile/src/providers/AuthProvider.tsx` e `mobile/src/services/push/push-lifecycle.ts` antes de permitir o MVP ACTIVE: persistir referência mínima, invalidar geração/cancelar efeitos, opt-in em memória false, DELETE bounded best-effort em paralelo à limpeza atual e bloquear novo reserve se pendência/recovery; nenhuma falha push impede limpeza JWT/cache. US2 completa reconexão/rotação e a matriz de corridas.
- [x] T035 [US1] Atualizar `mobile/tests/routes/profile.spec.tsx` e `mobile/tests/providers/AuthProvider.spec.tsx` para entrada em todas as roles, ausência de prompt espontâneo e cleanup mínimo de T034, preservando comportamento de tema/autenticação/conta e impedindo callbacks da sessão anterior de gravar vínculo.
- [x] T036 [US1] Executar suites de T005/T006/T011/T017–T021/T025/T029/T035 e gates dirigidos backend/mobile dos manifests, registrar resultados reais e fronteira do MVP em `specs/010-push-notification-foundation/final-validation.md`; conferir zero envios, reserva perdida inelegível, recusa/indisponível utilizáveis e nenhuma ativação sem binding persistido.

**Checkpoint**: MVP funcional de consentimento/registro em ambiente controlado; estados indisponíveis funcionam sem credentials. Não declarar fundação concluída/release antes de US2, US3 e consolidação. Cleanup mínimo já protege saídas de sessão; transporte de teste ainda não existe.

---

## Phase 4: User Story 2 — Manter os dispositivos corretos associados à conta (Priority: P2)

**Goal**: múltiplas instalações, rotação e invalidação corretas, logout offline recuperável e isolamento entre contas/sessões.

**Independent Test**: matriz automatizada 2 contas × 2 sessões × 2 instalações; rotação, opt-out, logout online/offline + reinício, troca de conta, refresh, revogação/expiry, permissão removida, reinstall e cascade. Somente registros afetados ficam inelegíveis; pendência é resolvida antes da próxima conta e nenhuma resposta antiga reativa REVOKED.

### Tests for User Story 2

- [x] T037 [P] [US2] Criar `backend/test/push-lifecycle.concurrency.integration.spec.ts` com PostgreSQL real isolado: reserve/rotate/revoke concorrentes, DELETE vencendo PUT, CAS/respostas fora de ordem, token elegível em outra instalação inclusive mesma conta, liberação inelegível sob locks ordenados/unique, sessão revogada entre guard/tx e zero alterações na vítima da SC-007.
- [x] T038 [P] [US2] Estender `backend/test/push-registration.integration.spec.ts` com 2×2×2, refresh mesmo sid, expiry/revokedAt, alterações sensíveis que revogam só outras sessões, cleanup e reativação apenas por novo binding; SDK não é prova universal de posse, nenhum desafio de verificação.
- [x] T039 [P] [US2] Estender `backend/test/account-deletion.integration.spec.ts` e `backend/test/account-deletion.concurrency.integration.spec.ts` com Registration/Attempt, exclusão versus activate/revoke/cascade e registros de outras contas preservados, mantendo advisory gate → User → Classrooms → cascatas e sem alterar semântica LAST_ADMIN_REQUIRED.
- [x] T040 [P] [US2] Criar `mobile/tests/services/push-lifecycle.spec.ts` com logout online/offline/restart, 204-only, pendência antiga versus nova, falhas de storage/rede, troca de conta, opt-out, rotação listener/CAS/409, permission denied, reinstall e descarte por session-generation; callback atrasado nunca grava estado de outra conta.
- [x] T041 [P] [US2] Criar `mobile/tests/providers/PushProvider.spec.tsx` para login/restauração/foreground/reconexão, opt-in false, listeners da geração anterior, cleanup de subscriptions e app utilizável em erro/pending, sem montagem da tela ser requisito de segurança.

### Implementation for User Story 2

- [x] T042 [US2] Completar rotação/múltiplas instalações/colisões em `backend/src/push/push-registration.service.ts`: token/plataforma novos exigem CAS exato e revision+1, retry igual é no-op; conflito elegível preserva vítima, colisão inelegível é liberada atomicamente com instalações ordenadas e sessão antiga reavaliada, unique fecha corrida; REVOKED/INVALID pedem novo reserve e binding nunca é reutilizado.
- [x] T043 [US2] Completar neutralização e cleanup de vínculos em `backend/src/push/push-registration.service.ts`: eligibility independe do estado salvo e consulta sessão vigente; expiração/revogação tornam inelegível imediatamente; remover vínculos de sessão inelegível, RESERVED sem uso e REVOKED/INVALID após 7 dias sem atividade, nunca ACTIVE elegível; Installation sem filhos após 7 dias, preservando filhos de outras contas e DELETE antigo inofensivo após remoção. Invocação operacional periódica fica ligada em T061.
- [x] T044 [US2] Estender `backend/src/push/push-registration.service.spec.ts`, `backend/test/push.e2e-spec.ts` e `backend/test/openapi.contract.spec.ts` com transições terminais, CAS/conflitos sanitizados e invariantes da fase, mantendo no-store/DTOs e documentação canônica coerentes sem alterar autenticação/refresh/senha/e-mail/exclusão existentes.
- [x] T045 [US2] Completar logout no coordenador `mobile/src/services/push/push-lifecycle.ts`: persistir pendência antes de limpar referências/autenticação, timeout DELETE <=5 s, nunca conservar bearer/refresh token; storage falho mantém opt-in em memória false/recovery e best-effort revoke sem prometer persistência/desativação, logout/cache cleanup sempre concluem.
- [x] T046 [US2] Implementar retomada de pendência em `mobile/src/services/push/push-lifecycle.ts` e `mobile/src/storage/push.storage.ts`: nova sessão/foreground/oportunidade de conectividade usa cliente capability-only, nenhum replay da conta anterior, retry limitado por essas oportunidades; remover apenas pendência correspondente após 204, conservar intenção mais nova e bloquear reserve/activate/test até resolver cleanup/recovery.
- [x] T047 [US2] Implementar rotação/permission revocation em `mobile/src/services/push/push-lifecycle.ts` e `mobile/src/services/push/push-device.service.ts`: listener nativo readquire Expo token, serializa intenções e captura geração, 409 consulta estado/readquire token antes de novo CAS; token APNs/FCM nunca enviado como Expo, permissão removida revoga terminal e opt-out não é reativado por foreground.
- [x] T048 [US2] Completar `mobile/src/providers/PushProvider.tsx` e `mobile/src/providers/AuthProvider.tsx` para login/restauração/foreground/troca de conta/exclusão: coordenador compartilhado fora de tela, geração impede efeitos tardios, opt-in resetado no logout/troca exige escolha nova; refresh não cria novo vínculo apenas pela troca de access JWT, conta/tema mantêm cleanup/restauração existentes.
- [x] T049 [US2] Estender `mobile/tests/providers/AuthProvider.spec.tsx`, `mobile/tests/lib/session-generation.spec.ts` e `mobile/tests/routes/profile-delete-account.spec.tsx` com falhas push/late callbacks e limpeza da conta, garantindo noAuthReplay da exclusão existente, independência de rede/provider e tema preservado.
- [x] T050 [US2] Completar estados/actions de recovery, pending cleanup, permission revoked, opt-out e conflito em `mobile/src/hooks/usePushNotifications.ts`, `mobile/app/(app)/profile/notifications.tsx` e `mobile/tests/routes/profile-notifications.spec.tsx`, distinguindo desativação no app de permissão SO e orientando conflito/reinstall sem apropriar token ou exibir identidade anterior.
- [x] T051 [US2] Executar a matriz lifecycle/concurrency/cascade/mobile de T037–T041/T044/T049/T050 e registrar evidência FR-009–019/030, SC-002–004/007/009/010 em `specs/010-push-notification-foundation/final-validation.md`, incluindo invariantes de locks, zero vítimas alteradas e ausência de tokens antigos elegíveis.

**Checkpoint**: ativação e ciclo de vida completos sem depender de envio externo; não há nova notificação de negócio. DeviceNotRegistered de tickets/receipts será integrado/testado na US3.

---

## Phase 5: User Story 3 — Validar a infraestrutura com uma notificação de teste (Priority: P3)

**Goal**: um teste neutro para a instalação vigente, cooldown persistido, resultados honestos e receipts recuperáveis sem reenvio automático.

**Independent Test**: adapter/SDK mockados comprovam destino próprio, payload neutro, ticket/receipt/UNKNOWN, single-flight e limite entre aceites. Negativas disparam zero envios. Walkthrough individual posterior distingue aceite de recebimento observado em uma instalação viável, sem exigir frota física ou campanha Android+iOS.

### Tests for User Story 3

- [x] T052 [P] [US3] Criar `backend/src/push/expo-push.adapter.spec.ts` para endpoints fixos, enhanced security, timeout 5 s, allowlist/limites, ticket ok/error, DeviceNotRegistered, MessageRateExceeded/429/5xx, MessageTooBig/MismatchSenderId/InvalidCredentials, resposta inválida/timeout e ausência de secrets/raw cause em erros; payload neutro de um destino <4 KiB.
- [x] T053 [P] [US3] Criar `backend/src/push/push-test.service.spec.ts` e `backend/test/push-test.concurrency.integration.spec.ts` com dois processos/conexões, uma tentativa em curso, janela entre aceites, token/capability alheios, expiry/revoke antes do despacho, crash/lease/UNKNOWN/restart e nenhum resend; aceite inicial em t=5 s obriga recusar nova intenção em t=30 s.
- [x] T054 [P] [US3] Criar `backend/src/push/push-receipts.worker.spec.ts` e `backend/test/push-receipts.integration.spec.ts` para leases concorrentes, reinício, primeiro check ~15 min, backoff/deadline, DeviceNotRegistered com revision/fingerprint antigos versus token novo, transientes, limpeza 7 dias e shutdown sem timers/HTTP/handles abandonados.
- [x] T055 [P] [US3] Criar `mobile/tests/services/push-test.service.spec.ts` e `mobile/tests/services/push-presentation.spec.ts` para permissão relida, pending/config/inactive, noAuthReplay/retry=false, cooldown, timeout indeterminado, handler <3 s, foreground sem toast duplicado e deduplicação por attemptId; mocks de background não são evidência de recebimento real.

### Implementation for User Story 3

- [x] T056 [US3] Implementar `backend/src/push/expo-push.adapter.ts` com fetch/crypto nativos, HTTPS send/getReceipts fixos, segredo só Authorization backend, timeout 5 s, parsing limitado/allowlist, códigos seguros sem resposta bruta; send de uma mensagem/um destino com título “Teste de notificações”, corpo “Este é um teste de notificações do aplicativo.”, data somente type push-test + attemptId opaco, sound default, canal push-test e TTL 60 s, sem qualquer dado pessoal/escolar/deep link.
- [x] T057 [US3] Implementar reserva de tentativa/cooldown em `backend/src/push/push-test.service.ts`: instalação+JWT user/sid+capability resolvem o único destino; configurar/revalidar eligibility/revision antes do despacho, travar Installation com ordem autenticada, persistir SENDING/snapshot imutável e lease <=15 s, nextTestAvailableAt=startedAt+5 s+30 s; uma tentativa em curso, 429/Retry-After seguro, HTTP fora de tx, sem retry automático de send.
- [x] T058 [US3] Implementar finalização por CAS em `backend/src/push/push-test.service.ts`: ticket ok/id privado <=256 caracteres → ACCEPTED e janela max(atual, acceptedAt+30 s), receipt agenda inicial ~15 min/deadline 24 h; ticket conhecido → REJECTED sanitizado, timeout/crash/resposta inválida → UNKNOWN preservando janela; DeviceNotRegistered invalida somente registrationId+revision+fingerprint enviados, transiente/config mantém token e nenhum resultado afirma exibição.
- [x] T059 [US3] Expor POST `/api/v1/push/installation/test` em `backend/src/push/push.controller.ts`, registrar adapter/service em `backend/src/push/push.module.ts` e estender `backend/test/push.e2e-spec.ts`: body estritamente vazio/sem destinatário/query, todos os roles, apenas ticket ok retorna 202 com attemptId/status/acceptedAt/nextTestAvailableAt, headers no-store, 409/429/503 seguros e zero envios nas negativas da SC-007.
- [x] T060 [US3] Implementar `backend/src/push/push-receipts.worker.ts`: claims/leases persistidos, tick <=60 s, primeira consulta ~15 min, backoff 1/2/5/15 min, deadline 24 h, lotes <=100 receipts e <=2 chamadas concorrentes; restart retoma só leituras, nunca POST send, SENDING com lease vencida vira UNKNOWN; efeitos por CAS de binding/revision/fingerprint, HTTP fora de tx, receipt ok → PROVIDER_HANDOFF e transitórios preservam registro.
- [x] T061 [US3] Conectar início/shutdown do worker em `backend/src/push/push.module.ts` e `backend/src/push/push-receipts.worker.ts`: cancelar timers/HTTP na parada, executar cleanup de T043 e attempts terminais após 7 dias sem perder leases em curso; não introduzir cron de domínio, cálculo de expiração, jobs de envio ou notificações futuras.
- [x] T062 [US3] Sincronizar quinta rota/schemas/security/respostas/cooldown em `specs/001-app-quality-readiness/contracts/openapi.json` e `backend/test/openapi.contract.spec.ts`, alinhando runtime de `backend/src/push/push.controller.ts` com o contrato e preservando ausência de API de histórico/listagem/destinatários.
- [x] T063 [US3] Adicionar test em `mobile/src/services/push/push.service.ts` e orquestração em `mobile/src/services/push/push-lifecycle.ts`: reler permissão SDK, conferir ACTIVE/config/pendência/geração, POST vazio com noAuthReplay e retry=false, single-flight/cooldown pela data do servidor; timeout fica indeterminado e exige nova intenção após janela, sem enviar automaticamente na reconexão.
- [x] T064 [US3] Implementar apresentação em `mobile/src/services/push/push-presentation.ts` e `mobile/src/providers/PushProvider.tsx`: handler foreground <3 s com banner/lista SO como apresentação única, listener deduplica feedback da tentativa conhecida por attemptId, sem log bruto/toast paralelo; toque abre app/área Notificações, web não instala handler e nenhum deep link escolar/headless/local scheduled fallback.
- [x] T065 [US3] Habilitar Enviar teste e feedback em `mobile/src/hooks/usePushNotifications.ts` e `mobile/app/(app)/profile/notifications.tsx`, estendendo `mobile/tests/hooks/usePushNotifications.spec.ts`, `mobile/tests/routes/profile-notifications.spec.tsx` e `mobile/tests/providers/PushProvider.spec.tsx`: “Solicitação aceita para envio. O recebimento depende do dispositivo.” apenas após 202, pending/cooldown bloqueiam repetição; erro/config/recusa/UNKNOWN acionáveis e nenhuma afirmação de entrega baseada só no ticket.
- [x] T066 [US3] Exercitar invalidação permanente versus rotação/logout/troca de conta/exclusão em `backend/test/push-lifecycle.concurrency.integration.spec.ts` e `backend/test/push-receipts.integration.spec.ts`, incluindo receipt antigo que não invalida token novo, conta removida sem ressuscitar binding e corrida inevitável após despacho tratada somente com payload neutro, sem prometer retirar envio externo.
- [x] T067 [US3] Executar suites de transporte/receipts/API/mobile de T052–T055/T059/T062/T065/T066 e registrar FR-020–024/029, SC-004/006/007/009/010 em `specs/010-push-notification-foundation/final-validation.md`: uma chamada por intenção, cooldown persistido após restart, UNKNOWN sem resend e ticket/handoff/exibição como fatos separados.

**Checkpoint**: três histórias automatizáveis completas. Provider mocks não comprovam credentials, provisionamento ou recebimento real; esses fatos ficam separados na consolidação.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: fechar privacidade, regressão, documentação, gates aplicáveis e evidência individual viável.

- [x] T068 [P] Criar `backend/test/push-privacy.integration.spec.ts` e `mobile/tests/services/push-privacy.spec.ts` com sentinelas sintéticas de token/capability/installationId/secrets e captura de logs/URLs/erros/analytics/payloads, incluindo erros SQL/Expo/Axios/validation; exigir zero ocorrências completas e responses sem dados privados, sem anexar sentinelas ou credentials reais em documentos versionados.
- [x] T069 [P] Atualizar documentação operacional em `README.md` e `specs/010-push-notification-foundation/quickstart.md` conforme implementação final: configuração pública versus secrets backend/build, enhanced security, FCM V1/APNs/EAS por identidade correspondente, preview interno, indisponível sem config, backup completo AsyncStorage/conflito após reinstall, recuperação desabilitando push/revogando vínculos/revertendo aplicação e conservando tabelas; documentar setup sem executar provisionamento remoto ou inserir credentials.
- [x] T070 Auditar fronteiras/regressão em `backend/test/push.e2e-spec.ts`, `backend/test/push-registration.integration.spec.ts` e `mobile/tests/providers/AuthProvider.spec.tsx`, cobrindo auth/cadastro/refresh/perfil/senha/logout/exclusão/convites/turmas/comunicados e zero envios de negócio; conferir ausência de scheduler de domínio, seleção de membros/broadcast/deep links/inbox/histórico e registrar FR-029/030 e SC-010 em `specs/010-push-notification-foundation/final-validation.md`.
- [x] T071 Executar gates backend de `backend/package.json`/`.github/workflows/backend-ci.yml` e roteiro seguro de `specs/010-push-notification-foundation/quickstart.md`: prisma validate/generate/migrate deploy, format:check, lint, typecheck, test:cov, test:integration, test:contract, test:e2e e build; migrations/suites somente local `avisa_ai_test` guardado, adapter mockado; registrar comandos/resultados/qualificações e estado real de CI em `specs/010-push-notification-foundation/final-validation.md`, sem publicar para acionar CI.
- [x] T072 Executar gates mobile de `mobile/package.json`/`.github/workflows/mobile-ci.yml`: typecheck, lint, format:check, test:ci, doctor e export:ci; conferir config/plugin em fixtures e ausência de SDK nativo na web, lockfile sincronizado, labels/temas/texto ampliado; registrar resultados em `specs/010-push-notification-foundation/final-validation.md`, sem equiparar export/Doctor a build assinada ou push real.
- [x] T073 Registrar walkthrough funcional individual viável em `specs/010-push-notification-foundation/final-validation.md` seguindo `specs/010-push-notification-foundation/quickstart.md`: abertura sem prompt, ativação até 2 min se medida ou recusa/indisponibilidade acionável, teste neutro/cooldown, foreground/background quando viáveis, opt-out/logout/retorno e temas; proprietário pode ser único executor/uma instalação, atribuir PASS (user-reported) só a cenários relatados e separar ticket/handoff/recebimento observado, falha real e configuração operacional ainda ausente.
- [ ] T074 Consolidar FR-001–030/SC-001–010, migration/recovery, contratos runtime/canônico, resultados automatizados, relato individual e gates efetivamente verificados em `specs/010-push-notification-foundation/final-validation.md` e atualizar apenas checkboxes realmente executadas em `specs/010-push-notification-foundation/tasks.md`; dependência operacional/terceiros/CI não vira dispensa, relato não inventa medições, e conclusão da 010 libera 011/012 sem implementar essas regras.

**Fechamento de T073 — 2026-10-06:** `PASS (user-reported)` no segundo APK: abertura/login sem solicitação espontânea, ativação manual, estado inicial desativado em outra conta, ACTIVE estável, foreground neutro/único, notificação observada após minimizar e retorno pelo toque, cooldown bloqueado, opt-out persistente após navegação e logout/login, Claro/Escuro legíveis. Tempo de ativação `NÃO MEDIDO`; instante exato de background não medido. Receipt `ok` da tentativa em foreground verificado separadamente. Gates completos repetidos após adapter e cinco patches Expo: **todos PASS, Doctor 21/21**. Triagem aceita: shell-quote Critical ausente do bundle Android, DEV/TOOLING ONLY; decode-uri-component Moderate presente, sem mitigação completa; remediações obrigatórias na futura 012, sem audit fix na 010. **T074 consolidada localmente, ainda aberta apenas pelo CI remoto NOT RUN**, conforme [final-validation.md](final-validation.md).

**DISPENSADA POR ESCOPO**: campanhas nativas especializadas Android/iOS, TalkBack, VoiceOver, auditorias físicas de acessibilidade/dispositivos e estudos com participantes. Não são tarefas executáveis, PASS, dependências ou bloqueios; não transferir para 011/012 ou outra spec. Semântica básica de UI, automação, integridade/segurança, configuração operacional e CI aplicável continuam exigidos.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup T001–T004
  → Foundation T005–T016
    → US1 T017–T036 (MVP de consentimento/registro, cleanup mínimo)
      → US2 T037–T051 (ciclo de vida completo)
        → US3 T052–T067 (transporte/teste/receipts)
          → Consolidation T068–T074
            → 011 e 012 independentes entre si, fora deste arquivo
```

- Setup precede Foundation; schema T007 → T008 → T009 → migration T010 → helper/test T011. Migration/helper prontos antes de suites PostgreSQL de histórias.
- T005 precede T012/T014; T006 precede T015. T012/T013 compartilham contrato, mas têm arquivos distintos. T014 usa T007–T012; T015 usa T002/T006/T013; T016 depende de schema/guard e é concluída antes de US1.
- US1 começa depois de Foundation. T017–T021 são testes independentes entre si. Backend T022 → T023 → T024 → T025; config T026 → T027, SDK T028 → API T029 → coordenador T030 → provider/hook T031 → tela T032 → opt-out T033 → Auth cleanup T034 → regressão T035 → checkpoint T036. T021 precede T027, T019 precede T026/T028 e T020 precede T030–T034.
- US2 depende do registro da US1; não alegar implementação completa independente de sua base. T037–T041 podem ser escritos em paralelo, depois backend T042 → T043 → T044 e mobile T045 → T046 → T047 → T048 → T049 → T050. T051 fecha ambos. Eligibility/cascade podem ser demonstrados sem adapter real ou test-send.
- US3 depende de ACTIVE/lifecycle seguro de US1/US2. T052–T055 precedem implementações correspondentes. Adapter T056 → tentativa T057 → finalização T058 → rota T059 → worker T060 → lifecycle/cleanup T061 → OpenAPI T062; API mobile T063 → apresentação T064 → UI T065 → corridas T066 → checkpoint T067. DeviceNotRegistered de T058/T060 complementa invalidação da US2.
- Consolidação depende das histórias; T068/T069 têm arquivos distintos. T070 e gates T071/T072 precedem fechamento T074; T073 registra somente o walkthrough viável realmente executado/relatado. Provisionamento externo ausente é limitação operacional a registrar, não evidência de recebimento nem campanha especializada a exigir.

### Within Each User Story

- Escrever cenários antes da implementação, conferir falha pela ausência do comportamento e rodar cobertura pertinente ao final.
- Serializar alterações no mesmo arquivo: registration service, controller/OpenAPI, push-lifecycle, AuthProvider/PushProvider, hook/tela e final-validation. `[P]` não permite duas alterações concorrentes nesses arquivos.
- Ações autenticadas/capability-only respeitam locks de data-model; nunca manter tx/lock durante HTTP. Binding/lifecycle e token revision têm funções distintas.
- Não ignorar cleanup mínimo no MVP: ativação pública depende de T033/T034. US1 isolada é checkpoint demonstrável, não release da fundação sem US2/US3.

### Parallel Opportunities

- Setup: T003 + T004 após T002.
- Foundation: T005 + T006; após pré-requisitos, T012 + T013; T015 pode ocorrer enquanto T014 termina, pois T015 usa T013 e não modifica os arquivos backend.
- US1: T017 + T018 + T019 + T020 + T021; depois backend T022–T025 e mobile T026–T035 podem progredir em arquivos separados, integrando/validando no T036.
- US2: T037 + T038 + T039 + T040 + T041; depois backend T042–T044 e mobile T045–T050 podem progredir em paralelo, fechando no T051.
- US3: T052 + T053 + T054 + T055; depois backend T056–T062 e mobile T063–T065 podem progredir com o contrato existente/mockado, integrando em T066/T067. T063 depende do contrato de 202 já definido, sem bloquear pela credencial real do adapter.
- Consolidação: T068 + T069. Gates backend/mobile podem executar em paralelo com captura separada de resultados, mas registrar `final-validation.md` sequencialmente.
- Suites destrutivas que compartilham `avisa_ai_test` executam serialmente. Paralelismo de escrita de testes não autoriza cleanups concorrentes no mesmo banco.

## Parallel Example: User Story 1

```text
Após Foundation:
T017: integração de reserva/ativação em backend/test/push-registration.integration.spec.ts
T019: SDK/configuração em mobile/tests/services/push-device.service.spec.ts e mobile/tests/config/push-config.spec.ts
T021: plugin de backup em mobile/tests/plugins/with-push-storage-backup.spec.ts
```

## Parallel Example: User Story 2

```text
Após checkpoint US1:
T037: corridas PostgreSQL em backend/test/push-lifecycle.concurrency.integration.spec.ts
T040: lifecycle mobile em mobile/tests/services/push-lifecycle.spec.ts
T041: eventos/provider em mobile/tests/providers/PushProvider.spec.tsx
```

## Parallel Example: User Story 3

```text
Após checkpoint US2:
T052: adapter mockado em backend/src/push/expo-push.adapter.spec.ts
T054: worker em backend/src/push/push-receipts.worker.spec.ts e backend/test/push-receipts.integration.spec.ts
T055: transporte/presentation mobile em mobile/tests/services/push-test.service.spec.ts e mobile/tests/services/push-presentation.spec.ts
```

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Setup/Foundation T001–T016.
2. Completar US1 T017–T036, incluindo cleanup mínimo; demonstrar consentimento/registro e estados recusado/indisponível.
3. Parar no checkpoint e validar a história sem POST test, notificação de negócio ou provisioning remoto. A fundação só fica concluída após as demais histórias e gates.

### Incremental Delivery

1. US2 adiciona rotação, recuperação offline e proteção completa de sessões/contas; validar 2×2×2 e concorrência real em banco isolado.
2. US3 adiciona teste neutro e receipts, conservando UNKNOWN e cooldown entre aceites. Nunca resend automático ou calendário de negócio.
3. Consolidar privacidade/regressão/gates e relato individual atribuído. Ticket aceito e receipt handoff não substituem exibição observada; SC-006 permite registrar honestamente recebimento não observado.
4. Ao concluir a 010, 011 e 012 podem usar a fundação e avançar independentemente entre si, sem antecipar qualquer regra neste backlog.

## Traceability & Task Counts

| Grupo          | IDs       | Quantidade |
| -------------- | --------- | ---------- |
| Setup          | T001–T004 | 4          |
| Foundation     | T005–T016 | 12         |
| US1 — P1 / MVP | T017–T036 | 20         |
| US2 — P2       | T037–T051 | 15         |
| US3 — P3       | T052–T067 | 16         |
| Consolidação   | T068–T074 | 7          |
| Total          | T001–T074 | 74         |

| Cobertura                          | Tasks principais                                          |
| ---------------------------------- | --------------------------------------------------------- |
| FR-001–006; SC-001/005             | T019–T021, T026–T036, T073                                |
| FR-007/008/011/027; SC-003/007     | T005, T007–T018, T022–T025, T037/T042/T044, T059/T062     |
| FR-009/010/012–019; SC-002–004/009 | T033–T051, T058/T060/T066                                 |
| FR-020–024; SC-004/006/009         | T052–T067, T073                                           |
| FR-025/026; SC-008                 | T003/T005/T012–T015, T024/T029, T052/T056/T059, T068/T069 |
| FR-028                             | T020/T021, T027/T032/T050/T065, T072/T073                 |
| FR-029/030; SC-010                 | T034/T035/T039/T044/T048/T049, T061/T066, T070–T074       |

## Notes

- SC-007 protege vínculos previamente registrados pelo fluxo controlado; negativas têm zero-envios e zero alterações na vítima. Não exigir garantia universal de posse de token desconhecido nem criar desafio por notificação.
- SDK mocks, migrations/gates locais e relato do proprietário são evidências diferentes. Não marcar campanha dispensada como PASS; não inventar credentials, tempo de ativação ou recebimento.
- Atualizar checkboxes somente após execução e evidência; depois deste checkpoint, as fases posteriores à Phase 5 permanecem abertas.
