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
npm install
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
npm install
npm start
```

Para executar em um dispositivo físico, informe no arquivo `mobile/.env` o endereço IP da sua máquina na rede local:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3000/api/v1
```

Para emuladores ou web local, use `http://localhost:3000/api/v1` quando esse endereço alcançar a API.

## Qualidade

### Mobile

```bash
cd mobile
npm run typecheck
npm run lint
npm run format:check
```

### Backend

```bash
cd backend
npm run lint
npm test
npm run test:integration
npm run test:e2e
```

## Documentação por componente

- [Aplicativo mobile](mobile/README.md)
- [API backend](backend/README.md)

## Licença

Projeto privado, destinado a fins educacionais e de portfólio.
