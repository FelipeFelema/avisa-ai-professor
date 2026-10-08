# T009 / sessões mobile

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/lib/api-session.spec.ts tests/providers/AuthProvider.spec.tsx tests/routes/auth-session-boundary.spec.tsx` | 2026-10-07T22:56:43.343Z | 2026-10-07T22:56:49.669Z | 1 |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/lib/api-session.spec.ts tests/providers/AuthProvider.spec.tsx tests/routes/auth-session-boundary.spec.tsx` | 2026-10-07T23:00:38.078Z | 2026-10-07T23:00:41.494Z | 0 |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/lib/api-session.spec.ts tests/providers/AuthProvider.spec.tsx tests/routes/auth-session-boundary.spec.tsx tests/services/release-error-privacy.spec.ts` | 2026-10-07T23:04:51.773Z | 2026-10-07T23:04:55.811Z | 0 |
| `npm run test:ci` | 2026-10-07T23:06:26.990Z | 2026-10-07T23:07:09.502Z | 0 |

Baseline: 42 testes, 41 PASS / 1 FAIL: dois 401 simultâneos chamam refresh duas vezes. Backend já rejeita o refresh perdedor; essa falha pode expirar a sessão válida. Correção: single-flight por generation, uma gravação de tokens, falha compartilhada expira uma vez; 401 tardio pode repetir com token já rotacionado. Flight antigo não limpa flight de outra geração.

Retestes direcionados: 42/42 e depois 59/59 (inclui privacidade). Nova cobertura troca A→B e nova sessão A, perfil/callback/expiry antigos ignorados; refresh finalizado após invalidation não grava/replay; cache/storage/provider/rotas com suites existentes preservadas. Regressão completa mobile: 88 suítes, 654 testes PASS e thresholds de coverage satisfeitos. Avisos act do harness existentes não foram tratados como observação manual ou falha funcional.

## Logout e troca de conta após remediação

| Componente | Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- | --- |
| mobile | `node node_modules/jest/bin/jest.js --runInBand tests/providers/AuthProvider.spec.tsx --testNamePattern=account B when account A` | 2026-10-08T00:02:27.344Z | 2026-10-08T00:02:30.122Z | 1 |
| mobile | `node node_modules/jest/bin/jest.js --runInBand tests/providers/AuthProvider.spec.tsx tests/lib/api-session.spec.ts tests/services/session-revocation.spec.ts tests/storage/auth.storage.spec.ts` | 2026-10-08T00:02:52.203Z | 2026-10-08T00:02:55.985Z | 0 |
| mobile | `npm run test:ci` | 2026-10-08T00:03:23.866Z | 2026-10-08T00:03:57.765Z | 0 |
| mobile | `npm run doctor` | 2026-10-07T23:59:35.472Z | 2026-10-07T23:59:40.880Z | 0 |

SEC-006 reproduzido em teste isolado (1 FAIL; demais 21 filtrados): logout A atrasado limpava sessão B. Geração por login/register e limpeza condicionada corrigem a corrida; identidade/cache de B e tokens reais no SecureStore mockado permanecem.

Nova suite session-revocation: online envia somente sid/capability e remove ACK; offline guarda JSON mínimo sem access/refresh/password/PII; restart por isolateModules preserva somente disk SecureStore e reconexão drena; mount/HTTP/foreground/timer signed-out; account B conserva metadata/fila separadas; dois drains compartilham request; ACK antigo preserva entrada nova; falha de storage conserva recovery; resposta tardia não fica ligada a nova geração. AuthProvider conclui logout sem aguardar rede e sinaliza falha de storage. api-session confirma callbacks de auth conectados e exclui network errors/logout para evitar loops.

Reteste direcionado: 4 suítes/57 PASS. Mobile completo: **89 suítes/667 PASS**, coverage statements 86.34%, branches 78.51%, functions 90.82%, lines 88.93%; api.ts functions 92.3% (threshold 80 preservado). Doctor 21/21 PASS. A execução intermediária de 663 testes passou assertions mas falhou coverage; callbacks foram cobertos com testes de comportamento e o gate completo foi repetido, sem reduzir thresholds. SEC-001/002/006 MITIGADOS. Revogação no servidor comprovada separadamente no checkpoint backend; sem inferência de dispositivo/FCM/CI.
