# Quickstart: Primary Surfaces Visual Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Data**: 2026-09-26

Este guia valida a implementação futura da spec 003. Os comandos abaixo são
direcionados à feature; os gates completos continuam sendo obrigatórios no
CI aplicável.

## Pré-requisitos

- Node.js 22+ e npm;
- dependências instaladas em `backend` e `mobile`;
- PostgreSQL de teste isolado para integração backend. Na configuração local,
  iniciar o compose pela raiz com `docker compose up -d` e usar uma
  `DATABASE_URL` cujo banco contenha `test`, conforme `backend/README.md`;
- API disponível para o walkthrough mobile e `mobile/.env` com
  `EXPO_PUBLIC_API_URL` sem credenciais.

Não são necessárias migrations novas. O banco de teste deve usar as migrations
existentes antes dos testes de integração.

## Validação direcionada

A partir da raiz do repositório:

```text
cd backend
npm test -- --runInBand src/classrooms/classrooms.service.spec.ts
npm run test:integration -- test/classrooms.integration.spec.ts
npm run test:contract
npm run typecheck
npm run lint
npm run format:check
npm run build

cd ../mobile
npm test -- --runInBand tests/lib/classroom-expiration.spec.ts tests/routes/home.spec.tsx tests/routes/classrooms-list.spec.tsx tests/routes/primary-states.spec.tsx tests/accessibility/touch-targets.spec.tsx tests/services/classroom.service.spec.ts
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run export:ci
```

Resultados esperados:

- o serviço retorna `expiresAt` no resumo quando há comunicado ativo e `null`
  quando não há;
- o contrato OpenAPI reconhece `expiresAt` como `date-time` obrigatório dentro
  de `LastAnnouncementSummary`, sem operações extras;
- a função produz os três rótulos definidos, não produz valor negativo e não
  mostra prazo sem comunicado/expirado;
- Home e Turmas mantêm os nomes, ações, parâmetros e estados acessíveis;
- todos os quality gates aplicáveis terminam com sucesso. Mensagens do
  harness sobre timers/handles devem ser classificadas conforme o protocolo do
  projeto se os testes terminarem aprovados.

## Walkthrough Android

Com a API executando e um emulador/dispositivo Android conectado:

```text
cd mobile
npm run android
```

Registrar os resultados em uma matriz de evidência da feature com `PASS`,
`WARN`, `FAIL`, `NOT RUN` ou `NOT MEASURED`.

### Cenários da Home

1. Como `PARENT` e `PROFESSOR`, confirmar cumprimento com nome, título
   principal e ordem de leitura.
2. Confirmar cards com comunicado que expira hoje, em um dia e em vários
   dias; conferir exatamente os rótulos e ausência de valor negativo.
3. Confirmar card sem comunicado e sem prazo; confirmar professor ausente e
   nomes/títulos longos.
4. Observar carregamento, erro com retry, vazio e sucesso; confirmar que erro
   não vira mensagem de ausência de turmas.

### Cenários de Turmas

1. Como `PROFESSOR`, confirmar introdução → busca → `Minhas turmas` →
   `Turmas disponíveis` e presença de um único ícone de pesquisa.
2. Como `PARENT`, confirmar a mesma ordem sem `Criar turma` e sem espaço
   reservado incoerente.
3. Exercitar busca com texto, resultado vazio e erro, verificando que o
   comportamento atual de consulta permanece igual.
4. Exercitar `Entrar`, `Sair`, `Excluir turma`, confirmação, cancelamento e
   abrir turma; nenhum toque deve disparar a ação vizinha.
5. Confirmar listas vazias, professor ausente, conteúdo longo, largura
   estreita e texto ampliado sem sobreposição ou perda de ação.

### Limites de evidência

- `npm run export:ci` e Expo Doctor demonstram empacotamento/saúde do projeto,
  não substituem leitura manual ou auditoria de acessibilidade.
- iOS, VoiceOver, participantes adicionais, tamanhos de dispositivo não
  testados e qualquer cenário sem dispositivo devem ser registrados como
  `NOT MEASURED`, não como `PASS`.
- Falhas preexistentes de escopo global devem ser separadas dos checks
  direcionados da feature e nunca corrigidas incidentalmente sem autorização.
