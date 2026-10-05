# Feature Specification: Primary Surfaces Visual Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Feature Branch**: `[003-primary-surfaces-visual-polish]`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "Melhorar a hierarquia visual, a legibilidade e a consistência da Home e da tela de Turmas, preservando a identidade clean e minimalista atual e sem antecipar as melhorias das telas de detalhe, tema escuro ou correção funcional da pesquisa."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compreender a Home rapidamente (Priority: P1)

Como pessoa autenticada, quero reconhecer com facilidade meu cumprimento, a mensagem principal e o resumo de cada turma na Home, para entender o que é mais importante sem precisar examinar uma tela visualmente uniforme.

**Why this priority**: A Home é a principal superfície de entrada depois da autenticação. Uma hierarquia clara reduz esforço de leitura e torna os comunicados recentes mais fáceis de localizar.

**Independent Test**: Pode ser testada abrindo a Home com turmas, sem turmas, durante o carregamento e diante de erro. A pessoa deve identificar o cumprimento, o título principal e o conteúdo prioritário dos cards sem depender das alterações da tela de Turmas.

**Acceptance Scenarios**:

1. **Given** que a pessoa possui turmas, **When** abre a Home, **Then** encontra o cumprimento com seu nome em destaque discreto, o título "Bem-vindo ao Avisa Aí Professor" como mensagem principal e os cards de turma em ordem de leitura clara.
2. **Given** que uma turma possui um último comunicado ativo, **When** seu card aparece na Home, **Then** o card preserva Nome da turma, Professor e Último comunicado e apresenta discretamente quanto falta para o comunicado expirar.
3. **Given** que uma turma não possui comunicado ativo, **When** seu card aparece na Home, **Then** informa que não há comunicado disponível e não apresenta prazo de expiração enganoso.
4. **Given** que as turmas estão carregando, falharam ou não existem, **When** a Home é exibida, **Then** a pessoa recebe um estado distinto e compreensível para carregamento, erro ou vazio, sem confundir falha com ausência de turmas.

---

### User Story 2 - Localizar seções e ações em Turmas (Priority: P2)

Como responsável ou professor, quero distinguir claramente a introdução, a busca, minhas turmas e as turmas disponíveis, para localizar a seção e a ação desejadas com menos esforço.

**Why this priority**: A tela concentra descoberta, acesso e ações sobre turmas. Melhor organização visual torna essa densidade compreensível sem alterar suas regras funcionais.

**Independent Test**: Pode ser testada abrindo Turmas como Responsável e Professor, com combinações de listas preenchidas e vazias. A ordem visual e as ações existentes devem permanecer claras mesmo sem a nova Home.

**Acceptance Scenarios**:

1. **Given** que a pessoa abre Turmas, **When** percorre a tela, **Then** reconhece nesta ordem a introdução, a busca, "Minhas turmas" e "Turmas disponíveis" como blocos visualmente distintos.
2. **Given** que a pessoa é Professor, **When** abre Turmas, **Then** encontra "Criar turma" como ação principal associada ao cabeçalho, sem competir visualmente com os títulos das seções.
3. **Given** que a pessoa é Responsável, **When** abre Turmas, **Then** não vê "Criar turma" e a ausência dessa ação não deixa um espaço ou alinhamento incoerente.
4. **Given** que a pessoa visualiza o campo "Buscar turmas", **When** identifica o controle, **Then** encontra um ícone de pesquisa, nome acessível e aparência coerente com os demais controles, enquanto o comportamento funcional atual da busca permanece inalterado.
5. **Given** que não existem turmas disponíveis, **When** a seção correspondente é exibida, **Then** apresenta um estado vazio visualmente cuidado, conciso e claramente associado a essa seção.

---

### User Story 3 - Ler cards e estados sem perder contexto (Priority: P3)

Como pessoa consultando Home ou Turmas, quero que cards, conteúdos longos e estados vazios permaneçam legíveis e consistentes, para acessar ou administrar turmas sem perder informações nem confundir ações.

**Why this priority**: A consistência dos elementos repetidos consolida a identidade visual e evita que o mesmo conteúdo pareça ter significados diferentes entre as duas superfícies.

**Independent Test**: Pode ser testada com nomes e comunicados curtos e longos, professor ausente, turma sem comunicado e cards com cada ação existente. Todos os dados e controles devem permanecer legíveis e operáveis.

**Acceptance Scenarios**:

1. **Given** cards em Home, Minhas turmas e Turmas disponíveis, **When** são comparados, **Then** compartilham linguagem visual e ordem de informação consistentes, preservando as ações específicas de cada contexto.
2. **Given** nome de turma, nome de professor ou título de comunicado longo, **When** o card é exibido em uma área estreita ou com texto ampliado, **Then** o conteúdo se adapta sem sobrepor, ocultar ou deslocar indevidamente as ações.
3. **Given** uma ação "Entrar", "Sair" ou "Excluir turma", **When** o card é exibido, **Then** a ação continua distinguível do toque que abre a turma e mantém seu significado e tratamento visual apropriados.
4. **Given** uma lista vazia, **When** seu estado é mostrado, **Then** o texto e a ilustração ajudam a pessoa a compreender qual lista está vazia sem sugerir uma ação indisponível para seu perfil.

### Edge Cases

- O nome do usuário, da turma, do professor ou do último comunicado ocupa mais de uma linha.
- A turma não possui professor identificável ou não possui comunicado ativo.
- O último comunicado expira hoje, em um dia ou em vários dias.
- O momento de expiração recebido já passou durante uma sessão longa; a interface não deve apresentar um prazo negativo.
- A pessoa usa texto ampliado ou uma tela estreita, reduzindo o espaço horizontal dos cabeçalhos, cards e ações.
- "Minhas turmas" está vazia enquanto "Turmas disponíveis" possui resultados, ou o inverso.
- A busca contém texto, mas a fonte atual retorna nenhuma turma; esta feature melhora somente a apresentação e não redefine o significado do resultado.
- Uma operação de entrar, sair ou excluir está pendente ou falha; os feedbacks e bloqueios existentes devem continuar funcionando.
- A pessoa troca entre os perfis Professor e Responsável em sessões diferentes; a composição visual deve continuar coerente com as ações permitidas a cada perfil.

## Requirements _(mandatory)_

### In-Scope Surface Inventory

| Superfície               | Elementos abrangidos                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Home                     | Cumprimento, título principal, lista de cards, prazo do último comunicado e estados de carregamento, erro e vazio |
| Turmas                   | Título, descrição, "Criar turma", busca visual, "Minhas turmas", "Turmas disponíveis", cards e estados associados |
| Elementos compartilhados | Card de turma e estados vazios usados exclusivamente ou diretamente pelas superfícies primárias                   |

### Functional Requirements

- **FR-001**: A Home e Turmas MUST preservar a paleta, o aspecto clean/minimalista e a personalidade visual estabelecidos por Login e Cadastro.
- **FR-002**: A hierarquia das superfícies MUST usar contraste, espaçamento, tipografia e cor de maneira consistente, sem recorrer a títulos exageradamente grandes nem descaracterizar a identidade atual.
- **FR-003**: Os ajustes MUST ficar restritos à Home, Turmas e aos elementos compartilhados enumerados no escopo.
- **FR-004**: A Home MUST apresentar o cumprimento "Olá, [nome] 👋" antes do título principal, com destaque perceptível, porém menor que o da mensagem de boas-vindas.
- **FR-005**: A Home MUST apresentar "Bem-vindo ao Avisa Aí Professor" como seu título principal, com leitura natural e escala coerente com a referência visual de autenticação.
- **FR-006**: Cada card de turma na Home MUST preservar Nome da turma, Professor e Último comunicado.
- **FR-007**: Quando houver último comunicado ativo, o card da Home MUST apresentar um indicador secundário de expiração com uma das formas "Expira hoje", "Expira em 1 dia" ou "Expira em X dias".
- **FR-008**: O indicador de expiração MUST refletir dias de calendário restantes na localidade da pessoa, nunca exibir valor negativo e desaparecer quando não houver comunicado ativo.
- **FR-009**: O resumo do último comunicado MUST disponibilizar seu momento de expiração para a Home sem alterar qual comunicado é selecionado, quem pode vê-lo ou qualquer outra regra de dados.
- **FR-010**: A Home MUST distinguir visual e semanticamente carregamento, erro, vazio e sucesso, sem apresentar uma falha de carregamento como se a pessoa não participasse de turmas.
- **FR-011**: Turmas MUST melhorar a hierarquia entre título e descrição, mantendo ambos concisos e coerentes com a finalidade atual da tela.
- **FR-012**: A ação "Criar turma" MUST receber destaque apropriado como ação primária do Professor, mantendo-se ausente para os demais perfis e preservando sua navegação atual.
- **FR-013**: O bloco de busca MUST manter o rótulo "Buscar turmas", apresentar um ícone de pesquisa identificável e conservar nome, função e estado acessíveis.
- **FR-014**: A mudança visual da busca MUST preservar integralmente seu estado atual, os parâmetros enviados, carregamento, resultados, ausência de resultados e erros; a correção funcional pertence à spec `006-classroom-search-fix`.
- **FR-015**: "Minhas turmas" e "Turmas disponíveis" MUST ser reconhecíveis como seções distintas, na ordem atual e sem misturar seus cards ou estados.
- **FR-016**: Os cards de turma MUST manter a mesma ordem básica de informações entre Home e Turmas, diferenciando apenas dados e ações pertinentes ao contexto.
- **FR-017**: Os cards em Turmas MUST preservar Nome da turma, Professor, Último comunicado e as ações atuais de abrir, entrar, sair ou excluir conforme perfil e ownership.
- **FR-018**: O estado vazio de "Turmas disponíveis" MUST ter associação visual inequívoca com a seção e explicar de forma breve que não há turmas a apresentar naquele momento.
- **FR-019**: Cards, cabeçalhos, busca, empty states e ações MUST acomodar texto ampliado e conteýo longo sem sobreposição, corte de informação essencial ou perda de operabilidade.
- **FR-020**: Todos os elementos interativos novos ou visualmente alterados MUST manter nome e função acessíveis, foco perceptível, contraste suficiente e área de toque compatível com os critérios atuais do projeto.
- **FR-021**: A feature MUST preservar consultas, mutações, permissões, confirmações, navegação, invalidação de dados e feedbacks existentes, exceto pela apresentação explícita do erro na Home exigida por FR-010.
- **FR-022**: A feature MUST NOT introduzir preferência de tema, novas capacidades de produto ou mudanças visuais nas telas de detalhe e Perfil.

### Key Entities

- **Resumo da turma**: Representa a informação exibida em listas primárias, incluindo identidade da turma, ownership, professor e o último comunicado ativo quando existir.
- **Resumo do último comunicado ativo**: Representa o comunicado mais recente ainda válido, contendo identidade, título, publicação e momento de expiração necessário ao indicador da Home.

### Out of Scope

- Redesign completo ou substituição da paleta e identidade atuais.
- Login, Cadastro, navegação secundária ou comportamento de teclado concluídos na spec `002-auth-navigation-ux-polish`.
- Detalhe da turma, detalhe do comunicado e Perfil, reservados para `004-detail-surfaces-visual-polish`.
- Tema escuro, seleção ou persistência de tema, reservados para `005-theme-preferences`.
- Correção, redefinição, debounce ou nova semântica da pesquisa, reservados para `006-classroom-search-fix`.
- Mudança das regras de criação, entrada, saída, exclusão, ownership ou visibilidade de turmas.
- Novos dados no resumo de turma além do momento de expiração estritamente necessário ao indicador da Home.
- Alterações na barra de abas, nos formulários de criar turma ou comunicado e nas telas de edição.
- Funcionalidades administrativas, segurança de conta ou notificações.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em uma matriz de Home e Turmas para Responsável e Professor, 100% dos elementos obrigatórios aparecem na ordem e com a hierarquia definidas, sem perda das informações ou ações existentes.
- **SC-002**: Em casos de expiração no mesmo dia, em um dia e em mais de um dia, 100% dos cards aplicáveis da Home exibem respectivamente "Expira hoje", "Expira em 1 dia" e "Expira em X dias"; cards sem comunicado ativo exibem zero indicador de prazo.
- **SC-003**: Home diferencia corretamente carregamento, erro, vazio e sucesso em 100% dos cenários da matriz de estados, sem classificar erro como lista vazia.
- **SC-004**: Turmas apresenta uma sequência visual inequívoca de introdução, busca, "Minhas turmas" e "Turmas disponíveis" em 100% dos cenários de perfil e preenchimento das listas.
- **SC-005**: O campo de busca apresenta exatamente um indicador visual de pesquisa, conserva seu nome acessível e produz os mesmos estados, solicitações e resultados observados antes da feature em todos os testes de regressão aplicáveis.
- **SC-006**: Na matriz com texto ampliado, menor largura suportada e conteýo longo, nenhum elemento essencial dos cabeçalhos, cards, busca, empty states ou ações fica sobreposto, inacessível ou truncado sem alternativa de leitura.
- **SC-007**: 100% dos controles novos ou alterados passam as verificações aplicáveis de nome, função, foco, contraste e área de toque do projeto.
- **SC-008**: Abrir turma, criar turma, entrar, sair e excluir continuam concluindo com a mesma regra e o mesmo resultado anterior em 100% dos cenários funcionais de regressão aplicáveis.

## Assumptions

- Login e Cadastro permanecem a referência visual de identidade, não modelos a serem copiados literalmente em todas as superfícies.
- A paleta clara e os estilos semânticos existentes continuam sendo a base; a arquitetura para alternância de tema será tratada somente na spec `005-theme-preferences`.
- O último comunicado de um resumo de turma continua sendo o comunicado ativo mais recente segundo a regra atual; esta feature apenas torna seu momento de expiração disponível para apresentação.
- Os dias restantes são apresentados por data de calendário na localidade da pessoa, usando linguagem singular, plural e "hoje" conforme definido em FR-007 e FR-008.
- A apresentação da expiração é informativa e não altera remoção, filtragem ou validade de comunicados.
- A evidência manual principal continua seguindo o alvo Android do ciclo atual; indisponibilidade de iOS ou auditoria humana adicional deve ser registrada como `NOT MEASURED`, não inferida a partir de empacotamento ou testes automatizados.
- A feature depende da conclusão de `002-auth-navigation-ux-polish` e deve ser encerrada antes de iniciar `004-detail-surfaces-visual-polish`.
