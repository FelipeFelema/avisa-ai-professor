# Contract: Profile and Password Management

**Version**: API v1 | **Date**: 2026-10-02 | **Status**: implementado na Phase 4; fechamento transversal e manual pendente na Phase 5.

## Perfil existente

| Interface                     | Entrada/saída                                     | Regra                                                                        |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| GET `/api/v1/users/profile`   | Bearer JWT; perfil público                        | id, name, email, role e timestamps públicos; nunca password/hash.            |
| PATCH `/api/v1/users/profile` | Objeto fechado name? / email?; 200 perfil público | Pelo menos um campo, sem id/role/senha/extras; identidade pelo JWT validado. |

Nome mantém trim, caracteres atuais e 3–100; e-mail mantém trim/lowercase, formato, 255 e unicidade. No-op normalizado retorna perfil atual sem write/revogação. Nome-only preserva todas as sessões. E-mail alterado, com/sem nome, grava identidade e revoga outras sessões atomicamente, preservando o sid iniciador. 400 inválido/extras, 401 sessão inválida, 409 conflito; falhas não deixam atualização parcial.

Editar perfil contém apenas Nome/E-mail; papel permanece no Perfil principal. Enviar somente campos alterados. Antes do request, resumo anterior→novo e confirmação/cancelamento sem perda de valores. No-op informa “Nenhuma alteração para salvar.”; conflito é recuperável no E-mail. Solicitação pendente bloqueia duplicação e saída voluntária; sucesso atualiza AuthUser/cache público sem logout.

## Nova troca de senha

**Method/path**: POST `/api/v1/auth/change-password`.

**operationId**: `auth.changePassword`. **Security**: bearerAuth/JwtAuthGuard e RateLimitGuard existentes. Sem restrição adicional entre PARENT/PROFESSOR/ADMIN. Limitação atual por IP/processo continua, sem prometer limite distribuído.

**Request**: JSON objeto fechado, `additionalProperties: false`, três propriedades obrigatórias e `writeOnly: true`:

| Propriedade        | Regra                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| currentPassword    | String não vazia; verificar credencial armazenada; sem máximo novo que invalide senha legada. |
| newPassword        | String de 6–72 pontos de código Unicode; exatamente diferente de currentPassword.             |
| confirmNewPassword | String obrigatória, exatamente igual a newPassword.                                           |

Strings preservadas integralmente: sem trim, case folding, coerção, truncamento ou normalização Unicode. Espaços/caixa fazem parte da senha; espaços isolados não são apagados silenciosamente. Valores não textuais, null, arrays, ausência e campos extras são rejeitados antes de escrita. A confirmação é enviada para cumprir FR-016; este design prioriza esse MUST sobre a afirmação divergente nas entidades/assumptions da spec. Não persiste nem retorna confirmação.

**Authorization**: obter userId/sid exclusivamente da sessão validada e revalidá-la no commit. O corpo não aceita id/userId/role/sid. A sessão precisa pertencer à conta, estar não revogada e não expirada.

### Responses

| Status | Conteúdo/semântica                                                          | Efeito                                                                                                                    |
| ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 204    | Sem corpo                                                                   | Credencial atualizada, outras sessões revogadas, tokens atuais preservados.                                               |
| 400    | ErrorResponse, mensagem de validação sem valores ou mensagem estável abaixo | Sem escrita/revogação.                                                                                                    |
| 401    | ErrorResponse, sessão ausente/inválida/expirada/revogada                    | Fluxo existente de refresh/expiração; nunca usado para senha atual errada.                                                |
| 409    | ErrorResponse, `CREDENTIAL_CHANGED`                                         | Snapshot alterado durante operação; pedido não sobrescreve a mudança concorrente.                                         |
| 429    | ErrorResponse, limite de tentativas                                         | Nenhuma troca executada pelo pedido bloqueado.                                                                            |
| 500    | Erro genérico, sem detalhes internos/credenciais                            | Falha transacional retorna rollback integral. Falha de transporte após commit pode deixar resultado remoto indeterminado. |

Envelope existente: `statusCode`, `message` string/string[], `error` opcional. Não adicionar `code` global. Mensagens de domínio permitidas para mapeamento local:

- `CURRENT_PASSWORD_INVALID`: erro de Senha atual, “A senha atual está incorreta.”
- `PASSWORD_CONFIRMATION_MISMATCH`: erro de Confirmar nova senha.
- `PASSWORD_UNCHANGED`: erro de Nova senha, informar que precisa ser diferente.
- `CREDENTIAL_CHANGED`: feedback recuperável, solicitar revisão/reentrada; se sid perdeu validade, usar 401.

Mensagens da validação identificam apenas regra/campo, nunca valor, hash, dados de outra conta ou lista de sessões. Não usar 409 da senha no helper global que interpreta esse status como conflito de e-mail. Não incluir exemplos com tokens/senhas reais na documentação.

### Commit e validade das sessões

Verificação e derivação de hash ocorrem fora da transação. Transação usa lock por User, revalida credencial snapshot/sid e grava credencial + revokeOthers no mesmo tx. O sid iniciador e seu refreshTokenHash/expiresAt são preservados. Nenhum par JWT novo é emitido pela troca.

Após commit, próximo access/refresh das outras sessões retorna 401. Nome-only/no-op não provocam revogação. Em falha intermediária, restaurar hash, updatedAt e estado de sessões. Duas trocas concorrentes não podem ambas sobrescrever o mesmo snapshot; sessão de login com snapshot antigo não pode surgir depois da revogação, porque sua criação participa do mesmo protocolo de lock/rechecagem. Refresh concorrente não limpa revokedAt.

Novo armazenamento é scrypt v1 da senha inteira; login aceita bcrypt legado e scrypt. Trata-se de formato interno, não campo/contrato público. Cadastro/troca escrevem o novo formato; sem rehash automático em login, migration em massa ou mudança do hash de refresh.

## Contrato mobile

Perfil principal mantém Nome/E-mail/papel, tema e ações distintas Editar perfil, Alterar senha e Sair da conta. Rota `/profile/change-password` usa exatamente Senha atual, Nova senha e Confirmar nova senha, entrada protegida, labels/erros acessíveis, password/newPassword e sem auto-capitalização/correção. Nenhum valor de senha em modal, navegação ou analytics.

Validação local repete regras do servidor; confirmação/nova/current comparadas exatamente. Hook imperativo não usa QueryClient/useMutation. Serviço extrai somente status/mensagens permitidos e descarta configuração/body do erro HTTP antes de devolvê-lo; estado guarda apenas pending/feedback/campo seguro. Dados transitórios existem somente durante formulário/transporte/verificação.

Ref imediata impede envio duplicado; UI anuncia processamento e desabilita campos/envio/saídas voluntárias até o resultado. Guarda abrange Voltar, Android back e gesto/remoção da rota, sem impedir redirecionamento de autenticação. Bloqueio opt-in mantém defaults das outras telas. Não alegar que cancelamento/timeout desfez commit remoto, nem repetir automaticamente troca indeterminada.

Sucesso limpa campos, apresenta confirmação segura e permite retorno ao Perfil sem logout. Erro recuperável permite corrigir; saída/blur/expiração limpa os três valores. Cada nova entrada começa vazia. Formulários acomodam teclado/scroll, texto ampliado, largura estreita e palette atual em Claro/Escuro.

## Sincronização e comprovação

DTO e responses registrados no Swagger e sincronizados em `specs/001-app-quality-readiness/contracts/openapi.json`, incluindo `auth.changePassword` e `ChangePasswordRequest`. A suite OpenAPI compara os inventários completos e verifica o corpo fechado/write-only e o 204 vazio.

Comprovar com configuração de produção, PostgreSQL isolado e dois sid: fronteira/tipos, roles, tokens preservados/revogados, login novo/antigo, rollback intermediário, races, respostas/logs/cache sem credenciais. Detalhes de execução em [quickstart.md](../quickstart.md).
