# Implementation Plan: Release Hardening and Documentation

**Branch**: `012-release-hardening-and-documentation` | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: `/specs/012-release-hardening-and-documentation/spec.md`

**Status**: Fases 1–6 autorizadas; em 2026-10-08 também autorizadas preparação pré-Render, correção de proxy/rate limit e commits locais da Spec 012. Fases 7–8 não iniciadas; push/deploy/build externo aguardam autorização. PRODUCTION_API_URL = PENDING.

## Summary

Uma spec conclui assessment, remediação relevante, produção, integridade/recovery, UX autorizada, regressão, documentação e gate Android. Inventariar/reproduzir riscos antes de corrigir, adicionar negativos e validar checkpoints; reunir evidência da revisão final. Não presumir exploração por configuração ausente ou contagem de audit.

## Technical Context

**Language/Version**: Node.js 22 baseline; backend TypeScript 5.9.3; mobile ~6.0.3 conforme manifests.

**Primary Dependencies**: NestJS 11, Prisma 7.6/PostgreSQL adapter; Expo ~57.0.27, React 19.2.3, React Native 0.86.3, expo-router ~57.0.25, expo-notifications ~57.0.22, SecureStore/AsyncStorage. Resolução exata nos lockfiles.

**Storage**: PostgreSQL 15+; sessões/domínio/ledger push; intenção local v2 por usuário/instalação proposta, sem tabela nova por padrão.

**Testing**: Jest backend unit/coverage/integration/contract/E2E; Jest/Testing Library mobile; Prisma, ESLint/Prettier/typecheck/build; Doctor/export/audit; smoke individual e CI real.

**Target Platform**: Backend production e Android MVP. iOS não bloqueia; CI all-platform existente continua aplicável, sem campanha nativa especializada.

**Project Type**: Monorepo API + Expo mobile.

**Performance Goals**: Preservar limites e resistência a abuso pertinente ao deploy; zero duplicação criada pela aplicação por ocorrência. Sem meta enterprise inventada.

**Constraints**: Constitution 2.1.0/escopo individual; testes destrutivos somente loopback/avisa_ai_test com guardas; sem fix --force, major automático, secrets públicos, nova spec automática, infra enterprise ou Git/publicação nesta etapa.

**Scale/Scope**: auth/users/classrooms/announcements/invites-code/push + config/CI/docs. Matriz mínima 2 contas × 2 turmas × PARENT/PROFESSOR/ADMIN × sessões/instalações distintas.

## Constitution Check

GATE pré-pesquisa e pós-design: **PASS documental**, sem alegar implementação. Nenhum desvio planejado.

| Princípio        | Aplicação                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------- |
| I: modularidade  | Serviços/guards/providers/storage atuais; sem redesign indiscriminado                         |
| II: segurança    | Authz servidor, negativos ID/papel/sessão, DTOs/secrets; revoke capability preservado         |
| III: testes      | Teste pertinente antes de correção, regressão e CI final real                                 |
| IV: dados        | Migration se necessária/revisada; cadeia/upgrade/recovery no banco isolado                    |
| V: UX            | Português, estados/feedback/temas/semântica básica, prompt por ação explícita                 |
| Validation Scope | Walkthrough individual; exclusões permanentes sem checkbox/dependência                        |
| Governança       | Review antes de execução; decisão significativa antes de código; autorização externa separada |

## Project Structure

### Documentation (this feature)

```text
specs/012-release-hardening-and-documentation/
  spec.md; plan.md; tasks.md; research.md; data-model.md; quickstart.md
  baseline-inspection-2026-10-07.md
  security-assessment.md; dependency-assessment.md; release-gate.md
  contracts/release-security-contract.md
  checklists/requirements.md; checklists/security-release.md
```

### Source Code (repository root)

```text
backend/src/{auth,users,classrooms,announcements,invites-code,push,prisma,common}/
backend/src/{main.ts,configure-app.ts,openapi/configure-openapi.ts}
backend/prisma/{schema.prisma,migrations/}
backend/test/{helpers/,fixtures/,*.integration.spec.ts,*e2e-spec.ts}
mobile/src/{providers,services/push,storage,config,lib,components,hooks}/
mobile/app/(app)/{_layout.tsx,profile/notifications.tsx}
mobile/tests/{providers,services,storage,routes,config}/
mobile/{app.config.ts,eas.json,plugins/}
.github/workflows/{backend-ci.yml,mobile-ci.yml,commit-conventions.yml}
README.md; backend/README.md; mobile/README.md
```

**Structure Decision**: Organização existente preservada; novos testes/UX/runbook indicados em tasks. Correções condicionais limitadas aos módulos do finding; nenhum scaffold implementado agora.

## Research e design

[Research](research.md) resolve método, bundle, credenciais, intenção/recovery/gate; [modelo](data-model.md) registra invariantes e formato local candidato; [contrato](contracts/release-security-contract.md) delimita API/lifecycle/production/release; [baseline](baseline-inspection-2026-10-07.md) distingue observado de não executado.

## Estratégia técnica

1. Inventariar método/rota/autoridade/fixture/teste/evidência. Inspeção de secrets inclui histórico/refs locais disponíveis e limites de cobertura remota, com saída redigida.
2. Demonstrar falha específica antes de remediação. Sem achado, registrar cobertura/preservar controle, sem fabricar alteração. Mudança significativa: risco/alternativas/impacto/validação apresentados antes de código.
3. Audit full/omit-dev nos dois componentes; revalidar sete pacotes históricos e novos advisories. Chain e reachability/bundle independem de dev metadata; consultar fix atual antes de patch/override. Retestar após mudanças.
4. Inventariar deploy real sem presumir hosting; validar fail-fast/logs/docs/CORS/proxy/abuso/HTTPS. Perfil production ausente na baseline. Leitura EAS/Firebase sanitizada quando autorizada; alteração externa somente com autorização pertinente.
5. Revisar schema/todas as migrations, base vazia/upgrade representativo/cascades/órfãos. Recovery ensaiado em test DB; sem cleanup/reset em avisa_ai/produção. Sem enfraquecer guardas.
6. UX contextual e intenção v2 com confirmação explícita no relogin, opt-out prioritário, testes de legado/corrupção/offline/contas. Se desenho não for seguro, registrar decisão de preservar ativação manual atual.
7. Regressão, export auditável e artefato production real; smoke ligado à API candidata; README/runbook e checks no SHA final. Ticket/handoff não prova receipt no aparelho.

## Fases e checkpoints

| Fase       | Escopo                    | Checkpoint                                        |
| ---------- | ------------------------- | ------------------------------------------------- |
| 1          | Preparação/autorização    | Spec revisada, baseline/ambientes definidos       |
| 2          | Fundação assessment       | Matriz/registro/segurança de testes               |
| 3 — US1 P1 | Auth/authz/abuso/privacy  | Isolamento/negativos/correções                    |
| 4 — US2 P1 | Push 010/011              | Elegibilidade/lifecycle/privacidade/restart       |
| 5 — US3 P1 | Dependencies/secrets      | Triagem/remediações atuais                        |
| 6 — US4 P1 | Produção/dados/recovery   | Config/migrations/recovery/candidato              |
| 7 — US6 P1 | Documentação/regressão/CI | Preparação independente; validação final após US5 |
| 8 — US5 P2 | UX notificações           | Onboarding/intenção segura/decisão                |
| 9          | Gate transversal          | READY ou BLOCKED com provas finais                |

Ordem nominal agrupa histórias por prioridade. Preparação US6 pode antecipar; sua validação final depende de US5. A DAG de tasks prevalece sobre leitura numérica. Nada executado agora. US1 é primeiro incremento de redução de risco; release exige US2–US6 e gate.

## Gates e evidência

Backend: scripts reais prisma:validate/generate/migrate:deploy no test DB guardado, format:check, lint, typecheck, test:cov/integration/contract/e2e, build e audits full/omit-dev.

Mobile: format:check, lint, typecheck, test:ci, doctor, export:ci e audits; export Android production para análise de módulos. Export não substitui build production nem smoke; build externo condicionado à autorização.

GitHub: Backend CI, Mobile CI, Commit Conventions e required checks reais. Workflows inspecionados não incluem audit; prova de audit é gate separado. Só após autorização commit/push/PR obter runs/jobs com SHA/links. Fechamento documental que muda HEAD também precisa de checks próprios; não citar revisão verde anterior como final.

Registros sanitizados na spec; logs privados em diretório ignorado. Evidência contém comando/cenário, timestamp/fuso, ambiente, SHA/lockfile/artefato, exit/result/link/executor. NOT RUN, PASS, FAIL e PASS (user-reported) são distintos; gate NOT EVALUATED no planejamento.

## Complexity Tracking

Sem desvio constitucional. Não criar fila externa/vault enterprise/auth provider por padrão. Finding significativo exige decisão antes de implementar, sem automaticamente criar outra spec.
