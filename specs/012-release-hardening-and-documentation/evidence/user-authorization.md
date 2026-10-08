# T011 / perfil, senha, exclusão

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/release-authorization.integration.spec.ts test/users.integration.spec.ts test/password-change.integration.spec.ts test/account-deletion.integration.spec.ts test/classrooms.integration.spec.ts test/announcements.integration.spec.ts test/invite-codes.integration.spec.ts` | 2026-10-07T23:04:39.500Z | 2026-10-07T23:06:16.852Z | 0 |

7 suítes/98 testes PASS (conjunto authz). users/password-change/account-deletion existentes + release-authorization. Todas as roles: query userId/id do perfil continua retornando sub próprio; payloads id/role/userId de vítima em PATCH perfil, senha e DELETE conta rejeitados 400; query de seleção na exclusão rejeitada; snapshot completo das identidades/turmas/membership/anúncios intacto. Senha e exclusão existentes cobrem revoked/expired/foreign sid, senha atual, confirmação e rollback/last ADMIN. Nenhum cross-account confirmado.
