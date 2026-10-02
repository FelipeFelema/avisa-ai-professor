# Feature Specification: Classroom Search Fix

**Feature Branch**: `[006-classroom-search-fix]`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Corrigir a pesquisa de turmas após investigar o fluxo atual de ponta a ponta, definir uma busca clara por nome em Turmas disponíveis e garantir estados e resultados consistentes antes e depois das ações de participação."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Encontrar uma turma disponível pelo nome (Priority: P1)

Como pessoa autenticada, quero pesquisar as turmas disponíveis por nome, para localizar rapidamente uma turma da qual ainda não participo e poder entrar nela.

**Why this priority**: Encontrar a turma correta é o objetivo central da feature. O fluxo atual encaminha o texto, mas não normaliza a entrada nem define com precisão quais resultados devem ser apresentados.

**Independent Test**: Pode ser testada com uma lista de turmas disponíveis contendo nomes semelhantes, digitando termos parciais, variações de maiúsculas e espaços externos. A seção deve exibir somente as correspondências disponíveis sem alterar "Minhas turmas".

**Acceptance Scenarios**:

1. **Given** turmas disponíveis chamadas "Matemática 6º A", "Matemática 7º B" e "Português 6º A", **When** a pessoa pesquisa `matemática`, **Then** encontra as duas turmas de Matemática e não encontra Português.
2. **Given** uma turma disponível chamada "Matemática 6º A", **When** a pessoa pesquisa `MATEMÁTICA`, **Then** encontra a mesma turma independentemente de maiúsculas e minúsculas.
3. **Given** uma turma disponível chamada "Matemática 6º A", **When** a pessoa pesquisa `  Matemática  `, **Then** os espaços externos são ignorados e a turma é encontrada.
4. **Given** texto vazio ou composto somente por espaços, **When** a busca é processada, **Then** a seção apresenta a lista completa de turmas disponíveis como se nenhum filtro tivesse sido informado.
5. **Given** uma pessoa já participante de uma turma cujo nome corresponde ao termo, **When** pesquisa esse nome, **Then** a turma não aparece em "Turmas disponíveis" e "Minhas turmas" não é filtrada.
6. **Given** que a pessoa limpa o campo, **When** a limpeza é concluída, **Then** o resultado volta à lista completa de turmas disponíveis e qualquer mensagem específica da busca anterior desaparece.

---

### User Story 2 - Compreender e controlar o estado da busca (Priority: P2)

Como pessoa pesquisando turmas, quero distinguir digitação, carregamento, resultados, nenhuma correspondência e erro, para saber se devo aguardar, mudar o termo ou tentar novamente.

**Why this priority**: Estados genéricos ou respostas de termos anteriores fazem a busca parecer quebrada mesmo quando a requisição é concluída. Feedback previsível torna o resultado confiável.

**Independent Test**: Pode ser testada simulando uma consulta lenta, nenhuma correspondência, falha e respostas fora de ordem. O campo deve preservar o termo, e somente o estado referente ao termo mais recente pode ser apresentado.

**Acceptance Scenarios**:

1. **Given** que a pessoa continua digitando, **When** ainda não decorreram 300 ms desde a última alteração, **Then** nenhuma nova busca é executada para os valores intermediários.
2. **Given** que a pessoa para de digitar um termo válido, **When** decorrem 300 ms, **Then** uma única busca é iniciada para o valor normalizado mais recente.
3. **Given** uma busca em andamento, **When** a seção de disponíveis é exibida, **Then** mostra carregamento associado à busca sem substituir "Minhas turmas" por loading ou vazio.
4. **Given** que o termo válido não possui correspondências, **When** a busca termina, **Then** a pessoa vê uma mensagem específica de que nenhuma turma foi encontrada para aquele termo e consegue limpar a pesquisa.
5. **Given** que a busca falha, **When** o erro é mostrado, **Then** o termo digitado permanece no campo e "Tentar novamente" repete a busca do mesmo termo normalizado.
6. **Given** duas buscas cujas respostas chegam fora de ordem, **When** a resposta do termo anterior chega por último, **Then** ela não substitui o loading, o erro nem os resultados do termo mais recente.
7. **Given** um termo acima do limite permitido, **When** a pessoa tenta pesquisá-lo, **Then** recebe feedback de validação e nenhuma consulta inválida é executada.

---

### User Story 3 - Manter resultados corretos após ações de turma (Priority: P3)

Como pessoa que entra, sai ou exclui uma turma, quero que a busca atual reflita o novo estado imediatamente após o sucesso, para não visualizar nem acionar dados incompatíveis com minha participação.

**Why this priority**: A investigação confirmou que as consultas filtradas não são atualizadas pelas invalidações atuais. Isso pode manter uma turma já ingressada na lista disponível ou omitir uma turma após a saída.

**Independent Test**: Pode ser testada mantendo um termo ativo durante as ações de entrar, sair e excluir. Depois de cada sucesso, "Minhas turmas" e todas as variantes relevantes de "Turmas disponíveis" devem refletir a nova participação.

**Acceptance Scenarios**:

1. **Given** uma turma visível no resultado filtrado, **When** a pessoa entra nela com sucesso, **Then** a turma deixa de aparecer nas disponíveis e passa a aparecer em "Minhas turmas" sem exigir limpar a busca ou reiniciar a tela.
2. **Given** uma turma de "Minhas turmas" cujo nome corresponde ao termo ativo, **When** a pessoa sai dela com sucesso, **Then** ela deixa "Minhas turmas" e aparece nas disponíveis se continuar elegível.
3. **Given** uma turma própria correspondente a uma busca armazenada, **When** o proprietário a exclui com sucesso, **Then** ela deixa de aparecer em todas as listas e resultados afetados.
4. **Given** que entrar, sair ou excluir falha, **When** a operação termina com erro, **Then** as listas não apresentam uma mudança de participação como se tivesse ocorrido sucesso.
5. **Given** buscas anteriores com termos diferentes ainda armazenadas, **When** uma ação de turma é concluída com sucesso, **Then** nenhuma dessas variantes volta a apresentar dados incompatíveis quando for consultada novamente.

### Edge Cases

- O termo é vazio, contém somente espaços ou possui espaços antes e depois do nome.
- O termo possui exatamente 80 caracteres ou ultrapassa esse limite.
- O nome da turma contém números, pontuação, espaços internos ou caracteres acentuados.
- O mesmo fragmento corresponde a zero, uma ou várias turmas disponíveis.
- Uma turma correspondente já pertence à pessoa e deve continuar fora dos resultados disponíveis.
- A pessoa digita rapidamente, apaga o texto ou troca o termo enquanto uma busca anterior está em andamento.
- Uma resposta antiga chega depois da resposta do termo atual.
- A conexão falha e retorna durante uma busca com termo preenchido.
- A pessoa entra, sai ou exclui uma turma enquanto existe um filtro ativo ou armazenado.
- A sessão expira durante a pesquisa; o fluxo de autenticação existente deve continuar sendo a autoridade.
- O tema é alternado durante a digitação, loading, erro ou exibição dos resultados.

## Requirements *(mandatory)*

### In-Scope Flow Inventory

| Parte do fluxo | Comportamento abrangido |
|---|---|
| Entrada | Texto de busca, normalização, limite, espera após digitação, limpeza e acessibilidade |
| Consulta | Critério por nome, envio do termo normalizado, autenticação e exclusão das turmas já associadas à pessoa |
| Apresentação | Carregamento, resultados, nenhuma correspondência, erro, retry e preservação do termo |
| Consistência | Atualização de "Minhas turmas" e de todas as buscas de disponíveis após entrar, sair ou excluir |
| Regressão | Cards, ações, temas, permissões e navegação existentes na tela de Turmas |

### Functional Requirements

- **FR-001**: A busca MUST filtrar somente a seção "Turmas disponíveis"; "Minhas turmas" MUST permanecer completa e independente do termo.
- **FR-002**: O campo MUST permanecer claramente associado a "Turmas disponíveis", mantendo nome, finalidade e ícone acessíveis nos temas Claro e Escuro.
- **FR-003**: A busca MUST continuar disponível para pessoas autenticadas nos perfis atualmente autorizados a consultar e entrar em turmas, sem ampliar permissões.
- **FR-004**: Antes da consulta, o termo MUST ter espaços iniciais e finais removidos; espaços internos e demais caracteres do nome MUST ser preservados.
- **FR-005**: Um termo normalizado vazio MUST ser equivalente à ausência de filtro e retornar todas as turmas disponíveis para a pessoa.
- **FR-006**: Um termo de busca MUST aceitar de 1 a 80 caracteres depois da normalização; valores acima do limite MUST ser impedidos ou sinalizados no cliente e rejeitados pela fonte de dados mesmo quando enviados fora do aplicativo.
- **FR-007**: A correspondência MUST ocorrer por substring do nome da turma sem diferenciar maiúsculas e minúsculas; diferenças de acentuação continuam significativas nesta feature.
- **FR-008**: A lista retornada MUST continuar excluindo toda turma da qual a pessoa já participa, independentemente do termo pesquisado.
- **FR-009**: A alteração visual do campo MUST ser imediata, mas a consulta MUST aguardar 300 ms sem nova edição antes de processar o termo mais recente.
- **FR-010**: Uma sequência contínua de digitação MUST produzir no máximo uma consulta para o valor final depois da pausa definida, sem consultar cada valor intermediário.
- **FR-011**: Termos equivalentes depois da normalização MUST produzir o mesmo critério e não manter resultados contraditórios entre si.
- **FR-012**: Somente loading, erro e resultados associados ao termo normalizado mais recente MUST ser apresentados; respostas anteriores MUST ser ignoradas quando perderem atualidade.
- **FR-013**: Durante a primeira carga ou uma busca ativa sem dados atuais, "Turmas disponíveis" MUST apresentar um estado de carregamento distinto de lista vazia e de erro.
- **FR-014**: Uma busca válida sem correspondências MUST apresentar estado específico, incluir o contexto do termo pesquisado e oferecer uma forma acessível de limpar a pesquisa.
- **FR-015**: Ausência de turmas sem filtro MUST conservar o empty state geral e MUST NOT ser apresentada como busca sem correspondências.
- **FR-016**: Uma falha de busca MUST preservar o texto no campo, comunicar o erro e permitir repetir exatamente o termo normalizado atual.
- **FR-017**: Limpar o campo MUST remover validação, erro ou mensagem de nenhuma correspondência relacionada ao termo anterior e restaurar a consulta sem filtro.
- **FR-018**: Após entrar em uma turma com sucesso, "Minhas turmas" e todas as variantes armazenadas ou ativas de "Turmas disponíveis" MUST ser atualizadas para refletir a nova participação.
- **FR-019**: Após sair de uma turma com sucesso, "Minhas turmas" e todas as variantes armazenadas ou ativas de "Turmas disponíveis" MUST ser atualizadas, incluindo a turma recém-disponível quando ela corresponder ao termo.
- **FR-020**: Após excluir uma turma com sucesso, todas as listas e variantes de busca que poderiam contê-la MUST ser atualizadas para que a turma não reapareça de dados antigos.
- **FR-021**: Falha, cancelamento ou operação ainda pendente de entrar, sair ou excluir MUST NOT produzir uma confirmação visual falsa de mudança de participação.
- **FR-022**: Cards, ação "Entrar", ações de "Minhas turmas", confirmações, navegação, temas e feedbacks não relacionados à busca MUST preservar seus comportamentos atuais.
- **FR-023**: O contrato da busca MUST documentar termo opcional, valor único, limite de 80 caracteres, normalização e correspondência case-insensitive e MUST rejeitar entradas inválidas de forma previsível.
- **FR-024**: A feature MUST reutilizar a listagem atual de turmas disponíveis e MUST NOT exigir novo endpoint, novo campo de resposta, migration, alteração do modelo de dados ou dependência externa.

### Key Entities

- **Termo digitado**: Texto imediatamente visível no campo enquanto a pessoa edita, antes da pausa necessária para pesquisar.
- **Termo normalizado**: Valor efetivamente usado como critério, limitado a 80 caracteres e sem espaços externos; vazio representa ausência de filtro.
- **Resultado de turmas disponíveis**: Coleção de turmas cujo nome corresponde ao termo e das quais a pessoa ainda não participa.
- **Estado da busca**: Combinação do termo atual com espera, carregamento, sucesso com resultados, sucesso sem correspondências ou erro recuperável.

### Out of Scope

- Filtrar, ordenar ou pesquisar a seção "Minhas turmas".
- Pesquisar por professor, comunicado, identificador ou qualquer atributo diferente do nome da turma.
- Busca aproximada, correção ortográfica, autocomplete, histórico, sugestões ou equivalência automática entre caracteres com e sem acento.
- Novos filtros, paginação, ordenação por relevância ou redesign geral da tela de Turmas.
- Persistência do termo entre reinicializações, sincronização entre dispositivos ou suporte offline de busca.
- Mudanças nas regras de criação, entrada, saída, exclusão, ownership ou autorização das turmas.
- Novo endpoint, novo formato de resposta, migration, alteração de schema ou pacote adicional.
- Alterações nas telas Home, detalhes, Perfil, autenticação ou preferências de tema além da regressão necessária para manter o comportamento atual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos casos da matriz com substring, maiúsculas/minúsculas, espaços externos, termo vazio e caracteres acentuados, os resultados seguem exatamente as regras definidas e nunca incluem uma turma já associada à pessoa.
- **SC-002**: Durante uma sequência de digitação, zero consultas são iniciadas antes de 300 ms de pausa e no máximo uma consulta é iniciada para o valor normalizado final.
- **SC-003**: Em 100% dos cenários com respostas fora de ordem, somente o loading, erro ou resultado do termo mais recente aparece na tela.
- **SC-004**: Carregamento, resultados, nenhuma correspondência, lista geral vazia e erro são distinguidos corretamente em 100% dos cenários da matriz, mantendo o termo e o retry quando aplicável.
- **SC-005**: Termos de até 80 caracteres são aceitos; termos maiores são impedidos ou sinalizados no aplicativo e rejeitados em 100% das solicitações diretas inválidas cobertas.
- **SC-006**: Depois de entrar, sair ou excluir com sucesso sob um filtro ativo, 100% das listas e buscas aplicáveis refletem a nova participação sem exigir reinício, limpeza do termo ou espera pelo vencimento de dados antigos.
- **SC-007**: Em 100% das falhas de entrar, sair ou excluir cobertas, nenhuma lista apresenta uma mudança como concluída e o erro existente permanece recuperável.
- **SC-008**: "Minhas turmas" conserva conteúdo, estados e ações em 100% das mudanças de termo, carregamentos, resultados vazios e erros da busca de disponíveis.
- **SC-009**: Campo, mensagens, ação de limpar, retry e cards permanecem acessíveis e legíveis nos temas Claro e Escuro em 100% dos cenários aplicáveis.
- **SC-010**: Criar, abrir, entrar, sair e excluir turma continuam produzindo as mesmas permissões, confirmações, destinos e resultados funcionais anteriores em todos os testes de regressão aplicáveis.

## Assumptions

- A busca serve à descoberta de "Turmas disponíveis" para entrada; não é um filtro global das duas seções.
- A listagem autenticada atual continua sendo a autoridade para excluir turmas das quais a pessoa já participa.
- Claro e Escuro concluídos na spec `005-theme-preferences` são bases obrigatórias para os estados novos ou alterados.
- A correspondência case-insensitive atual é preservada; equivalência automática entre letras acentuadas e não acentuadas não será introduzida.
- A ordem dos resultados permanece a mesma fornecida pela listagem atual; esta feature não cria ranking por relevância.
- Limpar o campo é uma ação local e acessível que retorna ao conjunto completo de disponíveis.
- Os avisos preexistentes de ambiente de teste não constituem evidência de falha da busca quando as asserções direcionadas passam, mas devem ser registrados separadamente durante validação.
- A spec `005-theme-preferences` está concluída e integrada; a `006` depende apenas da base visual fornecida pelas specs anteriores e permanece independente das capacidades de conta, administração e notificações.
