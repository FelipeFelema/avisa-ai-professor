# Data Model: Push Notification Foundation

**Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

Modelo proposto; não há schema/migration implementados. Turmas, convites e comunicados permanecem fora das novas relações.

## PushInstallation

| Campo               | Tipo/regra                                                                        |
| ------------------- | --------------------------------------------------------------------------------- |
| id                  | UUID v4 criptográfico da instalação; PK                                           |
| secretHash          | SHA-256 dos 32 bytes secretos; nunca segredo em claro                             |
| lifecycleVersion    | inteiro monotônico >=0; incrementa na reserva de novo vínculo                     |
| lastTestStartedAt   | timestamp nullable, cooldown 30 s por instalação entre vínculos                   |
| nextTestAvailableAt | timestamp nullable persistido; considera instante de aceite e timeout de despacho |
| testLeaseUntil      | timestamp nullable, lease de envio <=15 s                                         |
| createdAt/updatedAt | timestamps server-side                                                            |

Relação 1:N com Registration preserva revogações terminais. O vínculo corrente é o filho cujo lifecycleVersion coincide com Installation.lifecycleVersion, usando a unique composta; não há FK reversa de Installation para Registration. Isso evita cascata de exclusão bloquear Installation depois de já bloquear Registration. Nenhuma enumeração pública. SecretHash nunca substituído em instalação existente. Só reserva com JWT cria Installation; DELETE sem JWT não cria recursos.

## PushRegistration

| Campo                                         | Tipo/regra                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| id                                            | UUID server-side, PK, nunca reutilizado                                                            |
| installationId                                | FK Installation, onDelete Cascade                                                                  |
| userId                                        | FK User, onDelete Cascade                                                                          |
| sessionId                                     | FK AuthSession, onDelete Cascade                                                                   |
| lifecycleVersion                              | inteiro positivo; unique installationId+lifecycleVersion                                           |
| platform                                      | ANDROID/IOS, nullable em reserva                                                                   |
| expoToken                                     | string nullable unique global; somente ACTIVE conserva token utilizável                            |
| tokenFingerprint                              | SHA-256 nullable, privado                                                                          |
| tokenRevision                                 | inteiro >=0; 0 na reserva, aumenta com token/plataforma novos                                      |
| state                                         | RESERVED / ACTIVE / REVOKED / INVALID                                                              |
| reason                                        | nullable USER_DISABLED / LOGOUT / PERMISSION_REVOKED / SESSION_INACTIVE / TOKEN_INVALID / REPLACED |
| createdAt/updatedAt/activatedAt/invalidatedAt | timestamps aplicáveis                                                                              |

Índices userId, sessionId, installationId+state. ACTIVE implica token/plataforma/fingerprint/revision>0; demais estados sem token utilizável. Session.userId=userId é invariante revalidada pelo servidor, além das FKs independentes.

### Transitions

| Origem                  | Evento                                        | Destino/efeito                                                                       |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| sem vínculo             | reserva JWT + capability                      | RESERVED, sem token; salvar referência local antes de ativar                         |
| RESERVED                | ativação com permissão/token válidos          | ACTIVE, revision=1                                                                   |
| ACTIVE                  | mesmo token/plataforma/sessão                 | no-op idempotente, revision não muda                                                 |
| ACTIVE                  | rotação com CAS                               | ACTIVE, revision+1; token anterior inelegível                                        |
| RESERVED/ACTIVE/INVALID | revogação capability do vínculo               | REVOKED terminal, token=null; retry 204                                              |
| ACTIVE                  | erro permanente matching revision/fingerprint | INVALID, token=null; não atinge revisão nova                                         |
| qualquer                | sessão expirada/revogada                      | inelegível imediatamente por predicado; neutralização de estado/token ao reconciliar |
| qualquer                | User/AuthSession removidos                    | cascade remove registro/tentativas                                                   |
| REVOKED/INVALID         | novo opt-in explícito                         | novo RESERVED/id/lifecycle, nunca reabre REVOKED                                     |

Permissão SO não muda por opt-out. INVALID exige readquirir token no SDK e nova reserva; não reutilizar cache inválido. Reinstalação cria outra Installation sem herdar opt-in/vínculo.

### Eligibility

Todo envio exige ACTIVE com token, vínculo corrente, User existente e AuthSession pertencente ao User, revokedAt=null e expiresAt>now. Teste HTTP exige também JWT userId/sid correspondentes e capability. Revalidar revisão/fingerprint antes do despacho. Access JWT expirado pode ser renovado mantendo AuthSession/sid; não equivale sozinho à expiração da sessão persistida.

## PushTestAttempt

Persistência operacional; não é inbox/histórico público.

| Campo                                | Tipo/regra                                                               |
| ------------------------------------ | ------------------------------------------------------------------------ |
| id                                   | UUID opaco server-side, deduplicação de feedback, não seletor de destino |
| installationId/registrationId        | FKs cascade                                                              |
| tokenRevision/tokenFingerprint       | snapshot imutável, sem token em claro na tentativa                       |
| state                                | SENDING / ACCEPTED / PROVIDER_HANDOFF / REJECTED / UNKNOWN               |
| failureCode                          | código sanitizado nullable                                               |
| providerTicketId                     | privado nullable, <=256 caracteres                                       |
| startedAt/acceptedAt/completedAt     | timestamps                                                               |
| nextReceiptCheckAt/receiptDeadlineAt | timestamps nullable; prazo 24 h                                          |
| receiptLeaseUntil/receiptChecks      | lease/contador para recuperação worker                                   |

Índice state+nextReceiptCheckAt. Ticket ok → ACCEPTED; receipt ok → PROVIDER_HANDOFF; falha conhecida → REJECTED; timeout/deadline indeterminado → UNKNOWN. Nunca afirmar exibição. Window/lease são reservadas sob Installation lock antes do HTTP: nextTestAvailableAt=startedAt+5 s de timeout+30 s. Ticket ok atualiza atomicamente para max(janela atual, acceptedAt+30 s); UNKNOWN conserva janela, inclusive crash. Lease vencida conclui UNKNOWN, sem reenviar. Worker faz HTTP sem transação aberta e efeitos por CAS.

## Local state

| Item               | Persistência/regra                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| identidade         | SecureStore UUID+segredo; aleatoriedade criptográfica                                                                      |
| marcador           | AsyncStorage não secreto excluído de backup; ausência confirmada reinicia push                                             |
| opt-in app         | não secreto, default false; false prevalece sobre permissão concedida                                                      |
| current binding    | SecureStore bindingId/lifecycleVersion, salvo antes de ativar                                                              |
| pending revocation | SecureStore installationId/segredo+bindingId/lifecycleVersion/reason; sem JWT/token/userId/senha; remover somente após 204 |
| permissão/token    | SDK; token somente memória transitória, fora de cache genérico                                                             |
| reconciliação      | session-generation existente; efeitos tardios descartados                                                                  |

Erro storage bloqueia apenas push e produz recuperação. Logout/cache cleanup continuam. Escoar pendência antes de nova reserva/ativação. Ausência de marcador causada por erro de leitura não autoriza criar identidade. Reinstalação não muda restauração geral da conta/tema, mas não restaura relação push.

## Invariants and concurrency

1. No máximo um vínculo corrente por Installation. Reserva idempotente para mesmo user/session; outra conta/sessão requer revogação anterior ou inelegibilidade server-side.
2. UUID/bindingId sem capability não concede consulta/alteração. User/sid não são DTOs.
3. CAS tokenRevision protege rotação; REVOKED é terminal independentemente da revisão.
4. Token de outra instalação elegível é conflito mesmo na mesma conta. Token de vínculo inelegível pode ser liberado sob locks das instalações ordenados, jamais transferindo vínculo elegível.
5. Reserva com resposta perdida é inelegível; ativação só começa após persistência da referência. DELETE que precede PUT impede ativação.
6. Receipt usa registrationId+revision+fingerprint, preservando novo token/conta.
7. Cascatas removem registros/attempts da conta/sessão. Sem filho correspondente à lifecycleVersion, não existe vínculo corrente nem elegibilidade. Cleanup remove Installation sem filhos após 7 dias sem atividade; não remove instalação que tenha filhos de outra conta. BindingIds nunca reutilizados tornam antiga revogação inofensiva após remoção.
8. Envio externo despachado não pode ser retirado. Revalidar antes de despachar, cancelar se revogação já venceu; payload neutro evita exposição de conta na corrida inevitável após despacho.

Autenticadas: User → AuthSession → Installation(s) ordenadas → Registration. Capability-only/receipt: Installation(s) → Registration, sem adquirir User/AuthSession depois. Uniqueness fecha corrida entre seleção e insert/update. Exclusão conserva advisory gate → User → Classrooms → cascatas. Exercitar essas ordens em integração real.

Cleanup operacional remove bindings REVOKED/INVALID e reservas sem uso após 7 dias sem atividade, além de vínculos de sessão inelegível; nunca remove ACTIVE elegível. Remoção de binding antigo não o torna reativável: PUT com id ausente falha, DELETE antigo é no-op e IDs não se repetem. Isso limita resíduos de toggles/retries sem histórico público.

## Migration and recovery

Migração aditiva cria enums/tabelas/uniques/FKs/cascatas, sem backfill ou registros ativos. Gerar/revisar SQL na implementação; testar unique composta e cascata sem FK reversa. Atualizar clearTestDatabase: Attempt, Registration, Installation, depois dados existentes; guardas ativas.

Testar instalação do schema e banco isolado com dados preexistentes, preservando todas as entidades antigas. Recuperação: desabilitar push, revogar vínculos e reverter aplicação; conservar tabelas até revisão explícita de remoção. Credenciais externas não entram em migration/fixtures. Nenhuma migration é executada por este plano.
