# Render: SSL PostgreSQL e dependências de build — 2026-10-09

SHA implantado: `0381690ac13af7f18da20faeb3001071933c97c1`, confirmado pelo proprietário nesta rodada: **PASS (user-reported)**. Audits executados em export isolado de `backend/` desse commit; checkout/index/HEAD e WIP preservados. Node v22.14.0, npm 11.10.1, registry npm consultado. [Dados sanitizados](render-build-startup-hardening-2026-10-09.json); logs originais, scripts de probes e snapshot em `logs/spec012/render-hardening-2026-10-09/` (ignorado).

Lock SHA-256: `0d1853a6e0a4a314eb09dc3f89667159701618ba9f121a3d0b57e2718ae9e97e`. Mesmo hash do assessment anterior; package.json SHA-256 `36c5dddddf14eba90f78f68e940c033af88f8e73a335e4473f0d7c3fc0f08943`. A diferença de advisories não deriva de uma alteração de dependencies nesse deploy.

## Audits e critical

| Comando | Fim UTC | Exit | Moderate | High | Critical | Total |
| --- | --- | --- | --- | --- | --- | --- |
| npm audit --json | 2026-10-09T13:00:56.6647529Z | 1 | 20 | 3 | 1 | 24 |
| npm audit --omit=dev --json | 2026-10-09T13:00:55.3949202Z | 0 | 0 | 0 | 0 | 0 |

Opção JSON apenas torna audit legível por máquina; nenhum fix. Contagens reproduzem o relato do Render. Antes: 23/0 (20 moderate, 3 high, zero critical), reteste em 2026-10-08T14:24Z. Agora: 24/0. Novos advisories de Handlebars foram publicados no GitHub Advisory Database em 2026-10-08. Braces e sprintf-js continuam advisories raiz residuais; não houve reintrodução de shell-quote/proxy-addr corrigidos.

Cadeia obtida de `npm ls handlebars --all --package-lock-only` e lockfile:

`backend devDependencies → ts-jest@29.4.6 → handlebars@4.7.9`.

Handlebars é `dev=true` e ts-jest admite `^4.7.8`. O único pacote contabilizado como critical agrega **dois advisories críticos** e um moderate:

- [GHSA-8r5x-fm3f-whwj / CVE-2026-106446](https://github.com/advisories/GHSA-8r5x-fm3f-whwj): injeção de JS por AST não confiável em compile/precompile, CVSS 9.8.
- [GHSA-p8wg-vrv2-v86f / CVE-2026-106445](https://github.com/advisories/GHSA-p8wg-vrv2-v86f): bypass de own-property; template controlado e allowProtoMethodsByDefault=true permitem execução de JS.
- [GHSA-xw65-4hp5-5hc7 / CVE-2026-106444](https://github.com/advisories/GHSA-xw65-4hp5-5hc7): embedding inline inseguro de templates precompilados, moderate.

Não foi encontrado import/uso de Handlebars em código runtime/scripts do backend desse SHA; ele chega por test tooling. `--omit=dev=0` confirma ausência de advisories no grafo production, mas não significa que `npm ci --include=dev` já removeu ferramentas do disco. **DEV/TOOLING ONLY; não blocker automático de T041/release**, conforme política existente. Não há aceite implícito nem declaração de risco zero para build/test.

Proposta de remediação, **não aplicada**: atualizar somente a resolução transitiva Handlebars de 4.7.9 para 4.7.10, patch oficial disponível no registry e compatível com `^4.7.8`, sem major/override novo. Revisar diff do lock e executar audit completo/omit-dev, ts-jest/Jest e build afetados. Não usar audit fix --force. Histórico de zero critical permanece válido para a consulta anterior; este adendo é o resultado atual.

## SSL: runtime e migrations usam consumidores diferentes

Runtime: `@prisma/client@7.6.0 → @prisma/adapter-pg@7.6.0 → pg@8.20.0 → pg-connection-string@2.12.0`. PrismaService passa DATABASE_URL diretamente ao adapter, sem objeto SSL sobrescrevendo TLS. Parser instalado confirmou, com URL sintética, que require e verify-full produzem a mesma configuração TLS atual; outros parâmetros/credenciais sintéticos foram preservados. [Parser oficial](https://github.com/brianc/node-postgres/blob/master/packages/pg-connection-string/index.js), [Neon recomenda verify-full](https://neon.com/docs/connect/connect-securely).

**A DATABASE_URL compartilhada não deve ser alterada isoladamente para verify-full nesta revisão.** Prisma CLI é 7.10.0 e migrations usam schema-engine nativo. Seu [parser versionado](https://github.com/prisma/prisma-engines/blob/7.10.0/quaint/src/connector/postgres/url.rs#L302) só trata disable/prefer/require; valor não reconhecido mantém prefer. `prisma validate` PASS com verify-full sintético não testa conexão/TLS.

Probe contra servidor fictício exclusivamente loopback, sem banco real: servidor responde N à SSLRequest; `prisma migrate status` usa credentials sintéticas. Resultado esperado de ambos os comandos é exit 1, pois o stub não é um banco funcional:

| Modo da CLI | SSLRequest observada | Startup plaintext após recusa TLS | Resultado |
| --- | --- | --- | --- |
| require | sim | não | Recusou continuar sem TLS |
| verify-full | sim | sim | Confirmado fallback para prefer |

Não houve contato com Neon, leitura de URL real, mudança de ambiente ou migrations reais. Neon exige TLS, mas isso não torna o parser da CLI equivalente a verify-full nem permite usar health como prova de autenticação TLS.

**Proposta mínima, não aplicada:** manter DATABASE_URL atual para a CLI; em PrismaService, normalizar apenas o parâmetro `sslmode=require` para `sslmode=verify-full` na string entregue ao adapter pg. Substituição pontual do valor preserva bytes dos demais parâmetros; não serializar/imprimir a URL. Não adicionar uselibpqcompat/no-verify/rejectUnauthorized=false. Isso mantém comportamento CLI e explicita o comportamento TLS já vigente no runtime. Se a preferência for alterar a variável global, será necessário adaptar também a configuração CLI para require + sslaccept=strict e validar separadamente sua cadeia CA/hostname; isso é uma proposta adicional, não uma troca isolada do parâmetro.

Validação para eventual correção aprovada:

1. Prisma validate/generate + build do candidato (sem contato com banco para essas etapas); negativos de configuração e teste da normalização/preservação de parâmetros.
2. Migrations: `prisma migrate status` read-only no ambiente privado com CLI preservada, sem reset/db push/migrate dev; não executar migration só para testar SSL.
3. Startup production no Render com SHA/config conhecidos; ausência do aviso runtime e de APPLICATION_STARTUP_FAILED; confirmar logs sanitizados.
4. Health HTTP 200 / {status:ok}. GET público atual observado em 2026-10-09T13:04:14.0997224Z, **antes da correção proposta**; é somente liveness.
5. Query real read-only `SELECT 1` pelo PrismaClient/adapter do mesmo candidato usando environment privado do Render, com saída fixa de sucesso/falha e disconnect em finally. É a evidência de conexão Neon que falta; não imprimir URL, credenciais ou erro bruto. Nenhum teste destrutivo/fixture em produção.

**Classificação:** aviso atual é hardening preventivo, não blocker da T041/release. Alteração global isolada não aprovada tecnicamente por enfraquecer a política da CLI. Falha de conexão real/startup ou TLS enfraquecido em uma correção futura bloquearia aquele candidato.

## npm prune --omit=dev após build

Wrapper start:prod usa Node e `dist/src/main.js`; não depende de Nest CLI/ts-node/ts-jest. Prisma Client deve ser gerado antes do prune. **Compatível com o grafo atual**: dry-run no backend local com manifests idênticos, exit 0, prevê remover 570 pacotes incluindo handlebars/ts-jest. Apesar de Prisma constar em devDependencies, `@prisma/client` também a referencia como peer opcional: lock atual mantém prisma@7.10.0 e dotenv no grafo production. Não assumir que prune remove toda ferramenta ou que rompe migrations automaticamente.

Ensaio isolado do mesmo SHA: `npm ci --include=dev --ignore-scripts --no-audit --no-fund`, `npm run prisma:generate`, `npm run build`, `npm prune --omit=dev --ignore-scripts --no-audit --no-fund` e `npm run prisma:validate` após prune: **PASS**, URL sintética. Hash do lock preservado. Scripts de instalação foram omitidos; o ensaio não substitui instalação normal Linux/Render, startup e query reais. Imports do AppModule compilado após prune **PASS** (incluindo bcrypt/Prisma/pg); Handlebars e ts-jest ausentes, Prisma CLI e dotenv presentes. Não foi realizado bootstrap completo ou query real de produção após alteração.

Proposta de build, **não aplicada**: conservar ci → validate → generate → build e então acrescentar `npm prune --omit=dev`. Confirmar que nenhuma configuração persistente include=dev anula omit=dev; revalidar migrations/pre-deploy após prune e impedir download implícito de CLI ausente via npx. Render executa [pre-deploy depois do build, em instância separada](https://render.com/docs/deploys#pre-deploy-command); prune no filesystem de pre-deploy não limpa automaticamente a imagem runtime. Gates de runtime/Neon continuam necessários antes de tratar o pipeline alterado como validado.

Ausência de prune hoje não constitui blocker automático: Handlebars não foi encontrado em caminho executado da API e o audit production permanece zero. Prune reduz presença física do tooling e complementa o patch; não corrige o risco durante build/test. Retestar no lock final se houver atualização.

## Limite da decisão

T041 continua aberta por SEC-013/diagnóstico e demais provas privadas production existentes. Deploy saudável da instrumentação **PASS (user-reported)** não fecha coleta, desativação ou isolamento entre clientes. T043 **NOT RUN**, sem avanço, build EAS ou habilitação de push. Sem mudanças de código, manifests, lock, build Render, environment, Git/index/commit/push/PR. Somente evidência/documentação e ensaios em área ignorada.
