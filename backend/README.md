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
- Tokens de atualização armazenados como hash.
- Perfis `PARENT`, `PROFESSOR` e `ADMIN`.
- Códigos de convite para o cadastro de perfis privilegiados.
- Criação de turmas por professores e participação de usuários em turmas.
- Comunicados com prazo de expiração e operações de criação, leitura, atualização e exclusão.
- Validação de entradas por DTOs e controle de acesso por guards e funções.

## Rotas principais

Todas as rotas têm o prefixo `/api/v1`.

| Recurso               | Rotas                                                                                              | Acesso                              |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Autenticação          | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`                                    | Público                             |
| Turmas                | `GET /classrooms`, `GET /classrooms/my`, `POST /classrooms/:id/join`, `POST /classrooms/:id/leave` | Autenticado                         |
| Criação de turma      | `POST /classrooms`                                                                                 | Professor                           |
| Comunicados           | `GET /announcements`, `GET /announcements/:id`, `GET /announcements/classrooms/:classroomId`       | Autenticado e participante da turma |
| Gestão de comunicados | `POST /announcements`, `PATCH /announcements/:id`, `DELETE /announcements/:id`                     | Professor autor do comunicado       |

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

| Variável             | Descrição                                                               |
| -------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`       | URL de conexão do PostgreSQL.                                           |
| `JWT_ACCESS_SECRET`  | Secret usado para assinar access tokens.                                |
| `JWT_REFRESH_SECRET` | Secret usado para assinar refresh tokens.                               |
| `PORT`               | Porta HTTP da API. O padrão é `3000`.                                   |
| `CORS_ORIGIN`        | Origens permitidas, separadas por vírgula. Opcional em desenvolvimento. |

Nunca use secrets de exemplo em ambientes compartilhados ou de produção.

## Banco de dados

O PostgreSQL local pode ser iniciado a partir da raiz do repositório:

```bash
docker compose up -d
```

Instale as dependências, gere o client Prisma e aplique as migrations:

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

## Execução

```bash
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api/v1`.

## Scripts

| Comando                    | Descrição                                |
| -------------------------- | ---------------------------------------- |
| `npm run start:dev`        | Inicia a API em modo de desenvolvimento. |
| `npm run build`            | Gera a build de produção.                |
| `npm run lint`             | Executa o ESLint.                        |
| `npm run format:check`     | Verifica a formatação com Prettier.      |
| `npm test`                 | Executa os testes unitários.             |
| `npm run test:integration` | Executa os testes de integração.         |
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

Consulte o [README principal](../README.md) para executar todos os componentes do projeto e o [README do mobile](../mobile/README.md) para o cliente Expo.
