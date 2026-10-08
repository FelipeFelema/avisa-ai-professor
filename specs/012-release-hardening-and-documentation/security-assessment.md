# Security assessment — checkpoints Fases 1–6

**Status**: Fases 1–3 aprovadas/concluídas. Fases 4–6: 29/31 tasks, 47/70 da spec; Fases 4/5 completas no escopo local, Fase 6 parcial. Export JS Android auditado, SEC-012 corrigido e decoder confirmado. `PRODUCTION_API_URL = PENDING`. T041/T043 abertas; release real não liberada. Fases 7–9 NOT RUN.

## Protocolo e matriz

Preencher por método/rota a partir de controllers e contratos: operação, identidade/papel/sessão, owner/author/membership, ID próprio/de vítima/inexistente/inválido, body/query extras, status esperado, zero efeito na vítima, teste, evidência/exit/revisão. Mínimo duas contas/turmas e sessões/instalações separadas; fixtures de ADMIN somente no test DB.

| Domínio              | Cenários obrigatórios                                                             | Tasks     | Estado                                                               |
| -------------------- | --------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| Sessões              | login/refresh/logout/sid/expiração/revogação/replay/callback antigo/troca conta   | T008–T010 | PASS após revogação por sid/recovery e reteste T010                  |
| Authorization        | perfil/senha/exclusão/turmas/ownership/anúncios/invites/admin/push/announcementId | T011–T014 | PASS automatizado nos cenários documentados                          |
| Inputs/abuso         | DTOs/extras/IDs/body/query/limites/IP/proxy/rate limit/erros                      | T015–T017 | PASS após remediações compatíveis                                    |
| Push                 | destinatário/lifecycle/privacidade/capability/UNKNOWN/restart/concurrency         | T019–T025 | PASS local; provider metadata read-only PASS com limites             |
| Dependencies/secrets | audit/runtime/bundle/segredos/history/logs                                        | T026–T035 | Audits/scans/export JS Android PASS; endpoint real pendente          |
| Production           | config/startup/health/docs/CORS/HTTPS/EAS/FCM/flags                               | T037–T043 | Config/source/negativos PASS; ambiente/API/candidato real pendentes  |
| Dados                | migrations/cascades/órfãos/upgrade/recovery                                       | T044–T048 | PASS isolado; rollback de configuração/mesma revisão; nenhum DB real |
| Consentimento        | onboarding/conta-dispositivo/relogin/legado/offline                               | T059–T065 | NOT RUN                                                              |

## Registro por finding

Campos obrigatórios: ID/domínio; observação e hipótese; prova sanitizada/revisão/ambiente; cenário/vetor/pré-condições/impacto; classificação e justificativa; correção/mitigação e alternativa; task; decisão do proprietário quando pertinente; responsável/prazo; reteste; estado OPEN/RESOLVED/ACCEPTED.

Classificações finais: BLOCKER DE RELEASE; REMEDIAR AGORA; MITIGADO / NÃO EXPLORÁVEL NO RUNTIME ATUAL; DEV/TOOLING ONLY; RISCO ACEITO TEMPORARIAMENTE. Sem aceite implícito por task marcada. Não replicar valores reais de secrets na evidência.

## Decisões significativas

Antes de código: registrar finding, alcance, opções compatíveis, impacto contratual/schema/SDK, testes, recovery e recomendação; apresentar ao proprietário. Se aprovação necessária ainda não chegou, manter só o caminho dependente sem executar. Se nenhuma correção é necessária, registrar revisão/cobertura em vez de produzir mudança artificial.

## Secrets

Inspeção futura inclui .env privado por mecanismo seguro sem imprimir valores, exemplos, histórico/refs disponíveis, worktree, workflows, docs, fixtures, logs e export/bundle. Evidência registra caminho/commit/tipo/redaction, não valor/trecho contendo segredo. Exposição real: conter, revogar/rotacionar com autorização pertinente, verificar derivados/logs/artefatos e retestar; remover arquivo do HEAD sozinho não fecha finding. Não reescrever história Git automaticamente.

## Autorização e checkpoint de preparação (T001–T003)

Spec aprovada pelo proprietário em 2026-10-07 para executar exclusivamente Fases 1–3 (T001–T018), na ordem/dependências definidas. Sem produção, audit fix, majors, dependências, novas features ou Git/publicação. Constitution 2.1.0 / Validation Scope for This Individual Project e AGENTS relidos. Requirements checklist: 16/16; security-release: 0/20, gate final aberto e não alterado. Aprovação explícita de execução parcial prevalece sobre status de planejamento e checklist final. Baseline e envelope em arquivos relacionados; WIP preservado.

## Matriz de autoridade por método/rota (T004)

Base /api/v1. Cada rota privada recebe cenário anônimo/role insuficiente/sid foreign-revoked-expired. IDs: próprio e vítima válida das duas turmas; inexistente UUID; inválido literal. ID é dado, nunca credencial. Matriz explícita de zero efeito confronta snapshots de usuário/turma/comunicado/membership. Discovery e join aberto são comportamento aprovado, não bypass de membership. Contratos atuais usam IDs string; não presumir 400 UUID onde não há ParseUUIDPipe.

| Método/rota                                              | Autoridade                                                             | Status/zero efeito esperado                                            | Prova planejada                          |
| -------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| GET health                                               | público; sem dados privados                                            | 200                                                                    | health E2E                               |
| POST auth/login, auth/register                           | público; senha/hash; ADMIN proibido, professor por convite             | 400/401/429, zero conta/admin indevido                                 | auth/invites E2E                         |
| POST auth/refresh                                        | JWT refresh assinado, sid do sub ativo, hash atual; rotação CAS        | 401 replay/foreign/expired/revoked; 429                                | auth integration                         |
| GET auth/session-revocation                              | JWT/sid ativo; capability somente do sid autenticado                   | 200 mínimo/no-store; 401 anônimo/expired/foreign                       | auth integration/contrato                |
| POST auth/logout                                         | capability opaca exclusiva do sid; sem JWT e sem autoridade de leitura | 204 idempotente/400 extras/401 falsificação/429; zero efeito outro sid | auth integration/input E2E/contrato      |
| POST auth/change-password                                | JWT + sid atual + senha atual; somente própria conta                   | 400 extras/401 sessão/409 corrida/429; vítima intacta                  | password integration                     |
| GET users/profile                                        | sub atual; query não seleciona vítima                                  | 200 próprio/401 sessão, nunca perfil de vítima                         | users integration                        |
| PATCH users/profile                                      | sub/sid, whitelist nome/email; revoga demais sessões se email muda     | 400 id/role/password/401; vítima intacta                               | users integration                        |
| GET users/account-deletion                               | sub/sid; sem query/body                                                | 400 seleção/401; resumo sem IDs                                        | account deletion E2E                     |
| DELETE users/account                                     | sub/sid/senha/frase; sem seleção; último ADMIN protegido               | 400/401/409/429; zero efeito vítima                                    | account deletion integration/E2E         |
| POST classrooms                                          | JWT + role PROFESSOR; owner do sub                                     | 401/403/400; zero turma por papel indevido                             | classrooms integration/E2E               |
| POST classrooms/:id/join                                 | JWT; autoinscrição deliberadamente aberta; sub define novo membro      | 201 próprio, 400 já membro/404 ausente; não selecionar outro user      | classrooms integration                   |
| POST classrooms/:id/leave                                | JWT; próprio membership e não owner                                    | 400 não membro/409 owner; membership vítima intacto                    | classrooms integration                   |
| GET classrooms, classrooms/my                            | JWT; discovery público para autenticados; my só memberships próprios   | 200 lista autorizada/400 search extra/repetido/401                     | classrooms integration                   |
| DELETE classrooms/:id                                    | JWT + PROFESSOR + owner; receipt idempotente próprio                   | 401/403/404; zero efeito turma externa                                 | classrooms integration/E2E               |
| GET announcements, announcements/classrooms/:classroomId | JWT + membership; somente ativos                                       | 200 [] para externo; zero conteúdo privado                             | announcements integration                |
| GET announcements/:id                                    | JWT + membership + ativo                                               | 404 externo/ausente/expirado; zero conteúdo                            | announcements integration                |
| POST announcements                                       | JWT + PROFESSOR + membership; author=sub                               | 401/403/400; zero criação externa/payload extras                       | announcements integration                |
| PATCH announcements/:id                                  | JWT + PROFESSOR + author + membership + ativo                          | 403/404/400; zero mudança em vítima                                    | announcements integration                |
| DELETE announcements/:id                                 | JWT + PROFESSOR + author + membership                                  | 403/404; zero exclusão vítima                                          | announcements integration                |
| POST invite-codes                                        | JWT + ADMIN vigente + sid revalidado na transação                      | 401/403; zero convite após demotion/revogação                          | invites integration/E2E                  |
| POST push/installation/reserve                           | JWT/sid + instalação/ownership/revisão; rate limit                     | 400/401/409/429; zero binding vítima                                   | input E2E neste bloco; lifecycle Phase 4 |
| GET push/installation                                    | JWT/sid + capability + ownership; sem tokens na resposta               | 400/401/404/429; zero leitura vítima                                   | input/privacy E2E; Phase 4               |
| PUT push/installation                                    | JWT/sid + capability + ownership/CAS                                   | 400/401/409/429; zero ativação vítima                                  | input E2E; Phase 4                       |
| POST push/installation/test                              | JWT/sid + capability/binding/ownership + limite                        | 400/401/409/429; destinatário server-side                              | input E2E; Phase 4                       |
| DELETE push/installation                                 | capability/binding/revisão limitado; sem JWT deliberado                | 400/neutralização/429; nunca ativação/leitura                          | input E2E; lifecycle Phase 4             |

## Protocolo confirmado e checkpoint de foundation (T005–T007)

Fixture exige assertSafeTestDatabase e banco exatamente avisa_ai_test antes de criação e cleanup. Duas turmas isoladas, 5 identidades cobrindo todos os papéis, sids e installationIds independentes; contas com hash real e tokens emitidos pelo AuthService. Sem cleanup global da fixture, somente grafo criado. Todos os comandos destrutivos serializados no runner privado; guarda comum existente preservada.

Finding exige reprodução observada (não hipótese), descrição, severidade, superfície, prova/comando/revisão, impacto, classificação BLOCKER DE RELEASE/REMEDIAR AGORA/MITIGADO/RISCO ACEITO, correção/recomendação, reteste e estado. Aceite apenas explícito com proprietário/justificativa/mitigação/prazo/revisão. Correção compatível autorizada pelo pedido; decisão significativa apresentada antes do código, sem upgrade/infra/new feature. T004 matriz e T006 preparação concluídos; helpers serão exercitados nas suítes de assessment. Checkpoint documental libera investigação de US1.

## Findings observados neste bloco

| ID      | Descrição / superfície / impacto                                                                               | Severidade              | Prova e correção                                                                                                                                                                                                         | Classificação atual / estado             |
| ------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| SEC-001 | Logout apenas local permitia replay do sid. auth backend/AuthProvider                                          | Alta                    | [Auth](evidence/auth-sessions.md): original 404/200; após [decisão aprovada](evidence/logout-remediation-decision.md), capability por sid + SecureStore/recovery; access/refresh 401, outro sid preservado, reteste PASS | BLOCKER DE RELEASE → MITIGADO — RESOLVED |
| SEC-002 | Dois 401 renovam simultaneamente; backend recusa perdedor e cliente pode expirar sessão válida. api.ts         | Média (disponibilidade) | [Mobile](evidence/mobile-sessions.md): 2 refreshes; single-flight por generation, um save/expiry, reteste PASS                                                                                                           | REMEDIAR AGORA → MITIGADO — RESOLVED     |
| SEC-003 | Map de IPs retém buckets expirados; consumo de memória cresce com IPs distintos. RateLimitGuard                | Média (disponibilidade) | [Abuso](evidence/input-abuse.md): 1001 após janela; sweep + teto 10000/fail-closed, reteste PASS                                                                                                                         | REMEDIAR AGORA → MITIGADO — RESOLVED     |
| SEC-004 | Exception handler padrão registra erro interno bruto, capaz de carregar SQL/dado privado. Backend request logs | Média                   | [Erros](evidence/error-privacy.md): fault sintético preservado no Logger; filtro fixa código de log, reteste PASS. Nenhum secret real observado                                                                          | REMEDIAR AGORA → MITIGADO — RESOLVED     |
| SEC-005 | Parser JSON fora de push expõe detalhes posição/linha/coluna. General HTTP 400                                 | Baixa                   | [Erros](evidence/error-privacy.md): reprodução em 4 rotas; INVALID_REQUEST 400/413, push inalterado; reteste PASS                                                                                                        | REMEDIAR AGORA → MITIGADO — RESOLVED     |
| SEC-006 | Logout A atrasado apagava usuário/cache de login B. AuthProvider; encerramento local indevido                  | Média (disponibilidade) | [Mobile](evidence/mobile-sessions.md): RED reproduzido; nova geração por login/register, UI/cache condicionados, storage B preservado; reteste PASS                                                                      | REMEDIAR AGORA → MITIGADO — RESOLVED     |

Nenhum risco foi aceito implicitamente. Nenhum cross-account/cross-classroom de conteúdo completo, autoria/ownership ou bypass de role foi confirmado nos cenários testados. Discovery continua expondo summary conforme contrato anterior; não confundir isso com negativa de todo metadado. Pin HS256 é hardening preventivo, sem alegação de exploração por HS384 com secret comprometido.

## Checkpoint histórico Fases 1–3

T001–T018 concluídas: **18/18 do bloco, 18/70 da spec**. SEC-001 aprovado explicitamente pelo proprietário em 2026-10-07, remediado e retestado no checkpoint auth/contrato antes de marcar T010/T018. Todos os seis findings observados estão MITIGADOS/RESOLVED; zero BLOCKER DE RELEASE confirmado aberto neste bloco. [Gates](evidence/phase1-3-gates.md) registram provas atuais e falhas históricas.

É seguro prosseguir para avaliação das Fases 4–6 como próximo bloco, quando autorizado. Naquele checkpoint elas não haviam sido iniciadas. A autorização e execução posteriores estão registradas abaixo. Release final segue NOT EVALUATED; dependencies/secrets/production/provider/recovery/candidato/smoke/CI aguardam as fases próprias. Sem commit/staging/push/PR ou produção.

## Autorização posterior: Fases 4–6

Proprietário aprovou Fases 1–3 e informou SEC-001/SEC-006 corrigidos/retestados, sem blocker aberto; autorizou explicitamente somente Fases 4–6. Patch local significativo SEC-009 autorizado por resposta **Autorizar patch compatível**. Nenhum contrato público, schema/migration, SDK major, infra/custo, credencial externa ou Git foi alterado neste bloco. Constituição/AGENTS/WIP preservados. T024/T046 encerrados sem remediação artificial, por ausência de finding novo push/data.

## Findings novos e correções

| ID      | Observação e risco                                                                                                                             | Evidência/correção/reteste                                                                                                                                              | Estado atual                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SEC-007 | Produção aceitava JWT/config fraca, CORS ausente e flags inconsistentes; falha não era fail-fast adequada                                      | [Backend](evidence/backend-production.md): RED reproduzido, validador obrigatório/erros fixos; config E2E e startup smoke PASS                                          | REMEDIAR AGORA → MITIGADO / CORRIGIDO no código; ambiente real ainda não avaliado                         |
| SEC-008 | Profile/config mobile não estabelecia controles production para HTTPS/cleartext/IDs/secrets públicos/diagnostics                               | [Mobile](evidence/mobile-production.md): profile store/AAB, guards e 26 testes config PASS                                                                              | REMEDIAR AGORA → MITIGADO / CORRIGIDO na config; API/artefato real pendentes                              |
| SEC-009 | Decoder 0.2.2 via Expo Router/query-string permitia DoS de parsing reproduzido com entrada curta                                               | [Decisão](evidence/decode-remediation-decision.md): patch CJS oficial autorizado, npm ci/checker/regressão PASS                                                         | MITIGADO / CORRIGIDO; fonte/parent/factory minificada no export PASS                                      |
| SEC-010 | Advisories atuais com fixes transitivos compatíveis, inclusive shell-quote critical e proxy-addr critical condicional a trust proxy por subnet | [Dependencies](dependency-assessment.md): patches mínimos dentro de ranges e gates PASS; trust proxy false já testado; zero critical atual                              | MITIGADO / CORRIGIDO nesses advisories. Residual tooling continua registrado; nenhuma aceitação implícita |
| SEC-011 | start:prod apontava dist/main inexistente; inicialização podia escapar do tratamento e registrar stack                                         | [Startup](evidence/backend-production.md): wrapper exige production/aponta dist/src/main; import dentro catch e logger inicial desligado; compilação/startup smoke PASS | REMEDIAR AGORA → MITIGADO / CORRIGIDO                                                                     |
| SEC-012 | API LAN antiga apareceu no JS Android apesar de config HTTPS candidata, por cache de transformação                                             | Export sem clear rejeitado pelo gate; reexport --clear e verificação de API/factory PASS; export:ci e checker persistentes                                              | BLOCKER DE RELEASE no primeiro artefato → CORRIGIDO no export aceito                                      |

Foram cinco grupos no checkpoint inicial e SEC-012 observado no export posterior; advisory individual/CVE/versão/cadeia/vetor/fix/classificação aparecem separadamente na [triagem](dependency-assessment.md). Nenhum destinatário indevido, envio duplicado criado pela aplicação, corrupção/orfandade ou vazamento de secret real foi confirmado nos cenários executados. Não extrapolar para exclusão de todos os riscos desconhecidos.

## Checkpoint histórico Fases 4–6 antes da autorização do export

**25/31 tasks do bloco concluídas; 43/70 da spec.** Fase 4 7/7, Fase 5 6/11, Fase 6 12/13. [Gates](evidence/phase4-6-gates.md): backend 397 unit/270 integração/105 E2E PASS; mobile 675 regressão + reteste final dirigido config 26 PASS; Doctor 21/21; clean ci backend isolado/mobile PASS. Audits backend full 23/omit-dev 0 e mobile full 62/omit-dev 58; zero critical, dois advisories raiz residuais backend e cinco mobile (image-size tem dois advisories). Não interpretar quantidade de parents como CVEs ou presença no Android.

Secrets: nenhum valor real conhecido confirmado em fontes/histórico local/logs/backend dist/export histórico; T033 segue aberto para artefato Android atual. Service account/Gitignore protegidos; nenhuma rotação externa necessária por exposição confirmada neste momento. Provider EAS read-only confirma projeto/package/FCM V1/Enhanced Push Security e bearer backend presente, sem comprovar IAM/delivery/candidato.

14 migrations validadas, replay vazio/upgrade pré-010/cascades PASS; sem migration 012 necessária. Restore real isolado preservou grafo e tombstones; redeploy/rollback de configuração da mesma revisão health/docs/flags PASS. [Runbook](../../docs/release-recovery.md) não autoriza operações reais nem fallback para versão pré-hardening.

**Prova ausente:** T028 export Android atual; T029 triagem final Android, T033 artefatos/secrets, T034 condicional e T035 reteste bundle dependentes. Revisão automática rejeitou tentativa de export sob profile production por conflito com proibição de build production; sem bypass. Precisa autorização explícita apenas para export JS local com source maps, sem EAS/APK/AAB/publicação. A autorização do patch não engloba export. API pública HTTPS de produção/ambiente hosting ainda não informados/verificados; fixtures HTTPS sintéticos não os substituem. T043 aguarda US5/T065 e autorização externa, como previsto na DAG.

**Decisão deste checkpoint:** nenhum BLOCKER DE RELEASE explorável confirmado aberto após as correções source; release NÃO liberada e bloco não totalmente fechado pela prova obrigatória ausente. Não declarar seguro fechar Fases 5–6/avançar automaticamente para 7–8 antes de resolver export/config necessários. Nenhuma Fase 7 iniciada. Fases seguintes, build externo, commit/push/PR/smoke/CI permanecem sem execução/autorização.

## Checkpoint atualizado: export autorizado e API pendente — 2026-10-08

O proprietário autorizou somente export JS Android local com source maps, sem EAS/APK/AAB/deploy/Git, e confirmou que a API ainda não está publicada. **PRODUCTION_API_URL = PENDING**. A URL candidata é sintética e nunca é evidência de endpoint real.

[Export e gate](evidence/android-bundle-security.md) PASS: 1.714 módulos; decoder patch presente byte a byte, parent query-string ligado ao módulo corrigido e factory minificada executada em VM com timeout. Seis instâncias npm tooling ausentes, inclusive uuid 7.0.3; Expo uuid interno presente é diferente. Quatro audits atuais mantêm 23/0 backend e 62/58 mobile, zero critical. [Secrets](evidence/secrets-artifacts.md) sem exposição conhecida nem canaries backend no artefato. T034 encerrada pelo ramo sem exposição confirmada; nenhuma rotação externa executada.

**SEC-012 — BLOCKER DE RELEASE no primeiro artefato → CORRIGIDO no export aceito.** Primeiro export cacheado reteve API LAN HTTP mesmo sob config HTTPS candidata; gate negativo EXPORT_API_MISMATCH exit 1. Reexport com --clear materializou URL candidata exata e passou gate exit 0. export:ci agora limpa cache e check:android-export valida compilado/maps/decoder; sem mudanças de negócio/contrato/SDK. Referências localhost de bibliotecas e sourceMappingURL são mantidas e contextualizadas, não confundidas com baseURL da API. Novo candidato sempre exige inspeção própria.

**29/31 tasks do bloco, 47/70 da spec**: T028/T029/T033/T034/T035 fechadas; T041 reaberta por instrução explícita para não fechar configuração production real com URL sintética; T043 preservada aberta. T040/T037 são auditorias de código/config necessária e registro de lacunas, não smoke remotos. T042 comprova somente metadados anteriormente verificados; nenhum EAS API nesta rodada.

### Dependência específica da publicação real da API

| Task Fases 5–6   | Dependência de API real                                                                                          | Estado                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| T041             | Configurar ambiente production mobile com URL HTTPS real e validar configuração final                            | PARCIAL / PENDING; profile e controles locais PASS |
| T043             | Candidato Android production final precisa da API real confirmada; também depende US5/T065 e autorização externa | NOT RUN                                            |
| Fase 5 T026–T036 | Audits/scans/triagem/export candidato podem usar URL sintética; não requerem disponibilidade real da API         | Concluída para escopo local                        |

Nenhuma outra task local de Fases 5–6 foi tratada como prova de hosting/TLS/endpoint/remoto/deploy. T049 consolida o checkpoint com essas lacunas; não dá READY. Fora deste bloco, T057 smoke production depende do endpoint/candidato reais e continua não iniciada.

Nenhum blocker explorável confirmado aberto no export aceito; release ainda bloqueada por API/config/candidato/smoke/CI ausentes. É possível planejar/documentar as próximas fases com lacunas explícitas quando autorizado; não afirmar conclusão production nem iniciar a Fase 7 automaticamente. Sem commit/push/PR/EAS build/APK/AAB/deploy.

## Preparação pré-Render e commits locais — 2026-10-08

Autorização atual inclui correção de proxy/rate limit, gates e commits locais. SEC-013 REMEDIAR AGORA: reprodução de budget compartilhado atrás de proxy; corrigido no código por allowlist explícita TRUST_PROXY_CIDRS, default false, validação e negativos de spoofing/IPv6/cadeia. [Evidência e limites](evidence/render-proxy-readiness.md). Ranges de ingresso reais/smoke continuam pré-condição antes de liberar tráfego regular; não declarar política remota validada. Nenhuma migration/infra/contrato público novo nesta correção.

Gates locais PASS e audits/secrets reexecutados; advisories anteriores permanecem classificados. [Commits](commit-plan.md) incluem o WIP aprovado 012. PRODUCTION_API_URL = PENDING; T041/T043 abertas; 47/70 tasks, 29/31 no bloco 4–6. Sem push/PR/deploy/EAS/APK/AAB/CI remoto. Fases 7–8 não iniciadas; release Android NOT READY.
