# Backend

API do projeto Avisa Aí Professor, construída com NestJS, Prisma e PostgreSQL.

## Responsabilidades

- Autenticação com access token e refresh token
- Cadastro de usuários com perfis
- Criação e entrada em turmas
- Gerenciamento de comunicados
- Geração e validação de códigos de convite
- Validação de entrada com DTOs
- Testes unitários dos principais serviços

## Estrutura

- `src/auth`: autenticação, JWT, refresh token e guards
- `src/users`: cadastro e persistência de usuários
- `src/classrooms`: criação e participação em turmas
- `src/announcements`: comunicados vinculados a turmas
- `src/invites-code`: códigos de convite para perfis privilegiados
- `src/prisma`: integração com Prisma Client

## Ambiente

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

Depois configure as variáveis conforme necessário.

## Banco de Dados

O banco de dados é executado via Docker Compose a partir da raiz do projeto:

```bash
docker compose up -d
```

Para aplicar as migrations:

```bash
npx prisma migrate dev
```

## Scripts

```bash
npm install
npm run start:dev
npm test
npm run build
```
