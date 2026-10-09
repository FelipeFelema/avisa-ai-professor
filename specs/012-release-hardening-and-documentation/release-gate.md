# Android MVP release gate

**Planning status**: NOT EVALUATED — 2026-10-07. **Execution evidence**: Fases 1–3 PASS; Fase 4 PASS; Fases 4–6 parciais (29/31 tasks; API real pendente); gate final NOT RUN, release não liberada.

Este é um formulário de decisão futura; ainda não há avaliação final READY/BLOCKED. Artefatos não executam nem autorizam implementação, build externo, operação de produção ou Git/publicação.

## Candidato e proveniência

Baseline inspecionada: `832626de96c9ad5ef7446d8aba4f759113d1385a` (merge Spec 011). Candidato 012 ainda não definido. Preencher na execução: revisão final/head/merge de CI, hash de lockfiles, build ID/hash/commit/config production, endpoint público HTTPS e migrations aplicadas. Não registrar secrets nem URLs de banco com credenciais.

Envelope por evidência: ID/task/FR; comando ou cenário; executor; timestamp/fuso; ambiente; revisão/lockfile/artefato aplicáveis; resultado/exit; caminho/link sanitizado; limites. PASS automatizado e PASS (user-reported) distintos. Falha de scanner/rede/check ausente não é PASS. Mudança tardia invalida provas afetadas.

## Matriz de gates obrigatórios

| Gate                                                                       | Fonte/tasks                                    | Estado                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Auth/authz/isolation/abuso/privacy                                         | T018; security-assessment.md                   | PASS — checkpoint local Fases 1–3; candidato final ainda ausente                     |
| Push lifecycle/recipient/occurrence/privacy                                | T025 e T042                                    | PASS local; metadata provider read-only com limites                                  |
| Audits backend/mobile full/omit-dev + runtime/bundle                       | T035/T036, T055/T056; dependency-assessment.md | Quatro audits e inventário export JS Android PASS; nenhum candidato final            |
| Secrets fonte/history/logs/artefato e contenção                            | T032–T036                                      | Nenhuma exposição real conhecida no source/logs/export JS auditado; APK/AAB ausentes |
| Production backend/startup/health/CORS/docs/secrets/flags                  | T037–T039/T055                                 | PASS código/negativos locais; hosting production não verificado                      |
| Production mobile/package/EAS/Firebase/FCM/Enhanced Security               | T040–T043/T056                                 | Profile/negativos/provider metadata PASS; API/config real/candidato pendentes        |
| Migrations/schema/integridade/recovery/rollback/kill switch                | T044–T048                                      | PASS isolado; rollback configuração/mesma revisão, sem produção real                 |
| Onboarding/intenção por conta/dispositivo/decisão segura                   | T059–T065                                      | NOT RUN                                                                              |
| Backend Prisma validate/generate/migrations guardadas                      | T055                                           | NOT RUN                                                                              |
| Backend format/lint/typecheck/unit coverage/integration/contract/E2E/build | T055                                           | NOT RUN                                                                              |
| Mobile format/lint/typecheck/tests/Doctor/export                           | T056                                           | NOT RUN                                                                              |
| Regressão de todos os fluxos/010/011                                       | T054                                           | NOT RUN                                                                              |
| Smoke candidato production Android/API HTTPS, sem teste/debug/URL local    | T057                                           | NOT RUN                                                                              |
| README/guias/runbook do sistema entregue                                   | T047/T050–T053/T066                            | NOT RUN                                                                              |
| Backend CI/Mobile CI/Commit Conventions e required checks reais SHA final  | T058/T069                                      | NOT RUN                                                                              |

Required checks efetivos dependem da configuração GitHub lida na execução; os três workflows são baseline mínima conhecida, não declaração de branch protection verificada. CI 010/011 não fecha nenhum gate 012.

## Política de blockers

Impede READY: cross-account/cross-classroom; bypass de role; secret exposto; sessão revogada utilizável; destinatário push incorreto; vulnerabilidade critical realmente explorável no runtime; migration obrigatória ausente; build production quebrada; API inacessível; fluxo principal quebrado; gate/prova aplicável ausente ou failing. Demais riscos relevantes avaliados por vetor/impacto, sem depender só do rótulo audit.

Não bloqueiam automaticamente: cosmético menor ou finding tooling-only com prova/decisão documentadas. Risco aceito temporariamente exige proprietário/prazo/mitigação/revisão, sem encobrir blocker real. iOS e campanhas especializadas/leitores de tela/auditorias físicas/participantes: **DISPENSADA POR ESCOPO**, sem checkbox/dependência nem falso PASS.

## Decisão futura (T068)

Selecionar e registrar uma única decisão explícita após avaliação:

- `READY FOR ANDROID MVP RELEASE`: todos os gates aplicáveis concluídos, provas finais, zero blocker real aberto e limitações documentadas.
- `BLOCKED`: listar finding ou prova ausente, impacto, tasks/próxima ação e autorização faltante quando pertinente.

Não selecionar READY só para fechar spec. Mesmo READY não autoriza publicação. Se fechamento gerar novo HEAD, reconfirmar checks reais nesse HEAD (T069); não contar CI de revisão anterior como final. A evidência de runs pode ser apresentada em link imutável sem exigir commits de evidência em ciclo infinito, preservando qual SHA foi realmente aprovado.

## Envelope de evidência deste bloco (T003)

Logs privados: logs/spec012/ (ignorado pela regra logs da .gitignore; verificado com git check-ignore). Saída sanitizada em evidence/\*.md: comando/cenário, início/fim ISO UTC, fuso de apresentação America/Sao_Paulo, executor Codex, ambiente local/synthetic, HEAD base + worktree diff/hash, lock SHA256, exit/result e limites. Logs não são anexos públicos e podem conter falhas injetadas. Sem artefato Android neste bloco; mocks não provam production/device/FCM/CI.

Builds externos, credenciais/deploy, commits/staging/push/PR/publicação não executados e permanecem fora da autorização. A autorização deste bloco cobre T001–T018 somente. Gate final permanece NOT EVALUATED; fases seguintes NOT RUN.

## Checkpoint atual de execução

Fases 1–3: **18/18 tasks concluídas**, T010/T018 [X] após auth/contrato retestado. SEC-001 MITIGADO/RESOLVED e zero blocker confirmado aberto neste bloco. [Gates](evidence/phase1-3-gates.md). Fases posteriores não executadas; gate final T068 NOT EVALUATED, candidato/smoke/CI final NOT RUN. Fechamento de segurança deste bloco não declara release pronto.

## Checkpoint histórico Fases 4–6 antes do export autorizado

[Assessment](security-assessment.md), [dependencies](dependency-assessment.md), [gates/proveniência](evidence/phase4-6-gates.md). 25/31 tasks do bloco concluídas; T028/T029/T033/T034/T035 aguardam export Android atual autorizado. T043 aguarda US5 e autorização de build externo. API HTTPS real, hosting/deploy/TLS/variáveis production, smoke Android e CI final ainda ausentes. Nenhum candidato EAS production gerado/obtido/publicado. Secrets/FCM metadata não substituem entrega real. Rejeição automática do export foi respeitada. Nenhuma fase posterior iniciada nem ação Git executada.

## Checkpoint atualizado 2026-10-08

**PRODUCTION_API_URL = PENDING** (API ainda não publicada, confirmação explícita do proprietário). Export JS Android local/source maps autorizado e auditado com URL sintética; [hashes/gate](evidence/android-bundle-security.md). 29/31 tasks do bloco, 47/70 da spec. T041/T043 abertas por configuração/API/candidato reais, T043 também US5/autorização build externo. Nenhuma task real de endpoint fechada por URL candidata. SEC-012 primeiro bundle com API LAN cacheada rejeitado; --clear + inspeção compilada PASS no segundo. Decoder patch confirmado/runtime minificado PASS; seis instâncias npm vulneráveis de tooling ausentes. Secrets/canaries ausentes. Release real permanece NÃO liberada; smoke/CI/UX/candidato futuras não executadas. Nenhuma fase posterior ou ação externa/Git autorizada por este checkpoint.

## Backend preparado para push, publicação ainda não executada — 2026-10-08

Proprietário autorizou correção segura de proxy/rate limit, gates e commits locais. [Gates/evidência](evidence/render-proxy-readiness.md), [agrupamento](commit-plan.md), [configuração Render](../../docs/render-backend-deploy.md). Nenhum push/deploy/PR/EAS/APK/AAB/CI remoto realizado. Ranges de ingresso Render exigem verificação real antes de liberar tráfego regular; default conservador pode agrupar clientes. PRODUCTION_API_URL = PENDING; T041/T043 abertas, fases seguintes não iniciadas, decisão de release Android permanece NOT READY.

## Hardening do build/startup Render — 2026-10-09

[Conclusão e evidências](evidence/render-build-startup-hardening-2026-10-09.md): no SHA implantado 0381690, backend audit 24/0. Handlebars crítico é DEV/TOOLING ONLY, sem caminho de exploração runtime observado; não blocker automático, patch compatível pendente de decisão. Aviso require/verify-full não blocker atual; alteração global isolada incompatível com a política da Prisma CLI e não deve ser aplicada como solução pronta. Prune pós-build ensaiado em cópia isolada, sem modificar pipeline; startup production/query Neon após eventual alteração ainda precisam de prova. Health não comprova banco. T041 permanece aberta, T043 NOT RUN, gates finais/SEC-013/provas privadas existentes preservados.

## Checkpoint das remediações Render — 2026-10-09

[Remediações aplicadas e evidências](evidence/render-hardening-remediation-2026-10-09.md): patch Handlebars aplicado, zero critical e omit-dev 0; normalização runtime/CLI preservada e pipeline prune após build/generate validado em cópia limpa com scripts normais. Startup/health/SELECT 1 por TLS PASS apenas no cluster temporário isolado. Novo SHA/deploy/Neon/CI finais pendentes; release não liberada. T041/T043 e demais dependências permanecem abertas. [Roteiro remoto](../../docs/render-hardening-controlled-deploy.md).
