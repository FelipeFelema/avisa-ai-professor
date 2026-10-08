# Checklist de evidência e release

**Purpose**: Conferência futura das provas obrigatórias, sem antecipar PASS.
**Created**: 2026-10-07. **Feature**: [spec.md](../spec.md).
**Status**: NOT RUN; itens abertos referem-se à execução autorizada futura. Detalhes no [gate](../release-gate.md).

## Segurança e dependências

- [ ] CHK001 Sessões/replay/revogação/callbacks/troca de conta testados; zero acesso após logout (T008–T010/T018).
- [ ] CHK002 Matriz de autorização server-side de todas as famílias/IDs/papéis/owner/member com zero efeito na vítima (T011–T014/T017).
- [ ] CHK003 Inputs/limites/abuso/proxy e erros/logs sanitizados comprovados (T015–T017).
- [ ] CHK004 Destinatários push/backend-only, inelegíveis e lifecycle 010/011 comprovados (T019/T020/T024/T025).
- [ ] CHK005 Payload mínimo, deep link reautorizado, restart/concurrency/UNKNOWN seguros (T021–T025).
- [ ] CHK006 Quatro audits atuais e todos os advisories relevantes com chain/runtime/bundle/vetor/fix/decisão (T026–T035).
- [ ] CHK007 Sete pacotes históricos reavaliados sem reutilizar classificação antiga; fixes compatíveis retestados (T029–T035).
- [ ] CHK008 Secrets/history/worktree/fixtures/docs/workflows/logs/bundle revisados; exposição tratada com rotação/contenção/prova, sem valores públicos (T032–T035).

## Produção e integridade

- [ ] CHK009 Backend production/startup/health/CORS/rate limiting/secrets/flags e Swagger UI/JSON fechado demonstrados (T037–T039).
- [ ] CHK010 HTTPS/package/EAS/Firebase/FCM V1/Enhanced Push Security e proteção de service account/bearer comprovados (T040–T042).
- [ ] CHK011 Todas as migrations/schema/cascades/órfãos revisados e base vazia/upgrade verificados em avisa_ai_test (T044–T046).
- [ ] CHK012 Runbook e ensaio recovery/restore/kill switch/rollback compatível com ledger preservado (T047/T048).
- [ ] CHK013 Candidato Android production identificado e smoke sem botão teste/debug/URL local ou secret backend (T043/T057).

## UX, regressão, documentação e CI

- [ ] CHK014 Onboarding contextual/Agora não/Perfil e prompt somente por ação explícita demonstrados (T061/T064/T065).
- [ ] CHK015 Intenção por conta/dispositivo segura ou decisão explícita de manter ativação manual; logout/opt-out/legado/offline sem herança/reativação silenciosa (T059–T065).
- [ ] CHK016 Matriz de regressão inteira, inclusive 010/011, executada na revisão candidata com origem exata (T053/T054/T057).
- [ ] CHK017 Todos os gates backend/mobile e audits classificados, sem forceExit ou thresholds relaxados para ocultar falha (T055/T056).
- [ ] CHK018 README/guias/recovery refletem entregue e podem ser repetidos pelo proprietário (T047/T050–T053/T066).
- [ ] CHK019 Backend CI/Mobile CI/Commit Conventions/required checks efetivos com runs/jobs/links/revisão final reais (T058/T069).
- [ ] CHK020 Findings/tasks/contratos/provas reconciliados e decisão READY ou BLOCKED sem pendência obrigatória encoberta (T066–T070).

## Fora do escopo permanente

Campanhas especializadas Android/iOS, TalkBack, VoiceOver, auditorias físicas e participantes independentes: **DISPENSADA POR ESCOPO**. Sem checkbox, sem PASS, sem dependência/transferência. iOS não é blocker do lançamento Android. Sem dispensar semântica básica, gates automatizados, dependencies ou CI.
