# Secrets: fontes, exemplos e histórico

T032. Scan em 2026-10-08T01:01:48.342Z: 637 arquivos textuais tracked/untracked não ignorados, 1829 blobs textuais únicos de todos os refs localmente alcançáveis (branches/remotes/tags/checkpoints), 301 arquivos de logs/scripts/metadados ignorados. Cobertura inclui workflows, docs, fixtures, testes, .gitignore e .env.example. Valores privados conhecidos JWT access/refresh, Expo bearer e Firebase private key comparados internamente sem imprimir/hash identificável de segredo. Senha DATABASE_URL só participa da comparação exata quando não é curta/padrão; URL/key/PEM/token heuristics e revisão de configuração complementam.

**Zero matches reais confirmados.** 21 arquivos de teste atuais e 34 versões históricas com ExpoPushToken sintético foram revistos; não constituem exposição de token real. Nenhum PEM/JWT real nas heurísticas. Capabilities são referências/test values e API restrita/SecureStore; nenhum log de valor bruto identificado na revisão. Exemplos postgres/postgres são explicitamente dev, rejeitados pelo validador production; não são prova de credencial production vazada.

.env e mobile/credentials estão ignorados. Ignore reforçado para google-services.json, firebase-adminsdk/service-account, .pem/.key e export privado. Não há .easignore divergente; archive padrão usa .gitignore. Arquivo Google Services cliente é configuração pública de app, diferente de private service account. Não copiar esta última para GOOGLE_SERVICES_FILE. Não houve contenção/rotação externa porque não foi confirmada exposição. T034 permanece dependente da auditoria de artefato atual.

Limites: refs remotos excluídos não presentes, logs hospedados, segredos desconhecidos do inventário e formas base64/criptografadas arbitrárias não foram exaustivamente analisados. [Artefatos](secrets-artifacts.md).

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.

Scan final repetido após documentação: 652 arquivos fonte, 1829 blobs históricos, 309 logs/metadados privados, 166 arquivos de artefato disponível; zero matches reais. [Resumo sanitizado](secrets-final-summary.json).

## Reexecução com export atual — 2026-10-08

Scan 2026-10-08T14:35:52.611Z: 654 fontes, 1878 blobs históricos, 351 logs e 172 arquivos de artefato; zero exposição real conhecida. [Export atual](android-bundle-security.md), [resumo sanitizado](android-export-inspection.json). PRODUCTION_API_URL = PENDING.
