# Push API Contract

**Date**: 2026-10-05 | **Base**: `/api/v1` | **Roles**: PARENT, PROFESSOR, ADMIN

Contrato proposto, aditivo. Na implementação sincronizar decorators/runtime e `specs/001-app-quality-readiness/contracts/openapi.json`, incluindo security schemes, headers, DTOs, respostas e testes negativos. Nenhuma rota permite listagem de dispositivos ou selecionar outro destinatário.

## Authentication and privacy

- Reserva, estado, ativação e teste: JWT access válido via JwtAuthGuard, mais headers `X-Push-Installation` (UUID v4) e `X-Push-Capability` (base64url canônico de exatamente 32 bytes, 43 caracteres). Conta/sid vêm de AuthUser e são revalidados no banco. Não aceitar userId, sid, role ou bearer token no body.
- Headers são validados como inputs, com limites de comprimento antes de decode. Segredo nunca aparece em Swagger examples, logs, mensagens ou URLs. Não adicionar identifiers a path/query. Hash SHA-256 armazenado; comparação constante; capability errada/missing retorna erro genérico sem confirmar existência.
- Só reserva autenticada pode criar Installation com id/segredo novos. Reutilizar instalação requer segredo atual; não substituir por outro recebido.
- DELETE exige capability e bindingId/lifecycleVersion; não exige JWT, pois precisa funcionar após logout. Essa credencial concede somente revogação do vínculo informado, sem consulta/envio/registro ou escolha de conta.
- `Cache-Control: no-store` em respostas e falhas; suprimir logging de headers/body, error causes e resposta bruta do Expo/SQL. IDs privados completos não entram em observabilidade.
- DTOs com whitelist+forbidNonWhitelisted e schemas móveis Zod. Limitar body a 2 KiB; Content-Type JSON; nenhuma propriedade extra, array ou query de destino. RateLimitGuard por IP limita abuso; cooldown do teste é persistido por instalação.

## Operations

| Método / rota fixa                | Body            | Resultado                                          |
| --------------------------------- | --------------- | -------------------------------------------------- |
| POST `/push/installation/reserve` | `{}`            | 200 BindingView; reserva inelegível idempotente    |
| GET `/push/installation`          | nenhum          | 200 InstallationView sem token/identidade de conta |
| PUT `/push/installation`          | ActivateRequest | 200 BindingView; ativa/rotaciona com CAS           |
| DELETE `/push/installation`       | RevokeRequest   | 204 vazio; revogação terminal idempotente          |
| POST `/push/installation/test`    | `{}`            | 202 TestAccepted somente com ticket ok             |

### POST reserve

Executar somente depois de ação explícita, permissão concedida, ambiente configurado e token real obtido localmente; uma reserva nunca contém token nem é elegível. Repetição para mesma instalação/conta/sid retorna binding RESERVED/ACTIVE existente. Novo vínculo incrementa lifecycleVersion e recebe novo bindingId server-side. Vínculo anterior RESERVED/INVALID/REVOKED ou sessão inelegível pode ser neutralizado pela própria capability ao reservar; ACTIVE elegível de outra conta/sid exige primeiro DELETE, não transferência silenciosa.

BindingView é `{ bindingId: uuid, lifecycleVersion: integer, tokenRevision: integer, state: 'RESERVED' | 'ACTIVE' }`. Não devolver token, instalação completa, userId ou sid. Após receber, mobile salva bindingId/lifecycleVersion antes do PUT. Resposta perdida deixa apenas reserva inelegível; retry encontra mesma reserva enquanto ela for corrente e RESERVED/ACTIVE para aquela conta/sessão. Após revogação terminal, novo POST pode criar novo lifecycle inelegível; body vazio não distingue retry antigo de nova intenção. O coordenador descarta respostas por geração e não ativa reservas de intenção encerrada. Se a gravação local falha, não ativar.

### GET state

InstallationView: `{ available: boolean, state: 'ABSENT' | 'RESERVED' | 'ACTIVE' | 'INACTIVE', binding: BindingView | null, reason: null | 'CONFIGURATION_UNAVAILABLE' | 'REGISTRATION_INACTIVE' | 'TOKEN_INVALID', testAvailableAt: date-time | null }`.

Vínculo só aparece se pertence ao mesmo user/sid autenticados. Outra conta/sessão retorna INACTIVE/null sem seus IDs, tokens ou razões específicas. Ausência de registro com capability sintaticamente válida retorna ABSENT; não cria Installation. Permissão do SO não é inferida pelo servidor e não consta deste DTO. ACTIVE exige predicado de elegibilidade; configuração ausente dá available=false. Sem configuração, GET continua seguro e ações de envio/ativação retornam indisponível.

### PUT activate/rotate

ActivateRequest: `{ bindingId: uuid, lifecycleVersion: integer, expectedTokenRevision: integer, platform: 'ANDROID' | 'IOS', expoToken: string, permission: 'GRANTED' }`.

- IDs UUID v4; lifecycleVersion 1..2147483647; revision 0..2147483647.
- Token sem trim silencioso, 1..512 caracteres; formato `ExpoPushToken[...]` ou `ExponentPushToken[...]`, conteúdo interno ASCII alfanumérico/underscore/hífen de 8..256 caracteres, sem espaços/controles. Aceitar somente provider Expo; nunca APNs/FCM cru. Limites são decisão deste contrato, não prova de existência do token.
- permission é declaração validada estruturalmente; API não comprova permissão remota do SO ou posse universal de token desconhecido. Mobile usa SDK real. Conforme a SC-007 delimitada pelo proprietário em 2026-10-05, proteger vínculos já registrados no fluxo controlado, sem desafio por notificação; limite de confiança e rationale em research R3.
- `expectedTokenRevision` é compare-and-swap exato: uma troca de token ou plataforma incrementa a revisão em um; repetir o token/plataforma já aceitos é no-op idempotente, inclusive a repetição da mesma atualização após resposta perdida. Revisões antigas não alteram o vínculo.
- Um token que ainda pertence a um vínculo ACTIVE elegível retorna conflito sem modificar a vítima. Colisão com vínculo inelegível é liberada atomicamente sob locks ordenados e sessão antiga reavaliada. Estados REVOKED/INVALID são terminais para aquele binding e exigem novo POST reserve com `bindingId` e `lifecycleVersion` novos.
- ACTIVE só é elegível com sessão vigente e ciclo de instalação corrente; expiração/revogação de sessão invalida elegibilidade mesmo antes da limpeza periódica. Limpeza remove vínculos inelegíveis/stale e instalações sem filhos após o prazo definido no modelo.
- Binding pertence à instalação+user+sid e seu lifecycleVersion coincide com o corrente da Installation. REVOKED/INVALID não reabrem; pedir nova reserva. Guard revalidado sob locks.
- Resultado já igual ao pedido ACTIVE é no-op idempotente, inclusive retry com revisão anterior correspondente ao estado final; token/plataforma diferentes exigem CAS exato. Revisão divergente retorna 409, mobile consulta estado e obtém token atual antes de nova intenção.
- Colisão com token de outra instalação elegível retorna 409 PUSH_TOKEN_CONFLICT sem revelar proprietário e sem alterar vítima. Colisão inelegível é liberada atomicamente sob locks ordenados, conservando a unicidade. Nenhum envio ao provedor nesta operação.
- Troca efetiva incrementa tokenRevision, substitui token/fingerprint e torna versão antiga inelegível.

### DELETE revoke

RevokeRequest: `{ bindingId: uuid, lifecycleVersion: integer, reason: 'USER_DISABLED' | 'LOGOUT' | 'PERMISSION_REVOKED' }`.

Capability é conferida contra Installation; bindingId deve pertencer àquela instalação e version. Estado ACTIVE/RESERVED/INVALID vira REVOKED terminal; token é removido. Repetição, vínculo já removido por cascade ou Installation removida pelo cleanup retornam 204 sem criar/alterar outra relação. Prova inválida contra instalação existente dá 403 genérico; binding alheio não é alterado e retorna 204 sem revelar sua existência. Pendência antiga nunca afeta novo lifecycle/binding. Requisição sem bearer não acessa dados pessoais nem autoriza nova ativação.

A falta de registro/capability conhecida não habilita descoberta: 204 vazio é um ACK de no-op, não informação sobre outra conta. Mobile usa cliente HTTP separado sem interceptors JWT/refresh, retry limitado por conectividade/foreground, nenhum JWT antigo salvo. Remover pendência só após 204.

### POST test

Body estritamente vazio. Destino resolvido pelo Installation corrente + JWT user/sid + capability; nenhum binding/token/userId/query de destino aceito. Rejeitar ausente/inativo/configuração indisponível antes do envio. Revalidar permissões no SDK antes da chamada; servidor revalida elegibilidade, configuração, revisão e janela.

Reserva DB de TestAttempt e cooldown antes de HTTP; dois processos não podem despachar duas intenções simultâneas. Persistir nextTestAvailableAt=startedAt+5 s de timeout+30 s; após aceite conhecido atualizar atomicamente para max(janela atual, acceptedAt+30 s). UNKNOWN/crash preservam janela conservadora. O limite é entre aceites, não apenas entre inícios. Lease envio <=15 s; vence para UNKNOWN sem resend. Uma chamada externa com timeout 5 s; noAuthReplay e retry=false no cliente.

202: `{ attemptId: uuid, status: 'ACCEPTED', acceptedAt: date-time, nextTestAvailableAt: date-time }`. Nenhum ticket ou token. Mensagem UI: “Solicitação aceita para envio. O recebimento depende do dispositivo.”

Timeout/transporte/resposta perdida: falha sanitizada PUSH_TEST_OUTCOME_UNKNOWN, sem alegar ausência de envio e sem reexecutar automaticamente. Provider ticket error conhecido retorna falha normalizada e tratamento de token quando permanente. Não há GET de histórico/attempts; receipt é operacional interno.

## Errors

Conservar envelope Nest existente `{ statusCode, message, error }`, com message somente código seguro ou lista de mensagens de validação que nunca interpola o valor recebido. Mobile traduz códigos fixos em português; não imprime raw AxiosError/config/request.

| Status | Código/uso                                                                                |
| ------ | ----------------------------------------------------------------------------------------- |
| 400    | estrutura/headers/token/reason inválidos ou campos inesperados, sem eco de inputs         |
| 401    | JWT/sessão ausente, expirada ou revogada em operação autenticada                          |
| 403    | PUSH_INSTALLATION_PROOF_INVALID, sem distinguir conta/existência                          |
| 409    | PUSH_BINDING_INACTIVE, PUSH_BINDING_CONFLICT, PUSH_REVISION_CONFLICT, PUSH_TOKEN_CONFLICT |
| 429    | PUSH_TEST_RATE_LIMITED ou limite de abuso; Retry-After em segundos sem ID privado         |
| 503    | PUSH_UNAVAILABLE, PUSH_PROVIDER_UNAVAILABLE, PUSH_TEST_OUTCOME_UNKNOWN                    |
| 500    | falha interna sanitizada; sem SQL/token/cause original                                    |

## Required contract scenarios

A matriz de SC-007 usa vínculos de usuário/sessão/instalação/token previamente registrados pelo fluxo controlado da aplicação e verifica zero-envios e zero alterações na vítima em tentativas não autorizadas. Prova universal de posse de token desconhecido e envio de desafio não fazem parte desta aceitação. Transições legítimas de lifecycle continuam sujeitas às regras de autenticação/capability e elegibilidade acima.

Cobrir todas as roles; JWT/capability errados; sessão válida no guard mas revogada antes de tx; propriedades userId/sid/token/destination extras; token malformado e limites; IDs alheios; cascata/revocation; colisão ativa e inelegível; reserva idempotente; activation lost response; rotação versus DELETE; terminal revocation; cooldown multiprocesso; no-store em sucesso/erro; erro sem sentinela de segredo. Validação negativa usa tokens/IDs sintéticos, nunca exemplos versionados com identificadores privados reais.
