# Remediações mínimas Render — 2026-10-09

Execução autorizada pelo proprietário após o [assessment](render-build-startup-hardening-2026-10-09.md). Baseline Live confirmada: `0381690ac13af7f18da20faeb3001071933c97c1`. Candidato validado é **WIP local não commitado**, sobre HEAD `c2d4f0b783ec477e4669b7f23a53613dba7a1d40`; não inventar novo SHA implantado. [Proveniência/saídas sanitizadas](render-hardening-remediation-2026-10-09.json) contém hashes de todas as fontes da cópia validada. Logs e cluster de teste em `logs/spec012/render-remediation-2026-10-09/`, ignorado. Node v22.14.0 / npm 11.10.1 / Windows; PostgreSQL 18 temporário, não é prova Linux/Render/CI.

## Alterações aplicadas

- Lock: apenas `node_modules/handlebars` mudou, 4.7.9 → 4.7.10, resolução/integridade e range minimist declarado pelo pacote. Nenhum outro nó mudou ou foi removido. Parent ts-jest@29.4.6 mantém range ^4.7.8; sem override/dependência direta nova, major ou audit fix --force.
- Runtime: helper `runtimeConnectionString` altera somente valores literais sslmode=require na query da string passada ao PrismaPg. Preserva bytes de credenciais/parâmetros/fragments; não muta environment nem prisma.config.ts e não registra a URL. URLs sem require explícito permanecem intactas.
- Pipeline versionado: `build:prod` = validate → generate → build → prune --omit=dev. Render deve usar `npm ci --include=dev && npm run build:prod`. Ajuste no dashboard é passo do deploy, **não executado** nesta rodada.
- Probe privado `check:prod:database`: PrismaService compilado, somente SELECT 1 AS ok, códigos fixos, catch sem erro bruto, disconnect/finally e timeout 15s. Não adiciona API pública, schema/migration ou flags de push.

Lock SHA-256 final: `30e9e08b9e494d9300c14967d887ce055df5d7876bfe01cc3711d3c09ff4cb88` (mesmo hash na cópia após install/generate/build/prune). Inventory confirma que todas as fontes validadas continuam idênticas às fontes atuais.

## Validação automatizada local

| Check                                                            | Resultado                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| Instalação limpa npm ci --include=dev, lifecycle scripts normais | PASS                                                                  |
| Prisma validate / generate                                       | PASS                                                                  |
| Unitárias completas                                              | PASS — 36 suítes / 466 testes, incluindo 13 novos                     |
| E2E production-config / proxy-rate-limit / proxy-diagnostics     | PASS — 3 suítes / 31 testes                                           |
| Typecheck / lint / format                                        | PASS                                                                  |
| npm run build:prod (validate/generate/build/prune)               | PASS                                                                  |
| CLI migrate deploy + migrate status depois de prune              | PASS — cluster próprio loopback avisa_ai_test; guarda existente ativa |
| SELECT 1 via PrismaService normalizado após prune, com TLS       | PASS                                                                  |
| npm run start:prod após prune / health                           | PASS — HTTP 200 / {status:ok}, NODE_ENV=production                    |
| Warning SSL / canaries de secrets nos logs do ciclo              | Ausentes nos logs verificados; PASS nesse envelope                    |
| Erros privados / modo não production                             | PASS — exit 1, códigos fixos sem canary                               |
| Pacotes físicos após prune                                       | Handlebars/ts-jest ausentes; Prisma CLI presente                      |

Testes de tooling executados antes de prune, pois Jest/ts-jest são removidos. Checks de startup, query, health, CLI e negativos ocorreram após prune. No cluster temporário, TLS foi habilitado com certificado de teste/SAN para localhost/IP e raiz confiada explicitamente; DATABASE_URL de teste foi mantida com require para a CLI. Runtime fez a normalização e conectou com verificação TLS. Credenciais sintéticas permaneceram em memória; não houve cópia de .env nem gravação de URL de banco em arquivo. Cluster temporário encerrado ao fim. Nenhum banco de desenvolvimento/Neon foi modificado.

Guard `assertSafeTestDatabase` validou loopback/avisa_ai_test antes das migrations de teste. Não usar esse ensaio como evidência de conexão real Neon. Ausência dos canaries conhecidos não comprova ausência absoluta de toda espécie de secret; não imprimir ambiente/URLs/erros brutos no rollout.

## Audits finais

| Comando                     | Fim UTC                      | Exit | Moderate | High | Critical | Total |
| --------------------------- | ---------------------------- | ---- | -------- | ---- | -------- | ----- |
| npm audit --json            | 2026-10-09T13:41:05.1510543Z | 1    | 20       | 3    | 0        | 23    |
| npm audit --omit=dev --json | 2026-10-09T13:41:03.8126199Z | 0    | 0        | 0    | 0        | 0     |

Antes da remediação: full 24 (20/3/1), omit-dev 0. Agora: full 23 (20/3/0), omit-dev 0; **nenhum advisory de Handlebars** e nenhum critical. Residual braces/sprintf-js e parents de tooling permanecem com a classificação anterior DEV/TOOLING ONLY; não houve aceite implícito nem major para zerar o audit completo. Audit usa o lock completo mesmo após a remoção física do tooling.

## Próximo deploy e limites

[Procedimento controlado](../../../docs/render-hardening-controlled-deploy.md) inclui SHA final ainda pendente, comandos Build/Start, probe real Neon antes do startup, health, revisão privada de logs e rollback dos comandos antigos. Baseline 0381690 não contém os scripts novos: restaurar também Build/Start ao reconstruí-la. DATABASE_URL production permanece inalterada.

Nenhum commit/staging/push/PR/deploy/dashboard/CI remoto executado. Gates locais não fecham gates finais T055/T058/T069. Sem EAS build ou habilitação de push. **T041 aberta**, SEC-013 coleta/desativação/isolamento pendentes; **T043 NOT RUN**. Retomar SEC-013 somente depois de validar remotamente este candidato, conforme pedido do proprietário.
