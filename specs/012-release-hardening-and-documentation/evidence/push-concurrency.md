# Push: reminders, restart, retry e ledger

T022. Unique occurrence/event/dispatch, lock order e CAS preservados. SENDING é persistido antes da submissão externa. Crash/timeout/resultado ambíguo passa a UNKNOWN sem reenviar; receipt polling não ressubmete push. Tombstones sobrevivem exclusão de registration e occurrenceKey não é zerada no recovery. Late receipts não invalidam binding/token novos por engano.

Reminders/locks/dispatch/receipts e workers foram executados: publication idempotente, occurrence por expiração/revisão, edição de expiração, concorrência de workers, restart com ledger já existente, UNKNOWN/SENDING, retries de receipts e kill flags. A aplicação evita duplicação criada por ela; não promete exactly-once do Expo/FCM nem recuperação da entrega ambígua por retry. [Recovery](../../../docs/release-recovery.md) proíbe requeue de UNKNOWN/SENDING.

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.
