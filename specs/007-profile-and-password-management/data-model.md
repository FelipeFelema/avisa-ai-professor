# Data Model: Profile and Password Management

**Date**: 2026-10-02 | **Schema changes**: nenhuma; sem migration.

## Entidades persistentes existentes

| Entidade    | Campos relevantes                                                        | Relações/invariantes                                                                                                          |
| ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| User        | id, name, email, password, role, createdAt, updatedAt                    | Email único; role imutável no autoatendimento; password somente representação segura interna. Relações de domínio permanecem. |
| AuthSession | id, userId, refreshTokenHash, expiresAt, revokedAt, createdAt, updatedAt | User 1:N sessions; ativa quando revokedAt null e expiresAt futuro. Sid autenticado pertence ao mesmo User.                    |

`User.password` continua String, com bcrypt legado ou scrypt v1 fechado. Nenhuma representação de hash entra no perfil público. `refreshTokenHash` conserva mecanismo existente.

## Dados públicos e transitórios

| Modelo conceitual     | Campos                                                 | Vida útil/validação                                                                                                                                                  |
| --------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfil autenticado    | id, name, email, role, timestamps públicos             | AuthUser/consulta pública. Só name/email mutáveis pelo PATCH; nenhum segredo.                                                                                        |
| Atualização de perfil | name? e email?                                         | Pelo menos um campo; nome trim 3–100/padrão atual; email trim/lowercase válido até 255/único; payload contém apenas mudanças normalizadas.                           |
| Formulário de senha   | currentPassword, newPassword, confirmNewPassword       | Memória do formulário; protegidos; não vazios, nova 6–72 pontos de código, confirmação exata, nova diferente da atual; nenhuma normalização.                         |
| ChangePasswordRequest | mesmos três campos                                     | Transitório write-only na fronteira HTTP; servidor repete regras; id/role/sid/extras proibidos. Confirmação server-side conforme interpretação de FR-016 em plan.md. |
| Contexto de operação  | userId e sid validados; snapshot interno da credencial | Exclusivamente servidor; nunca controlado pelo body. Snapshot somente durante verificação/transação, não em evidência.                                               |
| Feedback de senha     | pending, status/mensagem permitida, campo de erro      | Sem values/payload/AxiosError/config/cause; não se torna consulta ou mutation cache.                                                                                 |

Senha atual não recebe um limite máximo novo: preservar possibilidade de verificar credenciais existentes conforme login. Senhas não ficam no estado global, local storage ou parâmetros de navegação.

## Transições de conta/sessão

| Evento                                         | User                                   | Sessão iniciadora                   | Demais sessões                               |
| ---------------------------------------------- | -------------------------------------- | ----------------------------------- | -------------------------------------------- |
| Perfil normalizado sem mudança                 | Sem write/timestamp novo               | Preservada                          | Preservadas                                  |
| Nome-only válido                               | name/updatedAt atualizados             | Preservada                          | Preservadas                                  |
| E-mail válido, com/sem nome                    | identidade/timestamp atualizados       | Preservada                          | revokedAt definido no mesmo commit           |
| Conflito/validação/falha de perfil             | Sem alteração final                    | Estado anterior                     | Estado anterior                              |
| Troca de senha válida                          | nova representação segura/updatedAt    | Tokens/sid/hash refresh preservados | revokedAt definido no mesmo commit           |
| Senha incorreta/igual/divergente/inválida      | Sem alteração                          | Preservada                          | Preservadas                                  |
| Falha entre write e revoke, ou antes do commit | Rollback integral incluindo timestamps | Estado anterior                     | Estado anterior                              |
| Sid revogado/expirado durante operação         | Nenhuma nova escrita                   | 401, não reativar                   | Sem nova mudança causada pelo pedido         |
| Snapshot de credencial vencido                 | Nenhuma sobrescrita                    | 409 recuperável ou 401 se revogada  | Não desfazer revogação da operação vencedora |

Revogação é permanente para aquele sid; access/refresh das demais sessões falham na tentativa posterior ao commit. Lock de User ordena trocas e criação de sessões a partir de credencial verificada, impedindo sessão tardia baseada em senha antiga.

## Estado do formulário

`vazio → edição → validação → enviando → sucesso/erro recuperável`. Validação inválida não envia. Durante envio, uma ref imediata protege contra repetição e saídas voluntárias ficam bloqueadas. Erro de campo permite corrigir; falha de rede não afirma rollback remoto se o resultado foi indeterminado. Não repetir automaticamente uma operação sensível após timeout.

Sucesso limpa valores; feedback contém apenas confirmação segura. Abandono/blur/expiração limpam o formulário e a nova abertura começa vazia. Refs/snapshots do pedido são soltos ao término; não armazenar o erro HTTP bruto. Não prometer apagamento físico da memória do runtime ou encerramento da operação remota ao sair do app.
