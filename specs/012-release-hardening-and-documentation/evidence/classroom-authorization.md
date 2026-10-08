# T012 / turmas

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-integration.json --runInBand --runTestsByPath test/release-authorization.integration.spec.ts test/users.integration.spec.ts test/password-change.integration.spec.ts test/account-deletion.integration.spec.ts test/classrooms.integration.spec.ts test/announcements.integration.spec.ts test/invite-codes.integration.spec.ts` | 2026-10-07T23:04:39.500Z | 2026-10-07T23:06:16.852Z | 0 |

PARENT/ADMIN não criam turma (403); professor A não exclui turma B (403 do contrato vigente); não-membro não sai da turma vítima (400); owner não sai sem excluir (409); join com UUID ausente/literal inválido 404; zero graph mutation na negativa. Teste inicialmente esperava 404 para non-owner; corrigido para 403 após conferir contrato/serviço. Era erro da expectativa, não bypass.

Discovery e join são deliberadamente abertos a contas autenticadas. A listagem de turmas disponíveis inclui teacher/owner e summary do último comunicado (ID/título/datas), conforme contrato anterior; conteúdo completo exige membership. Não afirmar que discovery esconde todos os metadados. E2E correspondente retestado separadamente após filtro. Nenhum bypass de ownership confirmado.
