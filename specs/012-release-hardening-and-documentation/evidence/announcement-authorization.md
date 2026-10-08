# T013 / comunicados

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/release-authorization.integration.spec.ts test/users.integration.spec.ts test/password-change.integration.spec.ts test/account-deletion.integration.spec.ts test/classrooms.integration.spec.ts test/announcements.integration.spec.ts test/invite-codes.integration.spec.ts` | 2026-10-07T23:04:39.500Z | 2026-10-07T23:06:16.852Z | 0 |

PARENT/PROFESSOR/ADMIN externos: lista geral exclui announcement vítima; lista por classroomId externo 200 []; detail IDs vítima/ausente/inválido 404; escrita sem professor 403, professor não autor 404. Professor A não cria em turma B sem membership (403); authorId adulterado rejeitado 400. Membership de leitura não transfere autoria: após join, GET permitido, PATCH/DELETE continuam 404. Snapshots antes/depois: zero efeito na vítima. Limites/durações/expiração de suites existentes preservados. Nenhum cross-classroom de conteúdo completo ou autoria indevida confirmado.
