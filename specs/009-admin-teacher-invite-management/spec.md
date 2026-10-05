# Feature Specification: Admin Teacher Invite Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Feature Branch**: `009-admin-teacher-invite-management`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Oferecer uma interface simples e exclusiva para ADMIN gerar, visualizar e copiar códigos temporários de cadastro de professores. O backend deve garantir que esse fluxo crie somente convites PROFESSOR; novos ADMINs continuam sendo provisionados manualmente fora do aplicativo."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Gerar convite de professor (Priority: P1)

Uma pessoa autenticada como ADMIN acessa a área de convites e gera um código temporário de uso único para cadastrar um novo professor. O resultado deixa explícito que o convite cria somente uma conta PROFESSOR e informa quando ele expira.

**Why this priority**: Gerar um convite de professor com autorização e papel corretos é o valor central da feature e elimina a necessidade de operar diretamente o backend para essa tarefa cotidiana.

**Independent Test**: Pode ser validada entrando como ADMIN, solicitando um convite e conferindo que o código ativo exibido cria uma conta PROFESSOR, possui validade de sete dias e não pode criar uma conta ADMIN.

**Acceptance Scenarios**:

1. **Given** uma sessão ADMIN válida, **When** a pessoa solicita um novo convite, **Then** o sistema cria um único código ativo para PROFESSOR, mostra o código e sua expiração e explica que ele é de uso único.
2. **Given** um código recém-gerado, **When** uma pessoa conclui um cadastro válido de professor antes da expiração, **Then** a nova conta recebe o papel PROFESSOR e o código deixa de aceitar outro cadastro.
3. **Given** uma solicitação manipulada para criar convite ADMIN ou incluir campos não aceitos, **When** ela chega ao sistema, **Then** nenhum código é criado e a tentativa é rejeitada.
4. **Given** uma pessoa PARENT, PROFESSOR ou não autenticada, **When** tenta acessar a área ou solicitar diretamente um convite, **Then** o acesso é recusado e nenhum dado de convite é revelado.
5. **Given** uma geração em andamento, **When** a pessoa toca repetidamente na ação, **Then** existe no máximo uma solicitação efetiva e um único resultado é apresentado.

---

### User Story 2 - Copiar e compartilhar o convite com segurança (Priority: P2)

Depois da geração, a pessoa ADMIN confere o código e a data de expiração, copia exatamente o valor necessário e recebe uma confirmação clara. Ela pode gerar outro convite de forma deliberada, sabendo que isso não revoga automaticamente o anterior.

**Why this priority**: Um convite só é útil se puder ser transferido corretamente ao professor pretendido sem erro de digitação ou dúvida sobre validade e uso.

**Independent Test**: Pode ser validada gerando um convite, copiando-o, comparando o conteúdo copiado com o código exibido e exercitando sucesso, falha de cópia e geração deliberada de um segundo convite.

**Acceptance Scenarios**:

1. **Given** um convite exibido, **When** a pessoa seleciona "Copiar código", **Then** somente o código é copiado e uma confirmação acessível é apresentada.
2. **Given** que a cópia não está disponível ou falha, **When** a pessoa tenta copiar, **Then** o código permanece legível e selecionável e o sistema informa como tentar novamente sem gerar outro convite.
3. **Given** um convite ainda ativo na tela, **When** a pessoa escolhe gerar outro, **Then** um novo código é criado e exibido sem declarar o convite anterior como revogado.
4. **Given** que a pessoa sai da área administrativa ou encerra a sessão, **When** retorna posteriormente, **Then** o código anterior não reaparece a partir de armazenamento local do aplicativo.

### Edge Cases

- A sessão expira ou perde o papel ADMIN enquanto a área está aberta ou durante a geração.
- Uma solicitação tenta enviar `ADMIN`, `PARENT`, outro papel, campos adicionais ou tipos inválidos.
- A pessoa toca várias vezes em gerar ou copiar enquanto a ação correspondente está pendente.
- A conexão falha antes do envio, durante o processamento ou depois que um código foi criado sem a resposta chegar ao dispositivo.
- A geração encontra uma colisão com um código existente.
- O aplicativo não consegue acessar a área de transferência ou o sistema operacional restringe a cópia.
- O código expira enquanto a tela está aberta ou exatamente durante uma tentativa de cadastro.
- Duas pessoas tentam consumir o mesmo código quase simultaneamente.
- A data de expiração é visualizada em fuso horário diferente daquele em que o código foi gerado.
- Existem códigos ADMIN históricos no armazenamento antes da entrega desta feature.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Somente uma pessoa autenticada com papel ADMIN MUST poder visualizar e acessar a área de geração de convites para professores.
- **FR-002**: A ausência da entrada administrativa na interface para PARENT e PROFESSOR MUST NOT substituir a autorização; toda solicitação de geração MUST ser autorizada novamente pela identidade e pelo papel vigentes no servidor.
- **FR-003**: Solicitações sem autenticação, com sessão inválida ou com papel PARENT ou PROFESSOR MUST ser recusadas sem criar convite e sem revelar código, expiração ou detalhes administrativos.
- **FR-004**: A área MUST apresentar uma única finalidade: gerar convite de cadastro para PROFESSOR, sem seletor de papel e sem opção de ADMIN.
- **FR-005**: O fluxo de geração exposto pelo aplicativo MUST criar exclusivamente convites cujo papel é PROFESSOR, independentemente de valores manipulados enviados pelo cliente.
- **FR-006**: Uma tentativa de solicitar convite para ADMIN, PARENT, papel desconhecido ou por campo adicional MUST ser rejeitada integralmente, e MUST NOT ser silenciosamente convertida em convite PROFESSOR.
- **FR-007**: Cada geração bem-sucedida MUST produzir um código único, não previsível a partir de códigos anteriores e ativo somente para a finalidade de cadastro de PROFESSOR.
- **FR-008**: Cada convite gerado por esta área MUST expirar sete períodos de 24 horas após sua criação; a duração não será configurável nesta feature.
- **FR-009**: O resultado da geração MUST informar o código, o papel PROFESSOR, o estado ativo, a data/hora de criação e a data/hora exata de expiração.
- **FR-010**: A interface MUST exibir o código com destaque, a expiração em data e hora compreensíveis no fuso local e orientações de que o convite é pessoal, temporário e de uso único.
- **FR-011**: A pessoa ADMIN MUST poder copiar somente o valor exato do código por uma ação explícita.
- **FR-012**: Cópia bem-sucedida MUST produzir confirmação acessível; falha de cópia MUST manter o código visível, permitir nova tentativa e MUST NOT gerar outro convite.
- **FR-013**: A pessoa ADMIN MUST poder solicitar deliberadamente outro convite depois de um resultado, e a interface MUST deixar claro que gerar um novo código não revoga o anterior.
- **FR-014**: Enquanto uma geração estiver pendente, novos envios MUST ser bloqueados; o aplicativo MUST NOT repetir automaticamente uma solicitação mutável após falha ou resposta incerta.
- **FR-015**: Se uma nova geração falhar, o sistema MUST apresentar erro recuperável e preservar na tela qualquer convite anterior ainda exibido, sem representá-lo como recém-criado ou revogado.
- **FR-016**: Se a sessão perder validade ou deixar de ser ADMIN, a área MUST remover o resultado administrativo da tela, limpar seu estado transitório e retornar a pessoa ao fluxo permitido para sua identidade atual.
- **FR-017**: Um convite PROFESSOR ativo MUST permitir exatamente um cadastro bem-sucedido de PROFESSOR antes de expirar; tentativas posteriores, simultâneas, expiradas ou com convite inativo MUST ser recusadas.
- **FR-018**: O cadastro público do aplicativo MUST NOT criar uma conta ADMIN a partir de qualquer código de convite; provisionamento de ADMIN permanece exclusivamente fora desse fluxo.
- **FR-019**: Códigos ADMIN históricos MUST NOT ser mostrados, copiados, reativados ou usados para criar ADMIN pelo fluxo público/administrativo desta feature; sua eventual limpeza operacional não faz parte desta entrega.
- **FR-020**: Erros de convite inválido, inativo, expirado ou já utilizado MUST ser compreensíveis sem revelar se outro código existe, quem o gerou ou quem o consumiu.
- **FR-021**: Códigos reais MUST NOT aparecer em logs, diagnósticos, mensagens de erro, exemplos de documentação, histórico persistente do formulário ou cache persistente do aplicativo.
- **FR-022**: O código gerado MAY permanecer apenas no estado transitório necessário para exibição e cópia; sair da área, perder autorização, encerrar sessão ou reiniciar o aplicativo MUST descartá-lo localmente.
- **FR-023**: O fluxo MUST oferecer estados distintos de inicial, geração pendente, resultado, cópia bem-sucedida, erro de cópia, erro de geração e sessão/autorização inválida, sempre em português.
- **FR-024**: Código, expiração, orientações, erros e ações MUST permanecer legíveis e operáveis com texto ampliado, temas Claro/Escuro e tecnologia assistiva, sem depender apenas de cor para indicar estado.
- **FR-025**: Cadastro PARENT sem convite e cadastro PROFESSOR com convite válido MUST preservar os comportamentos existentes, exceto pela proibição explícita de criação de ADMIN pelo fluxo público.

### Key Entities _(include if feature involves data)_

- **Convite de professor**: segredo temporário e de uso único que contém código único, papel fixo PROFESSOR, estado ativo/inativo, criação e expiração.
- **Sessão administrativa**: identidade autenticada cujo papel ADMIN vigente autoriza a geração; a autorização deve ser reavaliada em cada solicitação.
- **Cadastro de professor**: criação de conta que consome um convite válido e sempre resulta no papel PROFESSOR.
- **Resultado transitório de geração**: código e metadados exibidos somente durante a sessão de interface atual para conferência e cópia, sem histórico local persistente.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% das tentativas sem sessão ADMIN válida, nenhum convite é criado e nenhum código ou metadado administrativo é revelado.
- **SC-002**: Em 100% das solicitações válidas, o convite gerado possui papel PROFESSOR e expiração exatamente sete períodos de 24 horas após a criação.
- **SC-003**: Solicitações manipuladas com ADMIN, PARENT, papel desconhecido ou campos adicionais criam zero convites em todos os cenários de teste.
- **SC-004**: Cada convite gerado permite exatamente um cadastro bem-sucedido de PROFESSOR; uma matriz de tentativas repetidas, simultâneas, expiradas e inativas produz zero contas adicionais.
- **SC-005**: Uma pessoa ADMIN consegue localizar a área, gerar e copiar um convite em até 1 minuto, e o conteúdo copiado corresponde exatamente ao código exibido.
- **SC-006**: Toques repetidos, falhas de cópia e falhas de rede produzem no máximo uma geração por ação deliberada e nunca disparam geração como efeito de copiar ou tentar copiar.
- **SC-007**: Após saída, perda de autorização, logout ou reinicialização, o código exibido anteriormente aparece zero vezes no estado persistente e nas superfícies protegidas do aplicativo.
- **SC-008**: Códigos reais aparecem zero vezes nos logs, erros, artefatos de teste versionados, exemplos de documentação e caches persistentes inspecionados.
- **SC-009**: Login, sessões, cadastro PARENT, cadastro PROFESSOR, perfil, exclusão de conta, turmas e comunicados mantêm seus resultados anteriores em 100% dos testes de regressão aplicáveis, ressalvada a proibição de cadastro ADMIN por convite público.

## Assumptions

- O modelo atual já representa expiração e uso único; esta feature mantém esses conceitos e adota validade fixa de sete períodos de 24 horas para evitar configuração desnecessária na interface simples.
- A tela mostra a data e a hora locais calculadas a partir do instante de expiração, enquanto a regra de validade usa o mesmo instante absoluto em todos os fusos.
- Gerar um novo convite não revoga os anteriores; listagem, busca, revogação e histórico de convites exigiriam uma capacidade administrativa separada.
- Um código cujo resultado não chegou ao dispositivo pode permanecer ativo até uso ou expiração, mas o aplicativo não repete automaticamente a solicitação nem persiste um segredo que não recebeu.
- O fluxo público de cadastro deixa de aceitar elevação para ADMIN por código. Novos ADMINs serão criados por procedimento operacional manual externo ao aplicativo.
- Registros históricos de convite ADMIN podem continuar armazenados para tratamento operacional, mas deixam de ser utilizáveis e não são expostos por esta feature.
- O acesso à área de transferência ocorre somente após ação explícita; o sistema operacional passa a controlar o conteúdo copiado, e a interface orienta compartilhamento apenas com o professor pretendido.
- A `009` depende somente da autenticação, dos papéis e da base visual existentes. Ela permanece independente das capacidades de perfil/senha da `007`, exclusão de conta da `008` e push da `010`.

## Scope Boundaries

### In Scope

- Área simples, visível somente para ADMIN, destinada a gerar convite de PROFESSOR.
- Restrição autoritativa para que o fluxo gere e consuma somente convites PROFESSOR.
- Validade fixa de sete dias, exibição da expiração e regra de uso único.
- Exibição transitória, cópia explícita e feedback de geração/cópia.
- Estados de autorização, carregamento, sucesso e erro.
- Atualização do contrato e da documentação diretamente afetados.

### Out of Scope

- Listar, pesquisar, filtrar, renovar, revogar ou auditar convites existentes.
- Mostrar quem gerou ou consumiu um convite; adicionar vínculo de autoria administrativa.
- Gerenciar usuários, professores ou contas ADMIN; alterar papel ou excluir conta de terceiros.
- Criar dashboard administrativo, métricas, histórico ou gerenciamento em lote.
- Permitir escolha da validade ou do papel do convite.
- Implementar no aplicativo o procedimento manual de provisionamento de ADMIN.
- Adicionar compartilhamento direto por aplicativos terceiros; a entrega termina na cópia explícita.
- Implementar notificações, push, e-mail ou envio automático do convite.
- Antecipar a auditoria ampla de segurança, abuso e supply chain reservada à `014-production-security-assessment`.

## Dependencies

- Reutiliza a autenticação e os papéis PARENT, PROFESSOR e ADMIN já vigentes, mas o servidor continua sendo a autoridade de acesso.
- Reutiliza o cadastro de professor por convite e o modelo de expiração/estado existentes, ajustando o fluxo público para impedir criação de ADMIN.
- Não depende tecnicamente das specs `007`, `008` ou `010`; pode ser entregue como capacidade administrativa isolada após a base visual já integrada.
- Deve estar concluída antes da consolidação de release da `013-release-polish-and-documentation` e será reavaliada na `014-production-security-assessment`.
