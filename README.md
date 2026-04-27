# Avisa Aí Professor

API para comunicação escolar entre professores e responsáveis, com autenticação, turmas, comunicados e controle de acesso por perfil.

## Objetivo

Este projeto simula uma aplicação onde professores podem criar comunicados para turmas, e responsáveis podem acompanhar os avisos vinculados às turmas em que participam.

## Tecnologias

- Node.js
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Jest
- Docker Compose

## Pré-requisitos

Antes de rodar o projeto, você precisa ter instalado:

- Node.js 22 ou superior
- npm
- Docker
- Docker Compose
- Git

## Funcionalidades

- Cadastro e login de usuários
- Autenticação com access token e refresh token
- Perfis de usuário: responsável, professor e admin
- Criação e entrada em turmas
- Comunicados com data de expiração
- Código de convite para liberar cadastro de professores/admins
- Testes unitários dos principais serviços

## Arquitetura

O projeto está organizado como um monorepo com backend NestJS e estrutura inicial para aplicação mobile.

O backend segue uma divisão por módulos de domínio:

- `auth`: autenticação, estratégias JWT e guards
- `users`: cadastro, busca e refresh token dos usuários
- `classrooms`: criação e vínculo de usuários com turmas
- `invites-code`: códigos de convite para professores e administradores
- `prisma`: acesso ao banco de dados via Prisma Client

O PostgreSQL local é executado via Docker Compose, enquanto a API roda localmente com Node.js durante o desenvolvimento.

## Decisões Técnicas

- Separação entre access token e refresh token, usando secrets diferentes.
- Refresh tokens são armazenados como hash no banco, reduzindo impacto em caso de vazamento.
- Códigos de convite são usados para controlar cadastro de perfis privilegiados.
- O consumo do código de convite usa atualização condicional para evitar uso duplicado em requisições concorrentes.
- DTOs com `class-validator` validam os dados de entrada antes das regras de negócio.
- Prisma centraliza o acesso ao PostgreSQL e o histórico de migrations.
- Testes unitários cobrem regras de autenticação, usuários, turmas, comunicados e convites.

## Como rodar o backend

1. Suba o banco:

```bash
docker compose up -d
```

2. Instale as dependências:

```bash
cd backend
npm install
```

3. Configure o ambiente:

```bash
cp .env.example .env
```

4. Rode as migrations:

```bash
npx prisma migrate dev
```

5. Inicie a API:

```bash
npm run start:dev
```

A API ficará disponível em:

**http://localhost:3000/api/v1**

## Testes

A API contém testes unitários automatizados utilizando Jest.

```bash
cd backend
npm test
```
