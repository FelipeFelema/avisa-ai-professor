# Feature Specification: Auth Navigation UX Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Feature Branch**: `[002-auth-navigation-ux-polish]`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "Corrigir problemas pontuais de navegação e usabilidade nas telas de autenticação e nas rotas secundárias, preservando a identidade visual atual e o comportamento nativo de voltar."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Concluir o cadastro com o teclado aberto (Priority: P1)

Como pessoa criando uma conta de responsável ou professor, quero acessar e preencher todos os campos do cadastro mesmo com o teclado aberto, para concluir o registro sem precisar adivinhar o conteúdo de campos encobertos.

**Why this priority**: Um campo obrigatório encoberto pode impedir a criação da conta, tornando o problema um bloqueio direto de entrada no aplicativo.

**Independent Test**: Pode ser testada selecionando separadamente os perfis Responsável e Professor, mantendo o teclado aberto e percorrendo todos os campos até a ação de cadastro. A história entrega valor mesmo sem as demais mudanças desta feature.

**Acceptance Scenarios**:

1. **Given** que a pessoa selecionou Responsável e o teclado está aberto, **When** ela percorre os campos do cadastro, **Then** consegue visualizar, focar e preencher "Confirmar senha" sem que o teclado esconda o campo ativo ou sua mensagem de validação.
2. **Given** que a pessoa selecionou Professor e o teclado está aberto, **When** ela percorre os campos do cadastro, **Then** consegue visualizar, focar e preencher "Confirmar senha" e "Código do professor", bem como alcançar a ação de cadastro.
3. **Given** que uma validação aumenta a altura do formulário, **When** a mensagem aparece enquanto o teclado permanece aberto, **Then** a pessoa ainda consegue trazer o campo com erro e a mensagem correspondente para a área visível.

---

### User Story 2 - Voltar de telas secundárias com clareza (Priority: P2)

Como pessoa navegando pelo aplicativo, quero encontrar uma ação visual de voltar nas telas secundárias, para reconhecer rapidamente como retornar sem depender apenas do controle físico ou gesto do dispositivo.

**Why this priority**: A navegação atual oculta os cabeçalhos e deixa rotas secundárias sem uma ação visual consistente, o que reduz previsibilidade e descoberta.

**Independent Test**: Pode ser testada abrindo cada rota secundária definida no escopo, acionando o controle visual e repetindo o retorno pelo mecanismo nativo da plataforma. A história entrega navegação compreensível independentemente das correções do cadastro e Login.

**Acceptance Scenarios**:

1. **Given** que a pessoa abriu uma rota secundária a partir de sua tela de origem, **When** aciona o controle visual de voltar, **Then** retorna em uma única ação à tela anterior esperada.
2. **Given** que a pessoa está em uma rota secundária, **When** usa o botão ou gesto nativo de voltar, **Then** o comportamento normal da plataforma continua funcionando sem ser substituído ou duplicado pelo controle visual.
3. **Given** que uma rota secundária foi aberta sem histórico de navegação utilizável, **When** a pessoa aciona o controle visual de voltar, **Then** é conduzida ao destino pai seguro definido para essa rota, sem ficar presa nem sair para uma tela incompatível com seu estado de autenticação.
4. **Given** que a rota secundária está carregando ou apresenta erro ou conteúdo indisponível, **When** a pessoa deseja sair, **Then** continua existindo um caminho claro de retorno.

---

### User Story 3 - Encontrar um único caminho para criar conta (Priority: P3)

Como visitante na tela de Login, quero ver apenas um convite claro para criar conta, para não interpretar a repetição da mesma ação como escolhas diferentes.

**Why this priority**: A duplicidade não bloqueia o Login, mas introduz ruído visual e uma decisão desnecessária em uma tela de entrada.

**Independent Test**: Pode ser testada abrindo o Login, contando as ações visíveis "Criar conta" e verificando que o único CTA remanescente abre o cadastro.

**Acceptance Scenarios**:

1. **Given** que a tela de Login foi aberta, **When** a pessoa observa as ações disponíveis, **Then** encontra exatamente um CTA "Criar conta", associado ao texto de rodapé "Não possui uma conta?".
2. **Given** que a pessoa está no Login, **When** aciona o CTA de rodapé "Criar conta", **Then** a tela de cadastro é aberta normalmente.
3. **Given** que o CTA redundante foi removido, **When** a pessoa realiza o Login, **Then** os campos, validações, feedbacks e a ação "Entrar" mantêm o comportamento existente.

### Edge Cases

- O teclado é aberto em uma tela de baixa altura ou com texto ampliado, reduzindo significativamente a área visível do cadastro.
- A troca entre Responsável e Professor adiciona ou remove o campo "Código do professor" enquanto o teclado está aberto.
- Uma mensagem de validação aparece abaixo de "Confirmar senha" ou "Código do professor" e aumenta a altura do formulário.
- O mecanismo nativo de voltar fecha primeiro o teclado conforme a convenção da plataforma; uma ação nativa posterior continua a navegação esperada.
- A pessoa aciona rapidamente o controle visual de voltar mais de uma vez; uma única interação não pode produzir múltiplas transições inesperadas.
- Uma tela de detalhe ainda não conhece seu destino pai porque o conteúdo está carregando ou falhou; deve permanecer disponível um retorno seguro coerente com a área atual.
- A pessoa entra diretamente por uma rota secundária sem histórico anterior; o controle visual não pode deixá-la presa.
- O retorno a partir de um formulário com alterações não salvas conserva o comportamento atual; esta feature não introduz novos diálogos de descarte.

## Requirements _(mandatory)_

### In-Scope Screen Inventory

As telas raiz Login, Home, Turmas e Perfil não recebem controle visual de voltar. As telas secundárias abrangidas são:

| Tela secundária       | Destino pai seguro quando não houver histórico utilizável                    |
| --------------------- | ---------------------------------------------------------------------------- |
| Cadastro              | Login                                                                        |
| Criar turma           | Turmas                                                                       |
| Detalhe da turma      | Turmas                                                                       |
| Novo comunicado       | Detalhe da turma correspondente                                              |
| Detalhe do comunicado | Detalhe da turma correspondente quando identificável; caso contrário, Turmas |
| Editar comunicado     | Detalhe do comunicado correspondente                                         |
| Editar perfil         | Perfil                                                                       |

### Functional Requirements

- **FR-001**: O aplicativo MUST apresentar uma ação visual de voltar em todas as sete telas secundárias enumeradas no escopo.
- **FR-002**: As ações visuais de voltar MUST compartilhar apresentação, significado e posicionamento previsíveis, admitindo apenas adaptações necessárias ao contexto da tela.
- **FR-003**: Cada ação visual de voltar MUST ser reconhecível como controle interativo e possuir nome acessível que comunique a ação "Voltar".
- **FR-004**: Quando houver histórico de navegação utilizável, a ação visual MUST retornar à tela imediatamente anterior em uma única transição.
- **FR-005**: Quando não houver histórico utilizável, a ação visual MUST abrir o destino pai seguro definido no inventário da feature.
- **FR-006**: A introdução da ação visual MUST preservar o comportamento nativo de voltar oferecido pela plataforma em cada tela abrangida.
- **FR-007**: O caminho de retorno MUST permanecer disponível durante estados de carregamento, erro e conteúdo indisponível das telas secundárias.
- **FR-008**: As telas raiz Login, Home, Turmas e Perfil MUST permanecer sem uma ação visual de voltar adicionada por esta feature.
- **FR-009**: No cadastro de Responsável, a pessoa MUST conseguir trazer para a área visível cada campo obrigatório, sua mensagem de validação e a ação de cadastro enquanto o teclado estiver aberto.
- **FR-010**: No cadastro de Professor, a pessoa MUST conseguir trazer para a área visível cada campo obrigatório, incluindo "Confirmar senha" e "Código do professor", suas mensagens de validação e a ação de cadastro enquanto o teclado estiver aberto.
- **FR-011**: Ajustes de teclado e rolagem MUST preservar seleção de perfil, valores digitados, validações e envio existentes nos dois fluxos de cadastro.
- **FR-012**: A tela de Login MUST exibir exatamente um CTA "Criar conta" e ele MUST permanecer no rodapé associado ao texto "Não possui uma conta?".
- **FR-013**: O CTA "Criar conta" localizado abaixo da ação principal "Entrar" MUST ser removido.
- **FR-014**: O CTA remanescente "Criar conta" MUST abrir o cadastro, e a remoção da duplicidade MUST preservar o comportamento de Login existente.
- **FR-015**: Mudanças visuais MUST se limitar aos controles de retorno, ao comportamento visual do formulário diante do teclado e ao espaçamento diretamente afetado pela remoção do CTA redundante.
- **FR-016**: A feature MUST NOT alterar autenticação, regras de cadastro, perfis de acesso, contratos externos, dados persistidos ou comportamento funcional das demais telas.

### Out of Scope

- Redesign da Home ou de Turmas.
- Mudanças de hierarquia visual em detalhes de turma, comunicado ou Perfil além da inserção do controle de voltar.
- Tema escuro ou infraestrutura de preferência de tema.
- Alterações funcionais de Perfil, senha ou conta.
- Correção funcional da pesquisa de turmas.
- Novas confirmações para descarte de formulários.
- Novas regras de autenticação, cadastro, autorização ou backend.
- Alterações globais de identidade visual que pertencem às specs `003`, `004` e `005`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em uma matriz cobrindo as sete telas secundárias, 100% apresentam uma ação visual consistente e permitem retornar ao destino anterior ou ao pai seguro com uma única ação.
- **SC-002**: Em 100% das telas abrangidas, o botão ou gesto nativo de voltar continua produzindo o comportamento esperado da plataforma sem transição duplicada.
- **SC-003**: Nos fluxos Responsável e Professor, 100% dos campos obrigatórios, mensagens de validação e a ação de cadastro podem ser alcançados e visualizados com o teclado aberto na menor área de tela suportada pelo aplicativo.
- **SC-004**: A tela de Login apresenta exatamente uma ação visível "Criar conta", e ela abre o cadastro em 100% das verificações funcionais.
- **SC-005**: 100% dos novos controles de voltar atendem aos critérios do projeto para nome, função, foco e área mínima de toque acessíveis.
- **SC-006**: Os fluxos existentes de Login, cadastro de Responsável e cadastro de Professor concluem sem regressão em todos os cenários funcionais anteriormente suportados.

## Assumptions

- O cadastro de Responsável e o cadastro de Professor continuam sendo variações da mesma jornada, diferenciadas pela seleção de perfil e pelo campo adicional de código para Professor.
- O retorno visual usa a tela anterior quando ela existe; os destinos pais enumerados servem somente como fallback para entrada direta ou histórico inutilizável.
- O comportamento nativo da plataforma, inclusive fechar primeiro o teclado quando aplicável, é considerado correto e não será redefinido por esta feature.
- O comportamento atual ao sair de formulários com dados não salvos permanece inalterado.
- A identidade visual e os elementos reutilizáveis existentes constituem a referência para os pequenos ajustes desta feature.
- A feature depende da estrutura de navegação e da fundação visual entregues pela `001-app-quality-readiness`; ela não depende das specs posteriores.
- A `002-auth-navigation-ux-polish` deve ser concluída antes da `003-primary-surfaces-visual-polish`, conforme o catálogo aprovado.
