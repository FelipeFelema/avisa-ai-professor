# Data Model: invariantes e mudanças candidatas

**Status**: design, sem alteração do schema/migrations.

## Entidades persistidas existentes

| Entidade | Campos/relações relevantes | Invariante |
| --- | --- | --- |
| User / AuthSession | userId, role; sid, refreshTokenHash, expiresAt, revokedAt | Papel atual/sessão ativa, hash de refresh, rotação/replay/revogação |
| Classroom / UserClassroom | ownerId; chave userId+classroomId | Ownership/membership distintos; isolamento |
| Announcement | authorId, classroomId, expiresAt, notificationPending | Autoria/membership/regras atuais; expiração/ocorrência coerentes |
| InviteCode | code único, role, isActive, expiresAt | ADMIN vigente; cadastro público nunca produz ADMIN |
| ClassroomDeletionReceipt | classroomId, ownerId, deletedAt | Idempotência e política de retenção/órfãos explicitadas |
| PushInstallation | UUID, secretHash SHA-256, lifecycleVersion, leases | Hash no backend, lifecycle monotônico |
| PushRegistration | installationId, userId, sessionId, lifecycleVersion, expoToken, tokenRevision, state | ACTIVE exige pré-condições; REVOKED/INVALID inelegíveis; terminal não reabre |
| PushTestAttempt | registro, revisões, ticket/receipt, lease | Resposta antiga não altera novo binding/token; ambiguidade não reenvia |
| AnnouncementPushEvent | announcementId, kind, occurrenceKey, snapshotAt | Unicidade anúncio+kind+ocorrência; sem destinatário tardio |
| AnnouncementPushDispatch | eventId, instalação, registro/sessão, revisões, estado/leases/receipt | Unicidade evento+instalação, revalidação e integridade concorrente |

`backend/prisma/schema.prisma`/migrations são fonte de verdade; incluir constraints SQL. Cascades não substituem exclusão explícita das relações sem cascade. Não impor retention nem apagar tombstones/ledger sem decisão.

## Intenção local proposta (US5)

Sem tabela backend nova por padrão; APIs públicas podem permanecer inalteradas.

- `version`: literal `2`.
- `userId`: identidade da conta autenticada, nunca de payload push.
- `installationId`: UUID da instalação vigente derivado da identidade local segura.
- `intent`: enum `UNDECIDED | ENABLED | DISABLED`.
- `onboarding`: enum `NOT_SEEN | DEFERRED | DECIDED`.
- `updatedAt`: timestamp local para UX; não autoriza envio nem ordena lifecycle remoto.

Invariantes: **“Chave lógica única (userId, installationId)”**; **“Registro legado sem dono não autoriza ativação”**; **“ENABLED não implica permissão nativa nem binding ACTIVE”**; **“Logout nunca reutiliza binding REVOKED”**. Registro de intenção não contém Expo token, JWT, refresh token ou capability; capability mantém storage seguro existente.

### Transições

1. UNDECIDED/NOT_SEEN: convite contextual, sem requestPermission em mount/login.
2. Agora não: sem envio, onboarding DEFERRED; disponível no Perfil, sem insistência a cada restart.
3. Ativar explicitamente: escolha da conta vigente; prompt quando necessário/possível, binding novo pelo protocolo 010 e ativação só após pré-condições. Recusa gera feedback, sem elegibilidade remota.
4. Logout: revogar/registrar revogação pendente conforme 010, manter intenção isolada e bloquear callbacks antigos.
5. Relogin mesma conta/instalação: oferecer reconciliação explícita, sem reutilizar terminal nem prompt espontâneo.
6. A→B: chave exclusiva de B, sem fallback global à escolha de A.
7. Opt-out: DISABLED + revogação, prevalece sobre intenção antiga.
8. Exclusão: apagar intenção local da conta; reinstall/nova identidade sem herança.
9. Storage corrupto/indisponível ou revogação pendente: falha fechada, feedback/retry explícito; sem ativação antes de resolver.

## Registros documentais

Finding: ID, domínio, revisão/evidência, risco/alcance, classificação, decisão/tarefa, responsável, prazo/reteste e estado. Evidência: comando/cenário, timestamp/fuso, ambiente, SHA/lockfile/artefato, exit code, resultado, link sanitizado e executor. Candidato: SHA, ID/hash do build, API pública e migrations esperadas, sem segredos.

Migration nova só se finding justificar, com design/migration revisados e ensaio isolado. Não há migration antecipadamente obrigatória pela 012.
