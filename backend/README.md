# Avisa Aí Professor — Backend

> MVP estável — versão 1.0

API REST do Avisa Aí Professor. A aplicação centraliza autenticação, regras de acesso, gerenciamento de turmas e comunicados para o aplicativo mobile.

## Tecnologias

- Node.js e TypeScript
- NestJS
- Prisma ORM
- PostgreSQL
- JWT e Passport
- class-validator
- Jest e Supertest

## Funcionalidades

- Cadastro, login e renovação de tokens de acesso.
- Sessões por dispositivo com refresh tokens armazenados somente como hash.
- Atualização self-service de nome/e-mail com revogação seletiva das demais sessões.
- Consulta de impacto e exclusão permanente da própria conta, com revogação de todas as sessões.
- Perfis `PARENT`, `PROFESSOR` e `ADMIN`.
- Convites de PROFESSOR gerados por ADMIN; o cadastro público não provisiona ADMIN.
- Criação de turmas por professores e participação de usuários em turmas.
- Comunicados com prazo de expiração e operações de criação, leitura, atualização e exclusão.
- Validação de entradas por DTOs e controle de acesso por guards e funções.

## Rotas principais

Todas as rotas têm o prefixo `/api/v1`.

| Recurso               | Rotas                                                                                                                     | Acesso                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Autenticação          | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`                                                           | Público                                               |
| Convite de professor  | `POST /invite-codes`                                                                                                      | ADMIN autenticado                                     |
| Perfil                | `GET /users/profile`, `PATCH /users/profile`                                                                              | Autenticado                                           |
| Turmas                | `GET /classrooms`, `GET /classrooms/my`, `GET /classrooms/:id`, `POST /classrooms/:id/join`, `POST /classrooms/:id/leave` | Autenticado                                           |
| Criação de turma      | `POST /classrooms`                                                                                                        | Professor                                             |
| Exclusão de turma     | `DELETE /classrooms/:id`                                                                                                  | Professor owner                                       |
| Comunicados           | `GET /announcements`, `GET /announcements/:id`, `GET /announcements/classrooms/:classroomId`                              | Autenticado e participante da turma                   |
| Gestão de comunicados | `POST /announcements`, `PATCH /announcements/:id`, `DELETE /announcements/:id`                                            | Professor autor do comunicado                         |
| Exclusão de conta     | `GET /users/account-deletion`, `DELETE /users/account`                                                                    | Própria conta; todos os papéis, exceto o último ADMIN |

## Convites de professor

`POST /api/v1/invite-codes` exige a sessão atual de um `ADMIN` e aceita somente o papel `PROFESSOR`; o servidor fixa a validade em sete dias e permite um cadastro. `POST /api/v1/auth/register` continua criando `PARENT` sem convite ou `PROFESSOR` com um convite válido. Papel enviado pelo cliente não é aceito, e o cadastro público nunca cria `ADMIN`.

Uma nova geração deliberada cria um convite distinto e não revoga convites anteriores. O contrato anterior que aceitava convites `ADMIN` ou `expiresInDays` foi removido de propósito; login, refresh, cadastro `PARENT` e convites `PROFESSOR` existentes compatíveis permanecem disponíveis. Erros e exemplos não expõem códigos operacionais; exemplos OpenAPI são fictícios.

## Exclusão de conta

`GET /api/v1/users/account-deletion` retorna um resumo atual e somente de leitura das relações que seriam removidas. `DELETE /api/v1/users/account` recebe a senha atual e a frase exata `EXCLUIR MINHA CONTA`; a identidade vem da sessão autenticada e nunca de um identificador enviado pelo cliente. Os dois endpoints exigem JWT e usam `Cache-Control: no-store`.

A exclusão é permanente e não tem recuperação nem recibo de conta. Após revalidar a sessão, credencial e grafo atuais, o backend remove a conta, todas as sessões e as relações/conteúdos sob sua responsabilidade em uma transação; responde `204 No Content` somente depois do commit. Códigos de convite e dados sem relação com a conta permanecem. Uma conta `ADMIN` não pode ser excluída quando for a última `ADMIN`. O DELETE usa o `RateLimitGuard` existente; limites e timeouts globais não são alterados por esse fluxo.

O contrato detalhado de campos, erros, preservação e concorrência está em [account-deletion.md](../specs/008-account-deletion-data-lifecycle/contracts/account-deletion.md).

## Pré-requisitos

- Node.js 22 ou superior
- npm
- PostgreSQL 15 ou superior, ou Docker e Docker Compose

## Configuração

Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

Variáveis necessárias:

| Variável             | Classificação | Descrição                                                         |
| -------------------- | ------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`       | Secreta       | URL de conexão do PostgreSQL; pode conter credenciais.            |
| `JWT_ACCESS_SECRET`  | Secreta       | Secret forte e exclusivo para assinar access tokens.              |
| `JWT_REFRESH_SECRET` | Secreta       | Secret forte e diferente para assinar refresh tokens.             |
| `PORT`               | Não secreta   | Porta HTTP da API. O padrão é `3000`.                             |
| `CORS_ORIGIN`        | Não secreta   | Lista explícita de origens permitidas, separadas por vírgula.     |
| `NODE_ENV`           | Não secreta   | Ambiente de execução (`development`, `test` ou `production`).     |
| `API_DOCS_ENABLED`   | Não secreta   | Kill switch da documentação fora de produção; `false` a desativa. |

Mantenha os três valores secretos somente no gerenciador de secrets do ambiente e no `.env` local ignorado pelo Git. Não os registre em logs, exemplos, imagens ou variáveis `EXPO_PUBLIC_*`. Os valores de `.env.example` são placeholders locais e devem ser substituídos; produção exige secrets fortes, distintos e rotacionáveis.

O CORS deve listar apenas as origens cliente necessárias em ambientes compartilhados. A autorização permanece no backend por JWT, papel, autoria e ownership; ocultar uma ação no aplicativo não concede nem revoga permissão.

Em qualquer deploy, defina explicitamente `NODE_ENV=production`, restrinja o acesso ao PostgreSQL e termine TLS em um proxy/plataforma confiável para servir a API somente por HTTPS. O usuário, a senha e a porta publicados no `docker-compose.yml` são conveniências exclusivas do desenvolvimento local.

## Banco de dados

O PostgreSQL local pode ser iniciado a partir da raiz do repositório:

```bash
docker compose up -d
```

Instale as dependências, gere o client Prisma e aplique as migrations:

```bash
npm ci
npx prisma generate
npx prisma migrate dev
```

Em deploy, use migrations versionadas com `npx prisma migrate deploy`. Testes de integração/e2e devem receber um `DATABASE_URL` descartável cujo nome contenha `test`; o helper recusa bancos de desenvolvimento/produção para operações destrutivas.

### Testes destrutivos da exclusão de conta

Na raiz do repositório, selecione explicitamente a base local descartável `avisa_ai_test`; os helpers também recusam limpeza fora de localhost ou de uma base cujo nome contenha `test`.

```powershell
Set-Location backend
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/avisa_ai_test'
$env:NODE_ENV = 'test'
$env:JWT_ACCESS_SECRET = 'local_test_access_only'
$env:JWT_REFRESH_SECRET = 'local_test_refresh_only'
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run test:integration
npm run test:contract
npm run test:e2e
```

Os valores de conexão são exemplos locais e devem corresponder ao PostgreSQL de teste configurado na máquina. Esses testes limpam fixtures da base selecionada: nunca use `avisa_ai` nem uma base com dados pessoais. Não há migration nova da exclusão de conta. Consulte [quickstart.md](../specs/008-account-deletion-data-lifecycle/quickstart.md) para a matriz e os limites completos.

## Execução

```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api/v1`.

Em `development` e `test`, a referência OpenAPI fica em:

- Swagger UI: `http://localhost:3000/api/v1/docs`
- JSON: `http://localhost:3000/api/v1/docs/openapi.json`

`API_DOCS_ENABLED=false` desativa as duas rotas fora de produção. Em `production`, ambas permanecem indisponíveis mesmo se a flag estiver definida como `true`. Use somente contas e tokens descartáveis ao experimentar operações protegidas.

## Scripts

| Comando                    | Descrição                                |
| -------------------------- | ---------------------------------------- |
| `npm run start:dev`        | Inicia a API em modo de desenvolvimento. |
| `npm run build`            | Gera a build de produção.                |
| `npm run lint`             | Executa o ESLint.                        |
| `npm run format:check`     | Verifica a formatação com Prettier.      |
| `npm run typecheck`        | Verifica os tipos sem emitir build.      |
| `npm run test:cov`         | Executa testes unitários com cobertura.  |
| `npm run test:integration` | Executa os testes de integração.         |
| `npm run test:contract`    | Valida o contrato OpenAPI executável.    |
| `npm run test:e2e`         | Executa os testes end-to-end.            |

## Estrutura

```text
src/
  auth/                   # JWT, estratégias, guards e autenticação
  users/                  # usuários e perfil
  classrooms/             # turmas e participação
  announcements/          # comunicados
  invites-code/           # códigos de convite
  prisma/                 # acesso ao banco via Prisma
```

## Documentação relacionada

- [README principal](../README.md)
- [README do mobile](../mobile/README.md)
- [Guia integral de validação](../specs/001-app-quality-readiness/quickstart.md)
- [Contrato dos quality gates](../specs/001-app-quality-readiness/contracts/quality-gates.md)
- [Evidências de readiness](../specs/001-app-quality-readiness/evidence/)
