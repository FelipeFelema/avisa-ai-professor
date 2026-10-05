---
description: "Task list for Auth Navigation UX Polish"
---

# Tasks: Auth Navigation UX Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Input**: Design documents from `specs/002-auth-navigation-ux-polish/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/mobile-interactions.md`, `quickstart.md`

**Scope boundary**: Esta feature altera somente a camada mobile e seus testes/artefatos. Não criar endpoint, DTO, regra de autenticação/autorização, migração, dado persistido, mudança de payload ou dependência nova.

**Tests**: Incluídos porque o plano, o contrato de interação e o quickstart exigem cobertura Jest/RNTL e gates do mobile. A evidência manual será Android; iOS, VoiceOver e métricas de participantes continuam NOT MEASURED quando não disponíveis.

## Path Conventions

- Mobile app: `mobile/app/`
- Mobile shared components: `mobile/src/components/`
- Mobile tests: `mobile/tests/`
- Feature artifacts: `specs/002-auth-navigation-ux-polish/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixar o limite da implementação e confirmar a estrutura existente antes de tocar nas rotas.

- [x] T001 [P] Confirmar o baseline e o limite da feature em `specs/002-auth-navigation-ux-polish/spec.md`, `specs/002-auth-navigation-ux-polish/plan.md`, `specs/002-auth-navigation-ux-polish/data-model.md`, `specs/002-auth-navigation-ux-polish/contracts/mobile-interactions.md`, `mobile/app/_layout.tsx`, `mobile/app/(auth)/_layout.tsx`, `mobile/app/(app)/_layout.tsx` e `mobile/package.json`, registrando que não haverá mudança em backend, API, persistência, autenticação ou dependências.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Criar as primitivas compartilhadas que bloqueiam o cadastro e as sete rotas secundárias.

**⚠️ CRITICAL**: Nenhuma user story deve ser implementada antes desta fase.

- [x] T002 Implementar a primitiva de retorno em `mobile/src/components/ui/BackButton.tsx` com Pressable, ícone existente, texto visual `Voltar`, `accessibilityRole="button"`, `accessibilityLabel="Voltar"`, alvo mínimo de `theme.targets.android`, guard síncrono por `useRef`, consulta de `router.canGoBack()` no instante do toque, `router.back()` para histórico e `router.replace(fallbackHref)` sem histórico, sem BackHandler/listener, rede ou persistência.
- [x] T003 Implementar o shell `SecondaryScreen` em `mobile/src/components/ui/SecondaryScreen.tsx`, dependendo de `BackButton.tsx`, mantendo SafeAreaView e a faixa de retorno fora da área rolável e envolvendo igualmente loading, erro, not-found e conteúdo de sucesso sem substituir as ações contextuais existentes.
- [x] T004 [P] Exportar `BackButton` e `SecondaryScreen` em `mobile/src/components/ui/index.ts`, preservando os exports atuais de Button, ScreenState, FormField e ConfirmationDialog.
- [x] T005 [P] Atualizar o mock compartilhado de Expo Router em `mobile/tests/setup.ts` para expor `canGoBack` junto de `push`, `replace` e `back`, mantendo funções independentes por teste e sem alterar o comportamento de produção.

**Checkpoint**: As primitivas de retorno e o mock de navegação estão disponíveis; as user stories podem avançar sem criar soluções de retorno concorrentes.

---

## Phase 3: User Story 1 - Concluir o cadastro com o teclado aberto (Priority: P1) 🎯 MVP

**Goal**: Permitir que Responsável e Professor alcancem campos, mensagens de validação e `Cadastrar` com o teclado aberto, sem perder valores, seleção de perfil ou regras atuais.

**Independent Test**: Executar os testes de `AuthScreen` e do cadastro para os dois perfis e confirmar no Android, em portrait e na menor viewport suportada, que `Confirmar senha`, `Código do professor`, erros e `Cadastrar` podem ser visualizados e acionados.

### Tests for User Story 1

- [x] T006 [P] [US1] Criar `mobile/tests/components/AuthScreen.spec.tsx` com testes para KeyboardAvoidingView por plataforma, `flexGrow`, `keyboardShouldPersistTaps="handled"`, espaço inferior rolável e BackButton opcional fora do ScrollView, cobrindo explicitamente cadastro com retorno e Login sem retorno.
- [x] T007 [P] [US1] Criar `mobile/tests/routes/auth-navigation-ux.spec.tsx` com testes do cadastro em Responsável e Professor, incluindo presença de `Confirmar senha`, `Código do professor` e `Cadastrar`, mensagens de validação alcançáveis, seleção de perfil, valores preservados ao alternar o perfil e ausência de alteração no payload/mutation; escrever os testes antes da implementação correspondente.

### Implementation for User Story 1

- [x] T008 [US1] Evoluir `mobile/src/components/auth/AuthScreen.tsx` para usar KeyboardAvoidingView com `behavior="height"` no Android e `behavior="padding"` no iOS, preservar SafeAreaView, ScrollView, `flexGrow` e `keyboardShouldPersistTaps`, reservar espaço inferior suficiente e aceitar uma opção explícita de BackButton/fallback sem resetar filhos, footer ou estado de formulário.
- [x] T009 [US1] Atualizar `mobile/app/(auth)/register.tsx` para ativar o retorno visual com fallback `/login` por meio de `AuthScreen.tsx`, preservando `shouldUnregister`, `clearErrors`, `resetField`, seleção Responsável/Professor, validação, payload, mutation e feedbacks existentes.

**Checkpoint**: O cadastro é independentemente navegável e rolável nos dois perfis; Login e as regras de cadastro continuam sem regressão funcional.

---

## Phase 4: User Story 2 - Voltar de telas secundárias com clareza (Priority: P2)

**Goal**: Expor um único retorno visual consistente nas sete telas secundárias, com fallback seguro quando não houver histórico, preservando o botão/gesto nativo e todos os estados da tela.

**Independent Test**: Executar a matriz de sete rotas com histórico e sem histórico, verificar uma única chamada de navegação, testar loading/erro/not-found e confirmar que Login, Home, Turmas e Perfil continuam sem BackButton.

### Tests for User Story 2

- [x] T010 [P] [US2] Criar `mobile/tests/components/BackButton.spec.tsx` cobrindo role, label, texto visual, alvo mínimo baseado em `theme.targets.android`, histórico chamando somente `back`, ausência de histórico chamando somente `replace` com o fallback, toque duplo produzindo uma única transição e ausência de requisição/listener nativo.
- [x] T011 [P] [US2] Criar `mobile/tests/routes/secondary-navigation.spec.tsx` com a matriz de `register`, `classrooms/new`, `classrooms/[id]`, `classrooms/[id]/new-announcement`, `announcements/[id]`, `announcements/[id]/edit` e `profile/edit`, cobrindo fallback estático/dinâmico, loading, erro, not-found, origem imediata e ausência do controle nas quatro telas raiz.

### Implementation for User Story 2

- [x] T012 [P] [US2] Envolver `mobile/app/(app)/classrooms/new.tsx` e `mobile/app/(app)/classrooms/[id].tsx` com `SecondaryScreen`, usando fallback `/classrooms`, mantendo as ações de formulário, query/mutation, confirmação e todos os retornos antecipados dentro do shell.
- [x] T013 [P] [US2] Envolver `mobile/app/(app)/classrooms/[id]/new-announcement.tsx` e `mobile/app/(app)/announcements/[id].tsx` com `SecondaryScreen`, usando `/classrooms/:classroomId` no novo comunicado e `/classrooms` até haver contexto, depois `/classrooms/:classroomId` no detalhe carregado, sem alterar formulários, estados, dados ou ações de conteúdo.
- [x] T014 [P] [US2] Envolver `mobile/app/(app)/announcements/[id]/edit.tsx` e `mobile/app/(app)/profile/edit.tsx` com `SecondaryScreen`, usando fallback `/announcements/:announcementId` e `/profile`, respectivamente, mantendo loading/erro/not-found, confirmação, formulário, retorno nativo e ações contextuais sem criar controles ambíguos.
- [x] T015 [US2] Reconciliar os mocks e expectativas de navegação afetados em `mobile/tests/routes/confirmation-matrix.spec.tsx`, `mobile/tests/routes/classroom-details.spec.tsx` e `mobile/tests/routes/profile-edit.spec.tsx`, adicionando `canGoBack` quando a tela compartilhada for montada e preservando asserções existentes de mutation, cache, confirmação e navegação pós-sucesso.

**Checkpoint**: As sete rotas têm retorno visual em todos os estados, cada fallback usa `replace` somente sem histórico, e nenhum listener ou controle foi adicionado às telas raiz.

---

## Phase 5: User Story 3 - Encontrar um único caminho para criar conta (Priority: P3)

**Goal**: Deixar somente o CTA de rodapé associado a `Não possui uma conta?`, mantendo Login, validações, feedbacks e `Entrar` intactos.

**Independent Test**: Abrir Login, contar exatamente um controle `Criar conta`, acioná-lo e confirmar `push('/register')`; repetir a validação dos campos e do submit sem observar mudança no fluxo de Login.

### Tests for User Story 3

- [x] T016 [US3] Estender `mobile/tests/routes/auth-navigation-ux.spec.tsx` com os casos de Login: exatamente um `Criar conta`, associação ao texto `Não possui uma conta?`, abertura de `/register`, Login sem BackButton e preservação de campos, validações, feedbacks e `Entrar`; respeitar a alteração anterior do mesmo arquivo feita em T007.

### Implementation for User Story 3

- [x] T017 [US3] Remover o Button inline redundante e o estilo sem uso de `mobile/app/(auth)/login.tsx`, mantendo exatamente o CTA de footer que chama `router.push('/register')` e preservando mutation, campos, validações, feedbacks, `Entrar` e a ausência de retorno visual no Login.

**Checkpoint**: Login apresenta uma única ação visível de cadastro e nenhuma regra funcional de autenticação foi alterada.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consolidar acessibilidade, executar a validação automatizada/manual e deixar explícitas as limitações de evidência.

- [x] T018 [P] Estender `mobile/tests/accessibility/touch-targets.spec.tsx` para incluir `BackButton` na matriz de alvos, verificar os tokens compartilhados e manter a cobertura dos controles existentes sem introduzir valores literais divergentes.
- [x] T019 Executar o teste direcionado do quickstart a partir de `mobile/package.json` para `mobile/tests/components/BackButton.spec.tsx`, `mobile/tests/components/AuthScreen.spec.tsx`, `mobile/tests/routes/auth-navigation-ux.spec.tsx` e `mobile/tests/routes/secondary-navigation.spec.tsx`, corrigindo somente falhas dentro do escopo desta feature.
- [x] T020 Executar os gates descritos em `specs/002-auth-navigation-ux-polish/quickstart.md` usando `mobile/package.json`: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run doctor`, `npm run test:ci` e `npm run export:ci`; classificar cada resultado como PASS, WARN, FAIL ou NOT RUN e não tratar export/Doctor como prova de usabilidade manual.
- [x] T021 Realizar o walkthrough Android e registrar em `specs/002-auth-navigation-ux-polish/evidence/android-navigation-matrix.md` a matriz das sete rotas, teclado nos dois perfis, erro/loading/not-found quando aplicável, botão/gesto nativo, toque rápido, origem/destino e versão do dispositivo; declarar explicitamente iOS, VoiceOver, participantes e métricas não executados como NOT MEASURED.
- [x] T022 Revisar `specs/002-auth-navigation-ux-polish/spec.md`, `specs/002-auth-navigation-ux-polish/plan.md`, `specs/002-auth-navigation-ux-polish/contracts/mobile-interactions.md` e o diff final de `mobile/`, executar `git diff --check` no artefato e confirmar que não houve alteração em backend, contratos externos, persistência, autenticação, dependências ou WIP não relacionado.

---

## Dependencies & Execution Order

### Dependency Graph

```text
T001
 └─> T002 ─> T003 ─> {T004, T005}
       ├─> US1: {T006, T007} ─> T008 ─> T009
       ├─> US2: {T010, T011} ─> {T012, T013, T014} ─> T015
       └─> US3: T016 (also depends on T007 because it extends the same test file) ─> T017

{T009, T015, T017} ─> T018 ─> T019 ─> T020 ─> T021 ─> T022
```

### Phase Dependencies

- **Setup (Phase 1)**: T001 has no dependency and defines the allowed surface.
- **Foundational (Phase 2)**: T002–T005 depend on the baseline; T003 depends on T002, while T004 and T005 can run in parallel after the primitives exist.
- **User Story 1 (P1)**: T006 and T007 can run in parallel after the foundation; T008 depends on those tests and on T002/T003; T009 depends on T008.
- **User Story 2 (P2)**: T010 and T011 can run in parallel after the foundation; T012–T014 can run in parallel after the route tests are specified; T015 consolidates the existing affected test mocks afterward.
- **User Story 3 (P3)**: T016 depends on T007 because both edit `mobile/tests/routes/auth-navigation-ux.spec.tsx`; T017 follows T016.
- **Polish**: T018 follows all story implementations; T019 precedes T020 to diagnose the focused suites before the full gates; T021 requires the automated checks and T022 is the final scope/evidence review.

### User Story Completion Order

- **US1 (P1)**: Can start after Phase 2 and is the recommended MVP increment.
- **US2 (P2)**: Can start after Phase 2 and is independent of the form behavior, although the final mobile gates cover both stories.
- **US3 (P3)**: Source work is small and independent, but its test section shares the auth navigation suite with US1, so T007 must be complete before T016.

### Parallel Opportunities

- **Foundation**: T004 and T005 are parallel after T002/T003.
- **US1**: T006 and T007 use different test files and can run in parallel; T008/T009 remain sequential.
- **US2**: T010 and T011 use different test files; T012, T013 and T014 own disjoint route files and can run in parallel after the tests are written.
- **Validation**: T019 and T020 are deliberately sequential because both invoke Jest/quality tooling; this keeps coverage, caches and export output unambiguous.

## Parallel Execution Examples

### User Story 1

```text
Lane A: T006 -> component/keyboard contract in mobile/tests/components/AuthScreen.spec.tsx
Lane B: T007 -> register journey contract in mobile/tests/routes/auth-navigation-ux.spec.tsx
Coordinator: T008 -> mobile/src/components/auth/AuthScreen.tsx -> T009 -> mobile/app/(auth)/register.tsx
```

### User Story 2

```text
Lane A: T010 -> BackButton semantics and single-flight behavior
Lane B: T011 -> seven-route matrix and root exclusions
Lane C: T012 -> classroom creation/details routes
Lane D: T013 -> announcement creation/details routes
Lane E: T014 -> announcement editor/profile editor routes
Coordinator: T015 -> reconcile existing route tests and mocks
```

### User Story 3

```text
Coordinator: T016 -> extend shared auth-navigation-ux.spec.tsx
Implementation: T017 -> remove only the redundant inline CTA from login.tsx
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete T006–T009 for cadastro Responsável/Professor.
3. Run the focused tests and the Android keyboard walkthrough.
4. Stop and validate the P1 increment before adding the seven-route navigation matrix.

### Incremental Delivery

1. Add US1 and validate the keyboard/form behavior.
2. Add US2 and validate all seven secondary routes, state shells and native back behavior.
3. Add US3 and validate the single Login CTA.
4. Execute T018–T022 and retain every unavailable platform/manual result as an explicit limitation.

### Scope and Safety Notes

- Não alterar `backend/`, Prisma, migrações, serviços de API, payloads, validações de autenticação ou armazenamento.
- Não reativar globalmente o header do Stack, instalar `BackHandler`, usar `push` para fallback ou adicionar biblioteca de teclado.
- Preservar alterações não relacionadas no worktree; nenhuma tarefa autoriza reset, restore, limpeza ou commit.
- `tasks.md` é planejamento; nenhum critério de sucesso fica aprovado antes das validações automatizadas e do walkthrough Android correspondentes.

## Phase 7: Convergence

- [x] T023 Executar o walkthrough Android completo e atualizar `specs/002-auth-navigation-ux-polish/evidence/android-navigation-matrix.md` com dispositivo/versão, matriz das sete rotas, teclado nos dois perfis, estados de loading/erro/not-found, botão/gesto nativo e toque rápido, mantendo iOS, VoiceOver, participantes e métricas como `NOT MEASURED` quando indisponíveis conforme SC-001, SC-002, SC-003, SC-005, SC-006 e T021
- [x] T024 Expor o lock transitório do `BackButton` como estado `disabled`/acessibilidade durante a janela de navegação e adicionar a asserção correspondente, preservando o guard por `useRef`, a consulta de `canGoBack()` no toque e a transição única conforme plan: estado desabilitado do BackButton
