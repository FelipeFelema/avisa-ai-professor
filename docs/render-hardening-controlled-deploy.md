# Deploy controlado: SSL runtime, Handlebars e prune

Preparação local autorizada em 2026-10-09. T041 permanece aberta, SEC-013 aguarda a
próxima rodada e T043 não foi iniciada. Não habilitar push nem executar EAS build.
Este roteiro não afirma que o novo candidato já foi publicado ou implantado.

## Revisão e comandos

Baseline Live confirmada pelo proprietário:
`0381690ac13af7f18da20faeb3001071933c97c1`. O candidato novo ainda precisa de um SHA
commitado/publicado pelo proprietário; validar esse SHA exato, sem usar o HEAD
local anterior como se incluísse o WIP. Preservar os demais arquivos em andamento.

As remediações estão em `backend/package-lock.json` (somente Handlebars 4.7.10),
`backend/src/prisma/` (normalização e testes), `backend/package.json` (scripts),
`backend/scripts/check-production-database.cjs` e documentação. Não incluir
arquivos de ambiente, logs ou o cluster temporário no candidato.

Manter Root Directory `backend`, Node 22 e Auto-Deploy Off durante o rollout.
Anotar privadamente os comandos vigentes, SHA Live e configuração anterior antes
de salvar alterações no dashboard. A DATABASE_URL do Render continua exatamente
como está: a CLI recebe `require`; apenas o adapter runtime recebe `verify-full`.
Não exibir a variável nem usar `printenv`/dump de configuração.

- Build Command: `npm ci --include=dev && npm run build:prod`.
- `build:prod`: Prisma validate → generate → build → `npm prune --omit=dev`.
- Health Check Path: `/api/v1/health`.
- Start Command, para este deploy de validação:
  `npm run check:prod:database && npm run start:prod`.

O probe anterior ao startup executa somente `SELECT 1 AS ok` pelo PrismaService
compilado e pelo adapter real. Encerra a conexão em finally, limita a execução a
15s e imprime apenas `PRODUCTION_DATABASE_CHECK_OK`, um código fixo de falha ou
timeout. Se a query falhar, `&&` impede iniciar a nova API. Não cria registros,
não usa fixtures e não expõe endpoint de diagnóstico público. Esse comando
também funciona quando o plano não oferece Shell/pre-deploy.

Se o pre-deploy de migrations já está configurado, preservar seu fluxo aprovado.
Esta remediação não adiciona migration; não aplicar reset/db push/migrate dev.
Quando houver Shell/pre-deploy, confirmar a CLI instalada com
`node node_modules/prisma/build/index.js migrate status`; esse comando é somente
leitura. Evitar npx que baixe uma CLI ausente silenciosamente. Prisma CLI deve
estar disponível após prune no lock atual por peer de @prisma/client.

Manter as flags de push false e o diagnóstico SEC-013 desligado durante esta
validação. Não adicionar HMAC/credenciais de diagnóstico nesta etapa. Não mudar
TRUST_PROXY_CIDRS, topologia ou política de rate limiting.

## Execução e evidências remotas

1. Publicar o candidato revisado pelo fluxo Git aprovado pelo proprietário. No
   Render, executar manualmente **Deploy a specific commit** para o SHA novo.
   Nenhum deploy foi acionado pelo Codex nesta preparação.
2. Nos logs de build, confirmar a sequência validate/generate/build/prune e exit
   zero. Prune precisa concluir depois de gerar o client e compilar a aplicação.
   Não confundir o resumo de audit completo do npm ci com um critical runtime.
3. Nos logs da nova instância, confirmar `PRODUCTION_DATABASE_CHECK_OK` antes do
   startup. Esse marcador comprova uma query real com a configuração privada
   atual; health sozinho não comprova Neon. Verificar privadamente no dashboard
   que a variável aponta para o branch/database/role Neon de produção corretos,
   sem copiar seu valor para chat ou documentação.
4. Confirmar startup sem `APPLICATION_STARTUP_FAILED`, sem módulos ausentes e sem
   `SECURITY WARNING: The SSL modes`. Não silenciar warnings globalmente. Comparar
   somente logs do novo deploy, pois o aviso pode permanecer em logs históricos.
5. Em PowerShell, executar o GET público:

   ```powershell
   $health = Invoke-RestMethod -Uri 'https://api-avisa-ai.onrender.com/api/v1/health' -TimeoutSec 30
   $health.status
   ```

   Esperado: HTTP 200 e `ok`. Registrar SHA Live novo, horário, resultado da query,
   startup/health e confirmação da ordem prune/startup. Não publicar logs brutos.

6. Revisar os logs privadamente: nenhuma URL PostgreSQL com credenciais, JWT,
   refresh token, senha ou chave deve aparecer. O probe não imprime erro bruto.
   Registrar somente resultado e códigos fixos; detecção por padrões é apoio,
   não prova absoluta de ausência de todo tipo de secret.

Se houver Shell disponível, `npm run check:prod:database` permite repetir a mesma
query segura sem reiniciar a API. `npm ls --omit=dev` pode inventariar o runtime;
Handlebars e ts-jest devem estar ausentes fisicamente. Nunca executar npm ci ou
testes destrutivos no Shell de produção para obter essa evidência.

Após validar o deploy, o Start Command pode voltar ao padrão
`npm run start:prod`; o probe permanece disponível para uso privado. Salvar uma
mudança de comando/ambiente pode provocar novo deploy: aplicar conscientemente e
reconfirmar seu estado. Não declarar a retirada do probe executada sem fazê-la.

## Falha e rollback

Se build, query, startup ou health falharem, parar a validação e registrar apenas
código/etapa/SHA, sem errors/stacks/URLs brutos. Não tentar contornar TLS com
no-verify, uselibpqcompat ou rejectUnauthorized=false.

Para voltar à baseline Live `0381690`, restaurar também os comandos anteriores:

- Build Command:
  `npm ci --include=dev && npm run prisma:validate && npm run prisma:generate && npm run build`.
- Start Command: `npm run start:prod`.

O SHA antigo não possui `build:prod` nem `check:prod:database`. Não deixar os novos
comandos ativos ao reconstruí-lo. Usar o mecanismo de rollback do Render conforme
o estado do deploy e confirmar health/SHA novamente. A DATABASE_URL original não
foi alterada por esta remediação. Não executar rollback destrutivo de banco.

## Retomada

Depois dos checks remotos, retomar somente o diagnóstico SEC-013 pelo roteiro
privado já aprovado, que permanece no WIP local e fora deste commit.
O sucesso desta rodada não fecha isolamento entre clientes nem T041. T043,
push/EAS e gates finais permanecem nas dependências e autorizações já definidas.
