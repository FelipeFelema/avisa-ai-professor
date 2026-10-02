# Research: Theme Preferences

**Data**: 2026-10-01  
**Fontes**: código local desta branch, spec 005 e documentação oficial da Expo para [temas](https://docs.expo.dev/develop/user-interface/color-themes/), [barra de status](https://docs.expo.dev/versions/latest/sdk/status-bar/) e [barras do sistema](https://docs.expo.dev/develop/user-interface/system-bars/).

## 1. Baseline e paletas

**Observação**: `mobile/src/theme/tokens.ts` exporta somente uma paleta Clara; `auth.ts` deriva aliases de autenticação. Cores são resolvidas em `StyleSheet.create` no carregamento dos módulos. O teste `mobile/tests/theme/tokens.spec.ts` cobre papéis e alguns pares atuais. Os valores hex/rgba encontrados em `mobile/app` e `mobile/src/components` já foram removidos; a origem de cores é `tokens.ts`.

**Decisão**: definir `lightTheme` e `darkTheme` com as mesmas chaves e métricas. Acrescentar papéis apenas para estados reais que não caibam nas chaves atuais, como seleção/foco ou superfície de navegação. Derivar aliases de autenticação da paleta recebida, sem singleton Claro. Preservar os valores Claros salvo correção demonstrada por contraste. Medir pares reais: texto normal >= 4,5:1, texto grande >= 3:1, com bordas, ícones e estados essenciais distinguíveis.

**Motivo**: trocar apenas o valor exportado não atualiza estilos calculados uma vez. Uma paleta Escura explícita permite ajustar hierarquia e cores de ação sem inversão automática.

**Alternativas consideradas**: duplicar estilos por tela aumenta divergência; `Appearance`/`useColorScheme` seguiria o sistema, fora da spec; um singleton mutável deixaria estilos importados presos à paleta anterior.

## 2. Persistência e bootstrap

**Observação**: `@react-native-async-storage/async-storage` já está em `mobile/package.json` e é armazenamento persistente não criptografado, adequado para essa preferência não sensível ([Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/async-storage/)). `auth.storage.ts` usa SecureStore só para tokens. `AppProvider` monta `AuthProvider` acima das rotas. `SplashScreen.tsx` é o loading React simples. `mobile/app.json` declara `userInterfaceStyle: light`, mas o SDK 57 exige `expo-system-ui` para aplicar essa propriedade no Android; o pacote não está instalado ([Expo](https://docs.expo.dev/develop/user-interface/color-themes/)).

**Decisão**: chave própria AsyncStorage com somente `light` ou `dark`, independente de `auth.storage.ts`. Montar `ThemeProvider` acima de `AuthProvider`; manter sua identidade constante e não apresentar rotas/estados React até a tentativa única de leitura terminar. Ausência, valor inválido ou exceção resultam em Claro. Após a resolução, loading, redirects e primeira rota usam a mesma paleta. Logout não toca na chave.

**Motivo**: AsyncStorage serve para preferência não sensível sem pacote ou servidor. Resolver antes das rotas evita flash Claro na interface React e conserva a escolha durante mudanças de sessão.

**Alternativas consideradas**: ler em cada tela cria flashes; associar ao usuário quebra o compartilhamento no dispositivo; SecureStore mistura preferência visual com segredos; bloquear em erro viola fallback.

**Limite de plataforma**: um launch screen nativo exibido antes do JavaScript não lê essa chave através deste desenho. O manifesto não configura explicitamente um splash nativo, e a aparência real no Android não pode ser deduzida de `userInterfaceStyle: light` sem `expo-system-ui`. O plano exige primeira interface React e estados preparatórios React no tema salvo. A transição desde o launch screen nativo deve ser observada em um build Android, pois a [documentação Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/) ressalta que Expo Go e builds de desenvolvimento não reproduzem integralmente a experiência final. Se houver flash incompatível, investigar aparência nativa neutra sem pacote novo e registrar o resultado. Se isso não for viável, SC-003 permanece parcialmente não atendido até revisão explícita de escopo; teste de provider sozinho não resolve o ponto.

## 3. Alternância rápida e falhas

**Decisão**: aplicar a seleção em memória antes da operação assíncrona. Serializar gravações na ordem das escolhas, com identificador da última escolha para que somente a falha relevante exiba aviso: “A aparência mudou, mas a preferência pode não permanecer após fechar o aplicativo”. A última gravação bem-sucedida deve refletir a última escolha feita. Em falha da escolha atual, manter tema ativo e aviso até nova escolha ou ação apropriada.

**Motivo**: `setItem` concorrentes podem terminar fora da ordem de interação; reverter a UI em falha viola FR-011.

**Alternativas consideradas**: escrita sem serialização arrisca restaurar tema antigo; bloquear seletor viola alternância imediata; rollback retira escolha utilizável na sessão.

## 4. Propagação sem perda de estado

**Observação**: rotas e componentes usam `theme.colors` e `AUTH_THEME.colors` em estilos estáticos. O Perfil tem estado de logout; formulários mantêm valores próprios; dialogs são `Modal` nas rotas; abas têm tintas, mas não fundo explícito.

**Decisão**: expor `useTheme()` com paleta e preferência; derivar estilos dependentes de cor durante render, preservando estrutura estática. Não usar `key={theme}` no provider, `Stack`, `Tabs`, `ScrollView`, formulários ou dialogs. Propagar para telas públicas/autenticadas, detalhes, forms e componentes compartilhados. Abas terão fundo, borda, ícones e rótulos da paleta. `expo-status-bar` receberá estilo explícito (`light` no Escuro, `dark` no Claro); `auto` segue o esquema ativo da plataforma, que não representa necessariamente a preferência local ([documentação Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/status-bar/)).

**Motivo**: re-renderizar cores na árvore atual conserva entrada, scroll, teclado, dialog e operações pendentes.

**Alternativas consideradas**: duas árvores por tema duplicam estado; atualizar só Perfil deixa superfícies inconsistentes; `userInterfaceStyle: automatic` faria o app reagir ao sistema e, em Android development build, exige `expo-system-ui` conforme a [Expo](https://docs.expo.dev/develop/user-interface/color-themes/), em conflito com o escopo sem pacote novo.

## 5. Cobertura e evidência

**Observação**: há Login/Cadastro, Home/Turmas/Perfil, detalhes/formulários de turma/comunicado/perfil, componentes `auth`, `home`, `announcements`, `ui`, estados `SplashScreen`/`ScreenState`, dialogs e tab bar. A spec 004 concluiu o código e gates, mas mantém `T020`/`T021` pendentes para largura/texto ampliado e tecnologia assistiva Android; o relatório registra `NOT MEASURED`.

**Decisão**: inventariar cada consumo de cor e testar ambos os temas por superfície, inclusive loading, vazio, erro, ausência, sucesso, campo focado/inválido/desabilitado, ação pendente/destrutiva e dialog. Combinar testes de tokens/estilos e regressão de handlers com walkthrough real de contraste, barra de status, teclado, rota/scroll/form/dialog preservados. Reportar resultados manuais separadamente.

**Motivo**: teste automatizado verifica contrato e regressão; aparência final, sistema e tecnologia assistiva exigem observação apropriada.

**Alternativas consideradas**: Expo export/Doctor provam empacotamento/configuração, sem medir visual ou preservação interativa.

## Resolução de desconhecidos

Armazenamento, escopo, ordem de inicialização, serialização, fonte da paleta e propagação estão definidos. O launch screen nativo e a acessibilidade observada permanecem pontos de validação em dispositivo, não decisões técnicas em aberto. Nenhum `NEEDS CLARIFICATION` permanece.

## 6. Refinamento solicitado: Login e ícones sol/lua (2026-10-02)

**Verificação de convenções**: O [Android admite mudança de tema dentro do app](https://developer.android.com/develop/ui/views/theming/darktheme), sem prescrever o Login como localização. Os [templates oficiais do Material UI](https://mui.com/material-ui/getting-started/templates/) incluem telas de autenticação e disponibilizam alternância de aparência nas prévias. O [tutorial Carbon](https://preview.carbondesignsystem.com/getting-started/developing/web-components-tutorial/step-1) apresenta seleção de tema com ícones de sol e lua. Essas referências demonstram padrões possíveis, não uma exigência universal de posicionamento. A [Apple prioriza a preferência do sistema e desaconselha um controle próprio](https://developer.apple.com/design/human-interface-guidelines/dark-mode), mostrando que a orientação varia entre plataformas.

**Decisão para este produto**: Como a spec já define preferência manual da instalação, disponibilizar o mesmo controle antes da autenticação no Login é coerente e evita exigir entrada na conta para ajustar conforto visual. Manter o acesso no Perfil. A decisão de posicionamento é uma inferência de UX baseada no fluxo local, não uma regra imposta pelas fontes. Não acrescentar opção de seguir o sistema nem alterar o fallback Claro.

**Forma do controle**: Seletor compacto de duas opções com sol/Claro e lua/Escuro, nomes/seleção acessíveis, rótulo curto do tema atual e alvos de 48 dp. Cada ícone indica o tema que seleciona; o estado marcado identifica o tema atual. Reutilizar `useTheme`, persistência e aviso de falha nas duas superfícies. O Login mantém o formulário e a operação em curso. Implementação e verificações pertencem a T042, ainda não executada.
