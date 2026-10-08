# Gates pertinentes: Fases 4–6

Não são fechamento T054–T058 nem CI final. Resultados automatizados no worktree indicado abaixo, testes destrutivos serializados em avisa_ai_test.

| Componente | Comando                                                                                                   | Fim UTC                  | Exit |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------ | ---- |
| backend    | npm run format:check                                                                                      | 2026-10-08T00:54:07.516Z | 0    |
| backend    | npm run lint                                                                                              | 2026-10-08T00:53:14.103Z | 0    |
| backend    | npm run typecheck                                                                                         | 2026-10-08T00:53:05.066Z | 0    |
| backend    | npm run test:cov                                                                                          | 2026-10-08T00:48:40.084Z | 0    |
| backend    | npm run test:integration                                                                                  | 2026-10-08T00:55:02.669Z | 0    |
| backend    | npm run test:e2e                                                                                          | 2026-10-08T00:56:17.233Z | 0    |
| backend    | npm run build                                                                                             | 2026-10-08T00:52:15.023Z | 0    |
| backend    | npm run prisma:validate                                                                                   | 2026-10-08T00:55:50.012Z | 0    |
| backend    | npm run prisma:generate                                                                                   | 2026-10-08T00:41:51.850Z | 0    |
| backend    | node node_modules/prisma/build/index.js migrate status                                                    | 2026-10-08T00:55:52.039Z | 0    |
| mobile     | npm ci --no-audit                                                                                         | 2026-10-08T00:52:19.875Z | 0    |
| mobile     | node scripts/check-decode-security.cjs                                                                    | 2026-10-08T00:53:29.002Z | 0    |
| mobile     | npm run format:check                                                                                      | 2026-10-08T00:54:11.101Z | 0    |
| mobile     | npm run lint                                                                                              | 2026-10-08T00:53:54.203Z | 0    |
| mobile     | npm run typecheck                                                                                         | 2026-10-08T00:53:38.629Z | 0    |
| mobile     | npm run test:ci                                                                                           | 2026-10-08T00:54:27.101Z | 0    |
| mobile     | npm test -- --runInBand --runTestsByPath tests/config/app-config.spec.ts tests/config/push-config.spec.ts | 2026-10-08T00:58:44.330Z | 0    |
| mobile     | npm run doctor                                                                                            | 2026-10-08T00:54:46.703Z | 0    |
| backend    | npm audit --json                                                                                          | 2026-10-08T00:51:17.786Z | 1    |
| backend    | npm audit --omit=dev --json                                                                               | 2026-10-08T00:51:15.031Z | 0    |
| mobile     | npm audit --json                                                                                          | 2026-10-08T00:51:22.017Z | 1    |
| mobile     | npm audit --omit=dev --json                                                                               | 2026-10-08T00:51:21.993Z | 1    |

Backend clean npm ci isolado: exit 0 em 2026-10-08T00:58:15.705Z com mesmos manifest/lock, sem DB. Instalação no checkout inicialmente EPERM em bcrypt carregado pelo servidor do usuário; não encerramos seu servidor. npm install --ignore-scripts reparou instalação sem alterar o lock adicionalmente; clean ci separado comprova reprodução.

Backend unit coverage: 32 suites/397 testes; statements 72.16%, branches 62.59%, functions 72.16%, lines 72.84%, thresholds PASS. Integração: 28 suites/270; E2E: 10/105. Novo DB+duas migrations+contrato: 4/19. Push focado inicial: 10/82. Mobile: 89 suites/675; configuração final adicionou dois negativos e reteste dirigido 2 suites/26 testes PASS (não somar como testes distintos). Doctor 21/21. Decoder checker separado PASS após clean ci: 17 casos e pathological query-string em child com timeout 1500 ms; 512/2048/16384 repetições ~1.02/1.58/7.01 ms.

Audits exit 1 permanecem por advisories registrados; não rede. Backend omit-dev zero. Mobile full 62/omit-dev 58, zero critical. Contagens parents herdados não CVEs. [Triagem](../dependency-assessment.md).

Falhas históricas: production RED antes do fix; checksum CRLF normalizado depois de primeira falha; fixture de docs production precisou valores válidos/módulo HTTP sem DB; import dinâmico precisou .js no NodeNext; decoder file override relativo precisou referência root `$decode-uri-component`; lint assertion removida; restore inicial corrigido. Dois runners DB foram iniciados em paralelo por engano; integração interrompida e ambas suítes repetidas serialmente PASS, resultados sobrepostos descartados. PG deprecation warning não expõe values; hooks finalizaram naturalmente, sem Jest forceExit.

Export Android atual NOT RUN por revisão automática/autoridade pendente; build externo T043 NOT RUN por restrição expressa e dependência US5. API real/TLS/hosting/CI/smoke não provados. Não houve testes/aplicação sobre produção real.

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.

Reteste final após hardening de IDs/secrets públicos: npm run typecheck exit 0 em 2026-10-08T01:07:36.889Z; npm run lint exit 0 em 2026-10-08T01:07:41.284Z; npm run format:check exit 0 em 2026-10-08T01:07:44.685Z. Nenhuma mudança posterior de fonte.

## Export JS local autorizado — 2026-10-08

`npm audit --json` (backend): exit 1, 2026-10-08T14:24:19.996Z UTC.

`npm audit --omit=dev --json` (backend): exit 0, 2026-10-08T14:24:18.938Z UTC.

`npm audit --json` (mobile): exit 1, 2026-10-08T14:24:25.629Z UTC.

`npm audit --omit=dev --json` (mobile): exit 1, 2026-10-08T14:24:25.606Z UTC.

Export Android/source maps --clear exit 0; gate primeiro bundle exit 1 por API cacheada incorreta; segundo bundle e factory minificada exit 0. Lint/formatação checker PASS. [Método, hashes e limites](android-bundle-security.md). PRODUCTION_API_URL = PENDING; sem EAS/endpoint real/native/deploy/CI final. Mudanças apenas em scripts/gates/ignores, sem novo teste de negócio necessário.

## Revalidação pré-Render — 2026-10-08

[Gates finais e provenance](render-proxy-readiness.md), [resumo sanitizado](render-preparation-summary.json). Inclui correção/negativos TRUST_PROXY_CIDRS, regressão backend/mobile, instalação/build limpos, audits/secrets atualizados e commits locais autorizados. Não substitui CI/hosting/API/candidato/smoke reais nem inicia Fases 7–8.
