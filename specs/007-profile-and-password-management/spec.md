# Feature Specification: Profile and Password Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Feature Branch**: `[007-profile-and-password-management]`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Completar o gerenciamento do próprio perfil permitindo alterar nome e e-mail sem expor role editável e adicionar alteração segura de senha, preservando a sessão atual e revogando as demais sessões após a troca."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Atualizar a própria identidade sem alterar o papel (Priority: P1)

Como pessoa autenticada, quero atualizar meu nome e e-mail sem que meu papel de acesso seja apresentado como campo editável, para manter meus dados corretos sem risco de tentar alterar permissões.

**Why this priority**: Nome e e-mail já formam o fluxo principal de autoatendimento. Remover o campo "Perfil" da edição elimina uma affordance enganosa e reforça que permissões não pertencem ao usuário.

**Independent Test**: Pode ser testada abrindo "Editar perfil" como Responsável, Professor ou Administrador, alterando nome e/ou e-mail e tentando enviar campos não permitidos diretamente. A interface deve conter apenas Nome e E-mail, e o papel deve permanecer inalterado em todos os caminhos.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada, **When** abre "Editar perfil", **Then** encontra somente Nome e E-mail como dados editáveis e não encontra campo, seletor ou valor somente leitura de "Perfil" nessa tela.
2. **Given** que a pessoa altera apenas o nome com um valor válido, **When** confirma a atualização, **Then** o novo nome aparece no Perfil, o e-mail e o papel permanecem iguais e nenhuma outra sessão é revogada.
3. **Given** que a pessoa altera o e-mail para um valor válido e disponível, **When** confirma a atualização, **Then** o novo e-mail normalizado aparece no Perfil, a sessão atual permanece ativa e as demais sessões são revogadas.
4. **Given** que o novo e-mail já pertence a outra conta, **When** a atualização é processada, **Then** a pessoa recebe erro associado ao E-mail e nome, e-mail atual, papel e sessões permanecem inalterados.
5. **Given** que os valores normalizados são iguais aos atuais, **When** a pessoa tenta salvar, **Then** recebe a informação de que não há alteração e nenhuma atualização ou revogação de sessão é executada.
6. **Given** uma tentativa direta de enviar role, id, senha ou campo desconhecido pelo fluxo de perfil, **When** a solicitação é validada, **Then** ela é rejeitada e nenhum dado da conta é modificado.

---

### User Story 2 - Alterar a própria senha com segurança (Priority: P2)

Como pessoa autenticada, quero trocar minha senha informando a senha atual e confirmando a nova, para recuperar controle sobre minhas credenciais sem sair do dispositivo que estou usando.

**Why this priority**: A troca de senha é a nova capacidade principal da feature e precisa combinar confirmação de identidade, armazenamento seguro e resposta coerente das sessões.

**Independent Test**: Pode ser testada com duas sessões ativas da mesma conta. Uma troca válida deve preservar a sessão iniciadora, invalidar imediatamente a outra sessão e permitir novo login somente com a nova senha.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada no Perfil, **When** escolhe "Alterar senha", **Then** acessa um fluxo separado com os campos "Senha atual", "Nova senha" e "Confirmar nova senha".
2. **Given** senha atual correta, nova senha válida e confirmação correspondente, **When** a pessoa envia uma única vez, **Then** a senha é alterada, recebe confirmação de sucesso e continua autenticada na sessão atual.
3. **Given** duas ou mais sessões ativas, **When** a senha é alterada com sucesso em uma delas, **Then** todas as outras perdem acesso e capacidade de renovação, enquanto a sessão iniciadora continua operante.
4. **Given** uma troca concluída, **When** a pessoa tenta entrar novamente, **Then** a senha antiga é recusada e a nova senha é aceita.
5. **Given** senha atual incorreta, **When** a alteração é solicitada, **Then** a pessoa recebe feedback claro sem confirmação de credencial adicional e senha e sessões não são modificadas.
6. **Given** que a nova senha coincide com a atual, **When** a alteração é solicitada, **Then** o pedido é rejeitado sem atualizar o hash ou revogar sessões.
7. **Given** que a nova senha e sua confirmação não coincidem ou violam a política, **When** a pessoa tenta enviar, **Then** vê erro no campo correspondente e nenhuma solicitação válida é executada.
8. **Given** falha ao atualizar a senha ou revogar as demais sessões, **When** a operação termina, **Then** nenhuma parte da mudança é confirmada e a credencial anterior continua válida.

### Edge Cases

- Nome ou e-mail contém espaços externos, variação de maiúsculas ou atinge o limite aceito.
- A atualização de e-mail é normalizada para um endereço já existente.
- Uma tentativa de edição não produz mudança depois da normalização.
- A sessão expira enquanto a pessoa edita o perfil ou preenche a troca de senha.
- A senha atual está vazia, incorreta ou contém espaços intencionais.
- A nova senha possui 5, 6, 72 ou 73 caracteres.
- Nova senha e confirmação divergem apenas por espaço, maiúscula ou caractere especial.
- A nova senha é exatamente igual à atual.
- A pessoa toca repetidamente em salvar enquanto a operação está pendente.
- A atualização do hash tem sucesso interno, mas a revogação das outras sessões falha, ou o inverso.
- Outra sessão tenta usar access token ou refresh token logo após a troca.
- A pessoa alterna o tema ou abre o teclado com texto ampliado durante qualquer um dos formulários.

## Requirements _(mandatory)_

### In-Scope Flow Inventory

| Fluxo                 | Elementos abrangidos                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Perfil principal      | Exibição atual da identidade e do papel, acesso a Editar perfil e nova ação Alterar senha                              |
| Editar perfil         | Nome, E-mail, validação, confirmação, conflito, no-op e atualização do estado autenticado                              |
| Alterar senha         | Senha atual, nova senha, confirmação, validação, feedback, proteção contra envio duplicado e sucesso                   |
| Sessões               | Preservação da sessão iniciadora e revogação das demais após mudança efetiva de e-mail ou senha                        |
| Contratos e segurança | Autorização do próprio usuário, validação na fronteira, hash seguro e ausência de dados sensíveis em respostas ou logs |

### Functional Requirements

- **FR-001**: O Perfil principal MUST continuar exibindo Nome, E-mail e Perfil como informações da conta e MUST oferecer ações distintas para "Editar perfil", "Alterar senha" e "Sair da conta".
- **FR-002**: "Editar perfil" MUST conter somente Nome e E-mail; a tela MUST NOT apresentar campo, seletor ou valor somente leitura de papel.
- **FR-003**: O papel da conta MUST permanecer imutável por qualquer fluxo de autoatendimento, independentemente do perfil autenticado.
- **FR-004**: A atualização de perfil MUST aceitar somente Nome e/ou E-mail e MUST rejeitar role, id, senha e qualquer campo desconhecido sem alteração parcial.
- **FR-005**: Nome MUST manter normalização e validações atuais de caracteres e tamanho; E-mail MUST manter normalização, formato, limite e unicidade atuais.
- **FR-006**: O formulário MUST enviar somente os valores efetivamente alterados depois da normalização e MUST informar quando não existir mudança para salvar.
- **FR-007**: Antes de atualizar Nome e/ou E-mail, a pessoa MUST revisar um resumo inequívoco das mudanças e poder confirmar ou cancelar sem perder os valores preenchidos.
- **FR-008**: Uma atualização apenas de Nome MUST preservar todas as sessões ativas existentes.
- **FR-009**: Uma alteração efetiva de E-mail MUST preservar a sessão iniciadora, revogar todas as demais sessões e atualizar a identidade visível sem exigir novo login no dispositivo atual.
- **FR-010**: Conflito ou falha na atualização de perfil MUST preservar Nome, E-mail, papel e sessões anteriores e fornecer feedback recuperável no campo ou confirmação correspondente.
- **FR-011**: O Perfil MUST oferecer "Alterar senha" como fluxo separado da edição de Nome/E-mail e da futura exclusão de conta.
- **FR-012**: O formulário de senha MUST conter exatamente "Senha atual", "Nova senha" e "Confirmar nova senha", com entrada protegida e finalidade acessível apropriada para cada campo.
- **FR-013**: Senha atual, nova senha e confirmação MUST ser obrigatórias; a nova senha MUST ter entre 6 e 72 caracteres, seguindo a política já usada no cadastro.
- **FR-014**: Valores de senha MUST ser comparados exatamente como digitados e MUST NOT ser aparados, convertidos para outra caixa ou normalizados silenciosamente.
- **FR-015**: A confirmação MUST coincidir exatamente com a nova senha, e a nova senha MUST ser diferente da senha atual.
- **FR-016**: As regras de obrigatoriedade, tamanho, confirmação e diferença MUST ser aplicadas no aplicativo para feedback imediato e novamente na autoridade do servidor, sem confiar no cliente.
- **FR-017**: A alteração de senha MUST atuar exclusivamente sobre a conta identificada pela sessão autenticada; nenhum identificador de usuário informado pelo cliente pode selecionar outra conta.
- **FR-018**: A senha atual MUST ser validada contra a credencial armazenada antes de qualquer mudança; senha atual incorreta MUST produzir resposta não ambígua para a pessoa e MUST NOT alterar credencial ou sessões.
- **FR-019**: Uma troca válida MUST armazenar somente a representação segura da nova senha e MUST atualizar a credencial e revogar as outras sessões como uma única operação atômica.
- **FR-020**: Após sucesso, a sessão que iniciou a troca MUST continuar ativa com seus tokens atuais e todas as outras sessões MUST ser revogadas imediatamente.
- **FR-021**: Access tokens e refresh tokens pertencentes às sessões revogadas MUST ser recusados nas próximas tentativas de acesso ou renovação.
- **FR-022**: Depois da troca, autenticação com a senha antiga MUST falhar e autenticação com a nova senha MUST funcionar segundo as mesmas regras de login existentes.
- **FR-023**: Senhas em texto puro, confirmações e hashes MUST NOT aparecer em respostas, perfil público, logs, analytics, cache de consulta ou armazenamento local do aplicativo.
- **FR-024**: Os valores dos três campos de senha MUST permanecer somente na memória do formulário, ser removidos após sucesso ou abandono da tela e nunca ser restaurados em uma nova abertura.
- **FR-025**: Durante uma solicitação pendente, os controles MUST comunicar processamento, impedir envio duplicado e bloquear cancelamento que possa representar falsamente que a operação foi interrompida.
- **FR-026**: Falhas de validação ou operação MUST manter o fluxo recuperável sem revelar hash, política interna, existência de outra conta ou informações desnecessárias sobre sessões.
- **FR-027**: Editar perfil e alterar senha MUST funcionar nos temas Claro e Escuro, acomodar teclado, texto ampliado e largura estreita e manter rótulos, erros, foco e ações acessíveis.
- **FR-028**: A feature MUST preservar autenticação, refresh, logout, preferência de tema, permissões, navegação e demais regras de domínio existentes fora das mudanças explicitamente definidas.
- **FR-029**: A feature MUST documentar o novo contrato versionado de alteração de senha e atualizar os contratos de Perfil quando necessário, sem exigir nova tabela, migration ou dependência externa.

### Key Entities

- **Perfil autenticado**: Identidade pública da conta composta por id, nome, e-mail e papel; somente nome e e-mail são mutáveis por este fluxo.
- **Solicitação de alteração de senha**: Conjunto transitório e write-only de senha atual e nova senha; a confirmação existe apenas para prevenir erro de digitação no cliente.
- **Credencial de senha**: Representação segura usada para autenticação, substituída somente depois da validação da senha atual.
- **Sessão de autenticação**: Acesso associado à conta e a um identificador de sessão; a sessão iniciadora é preservada e as demais são revogadas em mudanças sensíveis.

### Out of Scope

- Exclusão de conta, confirmação de exclusão e ciclo de vida dos dados, reservados para `008-account-deletion-data-lifecycle`.
- Recuperação ou redefinição de senha para pessoa desconectada, envio de link ou código por e-mail e suporte administrativo de reset.
- Alteração de papel, promoção para Professor ou Administrador e gerenciamento de permissões.
- Tela de listagem de dispositivos/sessões, revogação manual de sessão específica ou botão "sair de todos os dispositivos".
- Autenticação multifator, passkeys, biometria ou login social.
- Nova política de complexidade, medidor de força, expiração periódica ou histórico de senhas.
- Mudança do comportamento geral de logout ou do ciclo de vida padrão dos tokens fora da revogação exigida após e-mail/senha.
- Novos dados de perfil, avatar enviado pelo usuário ou preferências adicionais.
- Nova tabela, migration, dependência externa ou alteração das relações de turmas, comunicados e ownership.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% dos perfis PARENT, PROFESSOR e ADMIN cobertos, "Editar perfil" apresenta somente Nome e E-mail, enquanto o papel permanece visível apenas como informação e não pode ser alterado pela interface nem por solicitação manipulada.
- **SC-002**: Nome válido, e-mail válido, atualização conjunta, no-op normalizado e conflito de e-mail produzem o resultado definido em 100% dos cenários de regressão, sem alteração de papel.
- **SC-003**: Em 100% das trocas válidas, a senha nova passa a autenticar, a antiga deixa de autenticar e nenhuma senha ou hash aparece na resposta.
- **SC-004**: Senha atual incorreta, nova senha igual à atual, confirmação divergente e comprimentos 5 e 73 são rejeitados em 100% dos testes aplicáveis sem alterar senha ou sessões.
- **SC-005**: Com pelo menos duas sessões ativas, 100% das trocas de senha concluídas preservam a sessão iniciadora e fazem access e refresh das demais sessões retornarem não autorizado na tentativa seguinte.
- **SC-006**: Em falha simulada entre atualização da credencial e revogação das sessões, 100% dos testes demonstram rollback integral: senha anterior e estado das sessões permanecem válidos.
- **SC-007**: Toques repetidos durante uma alteração de senha pendente produzem no máximo uma operação efetiva e um único resultado apresentado.
- **SC-008**: Nenhum teste, resposta, log ou estado persistido inspecionado contém senha atual, nova senha, confirmação ou hash fora do limite transitório necessário à validação.
- **SC-009**: Nome/e-mail e senha podem ser preenchidos, validados, corrigidos e enviados com teclado aberto, texto ampliado e nos temas Claro/Escuro sem ocultar campo, erro ou ação essencial nos cenários aplicáveis.
- **SC-010**: Login, refresh, edição de perfil, preferência de tema, logout e fluxos de turma/comunicado mantêm seus resultados anteriores em todos os testes de regressão aplicáveis.

## Assumptions

- PARENT, PROFESSOR e ADMIN autenticados podem alterar somente o próprio nome, e-mail e senha pelas mesmas regras de autoatendimento.
- O papel continua visível no Perfil principal para contexto, mas é removido apenas da interface de edição.
- A política vigente de senha permanece entre 6 e 72 caracteres, sem novas exigências de composição nesta feature.
- Espaços e caixa fazem parte da senha; nenhuma normalização é aplicada a valores de credencial.
- A sessão iniciadora é determinada pelo identificador da sessão autenticada já validado pelo servidor, nunca por valor fornecido no corpo da solicitação.
- O comportamento existente de alteração de e-mail — preservar a sessão atual e revogar as demais — permanece e serve de referência para a troca de senha.
- A confirmação da nova senha é uma proteção de interface e não precisa ser armazenada nem devolvida pelo servidor.
- Estruturas existentes de usuário, hash e sessões são suficientes; não há necessidade de migration ou novo pacote.
- A evidência manual principal continua seguindo o alvo Android do ciclo atual; ausência de dispositivo, versão, tecnologia assistiva, iOS ou participantes deve ser registrada como `NOT MEASURED`.
- A spec `006-classroom-search-fix` está concluída e integrada; `007` e `008` são capacidades relacionadas, porém independentes, e a implementação da `007` não deve antecipar exclusão de conta.
