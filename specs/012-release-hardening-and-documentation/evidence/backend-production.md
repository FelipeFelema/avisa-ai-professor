# Backend: configuração production

T037–T039. RED de controles ausentes foi reproduzido antes da correção; 10 testes production atuais PASS, mais E2E completo 105/105. validateProductionConfig roda no ConfigModule e configureApp: NODE_ENV=production exige JWTs distintos com comprimento/diversidade mínima, sem placeholders; DATABASE_URL PostgreSQL completa sem senha padrão; CORS obrigatório com origins HTTPS exatas sem localhost/IP/credenciais; PORT válido e flags boolean/coerentes. Validação de formato não mede entropia real: gerar secrets aleatórios privados.

start:prod antes apontava dist/main inexistente; corrigido para wrapper scripts/start-production.cjs → dist/src/main.js, exigindo NODE_ENV production. AppModule agora carrega dentro do catch de bootstrap; logger é desligado durante inicialização e falhas resultam apenas APPLICATION_STARTUP_FAILED + exit 1. Smoke do entrypoint compilado comprovou recusa de modo incorreto e configuração inválida sem valores/stacks. Shutdown hooks habilitados.

Docs UI/JSON permanecem desabilitados em production inclusive API_DOCS_ENABLED=true; erros HTTP sanitizados. Health é liveness minimalista {status:ok}, não certificado de schema/readiness/TLS/FCM. Startup não faz reset/db push/migrations automáticas. Rate limits locais limitados a uma instância; trust proxy false, não validar trust proxy genérico para contornar IPs. Atualização proxy-addr remove advisory, mas topologia real deve ser configurada conscientemente.

Ambiente hosting/API/TLS/firewall/secrets production reais não foi fornecido/verificado. Não declarar configuração remota segura a partir destes testes locais. Push flags podem permanecer false até candidato/FCM/smoke aprovados. .env.example continua exemplo dev, não configuração pronta de produção.

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.

## Endpoint real — 2026-10-08

PRODUCTION_API_URL = PENDING. Proprietário confirmou API não publicada. Este documento é auditoria/teste local de controles necessários, não avaliação de hosting/TLS/CORS/health remotos. Nenhum deploy ou smoke real executado.

## Revalidação pré-Render — 2026-10-08

O default trust proxy=false foi preservado; configuração opcional TRUST_PROXY_CIDRS permite allowlist explícita de ingresso, com negativos reais HTTP contra spoofing e budget compartilhado. [Correção e gates](render-proxy-readiness.md). Ranges reais de ingresso Render ainda pendentes; não são seus IPs de saída. Commits locais agora autorizados; push/deploy e PRODUCTION_API_URL permanecem pendentes.
