# Pré-Render: proxy, rate limit e commits locais

Autorizado pelo proprietário em 2026-10-08: correção segura pertinente, testes/gates e commits locais da Spec 012. Sem push/PR/deploy/build EAS/APK/AAB; Fases 7–8 não iniciadas. PRODUCTION_API_URL = PENDING. Executor: Codex, automatizado local; Node 22.14.0/npm 11.10.1; datas UTC nos metadados privados.

## Finding SEC-013 — REMEDIAR AGORA

Render documenta tráfego por Cloudflare/load balancers; com trust proxy false, req.ip é o socket do proxy. Reprodução HTTP local com o guard real: clientes sintéticos A e B na mesma conexão de proxy consumiam um único orçamento e a tentativa válida de A recebeu 429 antes de completar seu próprio limite. Também reproduzida ausência de validação da nova configuração antes de implementar (8 casos RED/4 PASS). Uma primeira invocação sem selecionar avisa_ai_test foi recusada pela guarda do setup, antes de executar testes; nenhum teste/reset foi executado no banco de desenvolvimento.

**Corrigido no código:** configuração opcional TRUST_PROXY_CIDRS, default false, somente IPs/CIDRs explícitos, limite de tamanho/quantidade e recusa de aliases/boolean/hop count/ranges universais/amplos. IPv4-mapped IPv6 na configuração é recusado (usar IPv4 nativo); subnets IPv6 que incluem todo o bloco IPv4-mapped também são recusadas. Código de erro fixo, sem valor bruto. Nenhuma dependência nova, migration ou contrato público novo para esta correção.

Express resolve cadeia de trás para frente e para no primeiro hop não confiável. HTTP local comprova budgets separados A/B, IPv6, proxy adicional fora da allowlist, socket não confiável, prefixos falsos, headers alternativos sem autoridade e ausência do header. Um cliente limitado não libera seu orçamento mudando prefixos/edge permitido; outro cliente mantém suas 10 solicitações. Invalid config é recusada antes de servir inclusive em production.

**Operação real pendente:** não conhecemos ranges de ingresso estáveis do serviço Render ainda não criado. A allowlist é política, não prova de procedência dos ranges. Não ativar true, confiar automaticamente em RENDER=true, selecionar número de hops, usar IPs de saída Render ou copiar fixtures. Confirmar todos os caminhos/peers confiáveis e impedir entrada não confiável pelo mesmo range. Sem allowlist, mantém socket budget e pode agrupar clientes. Primeiro deploy de health/configuração pode ser controlado com default; abertura a tráfego regular depende da verificação/allowlist/smoke remotos do [procedimento](../../../docs/render-backend-deploy.md).

O limiter permanece em memória, 10/min/IP por guard/processo, cap/expurgo preservados. Uma instância inicial; restart/rolling deploy não constitui limiter distribuído. Não contratado Redis/custo/infra nova. Plano Free hiberna e não garante reminders contínuos.

## Gates locais

Resultados finais e hashes em `render-preparation-summary.json`. Logs detalhados ficam ignorados em logs/spec012, sem valores privados nas evidências públicas. E2E/integration/contract serializados entre si, apenas loopback avisa_ai_test; nenhuma conexão ao serviço alvo Render ou banco Neon/production. Hooks Jest finalizaram naturalmente, sem forceExit. Uma falha de formatação em linha nova foi corrigida e retestada.

Backend: lint/format/typecheck/Prisma validate/generate/migrate status/build PASS; unit 33 suites/426 testes, coverage acima dos thresholds; integração 28/270; E2E completo 11/120, seguido de reteste focado 2/25 dos controles finais (sobrepostos, não somados); contrato 1/10. Instalação limpa `npm ci --include=dev --no-audit` isolada com NODE_ENV=production, sem copiar `.env`, seguida de validate/generate/build PASS; todos os inputs backend conferidos contra o worktree validado. Smoke do entrypoint compilado recusa modo incorreto, JWT placeholder e proxy inválido com exit 1/códigos fixos sem eco do sentinel. A primeira fixture de JWT atendia ao formato e foi descartada após timeout; corrigida para um placeholder inequivocamente inválido antes do resultado final. Não é smoke de app saudável/banco/hosting production. Mobile: typecheck/lint/format PASS, unit 89/677, Doctor 21/21 e decoder checker PASS. Export Android anterior permanece evidência do source mobile inalterado; nenhum novo export/build externo nesta rodada.

Audits de 2026-10-08: backend full 23 (20 moderate/3 high), omit-dev 0; mobile full 62 (12 moderate/50 high), omit-dev 58 (12 moderate/46 high), zero critical. Advisories/classificações anteriores preservados: [triagem](../dependency-assessment.md). Backend e mobile omit-dev mantiveram os mesmos pacotes/ranges/advisories. Mobile full mudou somente o range de um parent dev, jest-resolve-dependencies (via jest-snapshot): de 27.0.0-next.0–30.2.0 para 23.3.0–30.2.0; sem novo advisory, versão instalada ou presença no runtime Android. Mantém DEV/TOOLING ONLY, sustentado pela triagem/export anterior.

Secrets: comparações internas com JWT/Expo/Firebase privados conhecidos, heurísticas e revisão de ignore/source/history/logs/artifacts. Zero match de segredo real; detalhes e limites no resumo. Valores e arquivos privados não staged/commitados. Isso não certifica secrets desconhecidos, logs hospedados, refs remotas ausentes ou APK/AAB inexistente.

## Limites do checkpoint

Commits locais são autorizados neste checkpoint; registros anteriores de “sem commits” descrevem suas execuções passadas. [Agrupamento](../commit-plan.md). CI remoto ainda NOT RUN. Backend endurecido ficará no histórico local pronto para push, sem alegar publicação remota. T041/T043 continuam pendentes, contagem preservada 47/70 (29/31 no bloco Fases 4–6), release Android NOT READY.

Fontes primárias: [Render ingresso](https://render.com/articles/how-render-handles-ddos-attacks), [Express trust proxy](https://expressjs.com/en/guide/behind-proxies/). Não há garantia verificada de quantidade fixa de hops neste serviço.

## Retomada após queda de energia relatada pelo proprietário

Em 2026-10-08, confirmados os commits locais backend `3dec7df` e mobile `f67d504`, index vazio e nenhuma alteração nos 442 inputs fonte comparados com o manifesto validado. Os 17 gates anteriores e metadados de instalação limpa/smoke ficaram preservados. Reexecutados após a retomada: HTTP proxy/production 2 suites/25 testes PASS, decoder PASS e Prisma migrate status PASS com as 14 migrations atualizadas em loopback avisa_ai_test. Nenhuma migration/reset foi executada nessa retomada. Revisão final de secrets/index e commit documental concluem a preparação local; isso não autoriza nem prova push/deploy/CI remotos.
