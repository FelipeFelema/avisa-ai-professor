# Avisa Aí Professor — Mobile

> MVP estável — versão 1.0

Aplicativo mobile do Avisa Aí Professor, desenvolvido com React Native e Expo. Ele permite que professores organizem turmas e publiquem comunicados, enquanto responsáveis acompanham e participam das turmas de interesse.

## Recursos disponíveis

- Cadastro e login com sessão persistente.
- Renovação automática do token de acesso.
- Validação de formulários com mensagens claras para o usuário.
- Visualização do perfil e logout.
- Busca, entrada e saída de turmas.
- Criação de turmas para professores.
- Listagem, criação, edição e exclusão de comunicados para professores.
- Visualização de comunicados ativos pelos participantes das turmas.

## Stack

- React Native e Expo SDK 57
- TypeScript
- Expo Router
- TanStack React Query
- Axios
- React Hook Form e Zod
- Expo Secure Store

## Pré-requisitos

- Node.js 22 ou superior
- npm
- API backend em execução

## Configuração

Crie o arquivo de ambiente a partir do exemplo:

```bash
cp .env.example .env
```

Defina a URL base da API em `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

Em um dispositivo físico, `localhost` aponta para o próprio aparelho. Use o IP local da máquina que executa a API:

```env
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:3000/api/v1
```

## Execução

```bash
npm install
npm start
```

Comandos adicionais:

```bash
npm run android
npm run ios
npm run web
```

## Organização do código

```text
app/
  (auth)/                 # telas públicas: login e cadastro
  (app)/                  # telas autenticadas: turmas, comunicados e perfil
src/
  components/             # componentes reutilizáveis de interface
  config/                 # configuração de ambiente
  hooks/                  # queries e mutations do React Query
  lib/                    # clientes HTTP e integrações compartilhadas
  providers/              # estado e contexto de autenticação
  services/               # comunicação com a API
  storage/                # armazenamento seguro de tokens
  theme/                  # tokens visuais da aplicação
  types/                  # contratos TypeScript
  validations/            # schemas de validação dos formulários
```

## Qualidade

```bash
npm run typecheck
npm run lint
npm run format:check
```

## API

O aplicativo depende da API descrita em [../backend/README.md](../backend/README.md).
