# Push: destinatários backend-only

T020. AnnouncementPushService deriva usuários por membership atual no backend; requests não contêm lista arbitrária de recipients. Author é excluído da fanout conforme 011. ACTIVE é necessário, mas insuficiente: session/user, lifecycleRevision, bindingId, tokenRevision, fingerprint e associação são revalidados. Autoridade final dentro da seção de locks evita envio autorizado com snapshot antigo após saída/exclusão/logout.

Regressões fanout/dispatch/locks cobrem turma externa/conta externa, autor, REVOKED/INVALID, múltiplos destinatários, opt-out, saída/exclusão e alteração entre claim/authorize. Conta/turma/comunicado excluídos não deixam destinos elegíveis. Nenhum erro de destinatário foi observado nos testes. Isso prova decisão da aplicação nos cenários executados; não controla duplicação ou entrega física do provedor.

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.
