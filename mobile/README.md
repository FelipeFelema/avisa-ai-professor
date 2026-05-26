# Avisa AI Professor Mobile

Aplicativo Expo/React Native para consumir a API do Avisa AI Professor.

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Configure a URL da API:

```bash
cp .env.example .env
```

3. Inicie o app:

```bash
npm start
```

## Funcionalidades atuais

- Login usando o backend NestJS.
- Proteção das abas quando o usuário não está autenticado.
- Listagem de comunicados do usuário autenticado.
- Listagem das turmas do usuário autenticado.

## Observações

O app ainda guarda os tokens apenas em memória. Persistência segura, refresh automático e telas de criação/edição entram nos próximos passos.
