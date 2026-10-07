# Mobile and Provider Contract

**Date**: 2026-10-05 | **Scope**: consentimento, lifecycle e teste neutro

## Mobile states and actions

Entrada “Notificações” em Perfil para todas as roles; rota `/profile/notifications` com SecondaryScreen, Button, ScreenState e tokens de tema. Não criar item ADMIN especial. Estado local é composição de permissão SO, opt-in do app, configuração/suporte, vínculo server-side e pendência de revogação.

| Estado                   | Feedback português / ação                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| loading                  | “Verificando notificações”; ações bloqueadas temporariamente                                           |
| not-requested            | explicar finalidade; “Ativar notificações”; sem prompt ao abrir                                        |
| denied                   | “Permissão de notificações recusada”; orientação/botão Abrir configurações                             |
| unavailable              | “Notificações não estão disponíveis neste ambiente”; app segue funcionando                             |
| authorized, app disabled | “Notificações desativadas neste aplicativo”; Ativar sem repetir prompt SO                              |
| registering              | “Ativando notificações”; single-flight, referência salva antes de PUT                                  |
| active                   | “Notificações ativas neste dispositivo”; Desativar e Enviar teste                                      |
| error/recovery           | falha acionável; Tentar novamente; não inventar token/sucesso                                          |
| pending cleanup          | “A desativação será concluída quando houver conexão”; novo registro/teste bloqueados até reconciliação |

IDs/tokens não aparecem na tela. Loading, disabled, labels/roles e texto de estado não dependem só de cor. Layout aceita texto ampliado/wrapping, temas Claro/Escuro, targets existentes; testes semânticos automatizados. Não exigir AT/campanhas especializadas.

## Activation sequence

1. Usuário toca Ativar; confirmar plataforma android/ios, Device.isDevice, build independente compatível, projectId e configuração server-side. Estado indisponível não chama prompt nem obtém token fictício.
2. Criar canal Android `push-test`, consultar permissão, solicitar somente pela intenção explícita se cabível; recusa definitiva orienta configurações. iOS status autorizado/provisional/ephemeral mapeado com feedback de limites.
3. Obter Expo token real via getExpoPushTokenAsync(projectId). Network/config error mantém erro recuperável, sem reserva/registro ativo.
4. Escoar pendência; criar/ler identidade privada e marcador; POST reserve JWT+capability.
5. Persistir bindingId/lifecycleVersion no SecureStore. Falha de escrita não ativa; tentar revogar reserva best-effort.
6. PUT com token transitório e revisão; estado ativo somente após resultado/reconciliação confirmados. Resposta incerta consulta estado, sem inventar confirmação.

Consentimento explícito precede registro inicial. Reconciliação após login/restauração/foreground só registra se há opt-in válido da instalação e permissão já concedida; nunca prompt automático. Logout/troca de conta resetam opt-in para false, exigindo nova escolha para conta nova. Opt-out false prevalece mesmo se SO granted. Ler permissão novamente antes de testar.

## Lifecycle coordinator

Um coordenador testável, compartilhado por AuthProvider e PushProvider, serializa intenções; não depender de montagem da tela para segurança. PushProvider observa autenticação/foreground/token listener; AuthProvider inicia cleanup antes de limpar sessão. Não implementar toda regra dentro de JSX.

- Capturar geração e cancelar/descartar efeitos assíncronos após mudança; guards em gravações de token/binding. Callbacks/listeners antigos não vinculam instalação a conta nova.
- Logout persiste pendência antes de limpar referências; invalida geração/cancela reconciliação e executa limpeza atual. DELETE capability-only tem timeout bounded <=5 s e pode ocorrer em paralelo à limpeza local. Nunca condicionar logout à rede/provedor.
- Storage falho: opt-in em memória false, best-effort DELETE, recovery explícita; cache/JWT cleanup continua. Não garantir persistência que falhou.
- Nova sessão/reconexão/foreground escoa pendência com cliente sem JWT; não usar replay de requisição da conta anterior nem armazenar bearer para limpeza. Após 204 remover somente pendência correspondente, preservando qualquer intenção mais nova.
- Opt-out/permission denied detectado revoga binding terminal, mantendo estado SO separado. Nova ativação requer reserve novo.
- Listener de token nativo obtém novo Expo token; CAS e single-flight evitam overwrite fora de ordem. Ler token atual novamente ao resolver 409.
- Refresh conserva sid no backend; não criar vínculo novo só por trocar access token. Sessão revogada/expirada ou conta removida é inelegível no envio independentemente do cliente.
- Reinstall com marcador ausente confirmado gera identidade nova/opt-in false e apaga somente storage de push herdado. Falha de leitura significa recovery. Colisão com instalação ainda elegível é erro seguro, sem apropriação.

## Native/build configuration

Substituir app.json por app.config.ts preservando campos atuais, acrescentando plugin expo-notifications e plugin de backup, package Android/bundleIdentifier iOS e extra.eas.projectId. Config ausente mantém fallback/export e informa unavailable em runtime; não inserir credenciais reais no bundle.

| Configuração proposta              | Onde / regra                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| EXPO_PUBLIC_EAS_PROJECT_ID         | UUID de projeto público da build; source Constants.expoConfig.extra.eas.projectId ou Constants.easConfig.projectId |
| EXPO_PUBLIC_ANDROID_APPLICATION_ID | identidade pública nativa; necessária à build push Android                                                         |
| EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER  | identidade pública nativa; necessária à build push iOS                                                             |
| GOOGLE_SERVICES_FILE               | arquivo seguro fornecido pelo ambiente de build; referência em app.config, conteúdo fora do Git                    |
| EXPO_PUSH_ENABLED                  | backend boolean, default false                                                                                     |
| EXPO_PUSH_ACCESS_TOKEN             | segredo backend de enhanced security; obrigatório quando enabled                                                   |

Provisionar FCM V1/APNs pelo projeto/credentials EAS correspondentes à app identity. Não colocar access token backend, APNs key ou service-account JSON em EXPO_PUBLIC. Build de distribuição interna/preview independente é suficiente; não adicionar expo-dev-client sem necessidade. Propor `mobile/eas.json` com profile preview interno, sem credentials, para reproduzir a build; operação EAS/build não ocorre neste planejamento.

Plugin de backup mantém exclusão SecureStore e exclui database AsyncStorage (`RKStorage`, confirmar nome no pacote instalado) em fullBackupContent e em cloud-backup/device-transfer de dataExtractionRules Android. iOS fixa RCTAsyncStorageExcludeFromBackup=true. Exclusões afetam arquivo inteiro, inclusive backup de preferência de tema, mas não alteram persistência/estado do tema durante uso normal. Testes de plugin/config verificam essas regras sem campanha física obrigatória. Preservar configs de backups existentes ao mesclar.

Adicionar expo-crypto pelo resolvedor Expo e lockfile. UUID/segredo gerados por API criptográfica; não usar fallback Math.random, inclusive em debugger. Web não inicializa identidade, SDK, handlers ou callbacks de push nativo.

## Provider adapter

Endpoints fixos `https://exp.host/--/api/v2/push/send` e `https://exp.host/--/api/v2/push/getReceipts`; cliente não fornece URL. Authorization backend para enhanced security, body privado, TLS, timeout 5 s, resposta parseada com allowlist e limites. Não propagar message/errors brutos, que podem conter token.

Payload teste: título “Teste de notificações”; corpo “Este é um teste de notificações do aplicativo.”; data somente `{ type: 'push-test', attemptId: uuid }`; sound default, canal push-test Android, TTL 60 s. Sem usuário/role/email/installationId/classroom/announcement/deep link. attemptId opaco não identifica instalação e não é usado como credencial. Uma mensagem/um destino, <4 KiB.

| Resultado externo                                      | Efeito                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| ticket ok + id                                         | ACCEPTED; persistir ticket privado, consultar receipt                                                          |
| receipt ok                                             | PROVIDER_HANDOFF; nunca “entregue”                                                                             |
| DeviceNotRegistered ticket/receipt                     | INVALID apenas binding/revision/fingerprint enviados; token=null                                               |
| MessageRateExceeded, HTTP 429/5xx, rede                | erro transitório; conservar registro; retry apenas leitura de receipt, envio exige nova intenção após cooldown |
| MessageTooBig, MismatchSenderId, InvalidCredentials    | falha payload/configuração; manter registro, código seguro, orientar configuração operacional                  |
| timeout/resposta inválida/receipt ausente até deadline | UNKNOWN; não reexecutar envio nem afirmar falha de entrega                                                     |

Worker inicia no lifecycle backend, tick operacional <=60 s, lease DB/lotes limitados, primeiro check ~15 min, deadline 24 h, backoff 1/2/5/15 min. Shutdown cancela timer/HTTP; tests não ficam com handles abertos. Restart retoma leituras; nunca repete POST send. Cleanup remove attempts terminais e instalações sem filhos após 7 dias. Esse consumidor não agenda notificações de negócio nem envia mensagens futuras.

## Presentation and evidence

Handler foreground responde rapidamente (<3 s), banner/lista do SO como apresentação única, sem toast duplicado. Listener atualiza tentativa atual e deduplica feedback por attemptId, sem log de payload bruto. Ao tocar abre app/área de notificações; nenhuma rota de recurso escolar. Segundo plano usa SO, sem headless task ou local scheduled notification substituindo push real.

Ticket aceito, receipt handoff e exibição observada devem ter registros separados. Walkthrough pode registrar PASS (user-reported) para recebimento efetivamente relatado pelo proprietário. Se só há ticket, registrar aceite e recebimento não observado, nunca PASS fictício de exibição. Mocks comprovam estados/protocolo; não comprovam credenciais ou entrega real.

Fontes oficiais: [Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [Setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [envio/receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Auto Backup Android](https://developer.android.com/identity/data/autobackup).
