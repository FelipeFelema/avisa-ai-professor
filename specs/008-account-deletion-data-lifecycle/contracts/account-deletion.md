# Contract: Account Deletion

**Base**: `/api/v1` | **Spec**: [../spec.md](../spec.md) | **Model**: [../data-model.md](../data-model.md)

Contrato funcional implementado pela Spec 008. O runtime Swagger e o inventário OpenAPI canônico incluem os dois endpoints descritos abaixo; a suíte de contrato verifica sua sincronização. Todos os papéis podem excluir somente a própria conta, com a exceção do último ADMIN.

## Authentication and authorization

- JWT/sid válidos; User e sessão persistida atuais, não papel/email confiados apenas às claims.
- Alvo exclusivamente da identidade autenticada. Sem path/query/header/body alternativo para selecionar conta.
- Rejeitar query fields e body inesperado no GET; rejeitar query fields no DELETE e propriedades extras no seu body. Tentativas de fornecer id/userId/accountId como selector nunca mudam o alvo e devem receber 400. Headers não têm função de seleção de conta.
- Nenhuma role guard limitada a PROFESSOR/ADMIN; PARENT também pode usar ambos os endpoints.
- DELETE revalida User, sid, credencial snapshot, papel e elegibilidade dentro da transação.
- Aplicar RateLimitGuard existente ao DELETE, sem novo mecanismo/pacote ou alteração de limites globais.
- Sem log do request, senha, frase, headers de autenticação, hash ou erro original com causa. Respostas de ambos os endpoints com `Cache-Control: no-store`; não há cache persistente mobile.

## GET /users/account-deletion

**operationId**: `users.getAccountDeletionImpact` | **tag**: `users`

Sem body ou parâmetros de seleção. Consulta protegida somente de leitura, com snapshot consistente de contagens/papel/elegibilidade. Campos da resposta:

```json
{
  "role": "PROFESSOR",
  "canDelete": true,
  "blockReason": null,
  "ownedClassroomsCount": 2,
  "announcementsInOwnedClassroomsCount": 5,
  "externalMembershipsCount": 1,
  "authoredAnnouncementsInOtherClassroomsCount": 3
}
```

Todos os campos obrigatórios; role enum vigente, counts inteiros não negativos, blockReason null ou `LAST_ADMIN_REQUIRED`. Último ADMIN recebe 200 com `canDelete: false` e esse motivo. Outros casos elegíveis recebem true/null. Zero em todas as relações é válido. Não retornar id/name/email/password/sid, identificadores de recursos ou total de ADMINs.

| HTTP | Resultado                                               |
| ---- | ------------------------------------------------------- |
| 200  | Resumo atual, inclusive bloqueio último ADMIN.          |
| 400  | Body/query inesperados ou tentativa de selecionar alvo. |
| 401  | Sessão/conta ausente, expirada ou revogada.             |
| 500  | Falha sanitizada de consulta, sem resultado parcial.    |

O resumo não congela o grafo nem autoriza exclusão futura. A tela explica que as relações vigentes serão tratadas no envio. Recarregar ao entrar/focar, após conflito e antes de uma nova tentativa manual. Não usar apenas AuthUser.role/cache de listas para produzir o aviso.

## DELETE /users/account

**operationId**: `users.deleteOwnAccount` | **tag**: `users`

`Content-Type: application/json`, corpo obrigatório, schema `DeleteAccountRequest`, `additionalProperties: false`:

| Campo              | Validação                                                                                                                                | Exposição                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| currentPassword    | String não vazia; verificar exatamente contra credencial vigente, sem trim/normalização/coerção ou novo limite sobre credenciais atuais. | writeOnly; não devolver/persistir/logar. |
| confirmationPhrase | String exatamente `EXCLUIR MINHA CONTA`, com caixa/espaços internos exatos.                                                              | writeOnly; não devolver/persistir/logar. |

Rejeitar campos ausentes, null, número, boolean, array, objeto e adicionais (incluindo id/userId/role/email). Restaurar tipo JSON original no DTO, como no padrão vigente de senha; nenhuma conversão implícita pode tornar entrada inválida válida. Frase com espaços externos, variação de caixa, quebra de linha, espaço duplicado ou caracteres visualmente parecidos é inválida. A senha não passa pelas regras de comprimento de uma nova senha.

### Success

**204 No Content** somente após commit integral. Sem JSON, User, counts, tokens ou identifiers. Conta, sessões, memberships, autoria, ownership/subtrees e receipts removidos conforme política. Contas de terceiros preservadas; e-mail disponível para novo cadastro pelas regras atuais.

Depois do commit, nenhuma sessão anterior autoriza acesso/refresh. Segunda requisição da conta removida recebe 401, não um falso 204 baseado em receipt. Não há chave de idempotência/receipt de conta; UI impede duplicatas e servidor não pode remover duas vezes a mesma User.

### Errors

Reusar `ErrorResponse` vigente: `statusCode`, `message` string ou lista de mensagens constantes, `error` conforme serialização Nest. Os códigos abaixo são valores estáveis de message, não nova propriedade global. Mobile traduz para português por allowlist e nunca exibe response bruta.

| HTTP | message / motivo                                                                    | Efeito e recuperação                                                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400  | Validação DTO, `CURRENT_PASSWORD_INVALID`, `ACCOUNT_DELETION_CONFIRMATION_MISMATCH` | Sem escrita; feedback do campo, corrigir e confirmar manualmente.                                                                                                        |
| 401  | Sessão/conta ausente, inválida, expirada ou revogada                                | Nenhuma nova exclusão; verificar sessão por leitura, limpar se definitivamente inválida. Nunca renovar/reexecutar DELETE.                                                |
| 409  | `LAST_ADMIN_REQUIRED`                                                               | Sem escrita; explicar preservação do acesso administrativo, recarregar resumo, cancelar/back disponíveis.                                                                |
| 409  | `CREDENTIAL_CHANGED`                                                                | Sem escrita; senha snapshot vencida, descartar valores, resumo fresco e nova confirmação manual.                                                                         |
| 429  | Limite existente                                                                    | Sem escrita; aguardar e confirmar novamente por iniciativa da pessoa.                                                                                                    |
| 500  | Mensagem sanitizada “Não foi possível excluir a conta.”                             | Falha transacional conhecida implica rollback; oferecer tentativa manual posterior. Erro de infraestrutura/transportes desconhecidos permanece indeterminado no cliente. |

Senha incorreta é 400, nunca 401. Ausência de User após autenticação/snapshot é 401, sem revelar outra conta. Não vazar Prisma/SQL, hash snapshot, frase enviada ou informações globais de ADMINs. Não retornar 401 depois de commit bem-sucedido; falha de entrega é resultado incerto, não resposta transacional de autorização.

## Transaction and concurrency contract

- READ COMMITTED, advisory gate transacional comum antes de User lock, estado e ADMIN count atuais; turmas próprias travadas em ordem de id.
- Todas as remoções pelo mesmo TransactionClient, sem calls HTTP, callbacks de domínio pós-commit ou transações independentes para dependentes.
- Rollback mantém todas as tabelas/sessões anteriores; nenhum receipt de conta é criado.
- Login/emissão/refresh coordenam User e revalidam estado/hash antes de criar/rotacionar sessão. Tokens eventualmente recebidos após commit de exclusão não são utilizáveis.
- Writer de receipt de turma coordena User antes de receipt/Classroom; após remoção da conta, não recria identificador em receipt.
- Duas ADMINs: pelo menos uma permanece. Duas sessões da mesma conta: no máximo uma exclusão efetiva; a outra recebe 401. Lock timeout/deadlock pode abortar uma tentativa sem perda parcial; sem retry automático.

## Mobile interface contract

**Route**: `/profile/delete-account`, tela fora das tabs. **Entry**: “Excluir minha conta”, variante destrutiva, distinta de “Sair da conta”. Não altera Editar perfil ou Alterar senha.

### Impact and form

- Aviso “A exclusão é permanente e não pode ser desfeita.” e resumo das relações efetivas, mesmo em papel histórico inesperado.
- Conta/sessões/participações/autoria removidas; turmas próprias com todos os conteúdos removidas; turmas externas/demais membros/conteúdos alheios preservados; códigos de convite sem autoria e tema preservados.
- ADMIN recebe também aviso de perda de acesso administrativo. Último ADMIN mostra bloqueio claro e não permite envio.
- Senha atual protegida e frase solicitada visivelmente como literal fixo de interface. A constante exibida não é leitura/retorno de valor digitado.
- Zod e DTO têm as mesmas regras exatas; a API é autoridade. Sem autofill/autocorreção/auto-capitalização dos campos; valores transitórios.
- Loading/error/retry de resumo; empty válido; field error, conflito, bloqueio, pending, resultado incerto e sucesso em português.

### Pending and cleanup

- Ref síncrona impede dupla submissão antes do rerender; disabled/busy anunciados. Enquanto pending, campos/cancelar/back/gesto/hardware bloqueados; expiração permite redirecionar.
- Hook/service imperativos; nenhum request/credential em TanStack mutation, QueryClient, storage, params de rota ou analytics.
- Limpar valores em cancelamento/blur/unmount/expiração/sucesso/resultado incerto. Falha recuperável permite correção sem persistir entradas ou copiar segredos para feedback.
- DELETE não tem retry de domínio, interceptor, refresh ou resend de reconexão. Flag opt-in não altera replay vigente de chamadas normais.
- Sucesso invalida geração, cancela queries e limpa identidade/cache, serializa remoção de ambas as token keys e retorna à autenticação. Nenhuma resposta/callback antigo pode restaurar tokens/user/cache. Falha SecureStore mantém telas privadas fechadas e oferece recuperação; tema não é removido.
- Autenticação apresenta sucesso transitório sem identificadores; voltar/deep link/reinício não expõem telas protegidas. Outras sessões saem ao próximo acesso/refresh recusado; não existe push de logout instantâneo.

### Unknown result and session verification

Timeout/conexão interrompida não prova rollback. Mostrar “Não foi possível confirmar o resultado. Verifique sua conexão e a sessão antes de iniciar outra exclusão.”, limpar campos e oferecer “Verificar sessão”, somente de leitura.

| Verificação   | Comportamento                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| valid         | Obter resumo novo; permitir nova confirmação manual sem declarar falha/rollback da exclusão anterior.                                                      |
| invalid       | 401 definitivo após validação/refresh de leitura: limpar e retornar ao login com aviso neutro de sessão encerrada. Sem alegar sucesso da exclusão sem 204. |
| indeterminate | Rede/5xx/429 ou refresh sem resposta conclusiva: manter resultado incerto e orientação de conexão; não reenviar DELETE.                                    |

Implementar opção/serviço de verificação que distingue refresh definitivamente inválido de falha de rede; o catch global vigente não oferece essa distinção. Geração impede salvar refresh tardio após cleanup. Sem consulta de existência por e-mail/ID ou armazenar confirmação para repetir depois. Um processo encerrado retoma com validação de sessão no bootstrap, não com reenvio.

### Accessibility

Paleta ativa Claro/Escuro, sem cores fixas; ações com labels/roles e estados disabled/busy; erros anunciados e vinculados aos campos; foco na correção; título/impacto em ordem legível; ações destrutivas explícitas; scroll/KeyboardAvoidingView e texto ampliado sem recorte. Evidência de TalkBack/VoiceOver e compreensão em até dois minutos requer walkthrough observado.

## OpenAPI synchronization

Os DTOs Swagger `DeleteAccountRequest` e `AccountDeletionImpact`, segurança Bearer, operationIds, schemas fechados, campos obrigatórios/write-only e statuses acima estão sincronizados com `specs/001-app-quality-readiness/contracts/openapi.json` e `backend/test/openapi.contract.spec.ts`. O endpoint DELETE documenta 204 sem content e preserva os demais endpoints.
