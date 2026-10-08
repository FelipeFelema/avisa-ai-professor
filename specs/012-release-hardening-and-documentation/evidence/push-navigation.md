# Push: navegação autenticada e callbacks

T023. announcementId é apenas identificador. Parser rejeita versão/tipo/shape/IDs malformados e payload extra/antigo; navegação consulta a API com a sessão atual, e backend verifica membership/ativo antes de retornar comunicado. Payload não é authority nem cache de corpo. Conta externa, anúncio ausente/expirado/removido e callback após logout/troca/generation antiga não abrem conteúdo privado.

Suites announcement-push-navigation/provider e lifecycle/auth foram executadas na regressão mobile. Sem finding novo. Caminho Expo Router/query-string também motivou SEC-009 (DoS de disponibilidade, não bypass de membership), corrigido por patch autorizado; confirmação no bundle atual pendente.

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.
