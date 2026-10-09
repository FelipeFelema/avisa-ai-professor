# Tasks: Release Hardening and Documentation

**Input**: [spec.md](spec.md), [plan.md](plan.md), research.md, data-model.md, contracts/release-security-contract.md.

**Status**: 47/70 concluídas. Fases 1–3: 18/18. Fases 4–6: 29/31 (Fase 4: 7/7; Fase 5: 11/11; Fase 6: 11/13). Export JS Android local/source maps auditado com URL sintética. `PRODUCTION_API_URL = PENDING`. T041 parcial (profile/guards locais prontos; ambiente/API real pendente); T043 pendente de API real, US5 e autorização externa. Fases 7–9 não iniciadas.

**Tests**: Solicitados explicitamente; ampliar cobertura significativa, reaproveitando suítes 010/011. Teste negativo/reprodução antes de correção real; se controle já funciona, preservar e registrar evidência. Checkpoints de fase não autorizam automaticamente próxima fase se o usuário delimitar execução.

**Format**: `- [ ] Tnnn [P?] [USn?] descrição com caminho`. `[P]` indica arquivos independentes dentro do lote descrito na DAG, depois dos pré-requisitos. IDs/linhas são trabalho futuro, não evidência atual. Evidências referidas ainda não criadas serão geradas na execução.

## Phase 1: Setup — preparação e fronteiras (T001–T003)

**Checkpoint**: spec aprovada, baseline/WIP preservados e ambientes definidos.

- [x] T001 Registrar aprovação e escopo exato de execução em `specs/012-release-hardening-and-documentation/security-assessment.md`; reconferir constitution/AGENTS, branch/SHA/status e preservar WIP sem staging/commit.
- [x] T002 Inventariar backend/mobile, lockfiles, scripts, deployment alvo e configuração externa disponível sem valores secretos em `specs/012-release-hardening-and-documentation/baseline-inspection-2026-10-07.md`; separar credenciais/config ausentes de vulnerabilidade confirmada.
- [x] T003 Definir armazenamento privado ignorado de logs e envelope de evidência sanitizada/revisão/artefato/executor em `specs/012-release-hardening-and-documentation/release-gate.md`; documentar limites para builds externos, mudanças de credenciais/deploy e Git sem executar essas ações.

## Phase 2: Foundational — método comum (T004–T007)

**Checkpoint**: investigação segura e matriz completa; sem correção prematura.

- [x] T004 Mapear todos os métodos/rotas e autoridade role/owner/author/membership/sid/capability de `backend/src/` na matriz de `specs/012-release-hardening-and-documentation/security-assessment.md`, com IDs próprios/de vítima/inexistentes/inválidos, status e zero efeito esperado.
- [x] T005 [P] Definir fixtures duas contas/turmas, papéis e sessões/instalações separadas em `backend/test/helpers/release-security.fixture.ts`, somente loopback `avisa_ai_test`, mantendo `backend/test/helpers/test-database.helper.ts` e guardas; impedir fixture/reset/migration de teste em `avisa_ai` ou produção.
- [x] T006 [P] Preparar cenários/contas/artefato/estados e origem do walkthrough individual em `specs/012-release-hardening-and-documentation/quickstart.md`, sem exigir dispositivo específico, participantes ou campanhas excluídas.
- [x] T007 Consolidar protocolo de finding, classificação/reteste, aceite temporário explícito e decisão prévia para remediação significativa em `specs/012-release-hardening-and-documentation/security-assessment.md`; confirmar pré-requisitos T004–T006 antes das histórias.

## Phase 3: US1 — conta, conteúdo, abuso e privacidade (P1; T008–T018)

**Goal**: Sessões e autorização robustas para todas as operações, com entradas/erros seguros.
**Independent Test**: Matriz server-side e callbacks mobile, zero leitura/mutação indevida; sid revogado rejeitado.

- [x] T008 [P] [US1] Revisar login/refresh/logout/sid/AuthSession/expiração/rotação/replay/concorrência, verificação de assinatura/algoritmos/claims/TTL e hash de credenciais em `backend/src/auth/` e ampliar negativos de `backend/test/auth.integration.spec.ts` e `backend/src/auth/auth-session.service.spec.ts`; evidência em `specs/012-release-hardening-and-documentation/evidence/auth-sessions.md`.
- [x] T009 [P] [US1] Cobrir troca de conta, nova geração da mesma conta, refresh/logout simultâneo e callbacks antigos em `mobile/tests/lib/api-session.spec.ts`, `mobile/tests/providers/AuthProvider.spec.tsx` e `mobile/tests/routes/auth-session-boundary.spec.tsx`; evidência em `specs/012-release-hardening-and-documentation/evidence/mobile-sessions.md`.
- [x] T010 [US1] Remediar findings session identificados por T008/T009 em `backend/src/auth/`, `mobile/src/providers/AuthProvider.tsx` e `mobile/src/lib/api.ts` somente após decisão pertinente; validar acesso após logout/replay e ausência de contaminação sem alterar contratos silenciosamente.
- [x] T011 [P] [US1] Auditar perfil/senha/exclusão e IDs de vítima em `backend/test/users.integration.spec.ts`, `backend/test/password-change.integration.spec.ts`, `backend/test/account-deletion.integration.spec.ts` e E2E pertinentes; exigir zero efeito na vítima; evidência em `specs/012-release-hardening-and-documentation/evidence/user-authorization.md`.
- [x] T012 [P] [US1] Auditar role/ownership/membership/entrada/saída em `backend/test/classrooms.integration.spec.ts` e `backend/test/classrooms.e2e-spec.ts`, com duas turmas/contas e IDs manuais; evidência em `specs/012-release-hardening-and-documentation/evidence/classroom-authorization.md`.
- [x] T013 [P] [US1] Auditar leitura por announcementId e criação/edição/exclusão/autoria/isolation em `backend/test/announcements.integration.spec.ts`, com IDs válidos de outra turma/conta, payload adulterado e zero efeitos; evidência em `specs/012-release-hardening-and-documentation/evidence/announcement-authorization.md`.
- [x] T014 [P] [US1] Auditar convites/admin/demotion/sessão revogada/cadastro público sem ADMIN em `backend/test/invite-codes.integration.spec.ts`, `backend/test/invite-codes.e2e-spec.ts` e negativos da fixture `backend/test/helpers/release-security.fixture.ts`; sem edição concorrente desse helper; evidência em `specs/012-release-hardening-and-documentation/evidence/admin-authorization.md`.
- [x] T015 [US1] Auditar DTOs/limites/body-query extras/IDs/malformed JSON/rate limiting/IP-proxy de auth/cadastro/senha/invites/classrooms/announcements/push em `backend/test/release-input-security.e2e-spec.ts` e `backend/src/auth/guards/rate-limit.guard.spec.ts`; registrar impacto da retenção de IPs e uso multi-instância em `specs/012-release-hardening-and-documentation/evidence/input-abuse.md`.
- [x] T016 [US1] Auditar erros/logs/SQL-Prisma metadata e dados sensíveis nos módulos backend/mobile em `backend/test/release-error-privacy.e2e-spec.ts` e `mobile/tests/services/release-error-privacy.spec.ts`; registrar prova sanitizada em `specs/012-release-hardening-and-documentation/evidence/error-privacy.md`.
- [x] T017 [US1] Remediar findings aprovados T011–T016 em `backend/src/{users,classrooms,announcements,invites-code,auth}/`, DTOs e `backend/src/configure-app.ts`, com testes afetados/contrato atualizado; não redesenhar autorização nem implantar infra sem achado.
- [x] T018 [US1] Executar suites relevantes de `backend/test/` e `mobile/tests/` após correções; consolidar matriz/retestes/pendências em `specs/012-release-hardening-and-documentation/security-assessment.md` e checkpoint sem falsos PASS.

## Phase 4: US2 — segurança push 010/011 (P1; T019–T025)

**Goal**: Destinatário correto, privacidade e lifecycle/ledger preservados.
**Independent Test**: Turma externa/registro inelegível recebe zero envio; restart/concorrência sem duplicação criada pela aplicação.

- [x] T019 [P] [US2] Auditar JWT/capability/ownership/CAS, registros REVOKED/INVALID e logout/exclusão/troca de conta em `backend/test/push.e2e-spec.ts`, `backend/test/push-lifecycle.concurrency.integration.spec.ts` e `backend/test/push-registration.integration.spec.ts`; preservar revoke limitado sem JWT; evidência em `specs/012-release-hardening-and-documentation/evidence/push-lifecycle.md`.
- [x] T020 [P] [US2] Auditar destinatários backend-only, isolamento de turma/conta, saída/exclusão e corrida de envio em `backend/test/announcement-push-fanout.integration.spec.ts` e `backend/test/announcement-push-dispatch.integration.spec.ts`; evidência em `specs/012-release-hardening-and-documentation/evidence/push-recipients.md`.
- [x] T021 [P] [US2] Auditar payload/logs/capabilities/tokens e minimização de PII em `backend/test/push-privacy.integration.spec.ts`, `backend/test/announcement-push-privacy.integration.spec.ts` e `backend/src/push/expo-push.adapter.spec.ts`; incluir privacidade do título/turma contextual; evidência em `specs/012-release-hardening-and-documentation/evidence/push-privacy.md`.
- [x] T022 [P] [US2] Auditar UNKNOWN/no-resubmit, receipts tardios, edição de expiração/occurrence, restart/concorrência em `backend/test/announcement-push-reminders.integration.spec.ts`, `backend/test/announcement-push-locks.integration.spec.ts` e workers specs; evidência em `specs/012-release-hardening-and-documentation/evidence/push-concurrency.md`.
- [x] T023 [P] [US2] Cobrir payload adulterado/antigo, consulta autenticada por announcementId e callbacks pós-logout/troca em `mobile/tests/services/announcement-push-navigation.spec.ts` e `mobile/tests/providers/announcement-push-provider.spec.tsx`; evidência em `specs/012-release-hardening-and-documentation/evidence/push-navigation.md`.
- [x] T024 [US2] Remediar findings push aprovados em `backend/src/push/`, `mobile/src/services/push/` e `mobile/src/providers/PushProvider.tsx`, mantendo lock order/lifecycle/CAS/no-resubmit; atualizar `specs/012-release-hardening-and-documentation/contracts/release-security-contract.md` se mudar contrato.
- [x] T025 [US2] Executar regressão 010/011 relevante em `backend/test/` e `mobile/tests/`, registrar retestes e checkpoint em `specs/012-release-hardening-and-documentation/security-assessment.md`; configuração externa fica na US4, sem inferi-la dos mocks.

## Phase 5: US3 — dependencies e secrets (P1; T026–T036)

**Goal**: Triagem atual completa, remediação segura e nenhum segredo exposto.
**Independent Test**: Quatro audits, análise do artefato/runtime e decisões rastreáveis de todos os findings relevantes.

- [x] T026 [P] [US3] Executar npm audit --json e npm audit --omit=dev --json em `backend/`, sem fix; registrar SHA/hash lock/npm/node/exit/time e relatório sanitizado em `specs/012-release-hardening-and-documentation/evidence/backend-audit.md`.
- [x] T027 [P] [US3] Executar os mesmos audits em `mobile/`, sem fix; registrar evidência em `specs/012-release-hardening-and-documentation/evidence/mobile-audit.md` e manter falha de rede como ausência de prova.
- [x] T028 [US3] Produzir export Android de produção auditável de `mobile/` com API pública/config candidata, `__DEV__` false e sourcemap/metadados de módulos, sem secrets; registrar configuração/identificador e método de inclusão em `specs/012-release-hardening-and-documentation/evidence/android-bundle-security.md`; não substituir build final pelo export.
- [x] T029 [US3] Triar cada advisory relevante T026–T028 em `specs/012-release-hardening-and-documentation/dependency-assessment.md`: pacote/versão/chains/advisory-CVE/severidade/runtime/bundle/vetor/fix/impacto/classificação; revalidar shell-quote, decode-uri-component, braces, image-size, node-forge, sprintf-js, uuid e findings novos, consultando fontes primárias atuais.
- [x] T030 [US3] Registrar decisões de patch/override/update compatível e apresentar remediação significativa ou aceite temporário ao proprietário em `specs/012-release-hardening-and-documentation/dependency-assessment.md`; sem audit fix --force/major automático, sem fechar blocker por aceite implícito.
- [x] T031 [US3] Aplicar somente remediações de dependências aprovadas em `backend/package.json`, `backend/package-lock.json`, `mobile/package.json` e `mobile/package-lock.json`, checando parent ranges/SDK e gate afetado; sem atualização indiscriminada.
- [x] T032 [P] [US3] Auditar `.env`, exemplos, histórico/refs Git disponíveis/worktree, workflows/docs/fixtures e fontes para DATABASE_URL/JWT/Expo/Firebase/FCM/capability/token com saída redigida; registrar cobertura/limites sem valores em `specs/012-release-hardening-and-documentation/evidence/secrets-source-history.md`.
- [x] T033 [US3] Auditar logs/export/bundle de `backend/` e `mobile/`, EXPO*PUBLIC*\* e metadados/configuração embedada; diferenciar google-services cliente de service account privada; evidência em `specs/012-release-hardening-and-documentation/evidence/secrets-artifacts.md`, após T028.
- [x] T034 [US3] Para exposição confirmada T032/T033, registrar contenção/rotação/revogação/validação e obter autorização para ações externas em `specs/012-release-hardening-and-documentation/security-assessment.md`; remover segredo público nos arquivos afetados sem reescrever histórico Git automaticamente nem considerar remoção suficiente.
- [x] T035 [US3] Reexecutar audits/análise runtime-bundle/scans afetados após remediação em `backend/` e `mobile/`; registrar classificação final/compatibilidade/retestes em `specs/012-release-hardening-and-documentation/dependency-assessment.md` e evidências, sem inventar ausência de findings.
- [x] T036 [US3] Consolidar findings/decisões/pendências e checkpoint em `specs/012-release-hardening-and-documentation/security-assessment.md`; nenhum blocker real aberto pode ser ocultado como tooling-only.

## Phase 6: US4 — produção, dados e recovery (P1; T037–T049)

**Goal**: Configuração real validada, schema íntegro e candidato recuperável.
**Independent Test**: Ensaios isolados e artifact/config production coerentes; gate final exige smoke US6.

- [x] T037 [P] [US4] Auditar NODE_ENV/secrets robustos/separados/banco/migrations/CORS/proxy/rate limit/flags/startup/health/exit/logs em `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/configure-app.ts` e config de auth/push; evidência sanitizada em `specs/012-release-hardening-and-documentation/evidence/backend-production.md`.
  - Revalidação pré-Render autorizada: allowlist TRUST_PROXY_CIDRS e negativos de spoofing/isolamento; ranges de ingresso reais ainda não confirmados. Configuração remota depende de topologia verificada, não de IPs de saída. Ver `evidence/render-proxy-readiness.md`.
- [x] T038 [US4] Adicionar testes de configuração inválida/fail-fast/erros sanitizados/health e ausência Swagger UI/JSON em NODE_ENV=production inclusive API_DOCS_ENABLED=true em `backend/test/production-config.e2e-spec.ts` e `backend/test/openapi.contract.spec.ts`, sem executar sobre produção real.
- [x] T039 [US4] Corrigir findings aprovados production em `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/configure-app.ts`, config afetada e `backend/.env.example`; não expor segredo nem mudar contrato sem teste/registro.
- [x] T040 [P] [US4] Auditar configuração Android/API HTTPS/package/EAS projectId/Firebase/FCM/diagnostics/cleartext em `mobile/app.config.ts`, `mobile/eas.json`, `mobile/src/lib/api.ts` e `mobile/src/config/push-config.ts`; evidência em `specs/012-release-hardening-and-documentation/evidence/mobile-production.md`.
- [ ] T041 [US4] Definir perfil/ambiente production em `mobile/eas.json` e validar HTTPS sem URL local/fallback local/cleartext de preview/secret backend em `mobile/app.config.ts`, `mobile/src/lib/api.ts`, `mobile/tests/config/app-config.spec.ts` e testes pertinentes; manter preview delimitado.
  - Parcial: profile/guards/negativos/export locais concluídos; publicar/confirmar API HTTPS real e configurar/validar seu ambiente production ainda pendentes. URL sintética não fecha esta task.
  - Hardening Render 2026-10-09: [SSL/audits/prune](evidence/render-build-startup-hardening-2026-10-09.md). Audit full 24 (20 moderate/3 high/1 critical), omit-dev 0, mesmo lock; Handlebars via ts-jest é DEV/TOOLING ONLY, patch 4.7.10 proposto. Aviso SSL atual não blocker; não trocar DATABASE_URL global isoladamente devido ao parser da CLI, normalização runtime proposta. Prune ensaiado isoladamente; nenhuma mudança de build/dependencies/ambiente aplicada. T041 aberta por pendências existentes; T043 preservada NOT RUN.
  - Remediações aprovadas/aplicadas 2026-10-09: [gates e proveniência](evidence/render-hardening-remediation-2026-10-09.md), [deploy controlado](../../docs/render-hardening-controlled-deploy.md). Handlebars 4.7.10, full 23/omit-dev 0/zero critical; SSL normalizado somente no runtime, CLI preservada; build:prod com prune ao fim. Instalação limpa normal, 466 unit/31 E2E, Prisma/build/prune/CLI/query TLS/startup/health PASS em cluster temporário avisa_ai_test. Novo SHA/deploy/Neon/logs remotos pendentes; manter T041 aberta e T043 NOT RUN, sem EAS/push/Git/CI remoto.
- [x] T042 [US4] Verificar read-only projeto EAS/Firebase, FCM V1, service account protegida, Enhanced Push Security e token backend; registrar somente configuração/prova sanitizada em `specs/012-release-hardening-and-documentation/evidence/push-production-provider.md`; se mudança externa necessária, apresentar ação e aguardar autorização pertinente, sem inventar prova.
- [ ] T043 [US4] Após todas as alterações de app/dependencies/UX e autorização do build externo, gerar/obter candidato Android production de `mobile/eas.json`, registrar SHA/build ID/hash/config/API em `specs/012-release-hardening-and-documentation/release-gate.md`; não publicar/submeter nem usar preview como candidato.
  - Depende especificamente de API HTTPS real confirmada para o candidato final, além de US5/T065 e autorização de build externo; não executado.
- [x] T044 [P] [US4] Revisar todas as migrations/constraints/cascades/schema e retenção de `backend/prisma/`, comparar cadeia/checksums/estado e upgrade representativo em `specs/012-release-hardening-and-documentation/evidence/database-integrity.md`; só ler banco real quando autorizado, nunca fixtures nele.
- [x] T045 [US4] Cobrir conta/turma/comunicado/registrations/attempts/receipts/events/reminders/órfãos, base vazia e upgrade em `backend/test/release-database.integration.spec.ts`, preservando guardas de `backend/test/helpers/test-database.helper.ts` e nome exato avisa_ai_test.
- [x] T046 [US4] Se finding exigir evolução, apresentar design/recovery e corrigir serviços/schema com migration revisada em `backend/prisma/schema.prisma`, `backend/prisma/migrations/` e módulos afetados; nunca editar migration já aplicada para ocultar drift; registrar sem mudança se não necessária.
- [x] T047 [US4] Escrever runbook de backup/restore/migration falha/resolve compatível/kill switch push/rollback app, sem reset/down destrutivo na base real, em `docs/release-recovery.md`; documentar autorização/compatibilidade e preservação de ledger/tombstones.
- [x] T048 [US4] Ensaiar migrations/recovery/restore/rollback app e flags sem envio externo real em loopback `avisa_ai_test`, conforme `docs/release-recovery.md`; registrar comandos sanitizados/revisões/integridade em `specs/012-release-hardening-and-documentation/evidence/recovery-rehearsal.md`.
- [x] T049 [US4] Consolidar configuração/migrations/provider/recovery e checkpoint em `specs/012-release-hardening-and-documentation/security-assessment.md`; candidato T043 pode aguardar US5, sem falsamente fechar release pela configuração.

## Phase 7: US6 — documentação, regressão e provas finais (P1; T050–T058)

**Goal**: Documentação do entregue e validação completa do candidato final.
**Independent Test**: Setup/regressão pelo guia, gates por SHA e smoke production individual, sem prova histórica substitutiva.

- [ ] T050 [P] [US6] Atualizar `README.md` com objetivo/arquitetura/backend-mobile-banco/setup/variáveis/migrations/execução/testes/deploy/EAS-Firebase-FCM/push/security/secrets/recovery/limitações, sem valores reais e refletindo o resultado das histórias.
- [ ] T051 [P] [US6] Atualizar `backend/README.md` com contratos/config/flags/migrations/gates e referências a `docs/release-recovery.md`, placeholders seguros e distinção dev/test/prod.
- [ ] T052 [P] [US6] Atualizar `mobile/README.md` com produção/HTTPS/EAS/Firebase/consentimento/perfis/smoke/limitações reais e sem secrets; rever exemplos públicos correspondentes após decisão de config.
- [ ] T053 [US6] Preparar matriz completa cadastro/login/refresh/logout/perfil/senha/exclusão/admin-invites/turmas/entrada-saída/CRUD comunicado/novo push/reminder/troca conta em `specs/012-release-hardening-and-documentation/quickstart.md`, vinculando testes/expectativas/executor.
- [ ] T054 [US6] Executar regressão automatizada da matriz T053 em `backend/test/` e `mobile/tests/`, incluindo 010/011 e novos cenários, após T065/correções finais; registrar resultados qualificados em `specs/012-release-hardening-and-documentation/evidence/final-regression.md`.
- [ ] T055 [US6] Executar todos os gates backend reais (Prisma validate/generate/migrations guardadas, format/lint/typecheck/unit coverage/integration/contract/E2E/build/audits) em `backend/`; vincular revisão/exit/ambiente em `specs/012-release-hardening-and-documentation/evidence/backend-final-gates.md`.
- [ ] T056 [US6] Executar todos os gates mobile reais (format/lint/typecheck/test:ci/Doctor/export/audits e inspeção final do bundle/config) em `mobile/`; evidência em `specs/012-release-hardening-and-documentation/evidence/mobile-final-gates.md`; export não substitui T057.
- [ ] T057 [US6] Realizar walkthrough individual/smoke do candidato production T043 com API pública HTTPS, navegação/fluxos principais/consentimento/push novo-reminder e ausência de botão teste/debug/config local; registrar relatos exatos como PASS (user-reported), build/SHA/limites em `specs/012-release-hardening-and-documentation/evidence/production-smoke.md`.
- [ ] T058 [US6] Após autorização de commit/push/PR, obter Backend CI/Mobile CI/Commit Conventions e required checks reais em `.github/workflows/` para a revisão final; registrar SHA/head-merge/run/job/links/resultados em `specs/012-release-hardening-and-documentation/release-gate.md`; sem autorização/evidência, manter NOT RUN e gate não pronto.

## Phase 8: US5 — onboarding e intenção segura (P2; T059–T065)

**Goal**: UX contextual sem prompt espontâneo, sem herança de outra conta.
**Independent Test**: Primeiro uso/recusa/relogin/opt-out/offline/legado/corrupção, preservando lifecycle 010.

- [ ] T059 [US5] Avaliar e confirmar desenho de `specs/012-release-hardening-and-documentation/data-model.md` e `contracts/release-security-contract.md`: intenção vs permissão/binding, chave conta/instalação, confirmação explícita no relogin; apresentar decisão significativa antes de implementar. Se inseguro, registrar decisão de manter reativação manual e não simular execução dos ramos descartados.
- [ ] T060 [P] [US5] Escrever testes de “Chave lógica única (userId, installationId)”, “Registro legado sem dono não autoriza ativação”, “ENABLED não implica permissão nativa nem binding ACTIVE” e “Logout nunca reutiliza binding REVOKED” em `mobile/tests/storage/push-preferences.storage.spec.ts` e `mobile/tests/services/push-preference-lifecycle.spec.ts`; cobrir intenção UNDECIDED/ENABLED/DISABLED, onboarding NOT_SEEN/DEFERRED/DECIDED, logout offline, opt-out/exclusão/reinstalação/corrupção.
- [ ] T061 [P] [US5] Escrever testes UI de convite contextual/Ativar/Agora não/sem prompt em mount-login/Perfil disponível/recusa-feedback/temas/semântica básica em `mobile/tests/components/NotificationOnboarding.spec.tsx` e `mobile/tests/routes/profile-notifications.spec.tsx`, sem campanha especializada.
- [ ] T062 [US5] Implementar storage v2 de intenção em `mobile/src/storage/push-preferences.storage.ts` e integração segura com `mobile/src/storage/push.storage.ts`: version literal 2, userId autenticado, installationId UUID, intent/onboarding com enums de T060, updatedAt apenas UX; “Chave lógica única (userId, installationId)” e “Registro legado sem dono não autoriza ativação”; sem tokens/capability no registro de intenção.
- [ ] T063 [US5] Implementar reconciliação explícita no relogin em `mobile/src/providers/PushProvider.tsx` e `mobile/src/services/push/push-lifecycle.ts`, revogação de logout/conta isolada/opt-out/pendências/callback generation; “ENABLED não implica permissão nativa nem binding ACTIVE” e “Logout nunca reutiliza binding REVOKED”; nenhuma reativação silenciosa ou prompt espontâneo.
- [ ] T064 [US5] Implementar convite “Não perca comunicados da escola”, explicação e ações em `mobile/src/components/NotificationOnboarding.tsx`, `mobile/app/(app)/_layout.tsx` e `mobile/app/(app)/profile/notifications.tsx`; prompt só por ação explícita, loading/error/success/indisponível e reoferta controlada pelo Perfil.
- [ ] T065 [US5] Executar testes UX/storage/lifecycle e regressão 010/011 em `mobile/tests/`, registrar design seguro ou decisão explícita de manter manual em `specs/012-release-hardening-and-documentation/security-assessment.md`; dependências T043/T054–T058 só continuam após este checkpoint e revalidação da documentação.

## Phase 9: Cross-cutting — gate final (T066–T070)

**Checkpoint**: decisão explícita baseada no candidato final, sem operação de publicação implícita.

- [ ] T066 Reconciliar todos os findings/FRs/tasks/contratos/evidências e docs após mudanças finais em `specs/012-release-hardening-and-documentation/security-assessment.md`, `dependency-assessment.md`, `checklists/security-release.md` e `README.md`; ramos condicionais sem achado recebem decisão verificável, não falsa correção/PASS.
- [ ] T067 Verificar ausência de blockers reais e de prova obrigatória faltante na matriz de `specs/012-release-hardening-and-documentation/release-gate.md`; risks aceitos somente com decisão explícita/prazo/mitigação; iOS/campanhas excluídas não são pendências.
- [ ] T068 Registrar decisão final exatamente READY FOR ANDROID MVP RELEASE ou BLOCKED, revisão/artefato/API/migrations/findings/limitações e ações pendentes em `specs/012-release-hardening-and-documentation/release-gate.md`, após T066/T067; não declarar READY com task/gate aplicável ausente.
- [ ] T069 Se fechamento documental gerar novo HEAD publicado com autorização, reconfirmar CI/required checks nesse HEAD e atualizar `specs/012-release-hardening-and-documentation/release-gate.md` sem alegar que CI de SHA anterior é final; se ainda não publicado, registrar restrição e manter BLOCKED por prova ausente.
- [ ] T070 Entregar resumo de decisão/evidências/recovery/limitações ao proprietário em `specs/012-release-hardening-and-documentation/release-gate.md` e reconciliar `specs/012-release-hardening-and-documentation/tasks.md`, sem commit/push/PR/deploy/publicação adicional não autorizado.

## Dependencies & Execution Order

Fases 1 → 2 são comuns e anteriores à execução das histórias. US1, US2, triagem US3 e inventários US4 podem começar após T007 com arquivos disjuntos; não pressupõem conclusão de uma correção que ainda está em discussão. Checkpoint global de segurança se dá antes do candidato/gate final.

- US1: T008/T009 → T010; lote T011–T014 → T015 → T016 → T017 → T018. T014 só usa helper pronto T005 sem editá-lo simultaneamente.
- US2: T019–T023 independentes após T007 → T024 → T025. T019 não roda contra DB ao mesmo tempo que outro suite destrutivo.
- US3: T026/T027 independentes; T028 após config candidata segura (T040/T041 se necessário) → T029 → T030 → T031. T032 independente e T033 após T028; T034 após T032/T033. T035 após T031/T034; T036 consolida. Serializar edits nos manifests/lockfiles.
- US4: T037 → T038 → T039; T040 → T041 → T042. T044 → T045 → T046 → T047 → T048. T049 reúne provas, sem fechar candidato cedo. T043 espera T018/T025/T036/T039/T041/T042/T046/T065 e autorização build.
- US5: T059 após T025/decisões de segurança; T060/T061 independentes → T062 → T063 → T064 → T065. T063 compartilha PushProvider/lifecycle com T024: nunca simultâneos.
- US6: T050–T052 podem preparar docs em paralelo após design estabilizado, mas revisar depois de US5. T053 → T054 após T065 e todos fixes; T055/T056 após código/dependencies finais; T057 após T043 e gates/config/candidato definidos. T058 após autorização Git e revisão final com gates; nenhum publish implícito.
- Final: T066 depois de todas histórias/gates → T067 → T068 → T069 → T070. Correção tardia invalida evidência afetada e demanda reteste/novo candidato quando aplicável.

**Compartilhamentos**: schema/migrations, helper fixture, lockfiles, providers e configure-app são sequenciais por dono; integração/common registry por coordenador. Toda suite/migration/restore que usa `avisa_ai_test` é serializada; não rodar reset/fixtures concorrentes no mesmo banco. Registros de evidência por superfície podem ser paralelos; consolidação shared docs é sequencial.

## Parallel Examples

| História | Lote elegível                                                                                 | Limite                                                       |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| US1      | T008 backend + T009 mobile; depois T011–T014 em arquivos diferentes                           | Execução DB sequencial; T014 não editar helper compartilhado |
| US2      | T019/T020/T021/T022 backend research/tests + T023 mobile                                      | Desenvolvimento disjunto; suites no mesmo DB serializadas    |
| US3      | T026 backend audit + T027 mobile audit + T032 source/history scan                             | Sem mutação; T028/T033 dependem do export/config             |
| US4      | T037 backend config + T040 mobile config + T044 DB review                                     | Correções shared/config/schema e ensaios sequenciais         |
| US5      | T060 storage/lifecycle tests + T061 UI tests                                                  | Após T059; implementação no provider em sequência            |
| US6      | T050 README raiz + T051 backend README + T052 mobile README; T055 backend + T056 mobile gates | Docs rechecados após US5; sem reset/export conflitante       |

Esses lotes descrevem oportunidades, não autorização para iniciar implementação ou delegar agora.

## Release Blockers e tarefas obrigatórias

**Tarefas que investigam blockers**: sessões T008–T010; cross-account/role T011–T014/T017; push incorreto T019–T025; critical runtime/secrets T026–T035; config/API/build T037–T043; migration/integridade T044–T048; fluxo principal/production T054–T057. Um teste já existente não prova fechamento; cenário deve executar com resultado verificável.

**Gates que precisam de prova**: T018/T025/T035/T036, T038/T042/T048, T054–T058 e T066–T069. NOT RUN/failing quando aplicável impede READY; falta de autorização mantém tarefa pendente, não dispensa evidência. T059/T065 são decisões obrigatórias para a UX pedida; ramos de implementação condicionais podem encerrar por decisão segura documentada, sem marcar que código foi implementado quando não foi.

**Sem blocker automático**: cosmético menor, tooling-only documentado ou ausência de iOS. Campanhas especializadas Android/iOS, TalkBack/VoiceOver, auditoria física e participantes independentes: **DISPENSADA POR ESCOPO**, sem checkbox, contagem, dependência ou transferência.

## Requirement Traceability

| Requisitos / outcomes   | Tasks                                                  |
| ----------------------- | ------------------------------------------------------ |
| FR-001–004 / SC-001     | T004–T018                                              |
| FR-005–008 / SC-002     | T019–T025, T042, T054/T057                             |
| FR-009–013 / SC-003     | T026–T036, T056/T066                                   |
| FR-014–017 / SC-004/006 | T037–T049, T055–T057                                   |
| FR-018–019 / SC-005     | T059–T065                                              |
| FR-020–021 / SC-004     | T041/T043, T053–T057                                   |
| FR-022 / SC-008         | T047, T050–T053, T066                                  |
| FR-023–024 / SC-007     | T054–T058, T066–T070                                   |
| FR-025–026              | T001/T003/T006, restrições transversais de todas fases |

## Implementation Strategy

Primeiro review e autorização; setup/fundação; assessment e correções por história com checkpoints. US1 reduz risco primeiro, mas não é release parcial. Priorizar findings reais; nenhuma mudança significativa sem decisão. Concluir US5 antes de candidato/gates finais, então docs/recovery/regressão/smoke/CI e decisão única. Não criar spec nova nem avançar para publicação automática.

**Contagem**: 9 fases, 70 tasks (setup 3, foundation 4, US1 11, US2 7, US3 11, US4 13, US6 9, US5 7, final 5). Estado atual: 47 tasks concluídas; 29 concluídas no bloco Fases 4–6 e T041/T043 pendentes. PRODUCTION_API_URL = PENDING; nenhum endpoint real dispensado.
