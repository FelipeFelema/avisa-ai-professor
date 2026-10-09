# Primeiro deploy do backend no Render

Preparação local da Spec 012, 2026-10-08. Não é autorização de push/deploy nem prova de ambiente remoto. `PRODUCTION_API_URL = PENDING`. T041/T043 continuam abertas; Fases 7–8 não iniciadas.

## Serviço e comandos

Web Service, runtime Node, Root Directory `backend`, uma instância inicialmente. Selecionar uma revisão publicada que inclua o hardening 012; o antigo HEAD pré-hardening não é fallback seguro. Auto-Deploy Off para controlar o rollout. Criar o serviço já inicia seu primeiro deploy: configurar tudo antes de confirmar.

- `NODE_VERSION=22.x` (mínimo 22.12.0 nessa família).
- Build Command: `npm ci --include=dev && npm run build:prod`.
  `build:prod` executa validate → generate → build → `npm prune --omit=dev`; o prune ocorre somente após a compilação bem-sucedida. Testes usam a instalação completa antes do prune.
- Pre-Deploy Command, quando disponível: `npm run prisma:migrate:deploy && npx prisma migrate status`.
- Start Command: `npm run start:prod` (wrapper exige production e carrega `dist/src/main.js`).
- Health Check Path: `/api/v1/health`; esperado HTTP 200, `{"status":"ok"}`. É liveness, não consulta schema/banco/push.

Pre-deploy está disponível para web services pagos. Se indisponível, migrations precisam de uma etapa separada autorizada antes de iniciar a aplicação; não usar reset/db push/migrate dev. Há 14 migrations, ensaiadas em banco vazio e upgrade representativo. Banco antigo com dados requer inventário/backfill aprovado. Backup e falha após migration seguem [recovery](release-recovery.md).

## Ambiente privado

Secrets obrigatórios: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`. JWTs aleatórios, distintos, mínimo 32 caracteres e 12 caracteres distintos, sem placeholders. A URL precisa identificar PostgreSQL, usuário/senha/host/banco válidos. No Neon selecionar branch/database/role de produção, copiar conexão direct/unpooled e preservar TLS. CLI e runtime atuais usam somente DATABASE_URL; DIRECT_URL/DATABASE_URL_UNPOOLED não são lidas.

Configuração obrigatória: `NODE_ENV=production`, `CORS_ORIGIN` com origins HTTPS exatas separadas por vírgula, sem barra final/caminho/localhost/IP/wildcard. Android nativo não depende de CORS do navegador; se não houver frontend web, o origin HTTPS real do próprio serviço pode ser a allowlist inicial. Não incluir `/api/v1` em CORS_ORIGIN.

Opcionais: PORT fornecida pelo Render; API*DOCS_ENABLED=false por clareza (UI e JSON desabilitados em production mesmo true). Inicialmente EXPO_PUSH_ENABLED=false, ANNOUNCEMENT_PUSH_ENABLED=false e ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false. Somente true/false literais são aceitos. Expo habilitado exige EXPO_PUSH_ACCESS_TOKEN privado; announcements exigem Expo; reminders exigem announcements. Enhanced Push Security usa Bearer somente no backend. Firebase service account/FCM V1 ficam no mecanismo de credentials EAS/Expo, não no Render, Git ou EXPO_PUBLIC*\*.

## Proxies: configuração depende de ingresso verificado

`TRUST_PROXY_CIDRS` é opcional e **desativada por padrão**. Quando definida, aceita até 32 IPs/CIDRs explícitos separados por vírgula; rejeita valores vazios, DNS/aliases, booleanos, hop counts, ranges universais/excessivamente amplos e ranges IPv6 que cobrem todo IPv4 mapeado. IPv4 exige prefixo >=8; IPv6 >=16, além da exclusão de IPv4 universal. Esses limites não certificam a procedência de um range: usar os ranges mais estreitos comprovados como proxies. Falha resulta em código fixo sem eco do valor.

O Express percorre socket e X-Forwarded-For da direita para a esquerda, para no primeiro hop não confiável e usa esse endereço para o limiter existente. Não lê CF-Connecting-IP/True-Client-IP como autoridade isolada. Não adivinha quantidade de hops nem ativa trust proxy=true com RENDER=true. Sem header, preserva orçamento do socket.

**Ainda não há ranges de ingresso Render verificados.** Seus IPs de saída não identificam os proxies de entrada. Não copiar CIDRs das fixtures, confiar em toda a rede privada por conveniência nem ler o primeiro X-Forwarded-For diretamente. A documentação oficial confirma proxy/Cloudflare, mas não estabelece aqui uma allowlist estável específica deste serviço.

Para o primeiro deploy controlado de health/configuração, deixar TRUST_PROXY_CIDRS ausente. Isso preserva defesa contra spoofing, mas pode agrupar clientes atrás do proxy; **não liberar tráfego regular alegando isolamento por cliente** nessa condição. Antes da abertura:

1. Confirmar com o hosting/topologia real os IPs/CIDRs dos proxies de cada rota até a aplicação e como os hops são acrescentados/sanitizados. Garantir que conexões não confiáveis não possam entrar como um proxy autorizado, inclusive pela rede privada. Diagnóstico deve ser privado e temporário, sem expor endpoint público de IP/headers ou publicar valores reais.
2. Configurar somente os ranges confirmados em TRUST_PROXY_CIDRS e fazer redeploy com a configuração nova. Revalidar sempre que proxy/domínio/topologia mudar.
3. Em smoke autorizado, confirmar budgets separados para dois clientes com IPs externos distintos e que variar prefixos X-Forwarded-For/CF-Connecting-IP/True-Client-IP não contorna o limite. Não tratar o teste local como prova remota.

RateLimitGuard conserva 10/min/IP por guard/processo, cap e expurgo. Uma instância inicialmente; reinício perde os contadores e rolling deploy pode sobrepor processos. Multi-instância/distributed limiter exige decisão separada, não está implementado. O plano Free hiberna; workers internos de reminders só executam enquanto a API está ativa. Não prometer operação contínua de push nesse plano.

## Depois do deploy autorizado

Confirmar SHA, migrations/status/schema, HTTPS real e health; docs `/api/v1/docs` e `/api/v1/docs/openapi.json` devem retornar 404; revisar CORS e logs privados sanitizados. Só então substituir PENDING pela URL real em evidência/configuração mobile. URL mobile incluirá `/api/v1`. Não fechar T043 sem candidato Android e autorização de build externa. Push continua false até decisão própria.

Fontes: [Render deploys](https://render.com/docs/deploys), [Node](https://render.com/docs/node-version), [ingresso/limiter](https://render.com/articles/how-render-handles-ddos-attacks), [Free](https://render.com/docs/free), [Express proxies](https://expressjs.com/en/guide/behind-proxies/), [Neon](https://github.com/neondatabase/website/blob/main/content/docs/guides/prisma.md).

## Assessment SSL e prune — 2026-10-09

[Conclusão antes de mudar build/ambiente](../specs/012-release-hardening-and-documentation/evidence/render-build-startup-hardening-2026-10-09.md). Não substituir isoladamente sslmode=require por verify-full na DATABASE_URL compartilhada: runtime pg é compatível, Prisma CLI 7.10.0 faz fallback prefer (reproduzido localmente). Proposta mínima: normalização somente no adapter runtime, preservando CLI e demais parâmetros; não aplicada. Audits do SHA implantado 0381690: 24 full, zero omit-dev; critical Handlebars via ts-jest, patch 4.7.10 compatível proposto. Prune no fim do build é compatível com o lock/ensaio isolado e mantém Prisma CLI por peer; exige confirmação de startup/query/migrations no pipeline final. Build Command acima permanece vigente, sem alteração nesta rodada.

## Remediações aprovadas/aplicadas — 2026-10-09

O assessment propositivo anterior foi seguido pela autorização e [validação local completa](../specs/012-release-hardening-and-documentation/evidence/render-hardening-remediation-2026-10-09.md). O Build Command no início deste documento agora usa build:prod com prune ao fim; aplicar essa configuração no dashboard somente no próximo deploy controlado. Normalização acontece exclusivamente no PrismaPg, DATABASE_URL da CLI permanece intacta. [Roteiro completo, probe Neon privado e rollback dos comandos](render-hardening-controlled-deploy.md). Nenhum novo deploy/dashboard/Git nesta rodada; T041/T043 abertas.
