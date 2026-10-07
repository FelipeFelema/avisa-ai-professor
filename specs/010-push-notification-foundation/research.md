# Research: Push Notification Foundation

**Date**: 2026-10-05 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

Pesquisa somente leitura do código/fontes oficiais. Não foram enviados pushes, instaladas dependências, executadas migrations ou validadas credenciais externas.

## R1. Provedor e configuração

**Decision**: Expo Push Service único, Notifications no mobile e adaptador backend com fetch nativo, endpoints HTTPS fixos, timeout 5 s e erros normalizados. Habilitar enhanced push security; `EXPO_PUSH_ACCESS_TOKEN` somente no servidor. Desenvolvimento/CI sem credenciais usam indisponível ou adapter mock, nunca sucesso fictício.

**Rationale**: Notifications/Device/Constants já estão instalados; esta feature envia somente um destino por teste. O app.json atual não contém plugin Notifications, projectId, package/bundleIdentifier ou configuração FCM/APNs. Pacotes presentes não comprovam ambiente pronto.

**Alternatives considered**: FCM/APNs diretos duplicariam integração; múltiplos provedores/broadcast são excluídos; SDK backend completo não é necessário neste volume.

**Sources**: [Setup Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/), [envio Expo](https://docs.expo.dev/push-notifications/sending-notifications/).

## R2. Consentimento e rotação

**Decision**: ler permissão em reconciliação; solicitar somente no botão Ativar. Android cria canal `push-test` antes de permissão/token. iOS mapeia status específicos inclusive provisional/ephemeral, sem prometer alerta sonoro. Listener de token nativo dispara nova obtenção de Expo Push Token com projectId, nunca envia token APNs/FCM ao endpoint Expo.

**Rationale**: permissão SO e opt-in app são distintos. Perfil/restauração/foreground não pedem permissão nem reativam opt-out. Gate de plataforma android/ios + Device.isDevice + configuração/build respeita a spec, que classifica simuladores indisponíveis; isso não é limitação universal do Expo.

**Alternatives considered**: prompt no bootstrap; Device.isDevice sozinho (web pode retornar true); toda autorização iOS tratada como alerta garantido; token nativo no Expo endpoint.

**Sources**: [Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [Device](https://docs.expo.dev/versions/latest/sdk/device/).

## R3. Ownership e posse do token

**Decision**: JWT determina User/AuthSession. UUID de instalação não autentica sozinho: segredo criptográfico de 32 bytes em header HTTPS, SHA-256 no servidor e comparação constante. Reserva/estado/ativação/teste exigem JWT + capability. Colisão com outra instalação elegível falha antes de envio ou mutação no registro protegido. O teste nunca recebe token/destinatário.

**Rationale**: JwtStrategy já consulta sessão e retorna id/sid atuais. Revalidar dentro da transação; saber UUID ou enviar userId/sid não concede autoridade. Não é necessário expor sid no mobile para selecionar sessão.

**Boundary / SC-007 — decisão aprovada em 2026-10-05**: o proprietário delimitou a proteção aos vínculos de usuário, sessão, instalação e token já registrados pelo fluxo controlado da aplicação. A matriz negativa cobre usuário/sessão manipulados, instalação da vítima sem segredo, binding alheio, token de outra instalação protegida e destinatários extras no teste: tentativas não autorizadas produzem zero envios e zero alterações na vítima. A garantia universal de posse de token desconhecido foi explicitamente excluída do critério; a SC-007 e a seção Clarifications da spec registram essa decisão. Clarificação resolvida e gate de planejamento liberado, sem alegar testes executados.

**Rationale da delimitação**: Expo Push Token é um endereço confidencial fornecido pelo cliente, não constitui atestação de posse do dispositivo. Obter o token pelo SDK não prova remotamente ao servidor que o cliente controla aquele dispositivo. A origem de token desconhecido, inclusive após remoção/liberação legítima de vínculo anterior, não é comprovada universalmente neste protocolo. A aplicação mantém autenticação, capability, ownership, rejeição de colisões e transições controladas dos vínculos registrados. Não introduzir desafio de posse por notificação: ele produziria um envio antes da ativação, contrariando o zero-envios e acrescentando complexidade fora da decisão aprovada.

**Alternatives considered**: só UUID; transferir vínculo ativo por token/userId recebido; dizer que obter token pelo SDK prova remotamente sua posse. Desafio neutro de posse e garantia universal de origem de token desconhecido foram rejeitados explicitamente pelo proprietário em 2026-10-05. Não haverá mensagem de verificação nem exceção ao zero-envios para tentativas não autorizadas contra vínculos protegidos.

**Sources**: `backend/src/auth/strategies/jwt.strategy.ts`, `common/types/auth-user.type.ts`; [API Expo](https://docs.expo.dev/push-notifications/sending-notifications/).

## R4. Reserva e logout offline

**Decision**: reservar binding RESERVED inelegível/sem token; salvar bindingId/lifecycleVersion antes de ativar. Capability da instalação revoga somente esse binding sem JWT. Revogação terminal inclui RESERVED: ativação atrasada não reabre. Outro opt-in exige nova reserva. tokenRevision é separado de lifecycleVersion.

**Rationale**: logout atual só limpa estado local. Depois dele não há JWT para retry; conservá-lo ampliaria exposição. Reserva com resposta perdida é inofensiva; ativação com resposta perdida já tem referência de limpeza local. Separar versões protege logout concorrente com rotação.

Pendência contém somente capability/referência/reason, sem JWT/token/userId/senha. Salvar antes de limpar autenticação, invalidar geração, cancelar operações e tentar DELETE bounded best-effort. Storage falho não impede logout/cache cleanup; informa recuperação de push, bloqueia nova ativação automática e não afirma desativação confirmada. Crash sem persistência/rede pode deixar registro elegível até sessão expirar/revogar. Logout offline não confirma estado server-side imediatamente.

**Alternatives considered**: DELETE com JWT já apagado; guardar refresh token; capability ligada à revisão de token; ativação sem reserva; replay automático com outra conta.

**Evidence**: `mobile/src/providers/AuthProvider.tsx`, `mobile/src/lib/api.ts`, `mobile/src/lib/session-generation.ts`.

## R5. Instalação, backup e reinstalação

**Decision**: adicionar expo-crypto para UUID/segredo seguro; SecureStore iOS com WHEN_UNLOCKED_THIS_DEVICE_ONLY; marcador AsyncStorage não secreto excluído de backup. Plugin próprio estende exclusões Android cloud/device-transfer sem remover as de SecureStore. iOS fixa RCTAsyncStorageExcludeFromBackup=true, mecanismo confirmado no código instalado em `mobile/node_modules/@react-native-async-storage/async-storage/ios/RNCAsyncStorage.mm`.

**Rationale**: SecureStore iOS pode sobreviver uninstall, e Expo token iOS pode permanecer igual. Ausência confirmada do marcador reinicia só identidade/opt-in de push; erro de leitura entra em recuperação e não prova reinstall. Não alterar restauração geral de autenticação ou preferência de tema. A exclusão do arquivo AsyncStorage afeta seu backup completo, pois não há regra de backup por chave; explicitar isso na documentação operacional.

Reinstall cria nova identidade/opt-in false. Se token reaparece em instalação diferente e vínculo anterior segue elegível, retornar conflito seguro até revogação/inelegibilidade do anterior; não tomar vínculo por token. Isso pode atrasar ativação após reinstalação.

**Alternatives considered**: token como identidade; hardware/advertising IDs; SecureStore sozinho; cache como marcador; allowBackup=false sozinho; Math.random.

**Sources**: [Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [FAQ push](https://docs.expo.dev/push-notifications/faq/), [Android Auto Backup](https://developer.android.com/identity/data/autobackup).

## R6. Dados, sessões e locks

**Decision**: Installation ancora segredo/vínculo corrente/cooldown; Registration guarda ownership/lifecycle/token/revisão; TestAttempt guarda ticket/receipt. Cascatas User/AuthSession removem registros/tentativas. Elegibilidade faz join de sessão ativa sempre, mesmo se estado salvo é ACTIVE. Installation sem associações conserva só capability até cleanup operacional.

**Rationale**: sessão já tem expiresAt/revokedAt; senha/e-mail revogam outras sessões; refresh conserva sid. Cascata dispensa alterar transação de exclusão ou criar dependência circular entre módulos.

**Concurrency decision**: operações autenticadas seguem User → AuthSession → instalações ordenadas por UUID → Registration. Revogação/receipt seguem instalações ordenadas → Registration e nunca pedem User/AuthSession depois. Ao liberar token de vínculo inelegível, incluir sua instalação na ordem antes de travar registros; reavaliar sessão antiga e unicidade. Não transferir vínculo elegível. Uniqueness fecha corrida residual; erro vira conflito sanitizado. HTTP fica fora das transações. Exclusão mantém advisory gate → User → Classrooms → deletes/cascatas existentes. Tests PostgreSQL devem verificar cascatas e locks concorrentes, sem ciclos.

**Alternatives considered**: par userId/token; locks variáveis; HTTP sob lock; modificar Auth/Users para importar Push; confiar só no estado ACTIVE.

**Evidence**: `backend/prisma/schema.prisma`, `auth/auth-session.service.ts`, `users/users.service.ts`, `users/account-deletion.service.ts`.

## R7. Envio, cooldown e receipts

**Decision**: janela 30 s/lease reservadas atomicamente no banco. Uma chamada externa por tentativa, fora de transação, com rechecagem de elegibilidade antes do despacho. POST mobile tem noAuthReplay e retry=false. Timeout/crash depois do despacho → UNKNOWN, sem resend. Ticket ok → ACCEPTED; receipt ok → PROVIDER_HANDOFF; nenhum significa exibição.

**Rationale**: RateLimitGuard atual por IP/memória não cobre múltiplos processos/restarts. Antes do despacho, reservar nextTestAvailableAt=startedAt+timeout externo+30 s (35 s neste desenho); após ticket aceito, atualizar atomicamente para max(janela atual, acceptedAt+30 s). UNKNOWN mantém janela conservadora, inclusive após crash. Medir cooldown só desde início poderia permitir dois aceites separados por menos de 30 s.

Worker operacional inicia com backend, reivindica receipts por lease persistida, primeiro check ~15 min, backoff de leitura 1/2/5/15 min e deadline 24 h; recupera após restart. Nunca envia notificações ou calcula agenda de comunicado. DeviceNotRegistered invalida apenas registro/revisão/fingerprint enviados. Transitório/configuração mantém registro. Deadline sem receipt → UNKNOWN. Remover tentativas terminais após 7 dias, sem histórico público.

**Alternatives considered**: consultar só quando app retorna; timer não persistido; cron de comunicados; ticket/receipt como delivered; retry cego de envio.

**Sources**: [tickets, receipts e erros Expo](https://docs.expo.dev/push-notifications/sending-notifications/).

## R8. UI e evidência

**Decision**: mensagem portuguesa fixa neutra; handler foreground rápido usa banner/lista do SO, sem toast paralelo. Listener atualiza feedback da tentativa conhecida e deduplica; toque abre app/área de notificações, sem recurso de negócio. SDK nativo isolado da web.

**Rationale**: aceite externo/receipt/exibição são fatos separados. Walkthrough só do proprietário é válido; sem campanhas especializadas, AT ou participantes. Configuração ausente deve produzir indisponível e nunca prova fictícia.

**Alternatives considered**: banner/toast duplicados; tarefa headless; deep links escolares; campanha física obrigatória.

**Sources**: [Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) e constituição 2.1.0.
