# T014 / ADMIN e convites

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/release-authorization.integration.spec.ts test/users.integration.spec.ts test/password-change.integration.spec.ts test/account-deletion.integration.spec.ts test/classrooms.integration.spec.ts test/announcements.integration.spec.ts test/invite-codes.integration.spec.ts` | 2026-10-07T23:04:39.500Z | 2026-10-07T23:06:16.852Z | 0 |

Convites existentes integration/E2E: ADMIN atual revalidado sob transação, demotion/revogação após guard não escrevem; consumo único, histórico ADMIN/PARENT não autoriza cadastro privilegiado. Nova matriz: claims ADMIN assinados com identidade PARENT não passam role guard; demotion 403; sid revoked 401; cadastro público com role ADMIN 400 e zero conta criada; invite count inalterado. Fixture ADMIN exclusiva no test DB. Nenhum bypass de role confirmado.
