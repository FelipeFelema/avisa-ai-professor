# Feature Specification: Release Hardening and Documentation

**Feature Branch**: `012-release-hardening-and-documentation`

**Created**: 2026-10-07

**Status**: aprovada em 2026-10-07 para execução das Fases 1–3; demais fases aguardam autorização.

**Input**: Última spec antes do MVP Android: avaliação sistemática de segurança, remediação relevante, configuração de produção, UX final de notificações, regressão, documentação e decisão de release.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conta e conteúdo protegidos (Priority: P1)

Como usuário, quero que minha sessão, conta e turmas continuem protegidas mesmo quando alguém altera identificadores ou reaproveita uma sessão encerrada.

**Why this priority**: Acesso indevido e revogação ineficaz bloqueiam o lançamento.

**Independent Test**: Matriz de duas contas, duas turmas e todos os papéis, com chamadas diretas ao servidor e callbacks atrasados; nenhum acesso ou efeito indevido.

**Acceptance Scenarios**:

1. **Given** uma sessão encerrada, expirada ou revogada, **When** seus tokens são reutilizados, **Then** o servidor nega acesso e renovação.
2. **Given** outra conta/turma ou papel insuficiente, **When** IDs são adulterados em perfil, senha, exclusão, turmas, comunicados, convites ou notificações, **Then** o servidor nega acesso e preserva os dados da vítima.
3. **Given** troca de conta durante operação, **When** chega resposta, renovação ou callback da sessão anterior, **Then** nenhum estado, cache, navegação ou efeito privado contamina a nova conta.
4. **Given** entradas extras, inválidas, excessivas ou abuso repetido, **When** são submetidas aos fluxos protegidos e públicos, **Then** validação/limites aplicáveis rejeitam abuso sem revelar segredos, dados internos ou conteúdo privado.

### User Story 2 - Notificações com destinatário correto (Priority: P1)

Como usuário, quero receber apenas notificações elegíveis da minha conta e turma, com dados mínimos e sem autorizar acesso pelo conteúdo da notificação.

**Why this priority**: Destinatário incorreto, segredo exposto ou reativação indevida bloqueiam release.

**Independent Test**: Publicação, expiração, restart, concorrência, logout e exclusão em fixtures isoladas; contas externas recebem zero envios e nenhum payload concede autorização.

**Acceptance Scenarios**:

1. **Given** contas elegíveis e uma conta fora da turma, **When** há comunicado novo ou lembrete, **Then** somente o conjunto elegível definido pelo servidor recebe envio.
2. **Given** vínculo revogado/inválido, saída de turma, logout, exclusão ou troca de conta, **When** há dispatch ou resposta atrasada, **Then** o vínculo inelegível não recebe novo envio; trabalho antigo não reativa a conta.
3. **Given** notificação antiga ou adulterada, **When** é aberta, **Then** a consulta autenticada revalida acesso e trata conteúdo indisponível sem vazamento.
4. **Given** reinício ou workers concorrentes, **When** processam a mesma ocorrência de expiração, **Then** não criam envio duplicado; resultados ambíguos não são reenviados cegamente.
5. **Given** configuração final do provedor, **When** é revisada, **Then** credenciais de envio ficam fora do aplicativo e dos registros, e as proteções do provedor estão comprovadas sem divulgar valores.

### User Story 3 - Dependências e segredos avaliados (Priority: P1)

Como responsável pelo lançamento, quero decisões atuais e rastreáveis sobre vulnerabilidades e exposição de segredos, para corrigir os riscos relevantes sem mudanças incompatíveis apenas para zerar um relatório.

**Why this priority**: Um relatório histórico ou uma contagem de advisories não demonstra segurança da versão entregue.

**Independent Test**: Inventário atualizado de ambos os componentes, evidência do artefato Android e revisão de superfícies de segredo; cada finding recebe decisão e justificativa.

**Acceptance Scenarios**:

1. **Given** a revisão candidata e seus lockfiles, **When** são auditados, **Then** cada advisory relevante identifica cadeia, versão, severidade, presença no runtime/artefato, vetor alcançável, correção e impacto.
2. **Given** correção compatível e segura, **When** a remediação é aprovada e aplicada, **Then** o risco é reavaliado com regressão, sem atualização major automática.
3. **Given** segredos em ambiente, histórico, arquivos, fixtures, logs ou artefatos, **When** ocorre a revisão, **Then** valores reais não são publicados; exposição confirmada exige revogação/rotação, contenção e validação, e impede release enquanto aberta.

### User Story 4 - Produção reproduzível e recuperável (Priority: P1)

Como operador, quero subir o backend e o aplicativo Android com configuração correta, dados íntegros e um procedimento seguro de recuperação.

**Why this priority**: API inacessível, migração ausente, artefato quebrado ou fluxo principal indisponível bloqueiam o MVP.

**Independent Test**: Ensaio de migrations/recovery em banco isolado e smoke do artefato production ligado à API HTTPS candidata, sem procedimentos destrutivos na base real.

**Acceptance Scenarios**:

1. **Given** ambiente de produção, **When** o backend inicia, **Then** valida configuração obrigatória, oferece health apropriado e não expõe documentação insegura, stack ou dados internos.
2. **Given** a cadeia completa de migrations, **When** é ensaiada em base vazia e base anterior representativa, **Then** o schema final é coerente e exclusões não deixam dados órfãos incompatíveis com a política documentada.
3. **Given** falha de deploy, **When** o operador segue o runbook, **Then** consegue desativar push, recuperar dados e restaurar uma aplicação compatível sem apagar ledger nem executar downgrade destrutivo improvisado.
4. **Given** artefato Android production, **When** executa os fluxos principais, **Then** usa API pública HTTPS, configuração final de notificações e identidade correta, sem URL local, credencial backend, UI interna ou ação de notificação de teste.

### User Story 5 - Consentimento contextual por conta/dispositivo (Priority: P2)

Como usuário, quero entender o valor das notificações no primeiro uso e escolher se desejo ativá-las, sem herdar a escolha de outra conta.

**Why this priority**: Concluir a UX registrada na 011 mantendo a segurança do lifecycle da 010.

**Independent Test**: Walkthrough individual e testes de primeiro uso, recusa, bloqueio de permissão, logout offline, relogin e alternância entre contas.

**Acceptance Scenarios**:

1. **Given** primeiro uso elegível sem escolha registrada, **When** aparece o convite “Não perca comunicados da escola”, **Then** há explicação breve, “Ativar notificações” e “Agora não”; nenhum prompt nativo ocorre espontaneamente.
2. **Given** ação explícita para ativar, **When** a permissão é solicitada, **Then** somente essa ação pode abrir o prompt; recusa mantém o app utilizável e Perfil → Notificações disponível.
3. **Given** conta A com intenção anterior, **When** faz logout e entra B, **Then** o vínculo remoto de A é revogado e B não herda intenção, onboarding ou vínculo.
4. **Given** retorno de A no mesmo dispositivo, **When** há intenção anterior válida, **Then** uma reconciliação segura pode ser oferecida sem prompt espontâneo e sem reutilizar vínculo revogado; o padrão proposto exige confirmação explícita para reativação remota.
5. **Given** preferência legada sem dono, opt-out, exclusão, reinstalação, permissão negada ou revogação pendente, **When** se tenta restaurar intenção, **Then** prevalece estado seguro desativado até resolução e escolha válida.

### User Story 6 - Gate e documentação confiáveis (Priority: P1)

Como proprietário, quero um manual que descreva o sistema entregue e uma decisão de release respaldada pela revisão candidata e seus checks reais.

**Why this priority**: Documentação incompleta e provas de outra revisão não autorizam o lançamento.

**Independent Test**: Executar setup/regressão conforme guia, conferir evidências e decidir explicitamente `READY FOR ANDROID MVP RELEASE` ou `BLOCKED`.

**Acceptance Scenarios**:

1. **Given** documentação final, **When** o proprietário segue setup, execução, testes, deploy e recovery, **Then** encontra comandos e variáveis corretos, sem valores reais de secrets e com limitações explícitas.
2. **Given** revisão candidata, **When** se avaliam gates locais, automação remota, smoke de produção e findings, **Then** cada evidência informa revisão, ambiente, resultado e origem; relatos são `PASS (user-reported)`.
3. **Given** qualquer blocker aberto ou prova obrigatória ausente, **When** se fecha o gate, **Then** a decisão é `BLOCKED`; problemas cosméticos e findings somente de tooling documentados não bloqueiam automaticamente.

### Edge Cases

- Refresh simultâneo, replay após rotação, logout concorrente com dispatch e callback antigo após relogin da mesma conta.
- IDs válidos de vítima versus IDs inexistentes/inválidos, body/query extras e escalada para ADMIN no cadastro público.
- Expiração editada, ocorrência cancelada, restart durante envio ambíguo, receipt tardio após mudança de token e saída/exclusão de turma.
- Storage indisponível/corrompido, identidade de instalação recriada, intenção legada sem dono e revogação offline pendente.
- Credencial ausente em produção, proxy/IP mal configurado, configuração herdada de preview e flags push incoerentes.
- Advisory presente no lockfile mas ausente do artefato; scanner indisponível, falso positivo ou finding novo após atualização.
- Migration falha parcialmente, banco com drift e rollback de app incompatível com schema.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Avaliar login, refresh, logout, revogação, sessão ativa/expirada e reutilização de tokens; sessão revogada deve ser inutilizável no servidor.
- **FR-002**: Avaliar troca de conta e callbacks/respostas antigos sem contaminação de estado privado, inclusive retorno da mesma conta em nova sessão.
- **FR-003**: Verificar autorização server-side de perfil, senha, exclusão, turmas/ownership, comunicados, convites/admin e notificações; cobrir manipulação manual de IDs e isolamento entre contas/turmas. Frontend nunca é barreira de autorização.
- **FR-004**: Revisar entradas, limites de body/query/campos, IDs, abuso/rate limiting e mensagens de erro de auth, cadastro, senha, convites, turmas, comunicados e push.
- **FR-005**: Reavaliar conjuntamente o lifecycle e os eventos das 010/011: destinatários derivados no servidor, zero envio para turma externa e inelegibilidade de vínculos revogados/inválidos.
- **FR-006**: Verificar neutralização em logout/exclusão/troca de conta, payload mínimo sem autorização implícita e navegação que revalida acesso ao comunicado.
- **FR-007**: Verificar ausência de duplicação de lembretes por ocorrência após restart/concorrência e tratamento seguro de resultado de envio ambíguo.
- **FR-008**: Verificar token de envio Expo exclusivo do backend, credenciais FCM protegidas e configuração efetiva de segurança aprimorada do provedor; não expor capabilities, tokens ou secrets em logs/bundle/documentação.
- **FR-009**: Executar auditorias atuais completas e sem dependências de desenvolvimento em backend/mobile e analisar todos os advisories relevantes, incluindo os sete pacotes históricos apontados pelo proprietário.
- **FR-010**: Cada finding deve registrar pacote/versão/cadeia, advisory/CVE disponível, severidade, runtime e presença no artefato Android, vetor de exploração, versão corrigida verificada, impacto da atualização e classificação final.
- **FR-011**: Usar exatamente `BLOCKER DE RELEASE`, `REMEDIAR AGORA`, `MITIGADO / NÃO EXPLORÁVEL NO RUNTIME ATUAL`, `DEV/TOOLING ONLY` ou `RISCO ACEITO TEMPORARIAMENTE`; aceitação temporária exige decisão explícita do proprietário, justificativa, mitigação, prazo e revisão. Blockers reais não são reclassificados por conveniência.
- **FR-012**: Planejar/aplicar correções compatíveis com a baseline aprovada; não usar correção forçada nem upgrades major automáticos. Remediação significativa exige registrar e apresentar decisão antes de implementar.
- **FR-013**: Auditar segredos em arquivos de ambiente, exemplos, histórico/worktree Git, workflows, documentação, fixtures, logs e artefatos exportados; nunca copiar valores reais para evidências.
- **FR-014**: Validar produção do backend: ambiente, banco, migrations, CORS, limites de abuso, secrets, push, startup/health, logs sanitizados, erros e documentação da API sem exposição insegura.
- **FR-015**: Validar produção Android: API pública HTTPS, package, projeto de build, Firebase/FCM, perfil production e configuração final; excluir URL local e secrets backend do artefato.
- **FR-016**: Revisar todas as migrations/schema, cascades, exclusão de conta/turma/comunicado, vínculos push, attempts/receipts, eventos/lembretes e órfãos; testar destrutivamente somente em PostgreSQL loopback `avisa_ai_test` com guardas ativas.
- **FR-017**: Entregar runbook seguro de migration, backup/restore/recovery, desativação de push e rollback da aplicação, com compatibilidade de schema e preservação de evidências/ledger.
- **FR-018**: Implementar convite contextual de primeiro uso com as duas ações descritas em US5; prompt nativo apenas por ação explícita, estados claros e semântica básica de UI preservada.
- **FR-019**: Avaliar e implementar preferência por usuário/dispositivo apenas com desenho seguro aprovado; logout revoga vínculo remoto, nenhuma conta herda preferência e intenção não substitui consentimento/permissão/sessão. Se inseguro, registrar decisão de manter reativação explícita e preservar lifecycle atual.
- **FR-020**: Confirmar em artefato production a ausência de “Enviar notificação de teste” e outras UIs internas, configuração correta e navegação principal funcional.
- **FR-021**: Regressar cadastro, login, refresh, logout, perfil, senha, exclusão, administração/convites, turmas, entrada/saída, criação/edição/exclusão de comunicado, notificações novas/lembretes e troca de conta; preservar comportamentos das 010/011.
- **FR-022**: Atualizar README/guias para objetivo, arquitetura, backend/mobile/banco, setup, variáveis, migrations, execução, testes, deploy, EAS/Firebase/FCM, push, segurança, secrets, recovery e limitações reais.
- **FR-023**: Executar gates aplicáveis de backend/mobile e obter Backend CI, Mobile CI, Commit Conventions e required checks efetivos na revisão final; prova local ou histórica não substitui CI real.
- **FR-024**: Terminar com decisão explícita de release e evidências rastreáveis; esta spec substitui os planejamentos separados de polish, assessment, remediation e readiness, sem criar nova spec automaticamente.
- **FR-025**: Respeitar escopo individual permanente: walkthrough do proprietário é suficiente; não exigir campanhas nativas especializadas, leitores de tela, auditorias físicas ou participantes. Itens excluídos são `DISPENSADA POR ESCOPO`, sem checkbox/PASS/dependência. iOS não bloqueia release Android.
- **FR-026**: Preservar WIP e fronteiras de autorização: execução atual limitada às Fases 1–3 conforme aprovação de 2026-10-07; operações externas, remediações significativas, commits/push/PR/publicação exigem autorização pertinente.

### Key Entities

- **Conta e sessão**: identidade, papel, validade e revogação; todas as decisões privadas pertencem à sessão vigente.
- **Turma, vínculo de participação e comunicado**: autoria, ownership, pertencimento e expiração que delimitam acesso.
- **Instalação e registro push**: identidade/capability protegida, conta/sessão, revisão de lifecycle/token e elegibilidade.
- **Evento, ocorrência, dispatch e recibo**: trilha persistida de destinatários, processamento e resultado, sem garantia falsa de entrega exatamente uma vez pelo provedor.
- **Intenção de notificações**: escolha local por conta/dispositivo, distinta de permissão do sistema e de registro remoto.
- **Finding e evidência**: risco, alcance, decisão, origem, revisão e critério de fechamento.
- **Candidato de release**: revisão de código, artefato Android, configuração e banco alvo referenciados sem segredos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos cenários negativos da matriz aprovada negam acesso/efeito indevido; zero sessão revogada utilizável.
- **SC-002**: Zero envios para destinatários inelegíveis na matriz automatizada e zero duplicação criada pela aplicação para a mesma ocorrência nos cenários de restart/concorrência.
- **SC-003**: 100% dos advisories relevantes atuais têm triagem rastreável; zero blocker de segurança aberto e zero secret real em superfícies públicas/artefatos revisados.
- **SC-004**: O candidato Android completa todos os fluxos principais no smoke individual viável, sem UI de teste, URL local ou configuração indevida.
- **SC-005**: Nenhum prompt de permissão ocorre sem ação explícita nos cenários de onboarding/restauração; nenhuma preferência cruza contas.
- **SC-006**: O ensaio isolado preserva integridade da cadeia de evolução dos dados e demonstra recovery e rollback compatíveis, com zero teste destrutivo no banco real.
- **SC-007**: Todos os gates aplicáveis têm resultado e origem vinculados à revisão final; o gate termina em uma das duas decisões explícitas, sem pendência obrigatória encoberta.
- **SC-008**: A documentação cobre todos os tópicos de FR-022 e permite ao proprietário repetir setup/validação/recovery sem buscar valores secretos em arquivos públicos.

## Assumptions

- Specs 010/011 foram concluídas e mergeadas em develop conforme pedido e merge presente na baseline. Seus registros históricos permanecem intactos.
- Trata-se de hardening do MVP existente, incluindo somente os dois ajustes de UX de notificações expressamente pedidos; sem infraestrutura enterprise ou funcionalidades adicionais.
- O padrão proposto para intenção restaurável exige nova confirmação explícita de ativação remota; automação silenciosa não é necessária para cumprir a avaliação pedida.
- Configuração real de hospedagem, credenciais externas e artefato production serão verificados na execução autorizada; sua ausência de prova agora não equivale a finding confirmado nem a release pronto.
- Smoke ordinary do proprietário sobre artefato production é aceito; não constitui campanha especializada de dispositivos.
- Documentos podem ficar em português; UI mantém português; valores reais de secrets não são necessários para revisar esta spec.
