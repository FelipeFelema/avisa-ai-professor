# Feature Specification: Push Notification Foundation

**Feature Branch**: `010-push-notification-foundation`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "Criar uma infraestrutura reutilizável para notificações push: solicitar permissão, obter e registrar o token do dispositivo, associá-lo com segurança à conta/instalação/sessão, suportar múltiplos dispositivos, rotação e invalidação, tratar logout, recusa, tokens inválidos e falhas, e permitir uma notificação de teste. Regras de novo comunicado e expiração permanecem nas specs 011 e 012."

## Clarifications

### Session 2026-10-05

- Q: A SC-007 exige prova universal de posse de um token desconhecido ou protege os vínculos registrados pelo aplicativo? → A: Por decisão explícita do proprietário, a SC-007 protege os vínculos de usuário, sessão, instalação e token já registrados pelo fluxo controlado da aplicação. Não exige garantia universal de posse de Expo Push Token desconhecido. Não haverá desafio de posse por notificação; tentativas não autorizadas contra vínculos protegidos continuam exigindo zero-envios e zero alterações nos registros da vítima.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ativar notificações neste dispositivo (Priority: P1)

Uma pessoa autenticada como PARENT, PROFESSOR ou ADMIN acessa as configurações de notificações pelo Perfil, entende por que a permissão é necessária e decide explicitamente ativá-la. Quando o sistema operacional autoriza, a instalação é registrada para a conta atual. Se a pessoa recusar ou o ambiente não for compatível, o restante do aplicativo continua funcionando normalmente e a situação fica clara.

**Why this priority**: Nenhuma regra futura de notificação pode funcionar com segurança sem consentimento compreensível, token válido e associação correta ao usuário autenticado.

**Independent Test**: Pode ser validada em estados de permissão ainda não solicitada, concedida, recusada e indisponível, verificando que somente uma autorização concedida cria um registro para a própria conta e que recusar não bloqueia nenhuma função existente.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada cuja permissão ainda não foi solicitada, **When** abre as configurações de notificações, **Then** vê uma explicação e uma ação explícita para ativar, sem o aviso do sistema operacional aparecer automaticamente.
2. **Given** que a pessoa escolheu ativar, **When** a permissão é concedida e o dispositivo fornece um token válido, **Then** a instalação aparece como ativa para notificações da conta atual.
3. **Given** que a permissão foi recusada, **When** a pessoa retorna ao aplicativo, **Then** vê o estado recusado, orientação para configurações do dispositivo e continua usando todos os demais fluxos.
4. **Given** um simulador, plataforma ou build sem suporte/configuração para push, **When** a ativação é tentada, **Then** nenhum token fictício é registrado e uma mensagem segura explica que notificações não estão disponíveis nesse ambiente.
5. **Given** uma permissão já concedida e registro ativo, **When** a pessoa abre novamente a área, **Then** o estado é reconciliado sem criar registro duplicado nem solicitar permissão outra vez.

---

### User Story 2 - Manter os dispositivos corretos associados à conta (Priority: P2)

Uma mesma pessoa pode usar mais de um dispositivo, trocar de conta em uma instalação ou ter o token alterado pelo sistema. A fundação mantém cada instalação ativa associada somente à conta e à sessão corretas, substitui tokens antigos e remove ou invalida registros quando a permissão, a sessão ou a conta deixa de ser válida.

**Why this priority**: Registros desatualizados podem causar perda de avisos ou, pior, enviar informação de uma conta para outra pessoa que passou a usar o dispositivo.

**Independent Test**: Pode ser validada com duas instalações da mesma conta, troca de conta em uma instalação, rotação de token, logout, revogação de sessão, revogação de permissão e exclusão de conta, conferindo quais registros permanecem elegíveis.

**Acceptance Scenarios**:

1. **Given** a mesma conta autenticada em dois dispositivos autorizados, **When** ambos se registram, **Then** cada instalação mantém seu próprio registro ativo sem substituir o outro.
2. **Given** uma instalação cujo token mudou, **When** o aplicativo reconcilia o estado, **Then** o token novo substitui o anterior para essa instalação e o token antigo deixa de ser elegível.
3. **Given** que uma pessoa encerra a sessão, **When** o logout é concluído com conectividade, **Then** o registro daquela instalação é desativado antes ou junto da limpeza local, sem afetar os outros dispositivos da mesma conta.
4. **Given** logout sem conectividade, **When** o estado local é limpo, **Then** a pendência de desativação é preservada e reconciliada assim que houver comunicação, antes de associar a instalação a outra conta.
5. **Given** que outra pessoa entra na mesma instalação, **When** o dispositivo é registrado para a nova sessão, **Then** o token não permanece simultaneamente associado à conta anterior.
6. **Given** sessão expirada/revogada, conta excluída, permissão removida ou token declarado inválido permanentemente, **When** a elegibilidade é avaliada, **Then** o registro afetado deixa de receber envios sem remover registros válidos de outros dispositivos.

---

### User Story 3 - Validar a infraestrutura com uma notificação de teste (Priority: P3)

Uma pessoa com notificações ativas solicita uma notificação de teste para a instalação atual. O aplicativo informa separadamente se a solicitação foi aceita para entrega, recusada por configuração/permissão ou falhou, e a mensagem de teste não contém dados escolares ou pessoais.

**Why this priority**: Um teste controlado confirma que permissão, registro, serviço de entrega e recebimento funcionam juntos antes de as specs 011 e 012 adicionarem regras de negócio.

**Independent Test**: Pode ser validada em uma instalação compatível solicitando o teste para o próprio dispositivo, verificando o conteúdo neutro, o comportamento em primeiro plano e segundo plano e a recusa de tentativas de indicar outro usuário ou token.

**Acceptance Scenarios**:

1. **Given** permissão concedida e registro ativo da instalação atual, **When** a pessoa solicita uma notificação de teste, **Then** somente essa instalação é selecionada e o aplicativo informa se o serviço aceitou a entrega.
2. **Given** o aplicativo em primeiro plano, **When** a notificação de teste chega, **Then** a pessoa recebe feedback visível sem duplicação desnecessária.
3. **Given** o aplicativo em segundo plano, **When** a notificação de teste chega, **Then** o sistema apresenta uma notificação identificável como teste, sem título ou conteúdo de turma/comunicado.
4. **Given** permissão recusada, registro ausente/inativo ou ambiente não configurado, **When** o teste é solicitado, **Then** nenhum destino arbitrário é usado e a pessoa recebe orientação coerente com o estado atual.
5. **Given** uma solicitação manipulada com identificador de outro usuário, instalação ou token, **When** ela chega ao sistema, **Then** o destino é recusado e nenhuma notificação é enviada.

### Edge Cases

- A permissão muda nas configurações do sistema enquanto o aplicativo está fechado ou em segundo plano.
- A permissão é concedida, mas o token não pode ser obtido por falta de configuração, conectividade ou suporte do ambiente.
- O token muda entre sua leitura local e o registro no servidor.
- Duas reconciliações da mesma instalação ocorrem simultaneamente.
- O mesmo token aparece associado anteriormente a outra conta ou instalação.
- A conta tem várias sessões e somente uma delas é revogada.
- O logout local acontece sem rede e o aplicativo não é aberto novamente por algum tempo.
- A conta é excluída enquanto há registro ou envio de teste em andamento.
- O serviço de push aceita a mensagem, mas o sistema operacional não a exibe ou a entrega é atrasada.
- O serviço de push informa token inválido permanentemente, limitação temporária ou falha transitória.
- A pessoa toca repetidamente em ativar, desativar ou enviar teste.
- O aplicativo é reinstalado e passa a representar uma nova instalação, possivelmente com token diferente.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: PARENT, PROFESSOR e ADMIN autenticados MUST poder consultar e controlar o estado de notificações da instalação atual a partir do Perfil.
- **FR-002**: O aplicativo MUST explicar a finalidade das notificações antes de solicitar a permissão do sistema operacional e MUST solicitar essa permissão somente após ação explícita da pessoa.
- **FR-003**: O fluxo MUST distinguir, no mínimo, estados de permissão não solicitada, concedida, recusada e indisponível, além de carregamento e falha recuperável.
- **FR-004**: Recusar, revogar ou não poder conceder a permissão MUST NOT bloquear autenticação, perfil, turmas, comunicados ou qualquer capacidade não relacionada a push.
- **FR-005**: Quando a permissão estiver recusada, o aplicativo MUST evitar solicitações automáticas repetidas e MUST oferecer orientação para a pessoa revisar a permissão nas configurações do dispositivo.
- **FR-006**: Somente uma instalação com permissão concedida, configuração válida, token real e sessão autenticada ativa MUST poder criar ou atualizar um registro de push.
- **FR-007**: O servidor MUST determinar a conta e a sessão exclusivamente pela autenticação vigente; o cliente MUST NOT escolher outro usuário ou registrar token em nome de outra conta.
- **FR-008**: Cada registro MUST representar a relação entre uma conta, uma sessão ativa, uma instalação do aplicativo, uma plataforma, o token atual, seu estado e os instantes necessários para reconciliação e invalidação.
- **FR-009**: Uma conta MUST poder manter registros ativos independentes em múltiplas instalações, sem que atualizar uma delas remova as demais.
- **FR-010**: Uma instalação ou token MUST NOT permanecer ativo simultaneamente para contas diferentes; troca de conta MUST desassociar o vínculo anterior antes de habilitar o novo.
- **FR-011**: Repetir o registro com a mesma conta, sessão, instalação e token MUST ser idempotente e MUST NOT criar duplicatas.
- **FR-012**: Quando o token da instalação mudar, o sistema MUST ativar o novo vínculo e tornar o token anterior inelegível sem interromper registros de outros dispositivos.
- **FR-013**: O aplicativo MUST reconciliar permissão, token e associação após autenticação, restauração de sessão e retorno relevante ao primeiro plano, sem exibir prompts automáticos indevidos.
- **FR-014**: Desativar notificações no aplicativo MUST tornar o registro da instalação inelegível sem alegar que a permissão do sistema operacional foi removida.
- **FR-015**: Logout com comunicação disponível MUST desativar o registro da instalação atual sem afetar outras instalações da conta e MUST concluir a limpeza autenticada mesmo se a limpeza de push falhar.
- **FR-016**: Logout sem comunicação MUST concluir a limpeza local, preservar somente a pendência mínima necessária para desativação segura e reconciliá-la na próxima oportunidade antes de registrar outra conta na mesma instalação.
- **FR-017**: Registro ligado a sessão expirada ou revogada MUST ser inelegível para entrega; revogação das demais sessões após alterações sensíveis MUST afetar somente os registros dessas sessões.
- **FR-018**: Exclusão de conta MUST remover ou invalidar todos os seus registros de push; nenhuma instalação da conta excluída MUST permanecer elegível.
- **FR-019**: Revogação de permissão detectada no dispositivo MUST desativar o respectivo registro; reinstalação MUST ser tratada como nova instalação sem restaurar associação de conta anterior.
- **FR-020**: Quando o serviço de entrega identificar permanentemente um token como inválido ou não registrado, o sistema MUST torná-lo inelegível; falhas transitórias MUST NOT apagar um registro válido.
- **FR-021**: A pessoa autenticada MUST poder solicitar uma notificação de teste somente para o registro ativo da instalação atual; usuário, instalação e token de destino MUST NOT ser aceitos como seleção arbitrária do cliente.
- **FR-022**: A notificação de teste MUST usar conteúdo neutro, identificável como teste e sem nome, e-mail, turma, comunicado, papel ou outro dado privado.
- **FR-023**: O sistema MUST distinguir aceitação pelo serviço de entrega de exibição efetiva no dispositivo e MUST NOT afirmar entrega garantida quando houver apenas aceitação externa.
- **FR-024**: Solicitações repetidas de teste MUST ser bloqueadas enquanto uma estiver pendente e limitadas a uma tentativa aceita por instalação a cada 30 segundos.
- **FR-025**: Falhas de permissão, configuração, registro e entrega MUST produzir mensagens seguras e acionáveis, sem expor credenciais, configuração interna, resposta bruta do provedor ou token completo.
- **FR-026**: Tokens, identificadores privados de instalação e segredos de configuração MUST NOT aparecer completos em logs, diagnósticos, analytics, notificações, URLs, exemplos de documentação ou mensagens ao usuário.
- **FR-027**: O servidor MUST rejeitar propriedades inesperadas, tokens vazios/malformados e valores fora dos limites definidos, sem confiar na validação móvel.
- **FR-028**: Os controles e estados de notificações MUST permanecer compreensíveis em português, nos temas Claro/Escuro, com texto ampliado e sem depender apenas de cor; testes automatizados e walkthrough funcional individual seguem o escopo de validação vigente do projeto.
- **FR-029**: Esta feature MUST NOT enviar notificações por criação ou expiração de comunicado, executar agendamentos, selecionar membros de turma ou incluir deep link para recurso de negócio.
- **FR-030**: Login, cadastro, refresh, perfil, senha, logout, exclusão de conta, convites, turmas e comunicados MUST conservar seus resultados vigentes, exceto pelas integrações de registro/invalidação de push explicitamente definidas aqui.

### Key Entities _(include if feature involves data)_

- **Registro de push**: associação server-side entre conta, sessão, instalação, plataforma e token atual; possui estado e metadados de reconciliação suficientes para decidir elegibilidade sem expor o token.
- **Instalação do aplicativo**: identidade aleatória desta instalação, distinta de identificadores permanentes de hardware e recriada após reinstalação.
- **Estado de permissão**: decisão controlada pelo sistema operacional e refletida no aplicativo como não solicitada, concedida, recusada ou indisponível.
- **Pendência de desativação**: informação local mínima e transitória usada para concluir com segurança uma remoção que não pôde alcançar o servidor durante logout.
- **Tentativa de teste**: solicitação limitada para enviar conteúdo neutro ao registro ativo da instalação atual, com resultado separado entre rejeição local, aceitação externa e falha.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% dos cenários de permissão, somente uma escolha explícita seguida de autorização concedida produz registro; recusa ou indisponibilidade cria zero registros e bloqueia zero funções não relacionadas.
- **SC-002**: Uma matriz com duas contas, duas sessões e duas instalações mantém 100% dos registros válidos no proprietário correto, sem token ativo simultaneamente para contas distintas.
- **SC-003**: Repetição de registro e rotação de token resultam em exatamente um registro elegível por conta/sessão/instalação e zero tokens anteriores elegíveis para essa mesma instalação.
- **SC-004**: Logout, revogação/expiração de sessão, remoção de permissão, token permanentemente inválido e exclusão de conta tornam inelegíveis 100% dos registros afetados sem desativar registros válidos não relacionados.
- **SC-005**: Em um walkthrough funcional individual numa instalação compatível, a pessoa consegue ativar notificações e obter confirmação de registro em até 2 minutos, ou recebe um estado de recusa/indisponibilidade correto e acionável.
- **SC-006**: Uma notificação de teste aceita aparece com conteúdo neutro na instalação alvo durante o walkthrough funcional; quando não aparece, o sistema preserva a distinção entre aceitação externa e entrega observada, sem registrar um falso sucesso de exibição.
- **SC-007**: Para vínculos protegidos de usuário, sessão, instalação e token já registrados através do fluxo controlado pela aplicação, tentativas não autorizadas de direcionar teste ou registro a esses vínculos produzem zero notificações e zero alterações nos registros da vítima em todos os cenários negativos da matriz de validação. Este critério não exige garantia universal de posse de um Expo Push Token desconhecido e não introduz desafio de posse baseado no envio de uma notificação.
- **SC-008**: Tokens completos, identificadores privados de instalação e segredos aparecem zero vezes nos logs, URLs, erros, exemplos versionados, analytics e mensagens inspecionados.
- **SC-009**: Toques repetidos e reconciliações concorrentes produzem no máximo uma mutação efetiva por intenção e uma tentativa de teste aceita por instalação a cada 30 segundos.
- **SC-010**: Os fluxos existentes de autenticação, conta, convites, turmas e comunicados mantêm seus resultados anteriores em 100% dos testes de regressão aplicáveis, e nenhuma notificação de negócio é emitida nesta feature.

## Assumptions

- Android e iOS são plataformas de produto para esta fundação; a validação seguirá automação e walkthrough funcional individual viável, sem criar campanhas nativas especializadas, TalkBack, VoiceOver ou testes com participantes.
- A permissão pertence à instalação/sistema operacional, enquanto a elegibilidade de envio pertence à associação autenticada entre conta, sessão e instalação.
- Expo Push Token não constitui atestação de posse do dispositivo. A proteção da SC-007 incide sobre os vínculos registrados pelo fluxo controlado do aplicativo; a autorização e as regras de ciclo de vida desses vínculos permanecem obrigatórias, sem desafio de posse por notificação.
- O identificador da instalação será aleatório e específico do aplicativo, não um identificador permanente ou publicitário do hardware.
- A entrega push depende de um serviço externo e do sistema operacional; aceitação externa não equivale a garantia de exibição, e essa diferença permanece visível na evidência.
- Credenciais e identificadores do serviço de push serão fornecidos por configuração segura de ambiente; ausência de configuração gera estado indisponível, nunca token ou sucesso fictício.
- As dependências móveis compatíveis para dispositivo e notificações já estão presentes no repositório, mas isso não comprova configuração, registro, envio ou recebimento.
- Logout offline não permite confirmação imediata no servidor; por isso a aplicação conclui a segurança local e carrega uma pendência mínima de desativação para a próxima conectividade, antes de vincular outra conta.
- A notificação de teste está disponível para qualquer papel autenticado, sempre direcionada somente à instalação atual e sem seleção de destinatário.
- Web push, preferências por categoria e conteúdo de negócio não fazem parte desta fundação.
- A `010` é independente de perfil/senha (`007`), exclusão de conta (`008`) e administração de convites (`009`); integra-se apenas aos eventos de sessão/conta necessários para impedir registros residuais.

## Scope Boundaries

### In Scope

- Configuração operacional segura necessária para obter tokens e enviar push nos ambientes suportados.
- Área de notificações no Perfil, explicação, permissão, estados e ativação/desativação da instalação atual.
- Registro autenticado, múltiplas instalações, idempotência, rotação, troca de conta e invalidação de tokens.
- Integração com logout, revogação/expiração de sessão e exclusão de conta.
- Tratamento de recusa, ambiente incompatível, configuração ausente, token inválido e falhas transitórias.
- Envio limitado de notificação neutra de teste para a própria instalação.
- Contratos, documentação e testes diretamente necessários para comprovar a fundação.

### Out of Scope

- Notificar criação de comunicado; essa regra pertence à `011-new-announcement-notifications`.
- Agendar ou enviar lembrete de expiração; essa regra pertence à `012-announcement-expiration-reminders`.
- Selecionar destinatários por turma, papel ou administração; enviar broadcast ou notificação para outra pessoa.
- Deep links para turma/comunicado, payload de negócio ou ações interativas de notificação.
- Caixa de entrada, histórico de notificações, estado lido/não lido ou sincronização de notificações dentro do aplicativo.
- Preferências por tipo de notificação, horários silenciosos ou frequência personalizada.
- E-mail, SMS, notificações web ou múltiplos provedores de push.
- Métricas de campanha, analytics de abertura/entrega, painel administrativo ou reenvio manual.
- Campanhas especializadas Android/iOS, auditorias físicas de dispositivo/acessibilidade ou testes com participantes, conforme o escopo permanente de validação do projeto.
- Auditoria ampla de segurança e supply chain reservada à `014-production-security-assessment`.

## Dependencies

- Reutiliza autenticação, sessões e ciclo de vida de conta existentes somente para garantir ownership e elegibilidade dos registros; não depende da conclusão funcional das specs `007`, `008` ou `009` além da base já integrada.
- É uma capacidade independente das interfaces administrativas e pode ser planejada sem esperar novas mudanças de senha, exclusão de conta ou convites.
- `011-new-announcement-notifications` e `012-announcement-expiration-reminders` dependem desta fundação, mas permanecem independentes e paralelizáveis entre si depois da conclusão da `010`.
- As specs `002` a `012` devem estar concluídas antes da consolidação de release da `013-release-polish-and-documentation`; a fundação será reavaliada na `014-production-security-assessment`.
