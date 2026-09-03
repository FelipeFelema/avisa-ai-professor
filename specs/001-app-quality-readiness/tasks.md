---

description: "Tarefas de implementação para consolidação de experiência e qualidade do aplicativo"
---

# Tasks: Consolidação de Experiência e Qualidade do Aplicativo

**Input**: Artefatos de design em `/specs/001-app-quality-readiness/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Obrigatórios pela especificação e pela constituição. Em cada história, as tarefas de teste precedem a implementação correspondente e devem falhar pelo motivo esperado antes da alteração de produção.

**Organization**: As tarefas são agrupadas por história de usuário para permitir implementação e validação independentes. A tabela `Execution Coordination` é o contrato de dependências, ownership de arquivos e verificação estreita.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode compartilhar uma onda pronta com outra tarefa após suas dependências diretas serem satisfeitas e desde que os caminhos sejam disjuntos
- **[Story]**: História de usuário atendida (`US1` a `US6`)
- Todas as descrições indicam arquivos exatos; metadados de lane e dependência ficam somente na tabela de coordenação

## Path Conventions

- **Backend NestJS/Prisma**: `backend/src/`, `backend/prisma/`, `backend/test/`
- **Mobile Expo/React Native**: `mobile/app/`, `mobile/src/`, `mobile/tests/`, `mobile/docs/`
- **Qualidade transversal**: `.github/workflows/`, arquivos de pacote na raiz e `specs/001-app-quality-readiness/evidence/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Instalar somente o tooling aprovado, sincronizar lockfiles e proteger o trabalho mobile já existente.

- [X] T001 [P] Adicionar `@nestjs/swagger` e preparar os scripts de contrato sem alterar comportamento da API em backend/package.json e backend/package-lock.json
- [X] T002 [P] Adicionar Jest Expo, React Native Testing Library, `expo-doctor` fixado e scripts/configuração iniciais em mobile/package.json, mobile/package-lock.json e mobile/jest.config.js
- [X] T003 [P] Criar o pacote raiz de Commitlint com versões fixadas e regra Conventional Commits em package.json, package-lock.json e commitlint.config.mjs
- [X] T004 [P] Registrar o diff e as invariantes de preservação do editor de comunicado antes de qualquer consolidação em specs/001-app-quality-readiness/evidence/wip-baseline.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Disponibilizar harnesses seguros, primitivas compartilhadas e sessões revogáveis exigidas por todas as histórias protegidas.

**⚠️ CRITICAL**: Nenhuma história de usuário é liberada antes de T017 comprovar a fundação.

- [X] T005 Implementar bootstrap de testes Nest reutilizável e proteção contra limpeza de banco não reconhecido em backend/test/helpers/test-app.helper.ts, backend/test/helpers/test-database.helper.ts, backend/test/jest-integration.json e backend/test/jest-e2e.json
- [X] T006 [P] Configurar ambiente Jest Expo/RNTL, mocks de Expo Router/Secure Store e render com providers em mobile/tests/setup.ts, mobile/tests/helpers/render.tsx e mobile/tests/helpers/mocks.ts
- [X] T007 [P] Evoluir o tema verde/neutro para tokens semânticos e documentar contraste, tipografia, espaçamento, estados e alvos por plataforma em mobile/src/theme/tokens.ts, mobile/src/theme/index.ts e mobile/docs/visual-foundation.md
- [X] T008 [P] Escrever testes falhos de acessibilidade, cancelamento, pending e variantes das primitivas compartilhadas em mobile/tests/components/Button.spec.tsx, mobile/tests/components/FormField.spec.tsx, mobile/tests/components/ScreenState.spec.tsx e mobile/tests/components/ConfirmationDialog.spec.tsx
- [X] T009 Implementar `Button`, `FormField`, `ScreenState` e `ConfirmationDialog` nativos com export público em mobile/src/components/ui/Button.tsx, mobile/src/components/ui/FormField.tsx, mobile/src/components/ui/ScreenState.tsx, mobile/src/components/ui/ConfirmationDialog.tsx e mobile/src/components/ui/index.ts
- [X] T010 [P] Escrever testes falhos para factories de query keys, mensagens HTTP em português e `retry: false` de mutations em mobile/tests/config/query-keys.spec.ts, mobile/tests/lib/http-error.spec.ts e mobile/tests/config/query-client.spec.ts
- [X] T011 Implementar factories de query keys, mapeamento HTTP e política sem retry automático em mobile/src/config/query-keys.ts, mobile/src/config/query-client.ts, mobile/src/config/index.ts e mobile/src/lib/http-error.ts
- [X] T012 Escrever teste de migração falho cobrindo refresh legado, rollback, receipt único e cascatas em backend/test/session-and-receipt-migration.integration.spec.ts e backend/test/fixtures/legacy-session.sql
- [X] T013 Adicionar `AuthSession` e `ClassroomDeletionReceipt`, migrar pares de refresh legados e remover colunas antigas com transformação revisável em backend/prisma/schema.prisma e backend/prisma/migrations/20260824_add_auth_sessions_and_deletion_receipts/migration.sql
- [X] T014 Escrever testes falhos de criação, rotação, expiração, revogação e incompatibilidade de `sid` em backend/src/auth/auth-session.service.spec.ts, backend/src/auth/auth.service.spec.ts e backend/test/auth.integration.spec.ts
- [X] T015 Implementar persistência e invariantes de sessão por dispositivo em backend/src/auth/auth-session.service.ts e backend/src/auth/auth.module.ts
- [X] T016 Integrar `sid` obrigatório nos JWTs, login/register/refresh, guards e usuário autenticado atual em backend/src/auth/auth.service.ts, backend/src/auth/strategies/jwt.strategy.ts, backend/src/auth/strategies/refresh.strategy.ts, backend/src/common/types/jwt-payload.type.ts, backend/src/common/types/auth-user.type.ts e backend/src/users/users.service.ts
- [X] T017 Executar os checks estreitos da fundação e registrar versões, testes vermelhos-verdes e migração isolada em specs/001-app-quality-readiness/evidence/foundation-readiness.md

**Checkpoint**: Fundação pronta; US1, US2, o trabalho contract-first de US4 e a preparação de US5 podem avançar conforme o DAG.

---

## Phase 3: User Story 1 - Excluir uma Turma Própria com Segurança (Priority: P1) 🎯 MVP

**Goal**: O professor owner exclui a turma de forma permanente, atômica, autorizada e repetível pelo mobile; demais atores não conseguem apagar o conteúdo.

**Independent Test**: Criar turma com membros e comunicado, cancelar uma confirmação, executar DELETE como owner, repetir após resposta perdida e comprovar `204`, cascatas, uma única remoção, retorno à lista e negação de non-owner/anônimo.

### Backend Test-First Slice

> Escrever e executar estes testes primeiro; eles devem falhar pela ausência do comportamento alvo.

- [X] T018 [P] [US1] Escrever testes unitários falhos para owner explícito, bloqueio de leave, receipt, retry e concorrência em backend/src/classrooms/classrooms.service.spec.ts e backend/src/classrooms/classrooms.controller.spec.ts
- [X] T019 [P] [US1] Escrever testes de integração/e2e falhos para `204/401/403/404`, rollback e cascatas PostgreSQL em backend/test/classrooms.integration.spec.ts e backend/test/classrooms.e2e-spec.ts
- [X] T020 [US1] Implementar owner projection, leave `409` e exclusão transacional receipt-backed em backend/src/classrooms/classrooms.service.ts, backend/src/classrooms/classrooms.controller.ts, backend/src/classrooms/dto/classroom-summary.dto.ts e backend/src/common/types/classroom-with-users.type.ts

### Mobile Test-First Slice

- [X] T021 [P] [US1] Escrever testes mobile falhos do contrato DELETE, single-flight, invalidation e retry explícito receipt-backed em mobile/tests/services/classroom.service.spec.ts e mobile/tests/hooks/useDeleteClassroom.spec.tsx
- [X] T022 [US1] Adicionar `ownerId`, DELETE `204` e hook de exclusão com keys exatas e single-flight em mobile/src/types/classroom.ts, mobile/src/services/classes/classroom.service.ts e mobile/src/hooks/useDeleteClassroom.ts
- [X] T023 [US1] Escrever testes de rota falhos para visibilidade por `ownerId`, confirmação, navegação segura e not-found em mobile/tests/routes/classrooms-list.spec.tsx e mobile/tests/routes/classroom-details.spec.tsx
- [X] T024 [US1] Integrar ações owner/non-owner, diálogo destrutivo, estados de falha/not-found e route replacement em mobile/app/(app)/(tabs)/classrooms.tsx, mobile/app/(app)/classrooms/[id].tsx e mobile/src/components/home/ClassroomCard.tsx

### Independent Validation

- [X] T025 [US1] Executar o cenário independente automatizado da US1 e registrar autorização, cascata, retry e navegação em specs/001-app-quality-readiness/evidence/us1-classroom-deletion.md

**Checkpoint**: US1 funciona e é testável independentemente; este é o MVP sugerido após Setup e Foundational.

---

## Phase 4: User Story 2 - Atualizar Meu Nome ou E-mail (Priority: P1)

**Goal**: Qualquer usuário autenticado edita apenas o próprio nome/e-mail, confirma o diff, vê a identidade atualizada imediatamente e mantém somente a sessão iniciadora após troca de e-mail.

**Independent Test**: Para `PARENT`, `PROFESSOR` e `ADMIN`, validar name-only, email-only e ambos; validar também cancel/no-op, `400/409`, persistência, atualização em até dois segundos no perfil e na saudação da home, duas sessões e limpeza completa do dispositivo revogado.

### Backend Test-First Slice

> Os testes backend e client podem ser escritos em paralelo contra o contrato já versionado.

- [X] T026 [P] [US2] Escrever testes unitários falhos de normalização, campos proibidos, no-op, `P2002` e revogação seletiva em backend/src/users/users.service.spec.ts e backend/src/users/users.controller.spec.ts
- [X] T027 [P] [US2] Escrever testes de integração/e2e falhos para atualização self-service equivalente por `PARENT`/`PROFESSOR`/`ADMIN`, duas sessões, access/refresh revogados, login normalizado e atomicidade em backend/test/users.integration.spec.ts e backend/test/profile.e2e-spec.ts
- [X] T028 [US2] Restringir e normalizar o contrato de perfil com DTO próprio e normalizador reutilizável em backend/src/users/dto/update-profile.dto.ts, backend/src/users/dto/create-user.dto.ts e backend/src/common/normalizers/user-normalizer.ts
- [X] T029 [US2] Implementar PATCH self-service por `sub/sid`, no-op sem write, conflito `409` e revogação transacional das demais sessões em backend/src/users/users.service.ts e backend/src/users/users.controller.ts

### Mobile Test-First Slice

- [X] T030 [P] [US2] Escrever testes mobile falhos para schema, diff, contrato PATCH, no-op e erro `409` no campo em mobile/tests/validations/updateProfile.schema.spec.ts e mobile/tests/services/auth.service.spec.ts
- [X] T031 [US2] Adicionar tipos, schema Zod e service PATCH somente com campos alterados em mobile/src/types/auth.ts, mobile/src/validations/updateProfile.schema.ts e mobile/src/services/auth/auth.service.ts
- [X] T032 [US2] Escrever testes falhos de `applyProfileUpdate` e expiração `401` atômica sobre tokens, cache e contexto em mobile/tests/providers/AuthProvider.spec.tsx e mobile/tests/lib/api-session.spec.ts
- [X] T033 [US2] Implementar sincronização do perfil e expiração de sessão compartilhada pelo interceptor em mobile/src/providers/AuthProvider.tsx, mobile/src/contexts/AuthContext.tsx e mobile/src/lib/api.ts
- [X] T034 [US2] Escrever testes falhos do hook e das rotas de perfil/home para confirmação, preservação do formulário e atualização da identidade no perfil e na saudação da home em até dois segundos em mobile/tests/hooks/useUpdateProfile.spec.tsx, mobile/tests/routes/profile.spec.tsx, mobile/tests/routes/profile-edit.spec.tsx e mobile/tests/routes/home.spec.tsx
- [X] T035 [US2] Implementar mutation, formulário/diff/confirmação, acesso pela tela de perfil e sincronização dos displays diretos da identidade em mobile/src/hooks/useUpdateProfile.ts, mobile/app/(app)/profile/edit.tsx, mobile/app/(app)/(tabs)/profile.tsx, mobile/app/(app)/(tabs)/index.tsx e mobile/src/components/home/HomeHeader.tsx

### Independent Validation

- [X] T036 [US2] Executar o cenário independente da US2 para `PARENT`/`PROFESSOR`/`ADMIN` com duas sessões e registrar normalização, conflitos, perfil/home sincronizados em até dois segundos e revogação em specs/001-app-quality-readiness/evidence/us2-profile-update.md

**Checkpoint**: US2 funciona independentemente de US1 e mantém a sessão atual sem deixar sessões remotas ativas após troca de e-mail.

---

## Phase 5: User Story 3 - Confirmar Toda Atualização ou Exclusão (Priority: P1)

**Goal**: Perfil, turma, membership e comunicado usam a mesma decisão confirmada, cancelam sem request, bloqueiam duplo envio e preservam contexto em falhas.

**Independent Test**: Percorrer as cinco linhas da matriz de confirmação e comprovar target/diff/consequência, cancelamento, pending, falha, sucesso e novo consentimento antes de retry ambíguo.

### Tests for User Story 3

- [ ] T037 [US3] Escrever testes falhos da matriz completa para leave e update/delete de comunicado, incluindo cancel, falha e double-tap em mobile/tests/routes/confirmation-matrix.spec.tsx, mobile/tests/hooks/useLeaveClassroom.spec.tsx, mobile/tests/hooks/useUpdateAnnouncement.spec.tsx e mobile/tests/hooks/useDeleteAnnouncement.spec.tsx

### Implementation for User Story 3

- [ ] T038 [US3] Consolidar services e hooks de comunicado com query keys, invalidação sem navegação embutida e mutations sem retry em mobile/src/services/announcements/announcement.service.ts, mobile/src/services/announcements/index.ts, mobile/src/hooks/useUpdateAnnouncement.ts e mobile/src/hooks/useDeleteAnnouncement.ts
- [ ] T039 [P] [US3] Preservar o WIP e integrar diff, confirmação e contexto de falha no editor correto em mobile/app/(app)/announcements/[id]/edit.tsx
- [ ] T040 [P] [US3] Substituir `Alert` por confirmação compartilhada, single-flight e feedback recuperável no detalhe em mobile/app/(app)/announcements/[id].tsx
- [ ] T041 [P] [US3] Integrar confirmação de saída somente para non-owner sem confirmar join/criação em mobile/app/(app)/(tabs)/classrooms.tsx e mobile/app/(app)/classrooms/[id].tsx
- [ ] T042 [US3] Remover a rota duplicada somente após consolidar e testar o editor correto em mobile/app/(app)/classrooms/[id]/edit.tsx
- [ ] T043 [US3] Executar todas as linhas da matriz e registrar chamadas zero no cancel, single-flight e preservação de contexto em specs/001-app-quality-readiness/evidence/us3-confirmation-matrix.md

**Checkpoint**: Todas as mutations update/delete/leave no escopo usam o contrato de confirmação; create, join, navegação e logout continuam fora dele.

---

## Phase 6: User Story 4 - Usar uma Referência Interativa da API (Priority: P2)

**Goal**: Disponibilizar UI/JSON OpenAPI com exatamente 19 operações fora de produção, Bearer auth e metadados completos, sempre negada em produção.

**Independent Test**: Abrir `/api/v1/docs`, verificar inventário/metadados, executar um GET e uma mutation protegida, provar indisponibilidade em produção mesmo com override e registrar um desenvolvedor que não participou da implementação concluindo o exercício documentado em até 15 minutos.

### Tests for User Story 4

- [ ] T044 [P] [US4] Escrever testes falhos de bootstrap, health versionado, inventário OpenAPI, schemas/security/responses e negação em produção em backend/src/app.controller.spec.ts, backend/test/openapi.contract.spec.ts e backend/test/app.e2e-spec.ts

### Implementation for User Story 4

- [ ] T045 [P] [US4] Extrair prefixo, versionamento, pipes e CORS para bootstrap compartilhado e substituir Hello World por health em backend/src/configure-app.ts, backend/src/main.ts, backend/src/app.controller.ts e backend/src/app.service.ts
- [ ] T046 [P] [US4] Criar DTOs de resposta/erro documentáveis e helpers de decorators sem dados sensíveis em backend/src/common/dto/error-response.dto.ts, backend/src/common/dto/health-response.dto.ts, backend/src/common/dto/auth-response.dto.ts e backend/src/openapi/api-responses.decorator.ts
- [ ] T047 [P] [US4] Documentar operações, inputs, respostas e autenticação de auth/users em backend/src/auth/auth.controller.ts, backend/src/auth/dto/login.dto.ts, backend/src/users/users.controller.ts, backend/src/users/dto/create-user.dto.ts e backend/src/users/dto/update-profile.dto.ts
- [ ] T048 [P] [US4] Documentar operações, ownership, schemas e erros de classrooms em backend/src/classrooms/classrooms.controller.ts, backend/src/classrooms/dto/create-classroom.dto.ts e backend/src/classrooms/dto/classroom-summary.dto.ts
- [ ] T049 [P] [US4] Documentar operações e regras de autoria/admin de announcements/invite-codes em backend/src/announcements/announcements.controller.ts, backend/src/announcements/dto/create-announcement.dto.ts, backend/src/announcements/dto/update-announcement.dto.ts, backend/src/invites-code/invite-code.controller.ts e backend/src/invites-code/dto/create-invite-code.dto.ts
- [ ] T050 [US4] Configurar Swagger UI/JSON em development/test, kill switch e deny absoluto em production pelo bootstrap compartilhado em backend/src/openapi/configure-openapi.ts, backend/src/configure-app.ts e backend/.env.example
- [ ] T051 [US4] Comparar o runtime com o contrato de design e registrar as 19 operações, exercício autenticado de GET/mutation concluído em até 15 minutos por desenvolvedor que não participou da implementação e negação de produção em specs/001-app-quality-readiness/evidence/us4-openapi.md

**Checkpoint**: A referência interativa é completa, exercitável fora de produção e inacessível em produção.

---

## Phase 7: User Story 5 - Experimentar uma Interface Consistente e Acessível (Priority: P2)

**Goal**: Fluxos primários usam tokens e primitivas comuns, estados explícitos, semântica acessível, contraste AA e alvos mínimos específicos por plataforma.

**Independent Test**: Auditar auth, turmas, comunicados e perfil com screen reader, texto ampliado, matriz de contraste e medição de 44×44 pt iOS/48×48 dp Android, sem issue crítica.

### Tests for User Story 5

- [ ] T052 [P] [US5] Escrever testes falhos de contraste, targets por plataforma, semântica e estados das rotas primárias em mobile/tests/theme/tokens.spec.ts, mobile/tests/accessibility/touch-targets.spec.tsx e mobile/tests/routes/primary-states.spec.tsx

### Implementation for User Story 5

- [ ] T053 [US5] Registrar aprovação do product owner para a evolução verde/neutra antes do redesign amplo em specs/001-app-quality-readiness/evidence/visual-approval.md
- [ ] T054 [P] [US5] Migrar autenticação para tokens/primitivas e estados acessíveis sem alterar regras de login/register em mobile/app/(auth)/login.tsx, mobile/app/(auth)/register.tsx, mobile/src/components/auth/AuthScreen.tsx, mobile/src/components/auth/AuthField.tsx, mobile/src/components/auth/AuthButton.tsx e mobile/src/components/auth/AuthRolePicker.tsx
- [ ] T055 [P] [US5] Migrar listagem/detalhe/criação de turmas e cards para estados explícitos e ações irmãs sem `Pressable` aninhado em mobile/app/(app)/(tabs)/classrooms.tsx, mobile/app/(app)/classrooms/[id].tsx, mobile/app/(app)/classrooms/new.tsx, mobile/src/components/home/ClassroomCard.tsx e mobile/src/components/home/EmptyClassroomState.tsx
- [ ] T056 [P] [US5] Migrar perfil e comunicado para tokens/primitivas, wrapping e estados loading/error/success/not-found em mobile/app/(app)/(tabs)/profile.tsx, mobile/app/(app)/profile/edit.tsx, mobile/app/(app)/announcements/[id].tsx, mobile/app/(app)/announcements/[id]/edit.tsx e mobile/src/components/announcements/AnnouncementCard.tsx
- [ ] T057 [US5] Executar auditoria cross-platform de contraste, targets, texto dinâmico e screen reader sem issue crítica em specs/001-app-quality-readiness/evidence/accessibility-audit.md
- [ ] T058 [US5] Executar os cenários de usabilidade de exclusão, perfil e tarefas representativas e registrar SC-002/003/008 em specs/001-app-quality-readiness/evidence/usability-results.md

**Checkpoint**: Fluxos primários respeitam a fundação aprovada e possuem evidência automatizada e humana de acessibilidade/usabilidade.

---

## Phase 8: User Story 6 - Confiar em Gates Automatizados de Entrega (Priority: P2)

**Goal**: Backend, mobile e commits têm checks determinísticos, obrigatórios em `develop`/`main` e comprovadamente bloqueiam integração quando falham.

**Independent Test**: Executar todos os gates e, em alterações descartáveis, introduzir falhas controladas de formatação, correção estática, build/export, comportamento/contrato, saúde de ambiente/dependências e convenção de commit, demonstrando que somente a alteração conforme fica apta a integrar.

### Implementation and Validation for User Story 6

- [ ] T059 [P] [US6] Completar scripts backend e workflow estável com Prisma validate/generate/migrate, format, lint, typecheck, unit+coverage, integração, contrato, e2e e build em backend/package.json, backend/package-lock.json e .github/workflows/backend-ci.yml
- [ ] T060 [P] [US6] Completar scripts mobile, thresholds dos módulos críticos e workflow estável com doctor fixado, Jest/RNTL e export all em mobile/package.json, mobile/package-lock.json, mobile/jest.config.js e .github/workflows/mobile-ci.yml
- [ ] T061 [P] [US6] Criar workflow com histórico completo e nome estável para validar todos os commits da PR em .github/workflows/commit-conventions.yml
- [ ] T062 [US6] Executar gates verdes e a matriz de falhas deliberadas de formatação, correção estática, build/export, comportamento/boundary/contrato, saúde de ambiente/dependências e convenção de commit definida em specs/001-app-quality-readiness/contracts/quality-gates.md, anexando logs acionáveis em specs/001-app-quality-readiness/evidence/ci-gate-runs.md
- [ ] T063 [US6] Configurar rulesets de `develop` e `main` sem bypass indevido e comprovar PR falha bloqueada em specs/001-app-quality-readiness/evidence/github-required-checks.md
- [ ] T064 [P] [US6] Auditar a migration histórica obrigatória de `ownerId` nos ambientes alvo e registrar backfill/recuperação quando necessário em specs/001-app-quality-readiness/evidence/owner-migration-audit.md
- [ ] T065 [US6] Consolidar nomes dos três checks, enforcement, falhas detectadas e condição final da US6 em specs/001-app-quality-readiness/evidence/us6-delivery-gates.md

**Checkpoint**: A feature só passa este checkpoint se os checks estiverem ativos como obrigatórios e uma falha real impedir merge.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Fechar documentação, quickstart e decisão de readiness sem confundir artefatos planejados com comportamento implementado.

- [ ] T066 Atualizar documentação operacional e links para docs/evidências sem expor segredos em README.md, backend/README.md e mobile/README.md
- [ ] T067 Executar integralmente o guia de validação em banco descartável e registrar comandos/resultados em specs/001-app-quality-readiness/evidence/quickstart-validation.md
- [ ] T068 Executar `git diff --check`, scan de segredos/placeholders/cores literais, revisar todas as evidências e registrar aprovação ou bloqueios restantes em specs/001-app-quality-readiness/evidence/final-readiness.md

---

## Execution Coordination

| Task | Lane | Depends On | Dependency Reason | Owned Paths | Verification |
|------|------|------------|-------------------|-------------|--------------|
| T001 | backend | - | Root de dependências backend | backend/package.json; backend/package-lock.json | `npm --prefix backend install --package-lock-only && npm --prefix backend run build` |
| T002 | client | - | Root de tooling mobile | mobile/package.json; mobile/package-lock.json; mobile/jest.config.js | `npm --prefix mobile run test:ci -- --listTests` |
| T003 | coordinator | - | Root de tooling transversal | package.json; package-lock.json; commitlint.config.mjs | `npm exec commitlint -- --version` |
| T004 | coordinator | - | Preserva WIP anterior à implementação | specs/001-app-quality-readiness/evidence/wip-baseline.md | Revisão manual contra `git diff -- mobile/app/(app)/announcements/[id].tsx mobile/app/(app)/announcements/[id]/edit.tsx` |
| T005 | backend | T001 | Harness usa dependências e scripts backend fixados | backend/test/helpers/test-app.helper.ts; backend/test/helpers/test-database.helper.ts; backend/test/jest-integration.json; backend/test/jest-e2e.json | `npm --prefix backend run test:integration -- --listTests` |
| T006 | quality | T002 | Harness usa Jest Expo/RNTL instalados | mobile/tests/setup.ts; mobile/tests/helpers/render.tsx; mobile/tests/helpers/mocks.ts | `npm --prefix mobile run test:ci -- --listTests` |
| T007 | client | T002 | Tokens são a base visual das primitivas | mobile/src/theme/tokens.ts; mobile/src/theme/index.ts; mobile/docs/visual-foundation.md | `npm --prefix mobile run typecheck` |
| T008 | quality | T006, T007 | Testes consomem harness e contrato de tokens | mobile/tests/components/Button.spec.tsx; mobile/tests/components/FormField.spec.tsx; mobile/tests/components/ScreenState.spec.tsx; mobile/tests/components/ConfirmationDialog.spec.tsx | `npm --prefix mobile run test:ci -- --runTestsByPath tests/components/Button.spec.tsx tests/components/FormField.spec.tsx tests/components/ScreenState.spec.tsx tests/components/ConfirmationDialog.spec.tsx` falha pelo comportamento ausente |
| T009 | client | T008 | TDD exige os testes falhos antes das primitivas | mobile/src/components/ui/Button.tsx; mobile/src/components/ui/FormField.tsx; mobile/src/components/ui/ScreenState.tsx; mobile/src/components/ui/ConfirmationDialog.tsx; mobile/src/components/ui/index.ts | Reexecutar os quatro testes de T008 com sucesso |
| T010 | quality | T006, T007 | Testa boundaries compartilhadas antes da implementação | mobile/tests/config/query-keys.spec.ts; mobile/tests/lib/http-error.spec.ts; mobile/tests/config/query-client.spec.ts | `npm --prefix mobile run test:ci -- --runTestsByPath tests/config/query-keys.spec.ts tests/lib/http-error.spec.ts tests/config/query-client.spec.ts` falha pelo comportamento ausente |
| T011 | client | T010 | TDD exige contrato falho de cache/erro/retry | mobile/src/config/query-keys.ts; mobile/src/config/query-client.ts; mobile/src/config/index.ts; mobile/src/lib/http-error.ts | Reexecutar os três testes de T010 com sucesso |
| T012 | quality | T001, T005 | Migration precisa de banco descartável protegido | backend/test/session-and-receipt-migration.integration.spec.ts; backend/test/fixtures/legacy-session.sql | `npm --prefix backend run test:integration -- --runInBand session-and-receipt-migration` falha pelas tabelas ausentes |
| T013 | backend | T012 | Teste vermelho define transformação e rollback | backend/prisma/schema.prisma; backend/prisma/migrations/20260824_add_auth_sessions_and_deletion_receipts/migration.sql | `npm --prefix backend exec prisma validate && npm --prefix backend exec prisma migrate deploy` em DB descartável |
| T014 | quality | T005, T013 | Tipos Prisma novos habilitam os testes de sessão | backend/src/auth/auth-session.service.spec.ts; backend/src/auth/auth.service.spec.ts; backend/test/auth.integration.spec.ts | `npm --prefix backend test -- --runInBand auth-session.service.spec.ts auth.service.spec.ts` falha pelo lifecycle ausente |
| T015 | backend | T014 | Teste vermelho define invariantes persistentes | backend/src/auth/auth-session.service.ts; backend/src/auth/auth.module.ts | `npm --prefix backend test -- --runInBand auth-session.service.spec.ts` |
| T016 | backend | T015 | Emissão/validação JWT consome o store de sessões | backend/src/auth/auth.service.ts; backend/src/auth/strategies/jwt.strategy.ts; backend/src/auth/strategies/refresh.strategy.ts; backend/src/common/types/jwt-payload.type.ts; backend/src/common/types/auth-user.type.ts; backend/src/users/users.service.ts | `npm --prefix backend test -- --runInBand auth.service.spec.ts && npm --prefix backend run test:integration -- --runInBand auth.integration.spec.ts` |
| T017 | coordinator | T009, T011, T016 | Gate explícito libera histórias após fundação funcional | specs/001-app-quality-readiness/evidence/foundation-readiness.md | Evidência contém versões, migração limpa e suites alvo verdes |
| T018 | quality | T017 | Primeira suite TDD backend da US1 | backend/src/classrooms/classrooms.service.spec.ts; backend/src/classrooms/classrooms.controller.spec.ts | `npm --prefix backend test -- --runInBand classrooms` falha pelos novos cenários |
| T019 | quality | T017 | Boundary US1 pode ser especificado em paralelo ao unitário | backend/test/classrooms.integration.spec.ts; backend/test/classrooms.e2e-spec.ts | `npm --prefix backend run test:integration -- --runInBand classrooms.integration.spec.ts` falha pelos novos cenários |
| T020 | backend | T018, T019 | Implementação satisfaz regras unitárias e de persistência | backend/src/classrooms/classrooms.service.ts; backend/src/classrooms/classrooms.controller.ts; backend/src/classrooms/dto/classroom-summary.dto.ts; backend/src/common/types/classroom-with-users.type.ts | Suites de T018/T019 verdes, inclusive DELETE concorrente |
| T021 | quality | T017 | Contrato design estável permite TDD client paralelo ao backend | mobile/tests/services/classroom.service.spec.ts; mobile/tests/hooks/useDeleteClassroom.spec.tsx | `npm --prefix mobile run test:ci -- --runTestsByPath tests/services/classroom.service.spec.ts tests/hooks/useDeleteClassroom.spec.tsx` falha pelo fluxo ausente |
| T022 | client | T011, T021 | Hook consome keys/serviço definidos pelos testes | mobile/src/types/classroom.ts; mobile/src/services/classes/classroom.service.ts; mobile/src/hooks/useDeleteClassroom.ts | Reexecutar os testes de T021 com sucesso |
| T023 | quality | T009, T022 | Rotas são testadas após contrato/hook e antes da UI | mobile/tests/routes/classrooms-list.spec.tsx; mobile/tests/routes/classroom-details.spec.tsx | `npm --prefix mobile run test:ci -- --runTestsByPath tests/routes/classrooms-list.spec.tsx tests/routes/classroom-details.spec.tsx` falha pelos estados ausentes |
| T024 | client | T004, T009, T020, T023 | UI converge contrato backend estável e testes de rota | mobile/app/(app)/(tabs)/classrooms.tsx; mobile/app/(app)/classrooms/[id].tsx; mobile/src/components/home/ClassroomCard.tsx | Suites de T021/T023 verdes e `npm --prefix mobile run typecheck` |
| T025 | quality | T020, T024 | Evidência só é válida após provider e consumer completos | specs/001-app-quality-readiness/evidence/us1-classroom-deletion.md | Checklist US1 registra `204/401/403/404`, cascata, retry e route replacement |
| T026 | quality | T017 | Primeira suite TDD backend da US2 | backend/src/users/users.service.spec.ts; backend/src/users/users.controller.spec.ts | `npm --prefix backend test -- --runInBand users` falha pelos cenários novos |
| T027 | quality | T017 | Boundary de papéis/multi-sessão é independente do unitário | backend/test/users.integration.spec.ts; backend/test/profile.e2e-spec.ts | `npm --prefix backend run test:integration -- --runInBand users.integration.spec.ts` falha pela matriz `PARENT`/`PROFESSOR`/`ADMIN` e pelos cenários multi-sessão novos |
| T028 | backend | T026 | DTO/normalizador satisfaz contrato unitário de entrada | backend/src/users/dto/update-profile.dto.ts; backend/src/users/dto/create-user.dto.ts; backend/src/common/normalizers/user-normalizer.ts | `npm --prefix backend test -- --runInBand users.service.spec.ts users.controller.spec.ts` |
| T029 | backend | T016, T027, T028 | PATCH precisa de sid ativo, DTO estável e boundary vermelho | backend/src/users/users.service.ts; backend/src/users/users.controller.ts | Suites de T026/T027 verdes, inclusive duas sessões |
| T030 | quality | T017 | Contrato checked-in permite TDD client sem aguardar backend | mobile/tests/validations/updateProfile.schema.spec.ts; mobile/tests/services/auth.service.spec.ts | `npm --prefix mobile run test:ci -- --runTestsByPath tests/validations/updateProfile.schema.spec.ts tests/services/auth.service.spec.ts` falha pelo contrato ausente |
| T031 | client | T011, T030 | Tipos/schema/service seguem testes e mapeamento comum | mobile/src/types/auth.ts; mobile/src/validations/updateProfile.schema.ts; mobile/src/services/auth/auth.service.ts | Reexecutar os testes de T030 com sucesso |
| T032 | quality | T006, T031 | Provider/interceptor são testados após contrato tipado | mobile/tests/providers/AuthProvider.spec.tsx; mobile/tests/lib/api-session.spec.ts | `npm --prefix mobile run test:ci -- --runTestsByPath tests/providers/AuthProvider.spec.tsx tests/lib/api-session.spec.ts` falha pela sincronização ausente |
| T033 | client | T032 | TDD exige falha antes da boundary de sessão client | mobile/src/providers/AuthProvider.tsx; mobile/src/contexts/AuthContext.tsx; mobile/src/lib/api.ts | Reexecutar os testes de T032 com sucesso |
| T034 | quality | T009, T031, T033 | Rotas usam diálogo, service e provider estabilizados | mobile/tests/hooks/useUpdateProfile.spec.tsx; mobile/tests/routes/profile.spec.tsx; mobile/tests/routes/profile-edit.spec.tsx; mobile/tests/routes/home.spec.tsx | `npm --prefix mobile run test:ci -- --runTestsByPath tests/hooks/useUpdateProfile.spec.tsx tests/routes/profile.spec.tsx tests/routes/profile-edit.spec.tsx tests/routes/home.spec.tsx` falha pelo perfil/home ainda não sincronizados |
| T035 | client | T029, T033, T034 | Telas convergem PATCH backend e contexto client testados | mobile/src/hooks/useUpdateProfile.ts; mobile/app/(app)/profile/edit.tsx; mobile/app/(app)/(tabs)/profile.tsx; mobile/app/(app)/(tabs)/index.tsx; mobile/src/components/home/HomeHeader.tsx | Suites de T030/T032/T034 verdes, inclusive perfil e saudação atualizados em até dois segundos |
| T036 | quality | T029, T035 | Evidência precisa dos dois lados completos | specs/001-app-quality-readiness/evidence/us2-profile-update.md | Cenário registra os três papéis, name/email/both, no-op, conflito, perfil/home e duas sessões |
| T037 | quality | T025, T036 | Matriz global depende dos fluxos US1/US2 concluídos | mobile/tests/routes/confirmation-matrix.spec.tsx; mobile/tests/hooks/useLeaveClassroom.spec.tsx; mobile/tests/hooks/useUpdateAnnouncement.spec.tsx; mobile/tests/hooks/useDeleteAnnouncement.spec.tsx | `npm --prefix mobile run test:ci -- --runTestsByPath tests/routes/confirmation-matrix.spec.tsx tests/hooks/useLeaveClassroom.spec.tsx tests/hooks/useUpdateAnnouncement.spec.tsx tests/hooks/useDeleteAnnouncement.spec.tsx` falha pelas linhas restantes |
| T038 | client | T011, T037 | Hooks/services seguem testes e query keys comuns | mobile/src/services/announcements/announcement.service.ts; mobile/src/services/announcements/index.ts; mobile/src/hooks/useUpdateAnnouncement.ts; mobile/src/hooks/useDeleteAnnouncement.ts | Reexecutar testes de hooks de comunicado de T037 |
| T039 | client | T004, T009, T038 | Editor correto preserva WIP e usa hook estabilizado | mobile/app/(app)/announcements/[id]/edit.tsx | Teste da linha update announcement em T037 fica verde |
| T040 | client | T004, T009, T038 | Detalhe usa diálogo/hook sem compartilhar arquivo com editor | mobile/app/(app)/announcements/[id].tsx | Teste da linha delete announcement em T037 fica verde |
| T041 | client | T009, T024, T037 | Leave reutiliza telas US1 e contrato comum | mobile/app/(app)/(tabs)/classrooms.tsx; mobile/app/(app)/classrooms/[id].tsx | Teste da linha leave em T037 fica verde |
| T042 | client | T039 | Duplicata só sai após editor correto validado | mobile/app/(app)/classrooms/[id]/edit.tsx | `Test-Path -LiteralPath 'mobile/app/(app)/classrooms/[id]/edit.tsx'` retorna falso e teste de rota correta passa |
| T043 | quality | T039, T040, T041, T042 | Evidência cobre todas as linhas após consolidação | specs/001-app-quality-readiness/evidence/us3-confirmation-matrix.md | Matriz registra cinco ações, zero request no cancel e uma chamada no double-tap |
| T044 | quality | T017 | Contrato OpenAPI pode ser especificado contra baseline | backend/src/app.controller.spec.ts; backend/test/openapi.contract.spec.ts; backend/test/app.e2e-spec.ts | `npm --prefix backend run test:integration -- --runInBand openapi.contract.spec.ts` falha por docs/metadados ausentes |
| T045 | backend | T044 | Bootstrap/health implementam primeira parte dos testes | backend/src/configure-app.ts; backend/src/main.ts; backend/src/app.controller.ts; backend/src/app.service.ts | `npm --prefix backend test -- --runInBand app.controller.spec.ts && npm --prefix backend run test:e2e -- --runInBand app.e2e-spec.ts` |
| T046 | backend | T044 | DTOs comuns podem avançar paralelos ao bootstrap | backend/src/common/dto/error-response.dto.ts; backend/src/common/dto/health-response.dto.ts; backend/src/common/dto/auth-response.dto.ts; backend/src/openapi/api-responses.decorator.ts | `npm --prefix backend run build` |
| T047 | backend | T016, T029, T046 | Metadados aguardam contratos finais de auth/users | backend/src/auth/auth.controller.ts; backend/src/auth/dto/login.dto.ts; backend/src/users/users.controller.ts; backend/src/users/dto/create-user.dto.ts; backend/src/users/dto/update-profile.dto.ts | Teste OpenAPI filtra tags auth/users e passa |
| T048 | backend | T020, T046 | Metadados aguardam ownership/delete finais | backend/src/classrooms/classrooms.controller.ts; backend/src/classrooms/dto/create-classroom.dto.ts; backend/src/classrooms/dto/classroom-summary.dto.ts | Teste OpenAPI filtra tag classrooms e passa |
| T049 | backend | T046 | Domínios não alterados podem ser documentados em paralelo | backend/src/announcements/announcements.controller.ts; backend/src/announcements/dto/create-announcement.dto.ts; backend/src/announcements/dto/update-announcement.dto.ts; backend/src/invites-code/invite-code.controller.ts; backend/src/invites-code/dto/create-invite-code.dto.ts | Teste OpenAPI filtra tags announcements/invite-codes e passa |
| T050 | backend | T001, T045, T047, T048, T049 | Swagger integra bootstrap e metadados completos | backend/src/openapi/configure-openapi.ts; backend/src/configure-app.ts; backend/.env.example | Suite T044 passa com 19 operações e production deny |
| T051 | quality | T050 | Exercício só é confiável após documento runtime completo | specs/001-app-quality-readiness/evidence/us4-openapi.md | OpenAPI parseia, tem 19 `operationId` únicos e registra GET/mutation por novo desenvolvedor em até 15 minutos e production deny |
| T052 | quality | T009 | Testes visuais usam primitivas compartilhadas existentes | mobile/tests/theme/tokens.spec.ts; mobile/tests/accessibility/touch-targets.spec.tsx; mobile/tests/routes/primary-states.spec.tsx | `npm --prefix mobile run test:ci -- --runTestsByPath tests/theme/tokens.spec.ts tests/accessibility/touch-targets.spec.tsx tests/routes/primary-states.spec.tsx` falha pelas telas ainda não migradas |
| T053 | coordinator | T007 | Aprovação humana usa a fundação documentada | specs/001-app-quality-readiness/evidence/visual-approval.md | Evidência identifica aprovador, data, versão e decisão |
| T054 | client | T009, T052, T053 | Redesign auth requer testes e aprovação | mobile/app/(auth)/login.tsx; mobile/app/(auth)/register.tsx; mobile/src/components/auth/AuthScreen.tsx; mobile/src/components/auth/AuthField.tsx; mobile/src/components/auth/AuthButton.tsx; mobile/src/components/auth/AuthRolePicker.tsx | Testes de auth/primary states e `npm --prefix mobile run typecheck` |
| T055 | client | T041, T052, T053 | Redesign de turmas aguarda fluxo final de leave/delete | mobile/app/(app)/(tabs)/classrooms.tsx; mobile/app/(app)/classrooms/[id].tsx; mobile/app/(app)/classrooms/new.tsx; mobile/src/components/home/ClassroomCard.tsx; mobile/src/components/home/EmptyClassroomState.tsx | Testes US1/US3/US5 e scan sem `Pressable` aninhado |
| T056 | client | T035, T039, T040, T052, T053 | Redesign perfil/comunicado aguarda fluxos finais | mobile/app/(app)/(tabs)/profile.tsx; mobile/app/(app)/profile/edit.tsx; mobile/app/(app)/announcements/[id].tsx; mobile/app/(app)/announcements/[id]/edit.tsx; mobile/src/components/announcements/AnnouncementCard.tsx | Testes US2/US3/US5 e `npm --prefix mobile run typecheck` |
| T057 | quality | T054, T055, T056 | Auditoria só mede telas migradas | specs/001-app-quality-readiness/evidence/accessibility-audit.md | Checklist registra AA, iOS 44×44, Android 48×48, texto e screen reader sem crítica |
| T058 | quality | T025, T036, T057 | Usabilidade mede fluxos funcionais e acessíveis | specs/001-app-quality-readiness/evidence/usability-results.md | Evidência calcula SC-002, SC-003 e SC-008 contra os limiares |
| T059 | backend | T001, T005, T020, T029, T050 | Gate backend inclui todos os boundaries implementados | backend/package.json; backend/package-lock.json; .github/workflows/backend-ci.yml | Executar sequencialmente todos os 12 gates do contrato backend |
| T060 | client | T002, T006, T043, T057 | Gate mobile inclui behavior/a11y/export finais | mobile/package.json; mobile/package-lock.json; mobile/jest.config.js; .github/workflows/mobile-ci.yml | `npm --prefix mobile run typecheck && npm --prefix mobile run lint && npm --prefix mobile run format:check && npm --prefix mobile run doctor && npm --prefix mobile run test:ci && npm --prefix mobile run export:ci` |
| T061 | coordinator | T003 | Workflow consome Commitlint raiz fixado | .github/workflows/commit-conventions.yml | Validar um commit conforme e outro inválido em range descartável |
| T062 | quality | T059, T060, T061 | Matriz de falhas exige os três workflows completos | specs/001-app-quality-readiness/evidence/ci-gate-runs.md | Evidência contém run verde e uma falha acionável de cada categoria: formatação, estática, build/export, comportamento/contrato, ambiente/dependências e commit |
| T063 | coordinator | T062 | Check names devem existir antes do ruleset | specs/001-app-quality-readiness/evidence/github-required-checks.md | Ruleset/export mostra três checks obrigatórios em develop/main e PR falha sem merge |
| T064 | quality | T013 | Auditoria usa schema/migrations finais e ambiente alvo | specs/001-app-quality-readiness/evidence/owner-migration-audit.md | Evidência confirma aplicada ou inclui backfill/recuperação aprovado |
| T065 | coordinator | T062, T063, T064 | Fechamento US6 exige CI, enforcement e migration audit | specs/001-app-quality-readiness/evidence/us6-delivery-gates.md | Documento referencia runs, rulesets, PR bloqueada e resultado de readiness |
| T066 | coordinator | T051, T058, T065 | Documentação final depende de contratos e gates aceitos | README.md; backend/README.md; mobile/README.md | Links locais resolvem e scan não encontra segredo/token real |
| T067 | quality | T066 | Quickstart deve refletir documentação final | specs/001-app-quality-readiness/evidence/quickstart-validation.md | Todas as seções de quickstart.md possuem resultado e evidência |
| T068 | coordinator | T025, T036, T043, T051, T057, T058, T065, T067 | Decisão final agrega cada história e gate obrigatório | specs/001-app-quality-readiness/evidence/final-readiness.md | `git diff --check` passa; scans passam; documento declara aprovado ou bloqueios explícitos |

### Coordination Validation

- Cada tarefa T001–T068 aparece exatamente uma vez na tabela.
- Todas as dependências são arestas diretas para tarefas anteriores; nenhum ciclo é permitido.
- Tarefas simultaneamente elegíveis com `[P]` possuem ownership de caminhos disjuntos.
- Testes de cada história precedem a implementação correspondente e devem comprovar falha relevante antes do verde.
- Verificações manuais são usadas apenas para aprovação, acessibilidade/usabilidade real, ambientes alvo e enforcement externo.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001–T004 são raízes independentes.
- **Foundational (Phase 2)**: consome Setup e termina no gate T017, que bloqueia as histórias.
- **US1 e US2 (P1)**: podem avançar em paralelo após T017 porque o OpenAPI design contract já estabiliza a fronteira; convergem apenas nas validações posteriores.
- **US3 (P1)**: depende dos fluxos US1 e US2 completos porque audita toda a matriz de update/delete/leave.
- **US4 (P2)**: testes/bootstrap/DTOs podem começar após T017; decorators de auth/users/classrooms esperam seus comportamentos P1 finais para evitar documentar contrato transitório.
- **US5 (P2)**: testes e aprovação visual podem começar após a fundação; migração ampla de telas espera os fluxos P1 que possuem os mesmos arquivos.
- **US6 (P2)**: workflows finais dependem do código/testes do componente; rulesets dependem dos nomes estáveis materializados.
- **Polish (Phase 9)**: depende das seis histórias e termina na decisão de readiness T068.

### User Story Completion Order

```text
Setup -> Foundational -> +-> US1 ----+
                        +-> US2 ----+-> US3 ----+
                        +-> US4 --------------+-> US6 -> Polish
                        +-> US5 --------------+
```

- **US1**: T018/T019/T021 → T020/T022 → T023/T024 → T025.
- **US2**: T026/T027/T030 → T028/T031/T032 → T029/T033/T034/T035 → T036.
- **US3**: T037 → T038 → T039/T040/T041 → T042 → T043.
- **US4**: T044 → T045/T046 → T047/T048/T049 → T050 → T051.
- **US5**: T052/T053 → T054/T055/T056 → T057 → T058.
- **US6**: T059/T060/T061/T064 → T062/T063 → T065.

### Cross-Lane Sequencing

- `contracts/openapi.json` e `contracts/mobile-interactions.md` estão estáveis: T021–T022 e T030–T031 podem avançar no client enquanto T018–T020 e T026–T029 avançam no backend.
- T024 espera T020 porque a UI deve consumir `ownerId` e os status receipt-backed finais; T035 espera T029 para fechar o cenário multi-sessão.
- T047/T048 esperam os contratos runtime P1 de users/classrooms; T049 pode ser feito em paralelo porque announcements/invite-codes não mudam semanticamente.
- T054/T055/T056 podem compartilhar uma onda após aprovação visual, mas cada uma possui conjuntos de telas/componentes disjuntos.
- T063 é uma dependência administrativa real: workflow verde sem required checks não conclui US6 nem a feature.

### Parallel Opportunities

- Setup: T001, T002, T003 e T004.
- Foundation: T006 com T007; depois T008 com T010.
- Após T017: suites backend/client de US1 (T018, T019, T021), US2 (T026, T027, T030), OpenAPI (T044) e visual (T052) usam caminhos disjuntos.
- US3: T039, T040 e T041 após T037/T038 e os providers específicos.
- US4: T045 e T046; depois T047, T048 e T049.
- US5: T054, T055 e T056 após T052/T053 e os fluxos donos dos arquivos.
- US6: T059, T060, T061 e T064 antes da consolidação de evidência.

---

## Parallel Example: Contract-First P1

```text
Task T018: testes unitários backend de classroom delete
Task T019: testes de boundary backend de classroom delete
Task T021: testes client do DELETE e hook de classroom
Task T026: testes unitários backend de profile update
Task T027: testes multi-sessão de boundary
Task T030: testes client do schema/service de perfil
```

Os caminhos são disjuntos. T024 reúne backend/client da US1; T035 reúne backend/client da US2.

## Parallel Example: OpenAPI Domains

```text
Task T047: metadados auth/users
Task T048: metadados classrooms
Task T049: metadados announcements/invite-codes
```

T050 só integra Swagger depois que os três providers de metadados estiverem verdes.

## Parallel Example: Visual Migration

```text
Task T054: autenticação
Task T055: turmas
Task T056: perfil e comunicados
```

Esta onda só é liberada após os testes T052, a aprovação T053 e a estabilização dos fluxos que já possuem esses arquivos.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar T001–T017.
2. Completar T018–T025.
3. Parar e validar US1 independentemente com owner/non-owner/anônimo, cascata, retry e mobile.
4. Não declarar a feature inteira concluída: US2–US6 e os gates externos continuam pendentes.

### Incremental Delivery

1. Setup + Foundational → sessões, harnesses e primitivas prontos.
2. US1 → exclusão segura de turma como primeiro incremento demonstrável.
3. US2 → perfil e revogação seletiva sem acoplar a entrega de US1.
4. US3 → consistência de confirmação em todas as mutations do escopo.
5. US4 e US5 → referência API e interface acessível em ondas independentes.
6. US6 → CI determinístico e enforcement externo.
7. Polish → quickstart completo e decisão de readiness baseada em evidência.

### Dependency-Aware Team Strategy

1. O coordinator libera somente tarefas cujas dependências diretas estejam satisfeitas.
2. Backend, client e quality assumem apenas os `Owned Paths` da linha correspondente.
3. Antes de iniciar uma onda `[P]`, confirmar que o worktree não introduziu conflito novo nos mesmos caminhos.
4. Cada tarefa de teste registra o vermelho esperado; cada implementação deixa sua verificação estreita verde.
5. Commits seguem `type(scope): description` e agrupam tarefas apenas quando a fronteira e os arquivos justificarem.

---

## Notes

- `[P]` indica possibilidade de uma onda pronta, não autorização para ignorar dependências ou conflitos vivos.
- A migration histórica de `ownerId` não deve ser reescrita; T064 audita o ambiente e cria plano de recuperação quando necessário.
- O receipt armazena somente `classroomId`, `ownerId` e `deletedAt`; ele não é soft delete nem mecanismo de restauração.
- Um `404` genérico de DELETE nunca vira sucesso no client; somente o backend reconhece o retry do owner e retorna `204`.
- O perfil não é persistido no Secure Store; somente tokens permanecem ali.
- EAS/Maestro continua fora do gate obrigatório desta feature; Jest Expo/RNTL é o gate comportamental mobile aprovado.
- A feature permanece incompleta sem T063, mesmo que todos os arquivos e workflows locais estejam verdes.
