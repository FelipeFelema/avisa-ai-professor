# T015 / inputs e abuso

Executor: Codex; automação local; contas/secrets sintéticos; PostgreSQL loopback **avisa_ai_test** quando aplicável; push externo desabilitado. Revisão base `832626de96c9ad5ef7446d8aba4f759113d1385a` + worktree descrito em [manifest](worktree-sha256.json). Instantes ISO UTC abaixo; data/fuso de apresentação: 2026-10-07, America/Sao_Paulo. Logs privados ignorados em logs/spec012/.

| Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- |
| `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts test/invite-codes.e2e-spec.ts test/classrooms.e2e-spec.ts test/account-deletion.e2e-spec.ts` | 2026-10-07T23:00:26.351Z | 2026-10-07T23:00:56.787Z | 1 |
| `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts` | 2026-10-07T23:02:09.868Z | 2026-10-07T23:02:31.710Z | 0 |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/auth/guards/rate-limit.guard.spec.ts` | 2026-10-07T23:01:28.680Z | 2026-10-07T23:01:30.010Z | 1 |
| `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/auth/guards/rate-limit.guard.spec.ts src/auth/auth-session.service.spec.ts src/auth/auth.service.spec.ts` | 2026-10-07T23:04:04.953Z | 2026-10-07T23:04:07.227Z | 0 |

Body/query extras e limites: auth register/login/senha, invites, classroom name 81, announcement title 121/UUID/duration, push reserve; search repetido/object/81/ownerId rejeitados. 100KB general / 2KB push dão 413. X-Forwarded-For adulterado não muda orçamento com trust proxy desabilitado no configureApp real; 11ª tentativa login 429. Suites com trust proxy=true fazem isso apenas para isolar IPs sintéticos; não são prova de proxy production.

RateLimitGuard: reprodução com 1000 IPs, avanço 60s e novo IP reteve 1001 buckets. SEC-003 corrigido: expurgo periódico no tráfego e cap 10000 IPs ativos por instância/guard, novos IPs recebem 429 no teto; 10/min/IP permanece. Reteste testa expurgo, teto fail-closed, recuperação e orçamento existente de push. Sem timers/handles novos.

Limitações reais: estado em memória, budget por instância/guard, reinício o perde; não há limiter distribuído nem validação da cadeia proxy/hosting neste bloco. Configuração deploy é T037; não declarar garantia contra origem distribuída nem fabricar exploração na infra não observada. IPs não são persistidos/logados pelo guard; retenção agora limitada ao conjunto ativo até o próximo sweep/cap.


Reteste logout aprovado: | Componente | Comando | Início UTC | Fim UTC | Exit |
| --- | --- | --- | --- | --- |
| backend | `node node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand --runTestsByPath test/release-input-security.e2e-spec.ts test/release-error-privacy.e2e-spec.ts test/push.e2e-spec.ts test/announcement-push.e2e-spec.ts` | 2026-10-08T00:05:00.300Z | 2026-10-08T00:05:15.376Z | 0 |
POST /auth/logout com capability inválida não revoga sid; 11ª tentativa 429 no guard real, spoof X-Forwarded-For não evita o limite.
