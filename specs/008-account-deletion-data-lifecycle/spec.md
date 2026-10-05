# Feature Specification: Account Deletion and Data Lifecycle

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Feature Branch**: `008-account-deletion-data-lifecycle`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "Adicionar exclusão permanente da própria conta, com confirmação explícita, encerramento de sessões e tratamento consistente dos dados de PARENT, PROFESSOR, ADMIN e recursos sob ownership. A capacidade deve permanecer independente da gestão de perfil/senha e das futuras funcionalidades administrativas e de notificações."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compreender e confirmar a exclusão (Priority: P1)

Uma pessoa autenticada acessa a opção "Excluir minha conta" a partir do Perfil, entende que a operação é permanente e vê um resumo adequado ao impacto real de sua conta antes de confirmar. Para reduzir exclusões acidentais ou iniciadas por alguém com acesso momentâneo ao aparelho, ela informa a senha atual e digita a frase exibida para confirmação.

**Why this priority**: Uma decisão irreversível só pode ser segura quando o impacto está claro e a intenção é demonstrada de forma ativa.

**Independent Test**: Pode ser validada abrindo o fluxo com contas PARENT, PROFESSOR e ADMIN, conferindo o aviso específico de cada papel e tentando prosseguir com confirmação vazia, incorreta e correta, sem concluir a exclusão.

**Acceptance Scenarios**:

1. **Given** uma conta PARENT autenticada e participante de turmas, **When** a pessoa abre a exclusão, **Then** o sistema informa que a conta e suas participações serão removidas, enquanto turmas e conteúdos de outras pessoas serão preservados.
2. **Given** uma conta PROFESSOR com turmas próprias e participação em turma de outra pessoa, **When** a pessoa abre a exclusão, **Then** o sistema informa que suas turmas e respectivos conteúdos serão removidos e que sua participação e seus comunicados em turmas preservadas também deixarão de existir.
3. **Given** uma conta ADMIN autenticada, **When** a pessoa abre a exclusão, **Then** o sistema explica o impacto sobre o acesso administrativo e não sugere que recursos sem vínculo com a conta serão excluídos.
4. **Given** qualquer conta elegível, **When** a senha atual ou a frase de confirmação está incorreta, **Then** a exclusão não começa, nenhum dado é alterado e o erro permite correção.
5. **Given** a tela de confirmação aberta, **When** a pessoa cancela ou volta antes do envio, **Then** a conta permanece intacta e os valores sensíveis informados são descartados.

---

### User Story 2 - Excluir a conta sem deixar dados inconsistentes (Priority: P2)

Após uma confirmação válida, a pessoa exclui permanentemente sua própria conta. O sistema trata de forma explícita suas participações, autoria e ownership para que os dados de outras pessoas sejam preservados e nenhum registro órfão permaneça.

**Why this priority**: A exclusão só entrega seu objetivo se for integral para os dados da conta e, ao mesmo tempo, não destruir recursos pertencentes a terceiros.

**Independent Test**: Pode ser validada preparando uma matriz de contas e relacionamentos, concluindo uma exclusão por vez e comparando todos os dados removidos e preservados com a política desta especificação.

**Acceptance Scenarios**:

1. **Given** uma conta PARENT participante de uma ou mais turmas, **When** a exclusão é concluída, **Then** a conta, suas sessões e participações são removidas, e as turmas, demais participantes e comunicados continuam disponíveis aos usuários autorizados.
2. **Given** uma conta PROFESSOR proprietária de turmas, **When** a exclusão é concluída, **Then** cada turma própria é removida com suas participações e comunicados, sem excluir as contas dos participantes.
3. **Given** uma conta PROFESSOR autora de comunicado em turma preservada de outra pessoa, **When** a exclusão é concluída, **Then** o comunicado da pessoa excluída e sua participação são removidos, mas a turma, os demais comunicados e membros permanecem.
4. **Given** uma conta com registros de exclusões anteriores de turmas vinculados a ela, **When** a conta é excluída, **Then** esses registros mínimos também deixam de manter o identificador da conta.
5. **Given** uma falha em qualquer etapa da operação, **When** a exclusão não pode ser concluída integralmente, **Then** nenhuma exclusão parcial é mantida e a pessoa recebe uma orientação segura para tentar novamente.

---

### User Story 3 - Encerrar o acesso e retornar à autenticação (Priority: P3)

Quando a exclusão termina, o aplicativo elimina o estado autenticado local, retorna ao fluxo de entrada e impede que qualquer sessão anterior volte a acessar a conta. A preferência visual do dispositivo permanece disponível por não ser um dado da conta.

**Why this priority**: Uma conta excluída não pode continuar aparecendo como autenticada nem deixar conteúdo privado acessível em memória local ou por tokens antigos.

**Independent Test**: Pode ser validada com duas ou mais sessões da mesma conta, concluindo a exclusão em uma delas e verificando a saída local, a rejeição de todas as sessões e a preservação apenas da preferência de tema do dispositivo.

**Acceptance Scenarios**:

1. **Given** uma exclusão concluída, **When** o resultado é recebido no dispositivo iniciador, **Then** credenciais e dados autenticados locais são limpos e a tela de entrada é exibida sem possibilidade de voltar ao Perfil.
2. **Given** outras sessões ativas da conta excluída, **When** qualquer uma tenta acessar ou renovar a sessão, **Then** o acesso é recusado e o respectivo dispositivo retorna ao estado não autenticado.
3. **Given** uma conta excluída que utilizava o tema Escuro, **When** o aplicativo volta ao fluxo de autenticação, **Then** o tema Escuro permanece porque a preferência pertence à instalação, não à conta removida.
4. **Given** uma exclusão já efetivada cuja resposta não chegou ao aplicativo, **When** o aplicativo tenta confirmar a sessão, **Then** reconhece que ela não é mais válida, limpa o estado local e não sugere que a conta ainda existe.

### Edge Cases

- A sessão expira ou é revogada enquanto a tela de confirmação está aberta.
- O nome, o papel ou os relacionamentos da conta mudam entre a abertura do aviso e a confirmação; o impacto deve ser recalculado no momento da exclusão.
- A pessoa toca repetidamente em "Excluir minha conta" enquanto a solicitação está pendente.
- Uma renovação de sessão ou novo login concorre com a exclusão da conta.
- Duas sessões da mesma conta tentam iniciar a exclusão quase simultaneamente.
- A conta PROFESSOR possui turmas próprias sem membros, com membros, com comunicados ativos e expirados, além de comunicados em turmas de terceiros.
- A conta ADMIN é a única conta administrativa restante.
- A conexão é interrompida antes do envio, durante o processamento ou após a exclusão ter sido efetivada.
- A frase de confirmação contém variações de caixa, espaços adicionais ou caracteres parecidos com os solicitados.
- Dados históricos inesperados associam autoria ou ownership a um papel que atualmente não criaria esses recursos.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: PARENT, PROFESSOR e ADMIN autenticados MUST poder iniciar a exclusão somente da própria conta a partir do Perfil.
- **FR-002**: O sistema MUST determinar a conta exclusivamente pela identidade da sessão autenticada e MUST rejeitar qualquer tentativa de escolher ou manipular o identificador de outra conta.
- **FR-003**: Antes da exclusão, o sistema MUST apresentar um aviso inequívoco de permanência e uma descrição do que será removido e preservado para o papel e os relacionamentos atuais da conta.
- **FR-004**: O aviso MUST distinguir, no mínimo, a saída de turmas de terceiros da exclusão de turmas sob ownership da própria pessoa.
- **FR-005**: A conclusão MUST exigir simultaneamente a senha atual válida e a frase exata `EXCLUIR MINHA CONTA`, informadas especificamente para esta operação.
- **FR-006**: Senha, frase de confirmação e qualquer representação de credencial MUST ser tratadas apenas durante a validação necessária e MUST NOT aparecer em resposta, cache persistente, histórico de formulário ou registro de diagnóstico.
- **FR-007**: Confirmação inválida, senha incorreta, sessão inválida ou cancelamento MUST deixar a conta e todos os dados relacionados inalterados.
- **FR-008**: Enquanto a confirmação estiver pendente, o sistema MUST impedir novos envios e saídas voluntárias que possam ocultar o resultado; a pessoa ainda MUST poder ser retirada do fluxo se a sessão perder a validade.
- **FR-009**: A exclusão da conta e de todos os dados definidos nesta política MUST produzir um único resultado integral: sucesso completo ou preservação completa do estado anterior.
- **FR-010**: Para qualquer papel, o sucesso MUST remover o perfil, a credencial, todas as sessões, todas as participações em turmas, todos os comunicados de autoria da conta e todos os registros mínimos de exclusão de turma que ainda identifiquem a conta.
- **FR-011**: Para cada turma sob ownership da conta excluída, o sucesso MUST remover a turma, todos os seus comunicados e todas as participações nela, preservando as contas das demais pessoas.
- **FR-012**: Turmas pertencentes a outras pessoas MUST ser preservadas; nelas, apenas a participação e os comunicados de autoria da conta excluída MUST ser removidos.
- **FR-013**: Comunicados, participações, contas e demais recursos sem vínculo de ownership, autoria ou participação com a conta excluída MUST permanecer inalterados.
- **FR-014**: A política MUST ser aplicada aos relacionamentos efetivamente existentes, mesmo quando o papel atual da conta normalmente não criaria aquele tipo de recurso.
- **FR-015**: A exclusão da única conta ADMIN restante MUST ser bloqueada com explicação clara; nenhuma alteração MUST ocorrer nesse caso.
- **FR-016**: A decisão sobre papel, quantidade de ADMINs, ownership, autoria e participações MUST usar o estado vigente no momento da exclusão, e não apenas o resumo mostrado quando a tela foi aberta.
- **FR-017**: Após o sucesso, todas as sessões da conta, inclusive a iniciadora, MUST deixar de autorizar acesso ou renovação, e operações concorrentes MUST NOT criar ou restaurar uma sessão utilizável para a conta removida.
- **FR-018**: Após o sucesso, o mesmo endereço de e-mail MUST poder ser usado em um novo cadastro, sujeito às regras normais de cadastro vigentes.
- **FR-019**: O sistema MUST retornar um resultado de sucesso sem dados da conta excluída e MUST apresentar falhas sem revelar existência de outras contas, detalhes internos ou valores informados na confirmação.
- **FR-020**: O aplicativo MUST tratar a exclusão como operação destrutiva sem repetição automática; toques repetidos durante o envio MUST produzir no máximo uma operação efetiva e um único resultado visível.
- **FR-021**: Após o sucesso ou após a confirmação de que a sessão da conta excluída não existe mais, o aplicativo MUST limpar credenciais, identidade e dados autenticados armazenados localmente e retornar ao fluxo de autenticação.
- **FR-022**: A navegação anterior MUST NOT reabrir telas protegidas ou conteúdo em cache depois da limpeza local.
- **FR-023**: A preferência de tema da instalação MUST ser preservada após a exclusão; nenhuma outra preferência ou dado autenticado da conta MUST permanecer no dispositivo.
- **FR-024**: O fluxo MUST oferecer estados claros de carregamento, validação, falha recuperável, bloqueio de último ADMIN e sucesso, sempre em português.
- **FR-025**: Avisos, campos, erros, ações de cancelar e excluir MUST permanecer utilizáveis com teclado aberto, texto ampliado, temas Claro/Escuro e tecnologia assistiva, com semântica destrutiva explícita.
- **FR-026**: Login, cadastro, alteração de perfil, alteração de senha, logout e operações de turmas/comunicados não envolvidas na exclusão MUST conservar seus comportamentos vigentes.

### Data Lifecycle Policy

| Dado ou relação                                                        | Resultado após exclusão bem-sucedida                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Perfil, e-mail e credencial da conta                                   | Excluídos permanentemente; o e-mail volta a ficar disponível para cadastro.                      |
| Sessões da conta                                                       | Excluídas ou tornadas definitivamente inválidas, em todos os dispositivos.                       |
| Participações da conta em turmas de terceiros                          | Excluídas; as turmas e os demais membros são preservados.                                        |
| Comunicados de autoria da conta em turmas de terceiros                 | Excluídos; os demais conteúdos da turma são preservados.                                         |
| Turmas sob ownership da conta                                          | Excluídas com todos os comunicados e participações; as contas dos participantes são preservadas. |
| Registros mínimos de exclusões anteriores de turmas vinculados à conta | Excluídos para não reter o identificador da conta sem necessidade operacional.                   |
| Códigos de convite sem vínculo de autoria com a conta                  | Preservados, pois o modelo atual não os atribui a um usuário.                                    |
| Preferência local de tema                                              | Preservada na instalação, sem identidade de conta.                                               |
| Dados de outras contas sem relação com a conta excluída                | Preservados integralmente.                                                                       |

### Key Entities _(include if feature involves data)_

- **Conta**: identidade autenticável composta por perfil, papel, e-mail e credencial; é o alvo único da exclusão iniciada pela própria pessoa.
- **Sessão**: autorização de acesso de um dispositivo; todas as sessões da conta deixam de ser válidas após o sucesso.
- **Turma**: recurso que possui um owner; quando a conta excluída é owner, a turma e seu conteúdo dependente são removidos.
- **Participação em turma**: associação entre conta e turma; é removida sem afetar a turma quando o owner é outra pessoa.
- **Comunicado**: conteúdo associado simultaneamente a autor e turma; é removido quando sua autora é a conta excluída ou quando sua turma é excluída.
- **Registro de exclusão de turma**: registro mínimo usado para reconhecer repetição de uma exclusão de turma; deve deixar de identificar a conta removida.
- **Preferência da instalação**: configuração sem vínculo com a conta, atualmente o tema; sobrevive à limpeza do estado autenticado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% dos cenários de aceitação, uma conta só é excluída após senha atual e frase de confirmação válidas fornecidas pela própria sessão autenticada.
- **SC-002**: Em uma matriz com PARENT, PROFESSOR e ADMIN, 100% dos dados marcados para exclusão são removidos e 100% dos dados marcados para preservação permanecem disponíveis aos usuários autorizados.
- **SC-003**: Após cada exclusão bem-sucedida, há zero sessões válidas, participações órfãs, comunicados órfãos, turmas sem owner ou registros de exclusão de turma identificando a conta removida.
- **SC-004**: Tokens de todas as sessões preparadas para a conta excluída são recusados em 100% das tentativas de acesso e renovação posteriores, inclusive sob concorrência com a exclusão.
- **SC-005**: Falhas introduzidas em qualquer etapa testada mantêm 100% do estado anterior da conta e dos relacionamentos, sem exclusão parcial.
- **SC-006**: Uma pessoa consegue localizar a ação, compreender o impacto, cancelar ou concluir o fluxo em até 2 minutos em uma validação orientada, sem precisar de instrução externa sobre o que será removido.
- **SC-007**: Toques repetidos e falhas de rede não produzem exclusões duplicadas, estados autenticados residuais nem mensagens de sucesso conflitantes em 100% dos cenários testados.
- **SC-008**: Após o sucesso, o dispositivo iniciador exibe o fluxo de autenticação, não reabre conteúdo protegido e preserva somente a preferência de tema prevista em 100% dos cenários de retorno e reinicialização testados.
- **SC-009**: Senha, frase de confirmação, credenciais e identificadores internos de outras contas aparecem zero vezes nas respostas, mensagens, diagnósticos e estados persistidos inspecionados.
- **SC-010**: Os fluxos vigentes de autenticação, perfil, senha, tema, turmas e comunicados mantêm seus resultados anteriores em 100% dos testes de regressão aplicáveis.

## Assumptions

- A exclusão é definitiva e física para os dados ativos descritos nesta especificação; recuperação de conta, período de arrependimento, anonimização e soft delete não fazem parte deste ciclo.
- A senha atual é uma reautenticação adequada porque todas as contas vigentes utilizam credencial por senha; a frase fixa complementa a reautenticação como confirmação de intenção.
- PARENT, PROFESSOR e ADMIN podem excluir a própria conta, exceto quando a conta é a última ADMIN; provisionamento ou remoção excepcional dessa última conta continua sendo uma operação administrativa externa ao aplicativo.
- Turmas de uma conta excluída não são transferidas para outro owner; a transferência exigiria escolha e consentimento adicionais e pertence a uma capacidade separada.
- Comunicados não são anonimizados porque o comportamento aprovado é eliminar os dados associados à conta e evitar autoria sem usuário correspondente.
- A preferência de tema permanece vinculada à instalação conforme o comportamento atual e não é tratada como dado pessoal da conta.
- O modelo vigente não atribui códigos de convite a um criador; por isso eles não são dados da conta e permanecem inalterados.
- Backups operacionais, obrigações legais de retenção, exportação prévia e integrações externas não estão modelados no produto atual e ficam fora desta feature; caso sejam introduzidos, exigirão política própria antes da produção.
- A `008` é uma capacidade independente da alteração de perfil e senha da `007`: compartilha apenas a autenticação já existente e não exige que a pessoa altere sua senha, perfil ou papel antes de excluir a conta.

## Scope Boundaries

### In Scope

- Entrada de exclusão no Perfil e fluxo dedicado de aviso, cancelamento, confirmação, envio e resultado.
- Reautenticação com senha atual e confirmação pela frase fixa.
- Política explícita para PARENT, PROFESSOR, ADMIN, ownership, autoria, participações, sessões e estado local.
- Proteção da última conta ADMIN.
- Limpeza pós-exclusão e retorno ao fluxo de autenticação.
- Contratos e documentação necessários para descrever o novo comportamento.

### Out of Scope

- Alterar nome, e-mail, senha ou papel; administrar ou excluir a conta de outra pessoa.
- Transferir ownership de turmas, escolher sucessor ou preservar turmas próprias por anonimização.
- Recuperar conta, desfazer exclusão, oferecer período de carência ou exportar dados.
- Criar uma política jurídica de retenção, gestão de backups ou trilha de auditoria externa.
- Gerenciar usuários, professores ou ADMINs; gerar códigos de convite.
- Registrar dispositivos, enviar push ou implementar qualquer regra de notificação.
- Realizar a auditoria ampla de segurança reservada à `014-production-security-assessment`.

## Dependencies

- Depende da base visual e de navegação já estabilizada até a `005-theme-preferences` para apresentar o fluxo nos dois temas.
- Usa os conceitos vigentes de conta autenticada, sessão, turma, participação, comunicado e ownership; não cria dependência funcional entre a `007` e a `008`.
- Deve estar concluída antes da consolidação de release da `013-release-polish-and-documentation` e será reavaliada na `014-production-security-assessment`.

## Ajuste de linguagem aprovado pelo usuário — 2026-10-05

A copy da exclusão MUST usar linguagem breve e comum, com impactos condicionados ao papel e aos vínculos atuais. PARENT MUST ver saída das turmas e preservação de turmas/conteúdos de terceiros, sem aviso de exclusão de comunicados próprios, pois não publica comunicados no fluxo suportado. PROFESSOR MUST receber resumo de exclusão das turmas próprias e conteúdos, preservação das contas dos participantes e eventual remoção de seus comunicados/participações em outras turmas. ADMIN MUST receber esses impactos quando aplicáveis, mais perda do acesso administrativo e bloqueio claro se for o último administrador.

Não expor detalhes técnicos de credenciais, sessões, recibos ou recálculo transacional na copy principal. Vínculos históricos de ownership informados pelo servidor continuam recebendo aviso de exclusão, inclusive se o papel atual for PARENT, para preservar FR-003/FR-004. A política de remoção/preservação de dados, senha atual, confirmação exata e guarda do último ADMIN permanece inalterada. Evidência de T070/T073: [validation.md](./validation.md).
