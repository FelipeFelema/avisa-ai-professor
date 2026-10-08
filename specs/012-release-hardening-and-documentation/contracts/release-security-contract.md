# Contrato de segurança e release

**Status**: hardening Fases 1–3 executado; revogação por sid aprovada e contratada. Demais fases seguem futuras.

## Interfaces a preservar

API `/api/v1`. Inventariar método+rota exatos de controllers/DTOs/OpenAPI em T004; não criar endpoints para itens da auditoria.

| Família | Autoridade e negativa |
| --- | --- |
| auth / refresh / logout | Expiração, sid, sessão ativa, rotação/replay/revogação; sem ADMIN público |
| users / perfil / senha / exclusão | Conta vigente/permissões; trocar userId não transfere identidade nem vaza dados |
| classrooms / join / leave | Role, membership/ownership; ID de vítima não concede mutação |
| announcements / announcementId | Leitura por membership; escrita por papel/autoria; deep link reconsulta servidor |
| invite-codes | ADMIN vigente revalidado; erros sem enumeração indevida |
| push reserve / activate / status / test | JWT+sid, capability/ownership/revisões 010; cliente não define destinatário arbitrário |
| push revoke | Capability/binding/revisão, sem JWT conforme 010 para logout offline; não concede leitura/ativação |

Cada negativa: status conforme contrato, corpo sanitizado, zero mutação/efeito na vítima. Sem stack, SQL, Prisma metadata, capability/tokens na resposta production. Mudança de status/shape/headers/DTO exige atualizar contrato/consumidor/testes.

## Push e UX

- Destinatário derivado no backend; ACTIVE isolado não prova elegibilidade.
- Payload mínimo 010/011; revisar título/nome da turma como conteúdo de lockscreen, sem PII desnecessária. IDs são referências, nunca credenciais.
- Expo token obtido transitoriamente no cliente e enviado autenticadamente; persistência/envio no backend, sem exibição/log/retorno em status. Bearer do provedor exclusivamente backend.
- Consentimento, permissão SO, intenção e binding distintos. US5 não muda capability/CAS/envelopes por padrão.
- Convite oferece “Ativar notificações”/“Agora não”; Perfil disponível; reativação de intenção recuperada exige confirmação explícita.
- Callback antigo não altera conta/generation vigente. UNKNOWN não é sucesso/retry cego; handoff não prova receipt no aparelho.

## Production

- NODE_ENV=production; configuração validada antes de servir. Sem default secreto/fallback API local no candidato Android.
- Swagger UI/JSON indisponíveis em production mesmo com API_DOCS_ENABLED=true, conforme restrição atual.
- Health sem internos; HTTPS/allowlist CORS coerentes; CORS não substitui authz nativo.
- Perfil/ambiente production separados de preview; diagnostics false e ausência de “Enviar notificação de teste” no artefato.
- Package/EAS/Firebase/FCM V1 coerentes; service account/EXPO_PUSH_ACCESS_TOKEN fora do app; Enhanced Push Security comprovada externamente sem valores secretos.
- Flags EXPO_PUSH_ENABLED/ANNOUNCEMENT_PUSH_ENABLED/ANNOUNCEMENT_PUSH_REMINDERS_ENABLED coerentes; kill switch preserva ledger.
- Rollback app compatível com schema; falha parcial exige diagnóstico/backup/procedimento revisado; resolve não desfaz SQL.

## Decisão final

`READY FOR ANDROID MVP RELEASE`: todos os gates aplicáveis comprovados na revisão/artefato final, findings classificados e nenhum blocker aberto. `BLOCKED`: risco ou prova ausente e próxima ação concreta. Durante planejamento: NOT EVALUATED, sem antecipar decisão.

Blockers: cross-account/cross-classroom, bypass role, secret exposto, sessão revogada utilizável, push incorreto, critical realmente explorável no runtime, migration obrigatória ausente, production quebrada, API inacessível, fluxo principal quebrado ou prova obrigatória ausente/failing. Outros riscos podem bloquear por impacto reproduzido, não apenas severidade nominal.

Cosmético menor/tooling-only documentados não bloqueiam automaticamente. Aceitação temporária só por decisão explícita do proprietário, sem ocultar blocker. Deploy, alteração de painéis/credenciais, build externo, commit/push/PR/publicação dependem de autorização pertinente da etapa.

## Hardening executado em Fases 1–3

JWT de access/refresh pin HS256; assinatura/expiração/sid/hash/rotação permanecem obrigatórios. Refresh mobile compartilha uma operação por generation, sem mudar payload de refresh. General parser: malformed JSON/body excessivo mantém status 400/413 e envelope statusCode/message/error, agora message INVALID_REQUEST; push mantém PUSH_INVALID_REQUEST. HTTP inesperado 500 permanece genérico e logging não serializa causa/request. RateLimitGuard mantém 10/min/IP por instância/guard com retenção limitada e teto 10000 buckets/fail-closed. GET /auth/session-revocation autenticado retorna {sid, capability} do sid atual; POST /auth/logout sem JWT valida capability opaca exclusiva de revogação e revoga somente esse sid, 204 idempotente/no-store. Invalidação access/refresh 401, outras sessões preservadas. Extensão OpenAPI em [session-revocation.openapi.json](session-revocation.openapi.json), inventário exato 29 operações. Capability deliberadamente emitida pela rota autenticada não concede leitura/renovação; nunca aparece em outros status/erros/logs. Metadata/fila no SecureStore somente sid/capability; no bearer de B no cleanup de A. Recuperação mount/conectividade/foreground/timer e ACK exato, sem esperar rede para finalizar logout local. [Decisão/limites](../evidence/logout-remediation-decision.md).
