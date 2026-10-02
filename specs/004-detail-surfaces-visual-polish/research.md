# Research: Detail Surfaces Visual Polish

**Data**: 2026-10-01
**Fonte**: código e artefatos locais nas specs 002, 003 e 004. Todas as decisões abaixo se referem ao baseline desta branch.

## 1. Linguagem visual e limites

**Observação**: `mobile/src/theme/tokens.ts` define cores, espaçamentos, tipografia e alvos Android de 48 dp. `AUTH_THEME` em `mobile/src/theme/auth.ts` deriva desses tokens; não é outra identidade. As telas de detalhe misturam as duas formas de acesso, e Perfil já usa `AUTH_THEME`.

**Decisão**: compor as três superfícies com tokens existentes e, quando útil, migrar estilos locais para a forma canônica `theme`. Reutilizar `SecondaryScreen` e `ScreenState` nas telas secundárias. Alterar um componente compartilhado somente se a necessidade da spec 004 for direta e a regressão nos outros consumidores for coberta.

**Motivo**: mantém consistência com 003, evita dependência e não antecipa a spec 005.

**Alternativas consideradas**: novos tokens, tema escuro ou kit de cards foram descartados por excederem o escopo; valores de estilo duplicados por tela enfraquecem consistência.

## 2. Hierarquia e ação contextual da turma

**Observação**: `mobile/app/(app)/classrooms/[id].tsx` já carrega `useMyClassrooms` e `useClassroomAnnouncements`, diferencia carregamento/erro/ausência, mostra `+ Novo` quando `user?.role === 'PROFESSOR'` e escolhe excluir versus sair por `user?.id === classroom.ownerId`. Hoje o título `Comunicados` antecede o nome da turma e a ação contextual aparece antes da lista ou vazio. O botão de saída mostra `Sair`, embora o nome acessível já seja `Sair da turma`.

**Decisão**: apresentar o nome da turma como contexto principal; `Comunicados` e `+ Novo` formam o cabeçalho da seção; cards/estado vazio aparecem depois; o botão contextual fecha o conteúdo e usa `Sair da turma` ou `Excluir turma` com tratamento destrutivo. Preservar a condição atual de `+ Novo` por papel e a escolha de ação por `ownerId`. Manter o mesmo destino de criação.

**Motivo**: atende à ordem exigida pela spec sem alterar permissão, ownership ou rota. A frase da história que cita professora proprietária descreve um cenário coberto; FR-005 pede preservar as condições atuais.

**Alternativas consideradas**: introduzir gate de ownership para `+ Novo` alteraria comportamento; deixar a ação acima do conteúdo viola FR-009; criar uma nova consulta de detalhe de turma não é necessário.

## 3. Estado da ação destrutiva

**Observação**: a rota de turma usa `ConfirmationDialog`, `actionInFlight`, `isPending`, `getHttpErrorMessage` e `router.replace('/classrooms')` após sucesso. A rota de comunicado usa confirmação com bloqueio de toque repetido e `router.back()` após exclusão. `Button` já oferece variante `destructive` e alvo mínimo.

**Decisão**: mover ou agrupar somente os controles visuais; manter os handlers, confirmação, consequência, pending, feedback de erro, proteção contra envio duplicado e navegação. Cobrir os dois perfis de turma e autoria no teste de regressão.

**Motivo**: essas regras são parte explícita de FR-010, FR-015 e SC-010.

**Alternativas consideradas**: novo modal, novo hook ou nova mutation aumentariam risco funcional sem benefício visual.

## 4. Card e prazo de comunicado

**Observação**: `AnnouncementCard.tsx` mostra título, professor, prévia de três linhas e badge. Sua função local usa `setHours` e `Math.ceil`, mostra `Expira amanhã` para um dia e pode chamar um prazo passado de `Expira hoje`. `mobile/src/lib/classroom-expiration.ts`, entregue pela spec 003, já retorna `Expira hoje`, `Expira em 1 dia`, `Expira em X dias` ou `null` para timestamp inválido/passado, usando datas do calendário local.

**Decisão**: usar o helper existente no card. Manter título, professor, prévia legível e toque que abre o mesmo detalhe; deixar o rótulo textual em nível secundário. Para dado inválido ou expirado no instante da renderização, omitir o prazo enganoso e conservar os demais dados do card, sem filtrar a lista ou mudar a validade no servidor. Revisar o limite de três linhas da prévia contra FR-008: preservar pelo menos a informação atualmente visível, com a leitura integral no detalhe.

**Motivo**: elimina divergência com 003 e impede valor negativo; nenhuma mudança de contrato ou domínio é necessária.

**Alternativas consideradas**: manter o cálculo duplicado perpetuaria rótulos inconsistentes; formatar a data por diferença de milissegundos falha em fronteiras locais de dia; filtrar no cliente mudaria a regra de visibilidade.

## 5. Leitura do detalhe do comunicado

**Observação**: `mobile/app/(app)/announcements/[id].tsx` já apresenta título, autoria, datas e corpo, além de estados loading/erro/ausência, `SecondaryScreen` e ações condicionadas a `user?.id === announcement?.author.id`. Datas são formatadas em `pt-BR`; a tela usa divisores e blocos separados.

**Decisão**: reforçar a escala do título, agrupar publicação/expiração com cada valor, distinguir o corpo e manter largura, quebra de linhas e espaçamento flexíveis. Preservar as strings de data e o fluxo de edição/exclusão. Deixar ações fora da composição quando não houver autoria, sem lacuna reservada.

**Motivo**: melhora a leitura sem alterar dados, datas, origem de autoria ou comportamento.

**Alternativas consideradas**: novo formato de data ou componente de editor envolveria semântica/fluxo além da spec; coluna rígida de metadados arrisca sobreposição em tela estreita.

## 6. Perfil

**Observação**: `mobile/app/(app)/(tabs)/profile.tsx` já apresenta avatar por primeira letra de `user.name`, Nome, E-mail, Perfil, edição e logout. Loading e usuário ausente usam `ScreenState`; logout tem `isSigningOut` e `router.replace('/login')`.

**Decisão**: ajustar hierarquia e espaçamentos com os tokens atuais, permitir quebra natural de nome/e-mail/papel e deixar ícones decorativos sem competir na ordem acessível. Preservar `/profile/edit`, ação de login quando não há usuário e logout com estado de processamento.

**Motivo**: fecha a consistência das superfícies autenticadas sem antecipar gestão de conta.

**Alternativas consideradas**: novos campos, alteração de role label ou mudança na tela de edição ficam fora da spec 004.

## 7. Estratégia de validação e evidência

**Observação**: já existem suites para `classroom-details`, `profile`, `confirmation-matrix`, `secondary-navigation`, `classroom-expiration` e `touch-targets`. A evidência final da spec 003 registrou todos os tasks concluídos, mas o walkthrough Android como `NOT MEASURED` por ausência de `adb`/dispositivo naquela execução.

**Decisão**: ampliar testes para hierarquia/ordem, estados, rótulos, permissões e resultado dos handlers; executar gates mobile e walkthrough Android quando disponível. Registrar `NOT MEASURED` para largura, escala, TalkBack, iOS ou participante sem observação real. Não inferir experiência manual de Jest, Expo Doctor ou export.

**Motivo**: testes automatizados verificam semântica e regressão; layout e tecnologia assistiva exigem observação apropriada.

**Alternativas consideradas**: classificar toda a UX como aprovada após export deixaria SC-008 e SC-009 sem prova.

## Resolução de desconhecidos

As verificações locais cobriram caminhos, dependências, contratos, estados e regras de visibilidade. Não resta `NEEDS CLARIFICATION` para o desenho. A execução manual Android continua sendo uma atividade de validação futura, não uma lacuna de requisito.
