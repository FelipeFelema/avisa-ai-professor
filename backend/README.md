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
- Perfis `PARENT`, `PROFESSOR` e `ADMIN`.
- Códigos de convite para o cadastro de perfis privilegiados.
- Criação de turmas por professores e participação de usuários em turmas.
- Comunicados com prazo de expiração e operações de criação, leitura, atualização e exclusão.
- Validação de entradas por DTOs e controle de acesso por guards e funções.

## Rotas principais

Todas as rotas têm o prefixo `/api/v1`.

| Recurso               | Rotas                                                                                                                     | Acesso                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Autenticação          | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`                                                           | Público                             |
| Perfil                | `GET /users/profile`, `PATCH /users/profile`                                                                              | Autenticado                         |
| Turmas                | `GET /classrooms`, `GET /classrooms/my`, `GET /classrooms/:id`, `POST /classrooms/:id/join`, `POST /classrooms/:id/leave` | Autenticado                         |
| Criação de turma      | `POST /classrooms`                                                                                                        | Professor                           |
| Exclusão de turma     | `DELETE /classrooms/:id`                                                                                                  | Professor owner                     |
| Comunicados           | `GET /announcements`, `GET /announcements/:id`, `GET /announcements/classrooms/:classroomId`                              | Autenticado e participante da turma |
| Gestão de comunicados | `POST /announcements`, `PATCH /announcements/:id`, `DELETE /announcements/:id`                                            | Professor autor do comunicado       |

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
