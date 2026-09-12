# Avisa Aí Professor

> MVP estável — versão 1.0

Plataforma de comunicação escolar que conecta professores e responsáveis por meio de turmas e comunicados com prazo de validade. O projeto reúne uma API REST em NestJS e um aplicativo mobile em React Native/Expo.

## Recursos

- Cadastro, login, renovação de sessão e logout seguros.
- Perfis de responsável e professor, com controle de acesso por função.
- Criação de turmas por professores.
- Busca, entrada e saída de turmas.
- Criação, edição, visualização e exclusão de comunicados por professores.
- Exibição de comunicados ativos para participantes da turma.
- Perfil da conta no aplicativo mobile.
- Códigos de convite para controlar o cadastro de perfis privilegiados.

## Arquitetura

| Componente           | Tecnologia                       | Responsabilidade                                          |
| -------------------- | -------------------------------- | --------------------------------------------------------- |
| `backend/`           | NestJS, Prisma e PostgreSQL      | API REST, autenticação, regras de negócio e persistência. |
| `mobile/`            | React Native, Expo e Expo Router | Experiência mobile para professores e responsáveis.       |
| `docker-compose.yml` | Docker Compose                   | Banco PostgreSQL local para desenvolvimento.              |

## Pré-requisitos

- Node.js 22 ou superior
- npm
- Docker e Docker Compose

## Execução local

### 1. Suba o banco de dados

Na raiz do projeto:

```bash
docker compose up -d
```

### 2. Configure e inicie a API

```bash
cd backend
cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api/v1`.

### 3. Configure e inicie o aplicativo mobile

Em outro terminal:

```bash
cd mobile
cp .env.example .env
npm ci
npm start
```

Para executar em um dispositivo físico, informe no arquivo `mobile/.env` o endereço IP da sua máquina na rede local:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3000/api/v1
```

Para emuladores ou web local, use `http://localhost:3000/api/v1` quando esse endereço alcançar a API.

## Segurança da configuração

- `backend/.env` e `mobile/.env` são arquivos locais ignorados pelo Git. Crie-os a partir dos respectivos `.env.example` e nunca os versione.
- `DATABASE_URL`, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` são segredos exclusivos do backend. Use valores fortes e diferentes por ambiente; nunca use o prefixo `EXPO_PUBLIC_` para eles.
- No Expo, toda variável `EXPO_PUBLIC_*` é incorporada ao aplicativo e pode ser lida pelo usuário. Este projeto publica somente `EXPO_PUBLIC_API_URL`, que deve conter apenas o endereço da API, sem credenciais ou tokens.
- Tokens de acesso e refresh pertencem ao Secure Store do dispositivo e não devem aparecer em código, commits, logs, screenshots ou exemplos.
- A referência OpenAPI fica disponível fora de produção em `/api/v1/docs`; o backend a bloqueia incondicionalmente quando `NODE_ENV=production`.
- Todo deploy deve definir `NODE_ENV=production`, manter a documentação desabilitada e publicar a API por HTTPS. O PostgreSQL e as credenciais do `docker-compose.yml` existem somente para desenvolvimento local e não devem ser expostos nem reutilizados em ambiente compartilhado.

## Qualidade

### Mobile

```bash
cd mobile
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run test:ci
npm run export:ci
```

### Backend

```bash
cd backend
npm run prisma:validate
npm run prisma:generate
npm run lint
npm run format:check
npm run typecheck
npm run test:cov
npm run test:integration
npm run test:contract
npm run test:e2e
npm run build
```

Os testes de integração, contrato e e2e devem usar exclusivamente um banco PostgreSQL descartável cujo nome contenha `test`; nunca aponte esses comandos para um banco com dados úteis.

## Documentação por componente

- [Aplicativo mobile](mobile/README.md)
- [API backend](backend/README.md)
- [Guia integral de validação](specs/001-app-quality-readiness/quickstart.md)
- [Contrato dos quality gates](specs/001-app-quality-readiness/contracts/quality-gates.md)
- [Evidências de readiness](specs/001-app-quality-readiness/evidence/)

## Licença

Projeto privado, destinado a fins educacionais e de portfólio.
