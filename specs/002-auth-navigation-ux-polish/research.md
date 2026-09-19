# Research: Auth Navigation UX Polish

**Data**: 2026-09-16

**Escopo**: resolver as decisões técnicas da spec 002 sem implementar o
comportamento.

## 1. Baseline observado no repositório

O aplicativo é Expo/React Native com Expo Router, TypeScript, React Hook Form,
Zod, TanStack React Query e Jest Expo/RNTL. A versão instalada é Expo SDK 57,
React Native 0.86.3 e expo-router ~57.0.21.

Os layouts raiz, de autenticação e autenticado configuram headerShown: false.
Por isso, as telas secundárias não recebem atualmente o back visual padrão do
Stack. As rotas existentes são:

- mobile/app/(auth)/register.tsx;
- mobile/app/(app)/classrooms/new.tsx;
- mobile/app/(app)/classrooms/[id].tsx;
- mobile/app/(app)/classrooms/[id]/new-announcement.tsx;
- mobile/app/(app)/announcements/[id].tsx;
- mobile/app/(app)/announcements/[id]/edit.tsx;
- mobile/app/(app)/profile/edit.tsx.

O AuthScreen usa um ScrollView com flexGrow e
keyboardShouldPersistTaps="handled", mas não há KeyboardAvoidingView. O Login
renderiza dois botões com label “Criar conta”: um no footer e outro abaixo de
“Entrar”. Os estados antecipados de várias rotas retornam ScreenState antes do
SafeAreaView, portanto um botão colocado apenas no conteúdo de sucesso não
atenderia FR-007.

## 2. Decisão: controle visual compartilhado com fallback explícito

**Decision**: criar BackButton e SecondaryScreen em
mobile/src/components/ui. O shell manterá o BackButton fixo na área segura e
envolverá o conteúdo de sucesso, loading, erro e not-found. A ação seguirá esta
ordem:

1. ignorar a ativação se o guard local já estiver ocupado;
2. marcar a ativação como ocupada de forma síncrona;
3. consultar router.canGoBack() no instante do toque;
4. chamar router.back() se houver histórico;
5. caso contrário, chamar router.replace(fallbackHref).

O detalhe do comunicado terá fallback /classrooms nos estados em que o pai não
pode ser identificado. Depois de carregar um comunicado com classroomId, o
fallback será /classrooms/:classroomId. Os demais fallbacks são determinados
pela spec e não dependem de dados de API.

**Rationale**:

- A documentação do Expo Router descreve que o Stack normalmente exibe back e
  que navegar para uma nova rota empilha a tela; neste projeto o header foi
  deliberadamente ocultado, então um controle de conteúdo é o menor ponto de
  integração.
- O tipo instalado de useRouter() expõe canGoBack, back e replace.
  canGoBack() permite distinguir histórico utilizável de entrada direta, sem
  presumir que a rota anterior seja o pai lógico.
- replace no fallback não cria uma nova entrada que levaria a pessoa de volta à
  rota sem histórico. O guard cobre a janela em que dois toques ocorreriam
  antes de a navegação desmontar a tela.
- O shell compartilhado evita que loading, erro e not-found fiquem sem saída.

**Sources**:

- [Expo Router: navigation layouts](https://docs.expo.dev/router/basics/navigation-layouts/)
- [Expo Router: navigating between pages](https://docs.expo.dev/router/basics/navigation/)
- [React Navigation: navigation object and canGoBack](https://reactnavigation.org/docs/navigation-object/)
- Tipos locais em mobile/node_modules/expo-router/build/hooks/useRouter.d.ts e
  mobile/node_modules/expo-router/build/global-state/router.d.ts.

**Alternatives considered**:

- **Reativar o header nativo somente nas sete rotas**: rejeitado porque o
  baseline esconde o header em todos os layouts, o header padrão não fornece o
  mesmo fallback customizado para entrada direta e os títulos/estilos atuais
  precisariam ser reorganizados. Também criaria risco de duplicar o controle se
  um botão de conteúdo fosse mantido.
- **Usar somente unstable_settings.anchor**: útil para ancorar deep links,
  mas não substitui a ação visual exigida e não expressa o pai dinâmico do
  detalhe de comunicado em todos os estados.
- **Interceptar BackHandler ou o gesto nativo**: rejeitado porque poderia
  substituir ou duplicar o comportamento nativo explicitamente preservado por
  FR-006. O componente visual não instalará listener de volta.
- **Usar push para o fallback**: rejeitado porque perpetuaria no histórico a
  rota secundária sem pai e poderia prender a pessoa em um ciclo.

## 3. Decisão: ajuste nativo do cadastro ao teclado

**Decision**: evoluir o AuthScreen, compartilhado por Login e cadastro, com
KeyboardAvoidingView envolvendo o ScrollView. Usar behavior="height" no
Android e behavior="padding" no iOS; manter flex: 1, flexGrow: 1,
keyboardShouldPersistTaps="handled" e espaço inferior rolável. O cadastro
ativará o BackButton opcional fora da área rolável; o Login não ativará esse
slot.

O desenho mantém a seleção de perfil, valores e validações na instância atual
do React Hook Form. A adição/remoção de teacherCode continua passando por
shouldUnregister, clearErrors e resetField, sem alterar o payload.

**Rationale**:

- A documentação do React Native define KeyboardAvoidingView justamente para
  ajustar altura, posição ou padding quando o teclado aparece.
- A documentação também recomenda informar behavior em Android e iOS. A
  estratégia por plataforma evita depender de um comportamento implícito.
- O ScrollView é necessário porque o formulário pode ser maior que a viewport
  reduzida. keyboardShouldPersistTaps="handled" preserva o toque em controles
  enquanto o teclado está aberto; padding inferior permite alcançar mensagens e
  o botão final.
- automaticallyAdjustKeyboardInsets é uma capacidade específica de iOS no
  ScrollView; não será a única solução para o alvo Android. Se usado para
  compatibilidade, ficará complementar ao KeyboardAvoidingView.

**Sources**:

- [React Native: KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview)
- [React Native: ScrollView](https://reactnative.dev/docs/scrollview)

**Alternatives considered**:

- **Biblioteca externa de keyboard-aware scroll**: rejeitada; o caso cabe nos
  componentes nativos, e uma dependência nova exigiria lockfile, Doctor e
  manutenção sem benefício já demonstrado.
- **Somente padding fixo ou eventos manuais de teclado**: rejeitado porque uma
  altura fixa não acompanha tamanhos de teclado, safe area, texto ampliado ou
  erro que aumenta o formulário.
- **Alterar windowSoftInputMode/configuração nativa global**: rejeitado porque
  amplia a superfície para todas as telas e pode alterar outros formulários.

## 4. Decisão: acessibilidade e identidade visual

**Decision**: o BackButton usará Pressable, Ionicons já instalado, tokens de
mobile/src/theme/tokens.ts, label visual “Voltar”, role de botão e
accessibilityLabel="Voltar". O alvo será pelo menos theme.targets.android
(48 dp), que também supera o alvo iOS existente de 44 pt. A cor, espaçamento,
radius e estados seguirão os tokens já utilizados por Button, AuthButton e
AuthField.

**Rationale**: a constituição exige semântica acessível, idioma português e
preferência por primitivas reutilizáveis. A solução não introduz identidade
visual paralela e não usa cor como único indicador de ação.

**Alternatives considered**:

- **Ícone sem texto ou label genérico**: rejeitado porque não comunica a ação
  para leitores de tela e reduz a descoberta visual.
- **Estilos literais novos**: rejeitados porque aumentariam divergência com o
  tema existente.

## 5. Decisão: cobertura e evidência

**Decision**: adicionar testes de componente para o guard/semântica, testes de
rota para a matriz dos sete fallbacks e testes de autenticação para o CTA único
e os dois perfis de cadastro. A verificação manual será Android, com o
automated test suite como evidência complementar.

Os mocks de expo-router em mobile/tests/setup.ts e nos testes de rota receberão
canGoBack somente onde a primitiva for montada. Mutations existentes continuarão
sendo testadas com as mesmas expectativas, inclusive navegação após sucesso.

**Rationale**: a lógica de fallback/duplo toque é determinística e deve ser
automatizada; visibilidade real do teclado, gesto/botão nativo e área útil
dependem de um dispositivo Android. Export e Expo Doctor serão tratados como
evidência de empacotamento/saúde, não como prova de usabilidade humana.

Não há pesquisa pendente nem decisão técnica em aberto.
