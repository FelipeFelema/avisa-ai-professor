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
- Convites de PROFESSOR, gerados somente por ADMIN, com validade fixa de sete dias e uso único.
- Ativação opcional de notificações push por dispositivo e envio de um teste neutro, com novos comunicados e lembretes de expiração habilitados separadamente no backend (Spec 011).

Somente uma conta `ADMIN` autenticada pode gerar um convite de PROFESSOR. Cadastro público continua criando `PARENT` sem convite ou `PROFESSOR` com convite válido; ele nunca cria `ADMIN`. Cada geração deliberada cria outro convite e não revoga os anteriores. O aplicativo mantém código e feedback apenas durante a visita à tela e copia o código somente após ação explícita. Timeout ou falha de cópia não provocam repetição automática. O contrato anterior de geração de convites para `ADMIN` e de `expiresInDays` foi removido; login e os fluxos existentes de `PARENT` e `PROFESSOR` continuam disponíveis. A documentação usa apenas exemplos fictícios, nunca códigos operacionais.

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

### Notificações push de teste

O recurso é opcional e começa desativado. O aplicativo solicita permissão somente após ação explícita no Perfil. A fundação da Spec 010 mantém o teste neutro iniciado pelo próprio usuário; a Spec 011 acrescenta o envio de novo comunicado quando habilitado separadamente no backend.

- No backend, mantenha `EXPO_PUSH_ENABLED=false` enquanto o transporte não estiver configurado. Para habilitá-lo, defina `EXPO_PUSH_ENABLED=true` e `EXPO_PUSH_ACCESS_TOKEN` somente no ambiente privado do servidor. O token de acesso Expo nunca pertence ao app, ao EAS mobile profile ou a uma variável `EXPO_PUBLIC_*`.
- Na build mobile, configure `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_ANDROID_APPLICATION_ID` e `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER`. São identificadores públicos incorporados à configuração da app. Configure FCM V1 para a identidade Android e APNs para a identidade Apple correspondentes ao mesmo projeto EAS. O conteúdo de `GOOGLE_SERVICES_FILE` deve vir do ambiente de build; mantenha o arquivo de credenciais fora do Git.
- `mobile/eas.json` fornece o perfil `preview` para distribuição interna. Push requer uma build nativa independente e credenciais correspondentes; Expo Go, web, simuladores e configurações ausentes informam indisponibilidade sem bloquear os outros fluxos.
- O plugin de backup exclui o banco inteiro do AsyncStorage de backups Android e iOS para não restaurar a identidade push de uma instalação anterior. Isso também significa que a preferência de tema não é restaurada por backup do dispositivo; durante o uso normal, o tema continua persistido.
- Para recuperação operacional, desligue `EXPO_PUSH_ENABLED`, revogue os vínculos push afetados e reverta a versão da aplicação se necessário. Preserve as tabelas da migration; não as remova durante rollback.

Consulte o [quickstart da spec 010](specs/010-push-notification-foundation/quickstart.md) para configuração, gates e walkthrough individual. Os nomes de variáveis e regras de runtime estão em [mobile-and-provider.md](specs/010-push-notification-foundation/contracts/mobile-and-provider.md).

### Push de novos comunicados

Depois de revisar/aplicar a migration aditiva da Spec 011 e reiniciar o backend, `ANNOUNCEMENT_PUSH_ENABLED=true` habilita a publicação com recuperação durável, usando o transporte autenticado da 010. O valor padrão é `false`. `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED` também começa `false`; `true` habilita o reminder aproximadamente 24 horas antes do `expiresAt` atual. Aplique também a migration `20261007120000_announcement_expiration_occurrences` antes de usar esse backend. O lembrete usa o mesmo transporte e valida membros/instalações atuais; mudança de expiração suprime pendências antigas. Reinício, concorrência e resultado incerto não reenviam a mesma ocorrência.

O primeiro fanout seleciona membros atuais da turma com instalações elegíveis, excluindo o autor; cada vínculo é verificado novamente antes do envio. Falhas de push não desfazem a publicação. Depois da fronteira `SENDING`, resultados incertos não provocam reenvio automático; tickets aceitos são consultados pelo worker de receipts existente. A mensagem contém texto genérico e identificadores públicos do comunicado/despacho. O toque exige uma consulta autenticada nova; o identificador recebido nunca concede acesso.

Consulte o [quickstart da Spec 011](specs/011-release-critical-notifications/quickstart.md) para validação, recuperação e walkthrough. Preserve as tabelas e os registros de unicidade em rollback; desligar o flag e reiniciar é a forma de interromper novos envios. Cadastro, convites e turmas não ganham outros gatilhos nesta spec.

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
