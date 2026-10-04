# Avisa Aí Professor — Mobile

> MVP estável — versão 1.0

Aplicativo mobile do Avisa Aí Professor, desenvolvido com React Native e Expo. Ele permite que professores organizem turmas e publiquem comunicados, enquanto responsáveis acompanham e participam das turmas de interesse.

## Recursos disponíveis

- Cadastro e login com sessão persistente.
- Renovação automática do token de acesso.
- Validação de formulários com mensagens claras para o usuário.
- Visualização do perfil e logout.
- Consulta de impacto e exclusão permanente da própria conta.
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

`EXPO_PUBLIC_API_URL` é configuração pública por definição: o Expo incorpora toda variável `EXPO_PUBLIC_*` ao bundle e o usuário pode inspecioná-la. Ela deve conter somente uma URL sem credenciais. Nunca coloque nesse prefixo secrets JWT, `DATABASE_URL`, senhas, invite codes ou tokens de usuário. Access e refresh tokens são recebidos em runtime e persistidos apenas com Expo Secure Store.

O arquivo `mobile/.env` é local e ignorado pelo Git. Mesmo assim, trate qualquer valor `EXPO_PUBLIC_*` como publicável e use o gerenciador de secrets do backend para toda configuração confidencial.

Builds distribuídos devem usar uma URL `https://`; os endereços `http://localhost` e `http://SEU_IP_LOCAL` são apenas para desenvolvimento em rede controlada. Bearer tokens nunca devem trafegar por HTTP em ambientes compartilhados.

## Execução

```bash
npm ci
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
npm run doctor
npm run test:ci
npm run export:ci
```

Os testes Jest/RNTL cobrem os comportamentos automatizáveis; acessibilidade real, usabilidade e aprovação visual mantêm evidências manuais separadas.

## API

O aplicativo depende da API descrita no [README do backend](../backend/README.md).

### Exclusão da conta

Na tela Perfil, **Excluir minha conta** consulta `GET /api/v1/users/account-deletion` para mostrar as relações atuais. A confirmação envia uma única solicitação a `DELETE /api/v1/users/account`, com a senha atual e a frase literal `EXCLUIR MINHA CONTA`. A exclusão é permanente; o resumo não reserva nem congela as relações, que são recalculadas pelo servidor no envio. O último `ADMIN` é bloqueado no resumo e novamente pelo servidor.

O DELETE não renova a sessão, não é reenviado por interceptors/reconexão e não é repetido automaticamente. Se a resposta se perder ou o resultado for incerto, o app oferece uma verificação de sessão somente de leitura: sessão inválida encerra o acesso local; sessão válida carrega outro resumo e exige nova confirmação manual, sem afirmar que a tentativa anterior falhou; sem resposta conclusiva, o resultado continua indeterminado. Credenciais e frase digitadas permanecem transitórias e não entram no cache de queries/mutations ou no armazenamento. Ao encerrar a sessão, dados privados e tokens são limpos; a preferência de tema Claro/Escuro permanece.

O contrato e os limites desse fluxo estão em [account-deletion.md](../specs/008-account-deletion-data-lifecycle/contracts/account-deletion.md). Os gates automatizados e as observações manuais são registrados separadamente em [validation.md](../specs/008-account-deletion-data-lifecycle/validation.md); export ou testes automatizados não substituem evidência de aparelho/tecnologia assistiva.

Documentação operacional relacionada:

- [README principal](../README.md)
- [Guia integral de validação](../specs/001-app-quality-readiness/quickstart.md)
- [Contrato de interações mobile](../specs/001-app-quality-readiness/contracts/mobile-interactions.md)
- [Contrato dos quality gates](../specs/001-app-quality-readiness/contracts/quality-gates.md)
- [Evidências de readiness](../specs/001-app-quality-readiness/evidence/)
