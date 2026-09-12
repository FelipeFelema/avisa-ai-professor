# Implementation Plan: Consolidação de Experiência e Qualidade do Aplicativo

**Branch**: `feat/account-and-resourse-management` | **Feature ID**: `001-app-quality-readiness` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-app-quality-readiness/spec.md`

## Summary

Completar a experiência mobile de exclusão segura e repetível de turmas e atualização de perfil com revogação seletiva de sessões, uniformizar confirmações de updates/deletes, evoluir a identidade verde/neutra para uma fundação visual acessível, publicar uma referência OpenAPI interativa fora de produção e tornar testes e CI gates efetivamente bloqueantes. A implementação preserva o monólito modular NestJS e as camadas existentes do Expo, reutiliza PostgreSQL/Prisma/JWT/Axios/React Query/React Hook Form/Zod/Secure Store e adiciona apenas dependências de documentação e testes justificadas em [research.md](./research.md).

O backend existente é a base: ownership, deleção e cascatas de turma e o PATCH de perfil serão endurecidos e documentados, não reescritos. Uma migration substitui o refresh token único em `User` por sessões persistentes identificadas por `sid` e adiciona um recibo operacional mínimo de exclusão; isso permite manter o dispositivo atual, revogar todos os demais após troca de e-mail e reconhecer a repetição do mesmo DELETE sem reter conteúdo recuperável da turma. O mobile consumirá ownership explícito, sincronizará o perfil no `AuthContext`, bloqueará duplicidade de mutations e usará componentes compartilhados para confirmação, estados e acessibilidade. O trabalho local já existente no editor de comunicado deve ser preservado e consolidado na rota correta durante a implementação.

## Technical Context

**Language/Version**: Node.js 22+; TypeScript 5.9.3 no backend e ~6.0.3 no mobile

**Primary Dependencies**: NestJS 11, JWT/Passport, Prisma 7.6, `class-validator`/`class-transformer`, React Native 0.86, Expo SDK 57, Expo Router, Axios, TanStack React Query 5, React Hook Form 7, Zod 4 e Expo Secure Store; adicionar `@nestjs/swagger` para OpenAPI, Jest Expo/React Native Testing Library para comportamento mobile, `expo-doctor` travado e Commitlint para convenções de commit

**Storage**: PostgreSQL 15 via Prisma, incluindo as novas entidades operacionais `AuthSession` e `ClassroomDeletionReceipt`, que implementam respectivamente os conceitos de especificação **Device Session** e **Deletion Retry Record**; tokens JWT no Expo Secure Store; cache efêmero no TanStack React Query; uma migration com transformação dos refresh tokens legados

**Testing**: Jest 30, `ts-jest` e Supertest no backend (unitário, contrato, integração e e2e), incluindo matriz de `PARENT`/`PROFESSOR`/`ADMIN`, duas sessões simultâneas e DELETE inicial/repetido/concorrente; Jest Expo e React Native Testing Library no mobile (schema, hook, componente e integração das rotas de perfil/home); verificações automatizadas de contraste/tamanho mínimo, exercício OpenAPI cronometrado com novo desenvolvedor, falhas deliberadas em cada categoria de gate e auditorias manuais de acessibilidade/usabilidade onde automação não comprova o uso real ou o tempo de tarefa

**Target Platform**: API NestJS em runtime Node/Linux e Docker; lançamento inicial do aplicativo Expo para Android. iOS e web permanecem alvos de compatibilidade/empacotamento, sem aceite manual nesta iteração.

**Project Type**: Monorepo de API REST + aplicativo mobile, com tooling de qualidade no repositório

**Performance Goals**: Refletir perfil atualizado em todas as telas afetadas em até 2 segundos (SC-005); enviar no máximo uma mutation por confirmação mesmo sob taps rápidos; manter confirmações, loading e feedback responsivos sem bloquear a thread de UI; não há novo objetivo de throughput do servidor nesta feature

**Constraints**: Português em toda mensagem de usuário; `/api/v1` para operações externas; autorização final sempre no backend; docs OpenAPI nunca expostas em produção; mutations sem retry automático, mas com repetição explícita segura após resultado ambíguo; exclusão permanente sem estado recuperável; sessão atual preservada e demais sessões revogadas na troca de e-mail; WCAG 2.2 AA e alvos mínimos de 44×44 pt no iOS/48×48 dp no Android; preservar contexto em falhas; evoluir a identidade verde/neutra; usar dados de teste isolados; não sobrescrever o WIP mobile existente

**Scale/Scope**: 19 operações externas agrupadas em 6 domínios; 6 user stories; fluxos primários de autenticação, perfil, turmas e comunicados; duas novas entidades operacionais sem conteúdo de produto recuperável; dois workflows de componente mais gate de commits; sem novos papéis, ownership transfer, exclusão de conta ou redesign de senha

## Constitution Check

### Pre-design gate

| Principle/gate | Status | Design response |
|---|---|---|
| I. Domain-Modular Architecture | PASS | Preserva `Controller → DTO → Service → PrismaService` e `app → components/hooks/providers/services/validations/types/config/storage/theme`; refactors ficam limitados aos domínios tocados. |
| II. Secure, Explicit API Contracts | PASS | Mantém `/api/v1`, whitelist estrito, Zod no mobile, JWT/roles/ownership no servidor e adiciona contratos OpenAPI completos com testes estruturais. |
| III. Testable Delivery | PASS | Exige unitários, integração/e2e para boundaries, testes comportamentais mobile e todos os gates da constituição. |
| IV. Data Integrity and Safe Evolution | PASS | Preserva FKs `ON DELETE CASCADE` e adiciona migration revisada para sessões por dispositivo e recibos mínimos de exclusão, com transformação dos refresh tokens existentes e testes de rollback/cascata. Também verifica a migration histórica de `ownerId` antes da entrega. |
| V. Predictable and Accessible UX | PASS | Define estados explícitos, confirmação reutilizável, conteúdo em português, semântica acessível e tokens/componentes compartilhados. |
| Workflow and quality gates | PASS | Mantém Spec Kit, registra contratos e testes, usa Conventional Commits e exige tanto os gates versionáveis quanto rulesets/branch protection ativos; sem evidência do enforcement externo, a feature permanece incompleta. |

As falhas observadas no baseline — rota `GET /api` não versionada, profile DTO aceitando senha, refresh token único sem revogação imediata de access tokens por sessão, DELETE repetido retornando `404`, owner capaz de sair da turma, ausência de comportamento mobile automatizado e e2e fora do CI — são itens de remediação desta feature, não exceções ao desenho.

### Post-design re-check

PASS. [data-model.md](./data-model.md) mantém invariantes no Prisma, limita persistência nova a sessões e recibos operacionais e define a evolução segura; [contracts/openapi.json](./contracts/openapi.json) torna boundaries, autorização e retry de DELETE explícitos; [contracts/mobile-interactions.md](./contracts/mobile-interactions.md) preserva as camadas e cobre sessão, repetição e estados acessíveis por plataforma; [contracts/quality-gates.md](./contracts/quality-gates.md) mapeia testes e bloqueios internos/externos. Não há violação constitucional planejada nem esclarecimento técnico restante.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-quality-readiness/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.json
│   ├── mobile-interactions.md
│   └── quality-gates.md
└── tasks.md                    # gerado posteriormente por $speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma           # ownership/cascatas + AuthSession + deletion receipt
│   └── migrations/
├── src/
│   ├── auth/                   # JWT com sid, sessões revogáveis e DTOs/responses
│   ├── users/                  # update de perfil self-service e normalização
│   ├── classrooms/             # ownership, leave guard e deleção segura
│   ├── announcements/          # contratos e metadados OpenAPI
│   ├── invites-code/           # contrato admin documentado
│   ├── common/                 # DTO de erro e tipos compartilhados
│   ├── openapi/                # configuração Swagger fora de produção
│   ├── prisma/                 # acesso PostgreSQL
│   ├── configure-app.ts        # prefixo, pipes, CORS e docs compartilhados
│   └── main.ts
├── test/
│   ├── helpers/                # bootstrap e dados de teste compartilhados
│   ├── openapi.contract.spec.ts
│   ├── *.integration.spec.ts
│   └── *.e2e-spec.ts
└── package.json

mobile/
├── app/
│   ├── (auth)/
│   └── (app)/
│       ├── (tabs)/             # perfil e listagem de turmas
│       ├── profile/edit.tsx
│       ├── classrooms/[id].tsx
│       └── announcements/[id]/edit.tsx
├── src/
│   ├── components/             # Button, FormField, ScreenState, ConfirmationDialog
│   ├── config/                 # query client sem retry de mutation
│   ├── hooks/                  # queries/mutations e query-key factories
│   ├── lib/                    # Axios e expiração de sessão
│   ├── providers/              # sincronização do AuthContext
│   ├── services/               # contratos HTTP por domínio
│   ├── storage/                # tokens no Secure Store
│   ├── theme/                  # fundação visual global
│   ├── types/                  # contratos TypeScript
│   └── validations/            # schemas Zod
├── tests/                      # schemas, componentes, hooks e rotas
├── docs/visual-foundation.md
├── jest.config.js
└── package.json

.github/workflows/
├── backend-ci.yml
├── mobile-ci.yml
└── commit-conventions.yml

package.json                    # tooling Commitlint do repositório
package-lock.json
commitlint.config.mjs
```

**Structure Decision**: Manter os dois projetos existentes e fortalecer suas fronteiras internas. O backend continua modular por domínio, com configuração de transporte reutilizada por runtime e testes. O mobile continua orientado por Expo Router, deixando HTTP em services, cache/mutations em hooks, sessão em provider e apresentação em telas/componentes. O pacote raiz contém somente tooling transversal de Conventional Commits.

## Implementation Strategy

### 1. Normalizar bootstrap e contratos do backend

- Extrair a configuração comum do Nest para que runtime, integração, e2e e geração OpenAPI compartilhem prefixo, versionamento, `ValidationPipe` e CORS.
- Substituir `GET /api` por `GET /api/v1/health` e criar DTOs de request/response/erro como classes documentáveis.
- Publicar Swagger UI em `/api/v1/docs` e JSON em `/api/v1/docs/openapi.json` somente em development/test; produção permanece sempre desabilitada.
- Documentar as 19 operações com tags, purpose, auth, papéis/ownership/autoria, schemas e respostas relevantes; validar inventário e metadados por teste, sem snapshot integral frágil.

### 2. Endurecer regras existentes de perfil e turma

- Criar `AuthSession`, migrar o refresh legado e incluir `sid` obrigatório em access/refresh JWT; login/register criam sessões por dispositivo, refresh gira somente a sessão correspondente e o guard valida sessão ativa junto ao usuário atual.
- Restringir `PATCH /users/profile` a `name?` e `email?`, exigir ao menos uma alteração efetiva, normalizar nome/email e rejeitar senha, papel e campos desconhecidos. Uma troca efetiva de e-mail atualiza o usuário e revoga todas as `AuthSession` exceto o `sid` atual na mesma transação; name-only e no-op não revogam sessões.
- Expor `ownerId` em resumos de turma e usar a relação `owner`, não o primeiro professor membro, como fonte da autoria da turma.
- Impedir o owner de sair da própria turma e tornar `DELETE /classrooms/:id` permanentemente destrutivo e repetível: registrar `ClassroomDeletionReceipt` mínimo e apagar a turma/cascatas na mesma transação; o mesmo owner recebe `204` na repetição, enquanto non-owner existente recebe `403` e ausência sem recibo correspondente recebe `404`.

### 3. Criar a fundação de interação mobile

- Evoluir `AUTH_THEME` para tema global sem introduzir UI framework; documentar tokens, contraste WCAG 2.2 AA, tipografia, spacing, radius, elevation, ícones, touch targets mínimos de 44×44 pt no iOS/48×48 dp no Android e estados.
- Criar `Button`, `FormField`, `ScreenState` e `ConfirmationDialog` nativo com API acessível e testável; remover `Pressable` aninhado onde houver ação de card.
- Centralizar query keys, erros HTTP em português e mutations por hooks; remover retry automático e usar single-flight síncrono mais `isPending` para impedir double-submit.
- Fazer mudanças incrementais e preservar o editor de comunicado local em `announcements/[id]/edit.tsx`; a rota duplicada obsoleta só será removida depois de consolidar o WIP correto.

### 4. Entregar os fluxos P1 e estados P2

- Adicionar edição de perfil com React Hook Form/Zod, diff antes da confirmação, erro de e-mail `409` no campo e sincronização imediata do `AuthContext` e caches dependentes; inventariar e testar explicitamente a tela de perfil e a saudação da home como displays diretos da identidade, incluindo qualquer consumidor adicional descoberto. Um `401` de outra sessão limpa Secure Store, cache e contexto antes de redirecionar ao login.
- Mostrar exclusão apenas ao owner, confirmar nome/cascata, invalidar caches e substituir a rota após qualquer `204`, inclusive a repetição explícita depois de resposta perdida; confirmar também a saída de membro non-owner. Hooks cuidam de mutation/cache e a tela/controller cuida de confirmação e navegação.
- Migrar update/delete de comunicado para o mesmo diálogo, mantendo contexto e formulário em falha/cancelamento.
- Tornar loading, empty, error, success e not-found explícitos e acessíveis nos fluxos alvo.

### 5. Fechar testes, documentação e gates

- Expandir unitários, integração e e2e do backend para cobrir atualização self-service equivalente por `PARENT`, `PROFESSOR` e `ADMIN`, duas sessões simultâneas, revogação seletiva no próximo access/refresh, migração legada, autorização, receipt/retry/concorrência da exclusão, cascata, normalização e completude OpenAPI.
- Adicionar Jest Expo/RNTL para comportamento mobile crítico e bundle export; deixar E2E em dispositivo como evolução futura, pois RNTL cobre os critérios automatizáveis desta feature sem depender de conta EAS.
- Travar Expo Doctor, adicionar typecheck/Prisma validate/e2e e validação de Conventional Commits nos workflows.
- Executar os workflows para materializar seus nomes estáveis; em alteração descartável, comprovar falhas de formatação, correção estática, build/export, comportamento/contrato, saúde de ambiente/dependências e convenção de commit; ativar rulesets/branch protection de `develop` e `main`; e comprovar com uma PR falha que o merge é bloqueado. Um desenvolvedor que não participou da implementação deve concluir o exercício OpenAPI de leitura e mutation protegida em até 15 minutos. Aprovação visual, auditoria de acessibilidade e sessões de usabilidade também geram evidência; qualquer gate obrigatório ausente mantém a feature incompleta.

## Conventional Commit Delivery

Usar commits pequenos no formato `type(scope): description`, sem misturar domínios. Sequência recomendada:

1. `refactor(api): share application bootstrap`
2. `feat(auth): add revocable device sessions`
3. `fix(classrooms): make owner deletion idempotent`
4. `fix(users): restrict profile update contract`
5. `feat(api): add non-production OpenAPI reference`
6. `refactor(mobile): establish shared ui foundation`
7. `feat(mobile): add confirmed profile updates`
8. `feat(mobile): add owner classroom deletion`
9. `fix(mobile): unify confirmed announcement mutations`
10. `test: cover critical quality readiness flows`
11. `ci: add repository quality gates`

Depois dos commits, uma ação administrativa separada MUST ativar os três checks estáveis em `develop` e `main` e anexar evidência de bloqueio; isso não pode ser cumprido apenas por commit.

## Delivery Risks

- **Migration histórica de ownership**: `20260807202044_add_classroom_owner` adiciona `ownerId NOT NULL` sem backfill. Não reescrever migration aplicada; auditar ambientes que ainda não a executaram e criar plano de transformação/recuperação antes do deploy se houver dados.
- **Migração de sessões**: criar `AuthSession` a partir de `refreshTokenId`/`refreshTokenHash` antes de remover as colunas legadas. Access tokens antigos sem `sid` devem receber `401`, usar o refresh migrado para obter tokens novos e, se isso falhar, seguir para login sem manter contexto autenticado falso.
- **Recibo de exclusão**: manter somente `classroomId`, `ownerId` e `deletedAt`, sem nome, membros ou comunicados; garantir transação/rollback. O tombstone permanece para sustentar o contrato de retry e não cria capacidade de restauração.
- **WIP mobile concorrente**: preservar mudanças não commitadas do editor de comunicado e consolidar apenas arquivos tocados deliberadamente.
- **Enforcement externo**: workflow verde não bloqueia merge sozinho; required checks em `main`/`develop` dependem de ruleset/branch protection com permissão administrativa, e a feature permanece incompleta até a configuração e a prova bloqueante existirem.
- **Critérios humanos**: contraste/touch target podem ser auditados, mas SC-002/003/006/007/008, incluindo o exercício OpenAPI cronometrado com novo desenvolvedor, e aprovação da direção visual exigem evidência manual do product owner/testes de uso.

## Phase 10 scope rebaseline

Em 2026-09-09, o responsável pelo produto autorizou uma entrega inicial focada
em Android, com um único desenvolvedor responsável pela validação. Portanto,
T073 usa os gates automatizados, a auditoria disponível e o walkthrough Android;
iOS fica como follow-up explícito. T074 registra os testes automatizados e o
walkthrough individual como evidência funcional, mas mantém SC-002, SC-003 e
SC-008 como `NOT MEASURED` porque não há amostra independente. Essa decisão
reduz o escopo de lançamento sem reescrever os critérios originais nem declarar
conformidade cross-platform ou estatística que não foi observada.
