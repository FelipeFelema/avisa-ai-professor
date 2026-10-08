# T008 / sessões backend

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/auth.integration.spec.ts` | 2026-10-07T22:56:31.272Z | 2026-10-07T22:56:50.584Z | 1 |
| `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/auth.integration.spec.ts test/release-fixture.integration.spec.ts test/openapi.contract.spec.ts` | 2026-10-07T23:08:36.738Z | 2026-10-07T23:09:03.151Z | 1 |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/auth/guards/rate-limit.guard.spec.ts src/auth/auth-session.service.spec.ts src/auth/auth.service.spec.ts` | 2026-10-07T23:04:04.953Z | 2026-10-07T23:04:07.227Z | 0 |

Baseline: 25 testes, 23 PASS / 2 FAIL. Logout: POST /auth/logout inexistente (404); access preservado ainda retorna 200 no perfil. Algoritmo alternativo HS384 assinado com secret de teste válido também foi aceito. Este segundo caso não demonstra exploração sem secret; pin HS256 é hardening preventivo, não vulnerabilidade alegada.

Histórico anterior à remediação aprovada: após pin, checkpoint combinado 41 testes, 40 PASS / 1 FAIL; somente teste de logout continuava falhando. AuthSession: sub+sid conjunto, active/revoked/expiresAt, assinatura secret errada/none, TTL access 900s e refresh 604800s, senha scrypt e refresh bcrypt(SHA256), jti aleatório, CAS de refresh (duas chamadas: um 200, um 401), replay da rotação negado. Revogação por senha/perfil/exclusão mantém testes existentes executados. Sem reutilização de sid revogado demonstrada nesses caminhos; naquela revisão, logout local não revogava sid.

## Reteste após aprovação do logout

| Componente | Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- | --- |
| backend | `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/auth.integration.spec.ts test/openapi.contract.spec.ts test/release-fixture.integration.spec.ts` | 2026-10-08T00:04:40.133Z | 2026-10-08T00:05:00.241Z | 0 |
| backend | `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts test/push.e2e-spec.ts test/announcement-push.e2e-spec.ts` | 2026-10-08T00:05:00.300Z | 2026-10-08T00:05:15.376Z | 0 |
| backend | `npm run test:cov` | 2026-10-07T23:59:12.181Z | 2026-10-07T23:59:31.552Z | 0 |

Auth/contrato/destination guard: 3 suítes, 45/45 PASS, encerramento natural sem skip/forceExit. Auth inclui revogação do sid atual, replay access/refresh 401, outro sid do mesmo usuário/conta B intactos, repetição 204, capability estável após refresh, corrida sem reviver sessão, expired/removed 204, query de vítima ignorada, body sid foreign/capability alterada 401, campos extras 400 e capability não aceita como bearer. Real logout rate limit 429 e zero revogação com capability inválida cobertos em E2E. Unit coverage completo: 32 suítes/397 PASS, thresholds preservados.

**SEC-001 MITIGADO — RESOLVED. T010/T018 concluídas após reteste.** [Decisão/contrato/recovery](logout-remediation-decision.md).
