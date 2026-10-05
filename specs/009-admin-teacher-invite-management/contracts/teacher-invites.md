# Contract: Teacher Invite Generation and Public Registration

**Date**: 2026-10-04 | **Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

Contrato implementado pela Spec 009. Os resultados automatizados e as limitações de evidência manual/nativa estão registrados em [validation.md](../validation.md), [backend-validation.md](../backend-validation.md) e [mobile-validation.md](../mobile-validation.md).

## POST /api/v1/invite-codes

**operationId**: `inviteCodes.create` (preservado).

Requer bearer JWT, sessão ativa e papel ADMIN atual no servidor. Revalidar identidade/sid/papel dentro da transação da emissão; não confiar no papel enviado pelo cliente ou apenas no JWT. Não expor metadados administrativos a requisição não autorizada.

### Request

`Content-Type: application/json`; objeto obrigatório, fechado, exatamente:

```json
{
  "role": "PROFESSOR"
}
```

`role` é string literal obrigatória, não uma escolha oferecida pela interface. Missing/null/número/array/objeto/papel diferente, body não objeto e propriedades extras retornam 400. `expiresInDays`, `code`, `isActive`, campos de data, autoria ou destinatário são proibidos. Nunca ignorar extra nem converter ADMIN/PARENT em PROFESSOR. O serviço também fixa papel/duração para impedir bypass interno.

### Response 201

`Cache-Control: no-store`; retorno JSON com campos já existentes:

| Campo     | Tipo / regra                                                                          |
| --------- | ------------------------------------------------------------------------------------- |
| id        | UUID do registro criado.                                                              |
| code      | Segredo novo `PROF-` mais 32 hex maiúsculos; apenas para exibição/cópia transitórias. |
| role      | Literal PROFESSOR.                                                                    |
| isActive  | Literal true no momento da geração.                                                   |
| createdAt | ISO 8601 UTC, precisão milissegundos.                                                 |
| expiresAt | ISO 8601 UTC; exatamente createdAt + 604800000 ms.                                    |
| updatedAt | ISO 8601 UTC; metadata existente preservada.                                          |

Nenhum código operacional aparece em exemplo de documentação; Swagger usa `PROF-EXAMPLE`, explicitamente fictício e não compatível com um segredo gerado. Não adicionar autor, destinatário, relação de usuário, histórico ou token à resposta.

### Errors

Preservar envelope HTTP NestJS existente (`statusCode`, `message`, `error`, quando aplicável), sem incluir payload, código, valores inválidos, entidade Prisma, cause ou stack. A superfície mobile mapeia status/categoria para mensagens próprias em português.

| Status | Condição                                                              | Efeito                                                                  |
| ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 400    | Body/role/extra inválido                                              | Zero convites; mensagem de entrada inválida sem valores enviados.       |
| 401    | JWT ausente/expirado/inválido ou sessão inválida/revogada/inexistente | Zero convites; nenhuma metadata administrativa.                         |
| 403    | Usuário atual não ADMIN, inclusive papel alterado depois do guard     | Zero convites; nenhuma metadata administrativa.                         |
| 503    | Três colisões internas específicas de code esgotadas                  | Zero convite novo; “Não foi possível gerar o convite. Tente novamente.” |
| 5xx    | Falha interna de persistência/infraestrutura                          | Resposta sanitizada; não anunciar sucesso nem vazar erro do driver.     |

Colisão é tratada internamente com transações novas; não retorna 409 com o código e não instrui o cliente a reenviar automaticamente. Falha de transporte/timeout/5xx é tratada pelo cliente como resultado não confirmado, pois a resposta pode ter sido perdida após commit. Uma nova ação deliberada é uma geração nova, não recuperação/revogação da anterior.

Não há contrato de idempotência global entre dois POSTs deliberados de clientes distintos. SC-006 é atendido pela trava de uma solicitação por ação na interface e proibição de replay. Intermediários não devem repetir POST automaticamente.

## POST /api/v1/auth/register

Preservar campos e response de auth existentes: `name`, `email`, `password`, `teacherCode` opcional; nenhum campo `role` permitido. Preservar validações/normalização/senha e cadastro PARENT sem convite.

Com `teacherCode`, somente InviteCode PROFESSOR disponível permite criar User PROFESSOR. Convites ADMIN/PARENT, desconhecidos, inativos, vencidos ou já consumidos retornam **400 com mensagem genérica idêntica**: “Código de convite inválido ou indisponível.” Não revelar existência, papel, motivo específico, gerador ou consumidor. Nunca consumir convite ADMIN histórico. Nunca retornar código enviado na resposta/erro/log.

Validade é avaliada no banco depois de adquirir lock: `expiresAt > (clock_timestamp() AT TIME ZONE 'UTC')`; o instante exato do vencimento já é inválido. Consumo e criação da conta compartilham transação. Um unique de e-mail retorna 409 pelo contrato existente e desfaz consumo. Ausência de um campo de convite continua representando PARENT; formatos históricos de convites PROFESSOR válidos não são invalidados por exigir formato novo no cadastro público.

Não incluir convite na resposta de cadastro. Sessão/tokens continuam no formato atual, com resposta sem cache; resposta perdida após commit da conta é recuperada por login, sem reutilizar convite. ADMIN já provisionado segue login/refresh atuais. Este contrato não oferece endpoint para provisionar ADMIN.

## Contract Compatibility and Documentation

Mudanças intencionais: geração deixa de aceitar ADMIN e expiresInDays; response enum vira PROFESSOR; cadastro deixa de aceitar ADMIN histórico e unifica erros de convite. Clients antigos que enviarem validade devem receber 400 e atualizar seu payload. PROFESSOR existente válido e PARENT sem convite preservam semântica.

Na implementação, sincronizar DTO/decorators runtime, testes OpenAPI, `specs/001-app-quality-readiness/contracts/openapi.json` e README diretamente afetados. Não reescrever paths/schemas alheios ao contrato alterado. Validar autorização e comportamento HTTP real além da forma Swagger.

## Mobile Interface Contract

### Access and lifecycle

- Perfil mostra “Convites de professores” somente para ADMIN; deep link para `/admin/teacher-invites` exige guard local. PARENT/PROFESSOR retornam ao Perfil; ausência de sessão vai ao login.
- A rota usa `SecondaryScreen` e uma única finalidade, com “Gerar convite de professor”; nenhum seletor de papel/validade ou histórico.
- Foco/resume revalida perfil. Durante leitura pendente/indeterminada, ações ficam bloqueadas e resultado não é exposto. POST reautoriza no servidor. Rebaixamento remoto é detectado ao receber dados/erro do servidor, sem promessa de observação instantânea offline.
- Serviço POST usa `noAuthReplay: true`, sessionGeneration e signal. Em 401, hook limpa segredo e chama expireSession; em 403, limpa e retorna/reconcilia identidade para o fluxo permitido.
- Blur, unmount, logout, troca de identidade/papel e invalidação de sessão limpam código e feedback. Respostas tardias não podem reconstituir estado nem escrever feedback de outra visita/conta.

### States and copy

| Estado               | Conteúdo e ação                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Inicial autorizado   | Explica PROFESSOR, sete dias, pessoal/uso único; permite gerar.                                                            |
| Geração pendente     | Feedback busy e trava síncrona; botões de nova geração/cópia desabilitados; resultado anterior identificado como anterior. |
| Resultado            | Código selecionável, papel PROFESSOR, criação/expiração locais; informa “Ativo na geração” e uso único.                    |
| Cópia pendente       | Trava duplicatas; chama clipboard somente por gesto explícito.                                                             |
| Cópia bem-sucedida   | “Código copiado.” com feedback acessível; sem anunciar segredo automaticamente.                                            |
| Erro de cópia        | “Não foi possível copiar. Selecione o código ou tente copiar novamente.”; mantém resultado e não gera convite.             |
| Erro de geração      | Mensagem recuperável; preserva resultado anterior autorizado; não o apresenta como novo/revogado.                          |
| Resultado incerto    | Explica possibilidade de convite criado e ausência de repetição automática; oferece nova geração deliberada.               |
| Prazo encerrado      | Informa vencimento, preserva leitura e permite gerar outro; copiar fica desabilitado.                                      |
| Autorização inválida | Remove segredo e retorna ao fluxo permitido.                                                                               |

“Gerar outro convite” é ação explícita com aviso: “Gerar outro código não revoga o anterior.” Não consultar convites para provar consumo; `isActive` retornado é o estado da geração, sem atualização remota nesta feature.

Copiar grava apenas a string exata, sem whitespace/data/papel/texto adicional. `Clipboard.setStringAsync` true = sucesso; false/throw = falha. Não ler conteúdo do clipboard nem apagá-lo automaticamente. Não fazer await de rede entre gesto e chamada no web. O SO controla o conteúdo após cópia.

Código e feedback só existem em estado/ref local da visita. Nenhum segredo em React Query cache, navegação, armazenamento, diagnósticos, screenshots publicados ou snapshots versionados. Temas Claro/Escuro, scroll e texto ampliado não truncam código/data; ações expõem label, disabled/busy, feedback legível e acessível sem depender de cor. Prova de TalkBack/VoiceOver é manual e distinta de testes de componentes.
