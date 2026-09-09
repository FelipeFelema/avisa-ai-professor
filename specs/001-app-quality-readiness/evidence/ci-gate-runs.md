# Evidência de gates da Phase 8 — T059–T062

Data da validação: 2026-09-07 (America/Sao_Paulo)

Nesta atualização, os gates backend sem dependência de PostgreSQL foram
revalidados em 2026-09-07. Integração, contrato e e2e permanecem com a execução
anterior registrada contra `avisa_ai_test`; o Docker Engine não estava disponível
para repetir esses comandos nesta sessão.

## Resultado local

Os workflows e scripts foram executados no checkout compartilhado. Os comandos
abaixo foram rodados contra o banco descartável `avisa_ai_test`; nenhuma limpeza
destrutiva foi apontada para o banco de desenvolvimento `avisa_ai`.

### Backend — `Backend CI / Run backend checks`

| Gate | Comando | Resultado | O que prova / limite |
|---|---|---|---|
| Instalação determinística | `npm ci --dry-run --ignore-scripts` em `backend` | PASS | O lockfile permite instalação limpa; não substitui o `npm ci` real do runner. |
| Schema Prisma | `npm run prisma:validate` | PASS | O schema Prisma é válido. |
| Client Prisma | `npm run prisma:generate` | PASS | O client é gerado a partir do schema atual. |
| Migration | `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/avisa_ai_test'; npm run prisma:migrate:deploy` | PASS — execução anterior em 2026-09-06 | 11 migrations encontradas e nenhuma pendente no banco descartável. |
| Formatação | `npm run format:check` | PASS | Fontes backend e testes estão formatados. |
| Lint | `npm run lint` | PASS | ESLint terminou sem diagnóstico. |
| TypeScript | `npm run typecheck` | PASS | O backend compila sem emitir artefatos. |
| Unit + coverage | `npm run test:cov` | PASS — 12 suites/71 testes; 70,8% statements, 60,7% branches, 62,01% functions, 70,63% lines | O piso global 60/60/50/60 foi atingido. |
| Integração | `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/avisa_ai_test'; npm run test:integration` | PASS — execução anterior em 2026-09-06; 6 suites/39 testes | Cobre boundaries HTTP, persistência, autorização e transações. Logs esperados de falhas simuladas foram emitidos pelos testes de rollback. |
| Contrato OpenAPI | `npm run test:contract` | PASS — execução anterior em 2026-09-06; 1 suite/1 teste | Inventário e metadados OpenAPI passam contra o contrato. |
| E2E | `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/avisa_ai_test'; npm run test:e2e` | PASS — execução anterior em 2026-09-06; 3 suites/9 testes | Bootstrap, jornadas críticas e deny de documentação passam. |
| Build | `npm run build` | PASS | Emissão Nest/TypeScript concluída. |

O workflow usa `avisa_ai_test`, mantém o job estável e publica `backend/coverage`
como artefato quando disponível. Os scripts de integração, contrato e e2e
incluem `--runInBand` diretamente para não depender do repasse ambíguo de
argumentos pelo npm 11.

### Mobile — `Mobile CI / Run mobile checks`

| Gate | Comando | Resultado | O que prova / limite |
|---|---|---|---|
| Instalação determinística | `npm ci` em `mobile` | PASS — 1.128 pacotes instalados, 1.129 auditados | O lockfile está sincronizado. O npm reportou 19 vulnerabilidades (14 moderate, 5 high); nenhuma correção automática foi aplicada nesta fase. |
| TypeScript | `npm run typecheck` | PASS | Rotas, hooks e serviços compilam. |
| Lint | `npm run lint` | PASS | Expo ESLint terminou sem diagnóstico. |
| Formatação | `npm run format:check` | PASS | Fontes, testes e configuração estão formatados. |
| Expo Doctor | `npm run doctor` | PASS — 21/21 | Revalidado com acesso externo temporário às APIs da Expo/React Native Directory. |
| Behavior + coverage | `npm run test:ci` | PASS — 28 suites/79 testes | Todos os oito módulos críticos com piso configurado atingiram 80/80/80/70. `ConfirmationDialog` e `api.ts` ficaram em 100% nas quatro métricas; `AuthProvider` ficou em 98,21% statements, 72,72% branches, 93,33% functions e 98,14% lines. Houve warnings existentes de `act(...)` nos testes de mutations; não alteram o exit code. |
| Export | `npm run export:ci` | PASS — bundles Web, iOS e Android | Metro exportou as três plataformas após a instalação limpa; o diretório descartável foi removido após a captura. |

O `test:ci` não usa mais `--passWithNoTests`. A configuração aplica os pisos
80% statements/lines/functions e 70% branches a `useDeleteAnnouncement`,
`useDeleteClassroom`, `useUpdateAnnouncement`, `useUpdateProfile`,
`updateProfile.schema`, `ConfirmationDialog`, `AuthProvider` e `api.ts`.
Os testes críticos de diálogo, restauração/expiração de sessão e retry de 401
foram ampliados para sustentar esses pisos sem alterar o código de produção.

### Conventional Commits — `Commit Conventions / Validate commits`

| Gate | Comando | Resultado | O que prova / limite |
|---|---|---|---|
| Instalação raiz | `npm ci --dry-run --ignore-scripts` | PASS | Tooling Commitlint e lockfile raiz são instaláveis. |
| Histórico válido | `npm exec -- commitlint -- --from HEAD~10 --to HEAD --verbose` | PASS — 10 commits | O range local recente segue Conventional Commits. |
| Falha deliberada | `Write-Output 'not conventional' \| npm exec -- commitlint -- --verbose` | PASS como matriz — comando falhou com exit 1 | Commitlint identificou `subject-empty` e `type-empty`. |

O workflow usa `fetch-depth: 0` e o separador adicional `--` exigido pelo npm
11 para encaminhar `--from/--to/--last` ao Commitlint.

## Matriz SC-009 — falhas deliberadas descartáveis

Cada caso foi executado em arquivo temporário, produziu diagnóstico acionável e
foi removido antes da conferência final do worktree.

| Categoria | Comando/fixture temporário | Resultado observado |
|---|---|---|
| Formatação | `npm exec -- prettier -- --check ../.phase8-validation/format-bad.ts` a partir de `backend` | exit 1; Prettier apontou o arquivo e recomendou `--write`. |
| Correção estática | `npm exec -- tsc -- --noEmit --pretty false --skipLibCheck --target ES2022 --module commonjs .phase8-validation/static-bad.ts` | exit 1; `TS2322: Type 'number' is not assignable to type 'string'`. |
| Build/export | `npm run build` com `backend/src/phase8-deliberate-build-failure.ts` | exit 1; Nest reportou `TS2322` no arquivo temporário. |
| Comportamento/contrato | `npm exec -- jest -- --runInBand --runTestsByPath tests/phase8-deliberate-failure.spec.ts` em `mobile` | exit 1; Jest mostrou esperado/recebido e linha da asserção. |
| Ambiente/dependência | `npm ci --ignore-scripts` em `.phase8-validation` sem lockfile | exit 1; npm exigiu `package-lock.json`/`npm-shrinkwrap.json`. |
| Convenção | mensagem `not conventional` via stdin do Commitlint | exit 1; regras `subject-empty` e `type-empty`. |

## Limites da evidência

- `actionlint` não está instalado; a validação de YAML foi feita por inspeção
  do diff e pela coerência dos comandos locais, não por execução do GitHub
  Actions runner.
- A execução local não prova que o runner hospedado terá os mesmos acessos à API
  Expo nem que os workflows foram aceitos pelo GitHub; o `npm ci` local também
  reportou as vulnerabilidades acima sem falhar o gate.
- O detalhamento de `npm audit --omit=dev` ficou `NOT MEASURED` porque o endpoint
  de advisories retornou erro nesta sessão; nenhum `audit fix` foi executado.
- T063 (rulesets/required checks) e T064 (auditoria dos ambientes alvo) têm
  evidências separadas e permanecem bloqueantes até a confirmação externa.
