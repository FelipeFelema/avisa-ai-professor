# Feature Specification: Theme Preferences

**Feature Branch**: `[005-theme-preferences]`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Adicionar temas Claro e Escuro ao sistema visual estabilizado, permitir que a pessoa escolha sua preferência no Perfil, persistir essa escolha localmente e aplicá-la de forma consistente em todas as telas e estados do aplicativo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Escolher o tema no Login e no Perfil (Priority: P1)

Como pessoa usando o aplicativo, quero escolher entre os temas Claro e Escuro no Login antes de entrar e no Perfil depois da autenticação, para adaptar a aparência à minha preferência local sem alterar informações da conta.

**Why this priority**: A escolha explícita é a principal capacidade da feature e fornece o ponto de controle necessário para ativar e comparar os dois temas.

**Independent Test**: Pode ser testada abrindo o Perfil, alternando entre Claro e Escuro e verificando a seleção e a aparência da própria tela. A troca deve ocorrer imediatamente, sem reiniciar o aplicativo, mudar de rota ou depender das demais telas.

**Refinamento aprovado em 2026-10-02**: Repetir a alternância no Login sem autenticação, com campos preenchidos e login pendente; usar o mesmo seletor compacto com sol/Claro e lua/Escuro nas duas superfícies.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada no Perfil, **When** localiza a preferência de tema, **Then** encontra exatamente as opções "Claro" e "Escuro" e identifica qual está selecionada sem depender apenas de cor.
2. **Given** que o tema Claro está ativo, **When** a pessoa escolhe "Escuro", **Then** o Perfil adota o tema Escuro imediatamente e conserva os dados, a posição e as ações existentes.
3. **Given** que o tema Escuro está ativo, **When** a pessoa escolhe "Claro", **Then** o Perfil adota o tema Claro imediatamente e mantém a opção Claro marcada como selecionada.
4. **Given** um formulário preenchido, um dialog aberto ou uma operação em andamento, **When** o tema é alterado, **Then** a aparência muda sem apagar entradas, reiniciar navegação, fechar o dialog ou repetir a operação.
5. **Given** que a gravação local da nova preferência falha, **When** a pessoa faz a escolha, **Then** o aplicativo continua utilizável e informa claramente que a preferência pode não permanecer após o encerramento.
6. **Given** uma pessoa não autenticada no Login com e-mail/senha preenchidos ou login pendente, **When** escolhe Claro ou Escuro no seletor sol/lua, **Then** a escolha local é aplicada imediatamente, comunica o tema atual por texto e semântica acessível, preserva os dados/foco/estado da operação e acompanha o próximo login, logout e inicialização quando salva com sucesso; falha de gravação produz aviso também no Login.

---

### User Story 2 - Usar todas as superfícies nos dois temas (Priority: P2)

Como pessoa usando o aplicativo, quero que telas, controles e estados permaneçam legíveis e coerentes no tema escolhido, para concluir as mesmas tarefas tanto no Claro quanto no Escuro.

**Why this priority**: Uma alternância parcial deixaria trechos ilegíveis ou visualmente quebrados. O valor do tema Escuro depende de cobertura consistente em toda a experiência atual.

**Independent Test**: Pode ser testada percorrendo a matriz de telas públicas, autenticadas, secundárias e formulários em ambos os temas. Conteúdo, controles, navegação e estados devem manter hierarquia, contraste e comportamento equivalentes.

**Acceptance Scenarios**:

1. **Given** o tema Claro ou Escuro, **When** a pessoa percorre Login, Cadastro, Home, Turmas, Perfil e as telas secundárias atuais, **Then** cada superfície usa fundo, cards, textos, bordas, ícones e ações coerentes com o tema ativo.
2. **Given** um formulário em qualquer tema, **When** a pessoa observa campos vazios, preenchidos, focados, desabilitados ou inválidos, **Then** rótulos, valores, placeholders, bordas, ajuda e erros permanecem distinguíveis.
3. **Given** um dialog, estado vazio, carregamento, erro, sucesso ou item ausente, **When** é apresentado em qualquer tema, **Then** conteúdo, backdrop, ação e significado visual permanecem compreensíveis.
4. **Given** uma ação primária, secundária, neutra ou destrutiva, **When** é exibida, pressionada, desabilitada ou fica pendente, **Then** seu papel e estado continuam reconhecíveis sem depender exclusivamente de cor.
5. **Given** que o tema muda, **When** a pessoa observa barra de abas, navegação secundária e barra de status do sistema, **Then** fundos, ícones e textos se adaptam ao novo tema sem trecho claro ou escuro residual.

---

### User Story 3 - Manter a preferência no dispositivo (Priority: P3)

Como pessoa que já escolheu um tema, quero que o aplicativo restaure essa preferência nos próximos usos do mesmo dispositivo, para não precisar selecioná-la novamente a cada sessão.

**Why this priority**: A persistência transforma a alternância em uma preferência real e evita uma experiência inconsistente durante inicialização, logout e novo login.

**Independent Test**: Pode ser testada escolhendo um tema, encerrando e reabrindo o aplicativo e passando por logout e novo login. A primeira superfície utilizável deve aparecer no tema salvo sem exigir nova seleção.

**Acceptance Scenarios**:

1. **Given** que a pessoa escolheu Escuro e a preferência foi salva, **When** encerra e reabre o aplicativo, **Then** a primeira superfície utilizável e os estados preparatórios aparecem em Escuro sem uma mudança visível para Claro.
2. **Given** uma preferência salva, **When** a pessoa encerra a sessão e retorna ao fluxo de autenticação, **Then** o mesmo tema permanece ativo no dispositivo.
3. **Given** que outra conta entra no mesmo dispositivo, **When** o aplicativo é apresentado, **Then** utiliza a preferência local já salva, sem afirmar que ela foi sincronizada com a conta.
4. **Given** uma instalação sem preferência salva, **When** o aplicativo inicia, **Then** usa o tema Claro como padrão.
5. **Given** uma preferência ausente, inválida ou impossível de ler, **When** o aplicativo inicia, **Then** usa o tema Claro de forma segura e permanece operável.

### Edge Cases

- O aplicativo é iniciado pela primeira vez e ainda não há preferência local.
- O valor persistido não corresponde a Claro nem Escuro.
- A leitura ou gravação local falha ou fica temporariamente indisponível.
- A pessoa alterna o tema repetidamente em sequência rápida.
- A mudança ocorre com teclado aberto, formulário parcialmente preenchido, dialog visível, confirmação pendente ou lista rolada.
- A sessão expira ou a pessoa faz logout enquanto o tema Escuro está ativo.
- A aplicação inicia em carregamento, redirecionamento de autenticação ou restauração de sessão antes de chegar à primeira tela.
- Cards, títulos, nomes, e-mails ou comunicados contêm texto longo ou são exibidos com texto ampliado.
- Ações destrutivas, avisos e erros precisam manter destaque suficiente sem se confundir com fundos escuros.
- A barra de status e a barra de abas atravessam uma troca de tema com a tela já aberta.

## Requirements *(mandatory)*

### In-Scope Surface Inventory

| Grupo | Superfícies e elementos abrangidos |
|---|---|
| Inicialização e navegação | Estado inicial, restauração de sessão, fluxos público e autenticado, barra de abas, navegação secundária e barra de status do sistema |
| Autenticação | Login e Cadastro, incluindo campos, seleção de perfil, validações e rodapé |
| Superfícies principais | Home, Turmas e Perfil, incluindo a nova preferência de tema |
| Superfícies secundárias | Detalhes e formulários atuais de turma, comunicado e perfil |
| Elementos compartilhados | Cards, campos, botões, ícones, dialogs, backdrops, empty states e estados de carregamento, erro, sucesso e item ausente |

### Functional Requirements

- **FR-001**: O aplicativo MUST oferecer exatamente duas preferências selecionáveis nesta feature: "Claro" e "Escuro".
- **FR-002**: Na ausência de uma preferência local válida, o aplicativo MUST utilizar Claro como tema padrão.
- **FR-003**: O Perfil MUST apresentar a preferência de tema como um bloco distinto das informações e ações de conta, sem adicionar qualquer outra capacidade de Perfil.
- **FR-004**: O controle MUST comunicar nome, finalidade, opções disponíveis e seleção atual de forma textual e semanticamente acessível, sem depender apenas de cor ou ícone.
- **FR-005**: A escolha de Claro ou Escuro MUST ser aplicada imediatamente à superfície atual e ao restante do aplicativo, sem exigir reinício, recarregamento ou nova navegação.
- **FR-006**: Alterar o tema MUST preservar rota, posição relevante de leitura, valores de formulário, teclado, dialogs, operações pendentes e demais estados funcionais em andamento.
- **FR-007**: A preferência selecionada MUST ser persistida localmente no dispositivo e restaurada em inicializações futuras.
- **FR-008**: A preferência local MUST permanecer depois de logout, expiração de sessão e novo login e MUST NOT ser apresentada como preferência sincronizada à conta.
- **FR-009**: A restauração MUST ocorrer cedo o suficiente para que a primeira superfície utilizável e os estados preparatórios não exibam uma troca perceptível do tema salvo para o tema padrão.
- **FR-010**: Uma preferência ausente, desconhecida, corrompida ou impossível de ler MUST resultar em fallback seguro para Claro, sem bloquear inicialização, autenticação ou navegação.
- **FR-011**: Se a gravação local falhar, o tema escolhido MUST continuar utilizável na sessão atual e a pessoa MUST receber feedback de que a escolha pode não persistir.
- **FR-012**: Claro e Escuro MUST compartilhar os mesmos papéis semânticos de cor para fundo, superfície, superfície secundária, texto principal e secundário, borda, ação primária, informação, sucesso, aviso, perigo, backdrop e navegação.
- **FR-013**: Cores dependentes de tema MUST ser obtidas pelos papéis semânticos correspondentes; telas e componentes em escopo MUST NOT manter valores visuais diretos que impeçam a adaptação entre Claro e Escuro.
- **FR-014**: O tema Claro MUST preservar a identidade clean, minimalista e a paleta visual estabilizada nas specs anteriores, admitindo somente ajustes necessários à consistência semântica e ao contraste.
- **FR-015**: O tema Escuro MUST preservar a mesma identidade, hierarquia e significado do Claro, sem ser apenas uma inversão automática das cores.
- **FR-016**: Todas as superfícies enumeradas no inventário MUST responder ao tema ativo; nenhuma tela atual pode permanecer fixada em Claro ou misturar paletas após a troca.
- **FR-017**: Cards, campos, seletores e áreas de conteúdo MUST distinguir superfície, borda, foco, seleção, preenchimento, desabilitado e erro nos dois temas.
- **FR-018**: Textos principais, secundários, placeholders, ícones e separadores MUST manter legibilidade e hierarquia nos dois temas, inclusive com texto ampliado.
- **FR-019**: Botões e ações primárias, secundárias, neutras e destrutivas MUST preservar significado, estados pressionado, desabilitado e pendente e contraste adequado nos dois temas.
- **FR-020**: Dialogs e confirmações MUST adaptar card, backdrop, textos, resumo, erro e ações ao tema ativo sem reduzir o destaque de consequências destrutivas.
- **FR-021**: Estados de carregamento, vazio, erro, sucesso e item ausente MUST ser visualmente completos nos dois temas e MUST conservar mensagens e ações existentes.
- **FR-022**: Barra de abas, controles de navegação secundária e barra de status do sistema MUST adaptar fundo, ícones e textos ao tema ativo.
- **FR-023**: Pares de texto e fundo MUST atingir contraste mínimo de 4,5:1 para texto normal e 3:1 para texto grande; limites, ícones e estados essenciais MUST manter contraste perceptível nos dois temas.
- **FR-024**: A alternância de tema MUST preservar integralmente autenticação, consultas, mutações, permissões, validações, confirmações, navegação e regras de domínio existentes.
- **FR-025**: A feature MUST permanecer local ao aplicativo móvel e MUST NOT exigir novo endpoint, contrato de API, dado de usuário no servidor, migração de banco ou dependência externa adicional.
- **FR-026**: Login e Perfil MUST compartilhar um seletor compacto com sol para Claro e lua para Escuro, disponível no Login sem autenticação, com exatamente duas opções explicitamente nomeadas à acessibilidade, seleção semântica, indicação além de cor e rótulo textual do tema atual. O controle MUST reutilizar a preferência local e o feedback de falha de gravação, preservar formulários/operações e manter alvos de toque de pelo menos 48 dp.

### Key Entities

- **Preferência de tema**: Valor local do dispositivo com uma das opções válidas Claro ou Escuro, acompanhado pelo estado necessário para leitura, aplicação e persistência.
- **Paleta semântica**: Conjunto de papéis visuais compartilhados pelos dois temas; cada papel conserva o mesmo significado enquanto seu valor visual pode variar.
- **Tema ativo**: Resultado atualmente aplicado a toda a árvore visual, derivado da preferência restaurada ou do padrão Claro.

### Out of Scope

- Opção automática "Seguir o sistema", agendamento por horário ou mudança baseada em luminosidade.
- Sincronização da preferência com conta, backend ou outros dispositivos.
- Temas personalizados, escolha livre de cores ou mais de duas opções.
- Redesign das telas, mudança de identidade visual ou alteração de hierarquia que não seja necessária para a compatibilidade entre temas.
- Novos campos, edição de role, alteração de senha, exclusão de conta ou qualquer outra capacidade de Perfil.
- Mudanças funcionais na pesquisa de turmas, recursos administrativos, notificações ou regras de domínio.
- Personalização do teclado do sistema ou de outras interfaces externas ao aplicativo, além da adaptação da barra de status prevista no escopo.
- Novo endpoint, contrato de API, persistência no servidor, migration ou pacote adicional.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das trocas entre Claro e Escuro no Login e no Perfil, a opção selecionada e a aparência da tela são atualizadas sem reinício, mudança de rota ou perda de estado funcional.
- **SC-002**: Em uma matriz com todas as superfícies do inventário, 100% são exibidas integralmente em Claro e Escuro sem fundos, cards, textos, inputs, dialogs ou navegação presos à paleta oposta.
- **SC-003**: Após encerramento e nova abertura, logout e novo login, 100% das preferências gravadas com sucesso são restauradas antes da primeira superfície utilizável, sem flash perceptível do tema incorreto.
- **SC-004**: Preferência ausente, inválida ou ilegível produz Claro e mantém o aplicativo operável em 100% dos cenários de recuperação previstos.
- **SC-005**: 100% dos pares de texto avaliados atendem a 4,5:1 para texto normal ou 3:1 para texto grande em ambos os temas; nenhum significado essencial depende somente de cor.
- **SC-006**: Campos vazios, focados, preenchidos, inválidos e desabilitados permanecem distinguíveis em 100% dos formulários atuais nos dois temas.
- **SC-007**: Ações primárias, secundárias, neutras e destrutivas e seus estados pressionado, desabilitado e pendente permanecem identificáveis em 100% dos componentes aplicáveis nos dois temas.
- **SC-008**: Barra de abas, navegação secundária e barra de status usam a combinação correta de fundo e conteúdo em 100% das trocas e inicializações cobertas.
- **SC-009**: Trocar o tema com formulário preenchido, dialog aberto, lista rolada ou operação pendente preserva o estado anterior em 100% dos cenários de regressão aplicáveis.
- **SC-010**: Login, cadastro, navegação, busca atual, ações de turma e comunicado, edição de perfil e logout mantêm o mesmo resultado funcional anterior em 100% dos testes de regressão aplicáveis.

## Assumptions

- A spec `004-detail-surfaces-visual-polish` está concluída e fornece a última base visual necessária para esta feature.
- Claro continua sendo a aparência padrão para instalações sem uma escolha válida, preservando a experiência atual.
- A preferência pertence à instalação do aplicativo, não à conta autenticada; pessoas diferentes no mesmo dispositivo compartilham a escolha local.
- O tema salvo também se aplica às telas de autenticação depois do logout; o controle de escolha fica no Login e no Perfil e compartilha a mesma preferência da instalação.
- A capacidade de armazenamento local já disponível no projeto é suficiente; nenhuma nova dependência é necessária.
- Uma falha de gravação não desfaz a escolha durante a sessão atual, mas deve deixar explícito que a preferência pode voltar ao último valor válido em uma nova inicialização.
- A evidência manual principal continua seguindo o alvo Android do ciclo atual; dispositivo, versão, barra de status real, tecnologia assistiva, iOS e participantes ausentes devem ser registrados como `NOT MEASURED`, não inferidos de testes ou empacotamento.
- A feature deve ser encerrada antes de iniciar qualquer trabalho que dependa da base visual completa, conforme a sequência aprovada `003 → 004 → 005`.
