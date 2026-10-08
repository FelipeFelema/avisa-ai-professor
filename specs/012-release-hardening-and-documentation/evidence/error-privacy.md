# T016 / privacidade de erros

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts test/invite-codes.e2e-spec.ts test/classrooms.e2e-spec.ts test/account-deletion.e2e-spec.ts` | 2026-10-07T23:00:26.351Z | 2026-10-07T23:00:56.787Z | 1 |
| `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts` | 2026-10-07T23:02:09.868Z | 2026-10-07T23:02:31.710Z | 0 |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/lib/api-session.spec.ts tests/providers/AuthProvider.spec.tsx tests/routes/auth-session-boundary.spec.tsx tests/services/release-error-privacy.spec.ts` | 2026-10-07T23:04:51.773Z | 2026-10-07T23:04:55.811Z | 0 |

SEC-004: falha sintética de persistence em AnnouncementsService com marcador privado foi passada integralmente ao Logger.error pelo exception handler padrão. Resposta já era generic 500; não houve secret real exposto. Filtro global agora mantém HttpExceptions deliberadas e registra somente HTTP_INTERNAL_ERROR para exceções inesperadas, sem exception/cause/body/headers/URL; HTTP generic 500.

SEC-005: JSON malformado fora de push retornou posição/linha/coluna do parser; não foi demonstrado vazamento do valor da senha nessa amostra. Middleware de erro general retorna INVALID_REQUEST para 400/413; push mantém PUSH_INVALID_REQUEST. Negativos nos cinco paths passam; nenhum SQL/stack/parser detail no corpo revisado.

Mobile: getHttpErrorMessage ignora mensagem remota; changePassword remove config/response/cause/password nos status 400/401/409/429/500/503. Novo release-error-privacy com dados sintéticos, PASS 14 testes; cobertura combinada 59 PASS. Não alegar auditoria de secrets de arquivos/bundle/history (Phase 5). Bootstrap/logging startup production permanece T037, fora desta autorização.
