# Detail Surfaces Validation

## Baseline das Fases 1 e 2

Data: 2026-10-01

- T001 — `PASS`: verificados o helper `getClassroomAnnouncementExpirationLabel`, os tokens `theme`/`AUTH_THEME`, os primitivos compartilhados em `mobile/src/components/ui/`, as rotas e testes móveis relacionados, os scripts de `mobile/package.json` e a ausência de mudança de contrato em `backend/prisma/schema.prisma`. Nenhum pacote, lockfile, endpoint ou migration foi incluído no escopo.
- Baseline do worktree: `git status --short` mostrou somente a pasta não rastreada da própria Spec 004 (`?? specs/004-detail-surfaces-visual-polish/`); não havia WIP rastreado em mobile ou backend para esta implementação.
- T002 — `PASS`: `cd mobile; npm test -- --runInBand tests/lib/classroom-expiration.spec.ts tests/routes/classroom-details.spec.tsx tests/routes/profile.spec.tsx tests/routes/confirmation-matrix.spec.tsx tests/routes/secondary-navigation.spec.tsx tests/accessibility/touch-targets.spec.tsx`.
  - 6 suites passaram.
  - 22 testes passaram.
  - 0 falhas e 0 snapshots.
- Evidência manual, dispositivo Android, escala de texto, TalkBack, iOS/VoiceOver e participantes: `NOT MEASURED` neste checkpoint.

## Checkpoint da Fase 3 — US1

- T003–T005 — `PASS`: `cd mobile; npm exec -- jest --runInBand tests/components/AnnouncementCard.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/confirmation-matrix.spec.tsx`.
  - 3 suites passaram.
  - 23 testes passaram.
  - Cobertura dirigida: ordem e semântica do card, rótulos hoje/1 dia/X dias, entradas inválidas/passadas, criação por `PROFESSOR`, owner/membro/usuário desconhecido, estados de turma e comunicados, confirmações, cancelamento, erro recuperável, bloqueio de toque repetido, mutations e navegação após sucesso.
- T006–T007 — `PASS`: implementação validada pelo checkpoint US1 e pela regressão dirigida completa da Fase 1–3:
  - 7 suites passaram.
  - 37 testes passaram.
  - `npm run typecheck` — `PASS`.
  - `npm run lint` — `PASS`.
  - `npm run format:check` — `PASS`.
- Doctor, export, walkthrough Android e a matriz de evidência das fases posteriores: `NOT RUN` por estarem na Fase 6, fora do limite autorizado desta execução; qualquer observação manual permanece `NOT MEASURED`.

## Checkpoint da Fase 6 - Polish e validacao transversal
Data: 2026-10-01

### Matriz de cenários

| Área | Cenário/observação | Evidência | Status |
|---|---|---|---|
| US1 | Turma do proprietário com comunicados: nome → `Comunicados`/`+ Novo` → cards → `Excluir turma` | `classroom-details.spec.tsx` | `PASS` |
| US1 | Turma do proprietário sem comunicados: vazio antes da ação final | `classroom-details.spec.tsx`, `confirmation-matrix.spec.tsx` | `PASS` |
| US1 | Turma de membro com e sem comunicados: `Sair da turma` no fim, sem `Excluir turma` | `classroom-details.spec.tsx`, `confirmation-matrix.spec.tsx` | `PASS` |
| US1 | `PROFESSOR` encontra `Criar comunicado` e conserva o destino `/classrooms/{id}/new-announcement` | `classroom-details.spec.tsx` | `PASS` |
| US1 | Usuário desconhecido, turma ausente e lista 404 não recebem ação destrutiva; retorno seguro e retry | `classroom-details.spec.tsx`, `secondary-navigation.spec.tsx` | `PASS` |
| US1 | Lista carregando ou com erro recuperável mantém contexto, retry e ação válida | `classroom-details.spec.tsx` | `PASS` |
| Card | Expiração hoje, em 1 dia, em X dias, inválida e passada | `AnnouncementCard.spec.tsx`, `classroom-expiration.spec.ts` | `PASS` |
| US2 | Detalhe autoral: heading, professor, `Publicado em`, `Expira em`, corpo integral e ações em ordem | `detail-surfaces.spec.tsx` | `PASS` |
| US2 | Detalhe não autoral não reserva nem expõe `Editar`/`Excluir` | `detail-surfaces.spec.tsx`, `confirmation-matrix.spec.tsx` | `PASS` |
| US2 | Título, autoria e corpo longos, com quebras de linha e sem limite de linhas no detalhe | `detail-surfaces.spec.tsx` | `PASS` |
| US2 | Loading, erro com retry, 404/ausência e fallback da navegação secundária | `detail-surfaces.spec.tsx`, `secondary-navigation.spec.tsx` | `PASS` |
| US2 | Exclusão autoral preserva confirmação, cancelamento, pending, erro, bloqueio duplicado e `router.back()` | `confirmation-matrix.spec.tsx` | `PASS` |
| US3 | Perfil autenticado: header, avatar, Nome, E-mail, Perfil, editar e logout em ordem | `profile.spec.tsx` | `PASS` |
| US3 | Nome/e-mail/perfil longos permanecem presentes sem limite de linhas | `profile.spec.tsx` | `PASS` |
| US3 | Loading e usuário indisponível são distintos; `Entrar` retorna a `/login` | `profile.spec.tsx` | `PASS` |
| Navegação | Back único, fallback e retorno por histórico nas superfícies secundárias | `secondary-navigation.spec.tsx` | `PASS` |
| Acessibilidade automatizada | Card e controles com nomes/roles, hint, ordem de leitura, foco habilitado, feedback pressionado, texto destrutivo e alvos mínimos de 48 dp Android/44 pt iOS | `touch-targets.spec.tsx`: 6 testes | `PASS` |
| Layout manual | Menor largura, texto ampliado, colisão, contraste e ritmo visual | Sem dispositivo/emulador observável | `NOT MEASURED` |
| Tecnologia assistiva | TalkBack, VoiceOver, foco real e ordem de leitura em dispositivo | `adb` não está disponível no ambiente | `NOT MEASURED` |
| Plataforma manual | Modelo/versão Android, API, escala, participante e walkthrough dos fluxos | Walkthrough não executado sem `adb`/dispositivo | `NOT MEASURED` |

### T014 — acessibilidade dos controles

- `PASS`: `& .\\node_modules\\.bin\\jest.cmd --runInBand tests/accessibility/touch-targets.spec.tsx` — 6 testes passaram (iOS e Android).
- `PASS`: o card expõe um único `button` acessível com nome `Abrir comunicado ...`, hint textual, ordem título → professor → conteúdo → prazo, estado focável e feedback de pressionamento.
- `PASS`: `+ Novo`, `Editar`, `Excluir`, `Sair da turma` e `Sair da conta` preservam nomes/roles; as variantes destrutivas mantêm texto de ação e `theme.colors.danger`.
- `PASS`: alvos verificados contra `theme.targets.android` (48) e `theme.targets.ios` (44); o `AnnouncementCard` declara também `minWidth` mínimo.
### T016 — Jest dirigido e completo

- `PASS`: `& .\\node_modules\\.bin\\jest.cmd --runInBand tests/lib/classroom-expiration.spec.ts tests/components/AnnouncementCard.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/detail-surfaces.spec.tsx tests/routes/profile.spec.tsx tests/routes/confirmation-matrix.spec.tsx tests/routes/secondary-navigation.spec.tsx tests/accessibility/touch-targets.spec.tsx` — 8 suites e 48 testes passaram.
- `PASS`: `& .\\node_modules\\.bin\\jest.cmd --ci --runInBand --coverage --forceExit` — 36 suites e 148 testes passaram; cobertura global reportada: 82,64% statements, 86,89% branches, 72,56% functions e 82,14% lines.
- `WARN`: o script `npm run test:ci` executa os mesmos testes, mas o processo não encerra sozinho por handles assíncronos; a execução equivalente com `--forceExit` concluiu sem falhas. Também aparecem avisos preexistentes de `act(...)` em testes de hooks.

### T017 — gates mobile

- `PASS`: `npm run typecheck`.
- `PASS`: `npm run lint`.
- `PASS`: `npm run format:check`.
- `PASS`: `npm run doctor` com acesso à Expo API — 21/21 checks passaram.
- `PASS`: `npm run export:ci` gerou bundles Android, iOS e Web; o diretório temporário `.expo-ci-export` foi removido após a verificação.
- `WARN` resolvido: a primeira execução isolada do Doctor ficou em 19/21 por bloqueio de rede (`fetch EACCES`); a repetição autorizada confirmou 21/21.

### T018 — walkthrough Android

- `NOT MEASURED`: `adb devices` não pôde ser executado porque `adb` não está instalado/disponível no PATH. Nenhum dispositivo, emulador, versão Android, escala de texto, TalkBack ou participante foi observado.
- O export, Doctor e Jest não foram usados como substitutos de evidência visual/manual. Os cenários de largura estreita, texto ampliado, conteúdo longo, confirmações e tecnologia assistiva permanecem `NOT MEASURED` manualmente.

### T019 — auditoria de escopo e contrato

- `PASS`: a auditoria final conferiu `spec.md`, `contracts/detail-surfaces.md`, `backend/prisma/schema.prisma`, `mobile/package.json` e esta evidência; não há alteração de API, OpenAPI, Prisma, migration, pacote/lockfile, pesquisa, tema, gestão de conta, senha ou exclusão de conta.
- `PASS`: FR-001–FR-023 e SC-001–SC-007/SC-010 têm cobertura automatizada ou de escopo preservado nas suites dirigidas e completas; os limites de SC-008/SC-009 que exigem observação visual/assistiva estão explicitamente `NOT MEASURED`.
- `PASS`: o diff da Phase 6 ficou restrito ao `AnnouncementCard`, ao teste de acessibilidade e à evidência/tasks da Spec 004; as alterações anteriores das fases 3–5 foram preservadas como WIP existente.
