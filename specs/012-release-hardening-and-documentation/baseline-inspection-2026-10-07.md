# Inspeção read-only da baseline

Data: 2026-10-07. Branch: `012-release-hardening-and-documentation`.
HEAD inspecionado: `832626de96c9ad5ef7446d8aba4f759113d1385a`, merge da PR #54 da Spec 011. Worktree inicial limpo. Sem fetch ou verificação remota nesta etapa.

## Limite da evidência

Somente leitura de código, scripts, configurações versionadas, lockfiles e documentos. Não foram executados npm audit, export, build, testes, migrations, scanner de segredos ou acesso a painéis EAS/Firebase/GitHub. Valores de `.env` privado não foram lidos. Testes citados existem; não foram executados nesta sessão. A baseline não é security assessment completo nem decisão de release.

O sandbox falhou ao iniciar (`setup refresh had errors`); leituras via shell externo foram aprovadas pela revisão automática. Isso não é falha dos gates do projeto.

## Observações e investigações

| ID | Evidência local | Observação | Investigação planejada |
| --- | --- | --- | --- |
| B01 | `mobile/eas.json` | Existe somente perfil preview; APK interno com flag de cleartext de preview | Perfil production, HTTPS, Firebase/FCM e artefato final; US4 |
| B02 | `backend/src/openapi/configure-openapi.ts` | Docs habilitadas apenas em development/test | Provar ausência de UI/JSON em production mesmo com flag true; US4 |
| B03 | `backend/src/auth/guards/rate-limit.guard.ts:14` | Map local por IP sem expurgo global; ramo length zero após push inalcançável | Impacto no cenário real, proxy/IP, reinício e múltiplas instâncias; sem infraestrutura distribuída obrigatória; US1 |
| B04 | `backend/src/app.module.ts`, `backend/src/auth/auth.module.ts`, `backend/src/main.ts` | Config global sem schema explícito; JWT usa getOrThrow; bootstrap escreve erro bruto | Ausência/robustez/separação de secrets, sanitização e exit status; nenhum valor real inspecionado; US1/US4 |
| B05 | `backend/src/configure-app.ts:62` | JSON push 2 KB, demais bodies 100 KB; whitelist/rejeição extras; CORS configurável | Endpoints, limites, malformed JSON fora de push, origens e responsabilidade do proxy; US1/US4 |
| B06 | `backend/src/auth/strategies/jwt.strategy.ts:14`, `backend/src/invites-code/invite-code.service.ts:56` | JWT exige sid ativo e role atual; convites revalidam ADMIN/sessão na transação | Matriz negativa e corridas sem presumir bypass; US1 |
| B07 | `backend/src/push/guards/installation-capability.guard.ts:27`, `backend/src/push/push-registration.service.ts:433` | Capability canônica/hash/compare protegido, ownership/sessão/lifecycle/CAS; revoke sem JWT deliberado | Preservar revogação offline; testar abuso/neutralização sem impor JWT a todo DELETE push; US2 |
| B08 | `backend/src/push/announcement-push.service.ts:247`, workers/migrations | Revalidação de destinatário e ledger por ocorrência | Restart, edição de expiração, races e UNKNOWN sem retry cego; US2 |
| B09 | `mobile/src/storage/push.storage.ts:15`, `mobile/src/providers/PushProvider.tsx` | Opt-in local com chave global v1; lifecycle atual reset/revogação | Preferência v2 por conta/instalação, legado sem dono desativado e confirmação para reativar; US5 |
| B10 | `mobile/app.config.ts`, `mobile/src/config/push-config.ts` | Flag diagnóstica development/preview; teste de visibilidade existe | Prova no candidato production; preview não prova ausência; US4 |
| B11 | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Sessões/registrations/dispatches com cascades; UserClassroom/owner/author exigem exclusão explícita | Todas as migrations, órfãos, conta/turma/comunicado/ledger; US4 |
| B12 | `.github/workflows/` | Gates existentes disparam em PR/push develop/main ou dispatch; backend/mobile sem npm audit | Audit separado e required checks reais; CI antiga não prova 012; US6 |

## Versões lidas dos lockfiles atuais

`dev` é metadado npm, não prova de runtime nem de inclusão no bundle.

| Pacote | Backend | Mobile |
| --- | --- | --- |
| shell-quote | Não encontrado | 1.9.0, dev=false |
| decode-uri-component | Não encontrado | 0.2.2, dev=false |
| braces | 3.0.3, dev=true | 3.0.3, dev=false |
| image-size | Não encontrado | 1.2.1, dev=false |
| node-forge | Não encontrado | 1.4.0, dev=false |
| sprintf-js | 1.0.3, dev=true | 1.0.3, dev=false |
| uuid | Não encontrado | 7.0.3, dev=false |

Histórico em `specs/010-push-notification-foundation/final-validation.md:96`: shell-quote era tooling-only, correção relatada em 1.11.0; decode-uri-component estava no export Android. São pistas obrigatórias, não classificações atuais. Advisory/CVE, fix, cadeia e bundle atuais serão confirmados na US3; reavaliar também os outros cinco pacotes e novos advisories.

## Coberturas localizadas

- Sessões: `backend/test/auth.integration.spec.ts`, `backend/src/auth/auth-session.service.spec.ts`, `mobile/tests/routes/auth-session-boundary.spec.tsx`, `mobile/tests/lib/api-session.spec.ts`.
- Autorização: `backend/test/users.integration.spec.ts`, `announcements.integration.spec.ts`, `classrooms.integration.spec.ts`, `invite-codes.integration.spec.ts` e E2E correspondentes.
- Lifecycle/privacidade: `backend/test/push-lifecycle.concurrency.integration.spec.ts`, `push-privacy.integration.spec.ts`, `announcement-push-privacy.integration.spec.ts`, `announcement-push-locks.integration.spec.ts`; `mobile/tests/services/push-consent-lifecycle.spec.ts`, `announcement-push-navigation.spec.ts`.
- Dados: `backend/test/account-deletion.concurrency.integration.spec.ts`, `push-migration.integration.spec.ts`, `announcement-push-migration.integration.spec.ts`, `session-and-receipt-migration.integration.spec.ts`.
- Guardas: `backend/test/helpers/test-database.helper.ts` exige loopback e nome contendo test; a 012 mantém exigência adicional de nome exato `avisa_ai_test`, sem enfraquecer o helper.

## Lacunas de evidência

Audit atual, secrets/histórico completo, exploração/reachability, Enhanced Push Security/FCM V1 externos, recovery, artefato production e CI da revisão 012: **NOT RUN**. Nenhuma vulnerabilidade explorável confirmada por esta inspeção. Lacunas são tarefas futuras, sem declarar READY ou reabrir a 011.

## Baseline de execução — Fases 1–3

Autorização do proprietário em 2026-10-07; branch 012-release-hardening-and-documentation, HEAD 832626de96c9ad5ef7446d8aba4f759113d1385a. WIP inicial: somente specs/012-release-hardening-and-documentation/ não versionado. Node v22.14.0; npm 11.10.1. node_modules presentes nos dois componentes; nenhuma instalação/update/dependency change.

Alvo atual: assessment local Nest/Expo, PostgreSQL loopback/avisa_ai_test. Hosting/API production e painéis externos não verificados neste bloco; ausência de prova não é vulnerabilidade. eas.json contém perfil preview; nenhuma ação EAS/Firebase/produção autorizada aqui. Configuração privada lida somente para selecionar explicitamente o banco isolado com credenciais locais existentes; nenhum valor copiado para evidência. JWTs de testes usam secrets sintéticos distintos; push externo desabilitado. Nunca conectar ao banco dev para fixtures.

Inventário de scripts e lockfiles:


### backend

Lock SHA256: `00dfb2df8637916479644742e00e37e9f695d739f51d24f78c6c033d14a9e399`. Scripts disponíveis:

- `build`: `nest build`
- `format`: `prettier --write "src/**/*.ts" "test/**/*.ts"`
- `format:check`: `prettier --check "src/**/*.ts" "test/**/*.ts"`
- `prisma:validate`: `prisma validate`
- `prisma:generate`: `prisma generate`
- `prisma:migrate:deploy`: `prisma migrate deploy`
- `typecheck`: `tsc --noEmit`
- `start`: `nest start`
- `start:dev`: `nest start --watch`
- `start:debug`: `nest start --debug --watch`
- `start:prod`: `node dist/main`
- `lint`: `eslint "{src,apps,libs,test}/**/*.ts"`
- `lint:fix`: `eslint "{src,apps,libs,test}/**/*.ts" --fix`
- `test`: `jest`
- `test:watch`: `jest --watch`
- `test:cov`: `jest --coverage --runInBand`
- `test:debug`: `node --inspect-brk -r ts-node/register node_modules/.bin/jest --runInBand`
- `test:e2e`: `jest --config ./test/jest-e2e.json --runInBand`
- `test:integration`: `jest --config ./test/jest-integration.json --runInBand`
- `test:contract`: `jest --config ./test/jest-integration.json --runInBand --runTestsByPath test/openapi.contract.spec.ts`

### mobile

Lock SHA256: `dea9718dc1880cdb5610a39c6cea06457c03cc8f98941f2b7ee34f18f3317538`. Scripts disponíveis:

- `start`: `expo start`
- `android`: `expo start --android`
- `ios`: `expo start --ios`
- `web`: `expo start --web`
- `lint`: `expo lint`
- `lint:fix`: `expo lint --fix`
- `format`: `prettier --write .`
- `format:check`: `prettier --check .`
- `typecheck`: `tsc --noEmit`
- `test`: `jest`
- `test:watch`: `jest --watch`
- `test:ci`: `jest --ci --runInBand --coverage`
- `doctor`: `expo-doctor`
- `export:ci`: `expo export --platform all --no-bytecode --output-dir .expo-ci-export`
