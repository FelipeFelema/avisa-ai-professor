# Feature Specification: Detail Surfaces Visual Polish

**Feature Branch**: `[004-detail-surfaces-visual-polish]`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Melhorar a hierarquia visual, a legibilidade e a consistência do detalhe da turma, do detalhe do comunicado e do Perfil, preservando comportamentos, permissões e identidade visual existentes e sem antecipar tema, gestão de conta ou novas capacidades de produto."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar os comunicados de uma turma (Priority: P1)

Como pessoa participante de uma turma, quero reconhecer rapidamente a turma, a seção de comunicados e cada aviso publicado, para consultar as informações importantes sem que ações administrativas disputem atenção com o conteúdo.

**Why this priority**: O detalhe da turma é o principal caminho entre a lista de turmas e os comunicados. Sua hierarquia precisa favorecer leitura e descoberta antes das ações destrutivas.

**Independent Test**: Pode ser testada abrindo uma turma como proprietário e como membro, com comunicados, sem comunicados e nos estados de carregamento e erro. O contexto da turma, a lista e a ação permitida devem permanecer claros sem depender das outras duas superfícies desta feature.

**Acceptance Scenarios**:

1. **Given** que a turma possui comunicados, **When** a pessoa abre seu detalhe, **Then** identifica o nome da turma e "Comunicados" como níveis distintos da hierarquia antes de percorrer os cards.
2. **Given** que um comunicado aparece na lista, **When** a pessoa lê seu card, **Then** encontra título, professor, prévia do conteúdo e prazo de expiração organizados em ordem clara e pode abrir o detalhe pelo mesmo comportamento atual.
3. **Given** que a pessoa é membro e não proprietária, **When** chega ao fim do conteúdo da turma, **Then** encontra "Sair da turma" depois da lista ou de seu estado vazio, com tratamento destrutivo e confirmação antes da saída.
4. **Given** que a pessoa é proprietária, **When** chega ao fim do conteúdo da turma, **Then** encontra "Excluir turma" na mesma área final destinada à ação destrutiva, sem perder a confirmação ou a regra de ownership existente.
5. **Given** que a pessoa é professora proprietária, **When** abre a turma, **Then** continua encontrando "+ Novo" associado à seção de comunicados e pode iniciar a criação pelo mesmo destino atual.
6. **Given** que não há comunicados, **When** o detalhe é exibido, **Then** a ausência é explicada por um estado vazio claro e a ação destrutiva contextual permanece depois desse estado.

---

### User Story 2 - Ler um comunicado completo (Priority: P2)

Como pessoa que abriu um comunicado, quero distinguir título, professor, datas e conteúdo com facilidade, para compreender a mensagem e seu período de validade sem examinar uma composição visualmente uniforme.

**Why this priority**: O comunicado contém a informação central do produto. Uma hierarquia previsível melhora a leitura sem alterar autoria, validade ou regras de acesso.

**Independent Test**: Pode ser testada abrindo um comunicado curto e outro com título, autor e conteúdo longos. Título, autoria, publicação, expiração e corpo devem permanecer legíveis, enquanto ações de edição e exclusão continuam limitadas ao autor.

**Acceptance Scenarios**:

1. **Given** um comunicado válido, **When** seu detalhe é aberto, **Then** o título é o elemento textual principal, o professor aparece como autoria identificável e as datas "Publicado em" e "Expira em" formam um bloco de metadados fácil de percorrer.
2. **Given** que o comunicado possui conteúdo longo, **When** a pessoa percorre a tela, **Then** o texto mantém largura, espaçamento e ritmo de leitura adequados sem sobreposição ou corte de informação.
3. **Given** que a pessoa é autora do comunicado, **When** chega às ações, **Then** continua encontrando "Editar" e "Excluir", com exclusão destrutiva e confirmação preservada.
4. **Given** que a pessoa não é autora, **When** lê o comunicado, **Then** não encontra ações de edição ou exclusão e a ausência delas não deixa a composição incoerente.
5. **Given** que o comunicado está carregando, falhou ou não existe mais, **When** a tela é exibida, **Then** a pessoa recebe o estado correspondente e mantém uma saída segura da tela.

---

### User Story 3 - Conferir o próprio perfil (Priority: P3)

Como pessoa autenticada, quero que meu Perfil compartilhe a mesma linguagem visual das demais superfícies refinadas, para conferir minha identidade e acessar as ações existentes com clareza.

**Why this priority**: O Perfil fecha a experiência das superfícies autenticadas principais, mas esta etapa não deve antecipar capacidades de segurança ou ciclo de vida da conta.

**Independent Test**: Pode ser testada com um usuário autenticado, durante o carregamento e sem sessão disponível. Nome, e-mail, perfil e as ações atuais devem permanecer presentes e operáveis sem depender dos detalhes de turma ou comunicado.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada, **When** abre o Perfil, **Then** reconhece cabeçalho, identidade e informações da conta em uma hierarquia coerente com as demais superfícies do aplicativo.
2. **Given** nome, e-mail ou perfil com conteúdo extenso, **When** os dados são exibidos, **Then** permanecem legíveis sem colidir com ícones, limites ou ações.
3. **Given** que a pessoa seleciona "Editar perfil", **When** a ação é executada, **Then** segue para o mesmo fluxo de edição já existente, sem novos campos ou regras nesta feature.
4. **Given** que a pessoa seleciona "Sair da conta", **When** a ação é executada, **Then** conserva o tratamento destrutivo, o estado de processamento e o comportamento de encerramento de sessão existentes.
5. **Given** que o perfil está carregando ou a sessão não fornece um usuário, **When** a tela é exibida, **Then** mostra o estado correspondente e preserva a ação segura de entrada já disponível.

### Edge Cases

- O nome da turma, do professor, do usuário ou o título do comunicado ocupa mais de uma linha.
- O conteúdo do comunicado é muito curto, muito longo ou contém quebras de linha.
- Um comunicado expira hoje, em um dia ou em vários dias.
- A turma não possui comunicados, ou a lista deixa de estar disponível durante uma atualização.
- A pessoa alterna entre os papéis de proprietário e membro em turmas diferentes, mudando a ação destrutiva apresentada.
- Uma exclusão ou saída está pendente, falha ou recebe toques repetidos; confirmação, bloqueio e feedback existentes devem permanecer operantes.
- A pessoa autora e a não autora abrem o mesmo comunicado em sessões diferentes.
- Nome e e-mail longos são exibidos em tela estreita ou com texto ampliado.
- A pessoa usa tecnologia assistiva; a ordem de leitura e os nomes das ações não devem depender apenas de cor, ícone ou posição visual.

## Requirements *(mandatory)*

### In-Scope Surface Inventory

| Superfície | Elementos abrangidos |
|---|---|
| Detalhe da turma | Contexto da turma, seção de comunicados, cards, estados da lista, ação de novo comunicado e ação destrutiva contextual |
| Detalhe do comunicado | Título, autoria, datas de publicação e expiração, conteúdo, estados e ações autorais existentes |
| Perfil | Cabeçalho, identidade, nome, e-mail, perfil, estados e ações existentes de edição e saída |
| Elementos compartilhados | Somente elementos visuais usados diretamente por essas superfícies e necessários para sua consistência |

### Functional Requirements

- **FR-001**: As três superfícies MUST preservar a paleta clara, o aspecto clean e minimalista e a linguagem visual consolidada pelas specs `002-auth-navigation-ux-polish` e `003-primary-surfaces-visual-polish`.
- **FR-002**: Hierarquia, contraste, espaçamento, tipografia, agrupamento e cor MUST ser empregados de forma consistente, sem substituir a identidade atual nem introduzir preferência de tema.
- **FR-003**: Os ajustes MUST ficar restritos às superfícies e aos elementos compartilhados enumerados no escopo.
- **FR-004**: O detalhe da turma MUST tornar o nome da turma e "Comunicados" reconhecíveis como contexto e seção distintos, sem reduzir a clareza de nenhum dos dois.
- **FR-005**: A ação "+ Novo" MUST permanecer disponível somente nas condições atuais e visualmente associada à seção de comunicados, preservando seu destino.
- **FR-006**: Cada card de comunicado MUST preservar título, professor, prévia do conteúdo e indicador de expiração, com ordem visual consistente e sem transformar metadados em concorrentes do título.
- **FR-007**: O indicador de expiração dos cards MUST representar o prazo atual com "Expira hoje", "Expira em 1 dia" ou "Expira em X dias", sem apresentar valor negativo.
- **FR-008**: O toque no card MUST continuar abrindo o mesmo detalhe do comunicado e o resumo MUST permanecer legível sem revelar menos informação essencial que no estado atual.
- **FR-009**: A ação destrutiva contextual da turma MUST aparecer depois da lista de comunicados ou de seu estado vazio: "Sair da turma" para membro não proprietário e "Excluir turma" para proprietário.
- **FR-010**: "Sair da turma" e "Excluir turma" MUST possuir tratamento visual destrutivo e MUST preservar confirmação, consequência comunicada, estado pendente, prevenção de envio duplicado, feedback de falha e resultado de navegação existentes.
- **FR-011**: O detalhe da turma MUST distinguir carregamento, erro, turma ausente, lista vazia e sucesso sem ocultar uma ação válida nem apresentar uma ação para o papel incorreto.
- **FR-012**: O detalhe do comunicado MUST apresentar seu título como elemento textual principal e a autoria do professor como informação secundária claramente identificável.
- **FR-013**: "Publicado em" e "Expira em" MUST permanecer visíveis, com seus valores associados de forma inequívoca e em um agrupamento distinto do corpo do comunicado.
- **FR-014**: O conteúdo completo do comunicado MUST favorecer leitura contínua e acomodar parágrafos, quebras de linha e texto ampliado sem corte de informação essencial.
- **FR-015**: As ações "Editar" e "Excluir" MUST continuar visíveis somente para o autor, mantendo destinos, confirmação destrutiva, estados e resultados atuais.
- **FR-016**: O detalhe do comunicado MUST preservar os estados de carregamento, erro e item ausente e a navegação secundária definida na spec `002-auth-navigation-ux-polish`.
- **FR-017**: O Perfil MUST alinhar cabeçalho, identidade, informações e ações à mesma linguagem visual das demais superfícies autenticadas, sem acrescentar capacidades de conta.
- **FR-018**: O Perfil MUST preservar avatar derivado do nome, Nome, E-mail e Perfil com seus valores atuais, sem remover, editar ou reinterpretar esses dados nesta feature.
- **FR-019**: "Editar perfil" e "Sair da conta" MUST preservar visibilidade, significado, destino, estado de processamento e comportamento atuais; "Sair da conta" MUST continuar visualmente destrutivo.
- **FR-020**: O Perfil MUST preservar estados distintos de carregamento e usuário indisponível, incluindo a ação segura de entrada quando aplicável.
- **FR-021**: Textos, cards, metadados e ações MUST acomodar a menor largura suportada e texto ampliado sem sobreposição, perda de operabilidade ou truncamento de informação essencial sem alternativa de leitura.
- **FR-022**: Todos os controles novos ou visualmente alterados MUST manter nome, função, ordem de leitura, foco, contraste e área de toque acessíveis; cor ou ícone não podem ser o único meio de comunicar uma ação destrutiva.
- **FR-023**: A feature MUST preservar consultas, mutações, permissões, confirmações, navegação, invalidação de dados e regras de expiração existentes e MUST NOT exigir novo dado, contrato, endpoint, migração ou dependência externa.

### Key Entities

- **Turma detalhada**: Contexto de uma turma existente, incluindo identidade, ownership e sua coleção atual de comunicados; nenhum atributo novo é exigido.
- **Comunicado**: Conteúdo existente com título, autoria, publicação, expiração e corpo, apresentado como resumo na turma e integralmente em seu detalhe.
- **Perfil autenticado**: Identidade atual da pessoa, composta por nome, e-mail e papel, sem alteração de dados ou de regras nesta feature.

### Out of Scope

- Redesign completo, nova identidade, modo escuro, seleção ou persistência de tema; tema pertence à spec `005-theme-preferences`.
- Alteração funcional da pesquisa de turmas, reservada para `006-classroom-search-fix`.
- Novos campos ou regras de edição do perfil, alteração de senha ou outras capacidades de gestão de conta, reservadas para `007-profile-and-password-management`.
- Exclusão de conta ou ciclo de vida de dados, reservados para `008-account-deletion-data-lifecycle`.
- Funcionalidades administrativas, convites, notificações ou segurança de produção.
- Mudanças em criação ou edição de turma e comunicado, exceto a preservação dos caminhos que partem das superfícies em escopo.
- Mudanças de autoria, ownership, associação à turma, validade, visibilidade, ordenação ou filtragem de comunicados.
- Novos dados, endpoints, contratos, migrações, regras de autorização ou dependências externas.
- Alterações nas superfícies primárias concluídas pela spec `003-primary-surfaces-visual-polish`, salvo reutilização estritamente necessária de um elemento visual compartilhado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos cenários de turma com lista preenchida e vazia, para proprietário e membro, nome da turma, seção de comunicados, conteúdo e ação contextual aparecem na hierarquia e na ordem definidas.
- **SC-002**: Em 100% dos cenários aplicáveis, "Sair da turma" ou "Excluir turma" aparece depois do conteúdo da lista, usa tratamento destrutivo e conserva confirmação, bloqueio contra envio duplicado, falha e navegação existentes.
- **SC-003**: Cards com expiração no mesmo dia, em um dia e em vários dias apresentam respectivamente "Expira hoje", "Expira em 1 dia" e "Expira em X dias"; nenhum cenário apresenta prazo negativo.
- **SC-004**: Em 100% dos comunicados válidos da matriz de teste, título, professor, publicação, expiração e conteúdo completo permanecem identificáveis e associados corretamente, independentemente do tamanho do texto.
- **SC-005**: Em 100% dos cenários de autoria, apenas o autor visualiza "Editar" e "Excluir", e ambas as ações preservam o resultado funcional anterior.
- **SC-006**: O Perfil apresenta Nome, E-mail e Perfil e mantém "Editar perfil" e "Sair da conta" operantes em 100% dos cenários autenticados cobertos, sem introduzir novos controles de conta.
- **SC-007**: Carregamento, erro, ausência e sucesso são representados pelo estado correto em 100% dos cenários aplicáveis das três superfícies.
- **SC-008**: Na matriz com menor largura suportada, texto ampliado e conteúdo longo, nenhum dado essencial ou controle fica sobreposto, inacessível ou truncado sem alternativa de leitura.
- **SC-009**: 100% dos controles alterados passam as verificações aplicáveis de nome, função, ordem de leitura, foco, contraste e área de toque do projeto.
- **SC-010**: Abrir e criar comunicado, editar e excluir comunicado, sair ou excluir turma, editar perfil e sair da conta mantêm as permissões, confirmações, destinos e resultados anteriores em todos os testes de regressão aplicáveis.

## Assumptions

- A spec `003-primary-surfaces-visual-polish` está concluída e fornece a base visual da qual esta feature depende.
- Todos os dados necessários já estão disponíveis nas superfícies atuais; a feature é exclusivamente de apresentação e organização visual.
- A ação destrutiva contextual da turma ocupa uma área final comum, variando entre saída e exclusão conforme membership e ownership já calculados.
- Os rótulos de expiração seguem a linguagem consolidada na spec `003`, distinguindo hoje, um dia e vários dias.
- A apresentação de Perfil nesta feature não altera a interface de edição nem antecipa senha, exclusão de conta ou outras decisões das specs `007` e `008`.
- A evidência manual principal continua seguindo o alvo Android do ciclo atual; ausência de dispositivo, versão, tecnologia assistiva ou participantes deve ser registrada como `NOT MEASURED`, não inferida de testes automatizados.
- A feature deve ser encerrada antes do início de `005-theme-preferences`, conforme a dependência aprovada `003 → 004 → 005`.
