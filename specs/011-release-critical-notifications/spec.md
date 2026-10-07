# Feature Specification: Release Critical Notifications

**Feature Branch**: `011-release-critical-notifications`

**Created**: 2026-10-06

**Status**: P0/P1 walkthrough and final copy PASS (user-reported); production diagnostic hiding accepted from automated/configurational evidence, production-artifact smoke at final release. All local gates and actual remote Backend CI/Mobile CI/Commit Conventions passed for PR #54 on c57b0a4. T060/T061 completed; 64/64 tasks. Final documentary closure commit must also receive green checks before merge readiness. Spec 012 not started; no merge performed.

**Input**: Notificar novos comunicados no lançamento, reutilizando a fundação da Spec 010, com isolamento entre turmas/contas, autorização normal no toque e processamento idempotente. Lembrete de expiração integra a entrega completa autorizada em 2026-10-07; flag operacional independente por padrão desativada.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Receber aviso de novo comunicado da própria turma (Priority: P0)

Como membro de uma turma com notificações explicitamente ativadas, quero receber um aviso quando um professor dessa turma publicar um comunicado. O professor continua podendo publicar quando o serviço de notificações estiver indisponível.

**Why this priority**: Aviso obrigatório do MVP; comunicar a turma não pode comprometer a publicação nem atingir outras turmas.

**Independent Test**: Publicar na turma A com membros elegíveis/inelegíveis e outra turma B com instalações ativas. Verificar destinatários e publicação diante de falha de push. Repetir processamento, concorrência e reinício sem novo envio para a mesma instalação/evento.

**Acceptance Scenarios**:

1. **Given** professor membro da A e membros com notificações ativas, **When** publica, **Then** o comunicado fica disponível e somente instalações elegíveis de membros da A, exceto o autor, são candidatas ao aviso.
2. **Given** contas somente da B, registros desativados/inválidos ou sessões inativas, **When** publica na A, **Then** essas instalações recebem zero envios.
3. **Given** configuração indisponível, rejeição, timeout ou falha no processamento de push, **When** publica, **Then** a publicação continua bem-sucedida, sem desfazer o comunicado; aviso e publicação têm resultados separados.
4. **Given** evento processado em paralelo, novamente ou após reinício, **When** retoma, **Then** há no máximo uma submissão por evento/instalação; resultado incerto não provoca reenvio automático.
5. **Given** logout, revogação, troca de conta ou perda de membership antes da autorização final de envio, **When** reavalia o candidato, **Then** suprime o envio, sem redirecioná-lo à nova conta.

### User Story 2 - Abrir o comunicado autorizado pelo toque (Priority: P0)

Como destinatário, quero tocar no aviso e abrir seu detalhe com minha conta atual. Se perdeu validade ou acesso, quero indisponibilidade clara e nenhum conteúdo indevido de outra sessão.

**Why this priority**: O acesso seguro ao detalhe completa o fluxo obrigatório do lançamento.

**Independent Test**: Usar avisos sintéticos válidos/malformados e de outra turma; verificar consulta autorizada, sessão expirada, troca de conta, perda de membership, exclusão/expiração e cache antigo, independentemente do envio real da US1.

**Acceptance Scenarios**:

1. **Given** aviso válido e conta com acesso, **When** toca, **Then** consulta o comunicado com autorização normal e abre o detalhe correspondente.
2. **Given** perda de acesso, exclusão ou expiração e conteúdo antigo em cache, **When** toca, **Then** a resposta atual do backend prevalece e não exibe conteúdo protegido anterior.
3. **Given** usuário deslogado/sessão em restauração, **When** toca, **Then** aguarda autenticação/restauração antes da consulta; troca de identidade descarta destino pendente anterior.
4. **Given** recebimento em foreground, **When** apresenta o aviso, **Then** não navega espontaneamente, pede permissão nem repete processamento.
5. **Given** payload malformado, URL arbitrária ou identificação de outra turma, **When** recebe, **Then** não aceita rota arbitrária nem trata o payload como prova de autorização.

### User Story 3 - Receber um único lembrete antes da expiração (Priority: P1)

Como membro elegível, posso receber um lembrete aproximadamente 24 horas antes de o comunicado expirar. Implementação autorizada junto ao P0 em 2026-10-07.

**Why this priority**: Útil para consulta, mas não justifica atrasar o lançamento.

**Independent Test**: Relógio controlado, ciclos concorrentes, reinício, alteração/exclusão de comunicado; um evento de lembrete e no máximo uma submissão por instalação, reutilizando elegibilidade/autorização do P0.

**Acceptance Scenarios**:

1. **Given** comunicado ativo com expiresAt, criado pelo menos 24 horas antes desse vencimento, próximo de 24 horas até expiração e P1 habilitado, **When** chega a janela, **Then** gera no máximo um evento de lembrete e uma submissão por instalação elegível.
2. **Given** lembrete já gerado ou resultado incerto, **When** reinicia/reprocessa/altera expiração, **Then** não repete o evento da mesma expiração nem envio incerto; pendências de uma expiração substituída são suprimidas.
3. **Given** exclusão/expiração antes da autorização final, **When** processa, **Then** não faz nova submissão.
4. **Given** P1 desabilitado na configuração, **When** valida P0, **Then** aprovação e lançamento não dependem do P1.

### Edge Cases

- Turma sem candidatos; várias instalações por conta; membro em várias turmas; autor com instalação ativa.
- Dois processos, reinício antes/depois de submissão, aceite seguido de falha de persistência e receipt tardio.
- Token rotacionado, reassociação, logout, revogação ou perda de membership durante processamento; aviso entregue depois da revogação.
- Conta/turma/comunicado excluídos, expiração durante envio e indisponibilidade prolongada; sem replay de publicações anteriores à ativação.
- Toque repetido com app aberto/em background/fechado, destino durante login e cache de sessão anterior.
- P1: comunicado novo com menos de 24 horas restantes, alteração de expiração e retomada tardia.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001 (P0)**: Publicação bem-sucedida por professor autorizado DEVE originar aviso de novo comunicado. Edição não origina outro aviso dessa categoria.
- **FR-002 (P0)**: Somente membros da turma do comunicado DEVEM ser candidatos. Contas externas DEVEM receber zero envios; papéis não concedem acesso global a notificações.
- **FR-003 (P0)**: Usar somente instalações elegíveis da 010: consentimento ativo, identidade/vínculo atual, token válido e sessão vigente. Elegibilidade e membership DEVEM ser reavaliados antes da autorização final de envio.
- **FR-004 (P0)**: Excluir o autor. Várias instalações elegíveis da mesma conta podem receber uma submissão cada; isso não é duplicação entre instalações.
- **FR-005 (P0)**: Falha de enqueue/processamento/despacho, configuração indisponível, rejeição, timeout ou falha de receipts NÃO DEVE desfazer nem transformar em falha a publicação confirmada.
- **FR-006 (P0)**: Identidade do evento e progresso por instalação DEVEM persistir após reinício. Concorrência, recuperação e retries NÃO DEVEM repetir submissão do mesmo evento para a mesma instalação.
- **FR-007 (P0)**: Resultado incerto NÃO provoca reenvio automático. A garantia é de ausência de duplicação por nosso processamento, não de entrega exatamente uma vez pelo provedor/dispositivo.
- **FR-008 (P0)**: Reutilizar instalações, PushRegistration, consentimento, transporte autenticado e tratamento de token inválido da 010. NÃO criar segundo sistema de tokens/instalações; preservar single-flight, cooldown e proteção contra spam do teste neutro.
- **FR-009 (P0)**: Novo aviso usa título `Novo comunicado • {nome da turma}` e corpo com o título do comunicado; título ausente/vazio usa `Novo comunicado disponível`. Lembrete usa `Comunicado próximo da expiração • {nome da turma}` e `{título do comunicado} expira em breve.`, com fallback `Um comunicado expira em breve.`. Nome de turma ausente/vazio usa `Sua turma`. Somente nome da turma e título do comunicado são permitidos no texto; NÃO incluir corpo completo, dados pessoais, credenciais, tokens ou capabilities. `data` permanece fechado com version/type/announcementId/dispatchId; detalhe completo exige consulta autorizada atual.
- **FR-010 (P0)**: Toque abre detalhe após consulta autenticada atual. `announcementId` no payload nunca substitui autorização server-side; perda de acesso, exclusão e expiração seguem negação normal do backend, prevalecendo sobre cache antigo.
- **FR-011 (P0)**: Validar destinos e limitar ao detalhe interno. Troca de identidade descarta destino pendente; payload NÃO autoriza URL/rota arbitrária.
- **FR-012 (P0)**: Foreground NÃO navega espontaneamente, solicita permissão ou dispara reconciliação repetida. Recebimento/toque repetidos têm processamento limitado/deduplicado.
- **FR-013 (P0)**: Distinguir publicação, aceite, handoff e exibição observada. Logs e respostas NÃO expõem credenciais, tokens, capabilities ou conteúdo privado.
- **FR-014 (P0)**: Não enviar publicações anteriores à ativação da 011. Suprimir pendências excluídas/expiradas antes do envio.
- **FR-015 (P0)**: Testes automatizados cobrem isolamento, elegibilidade, falha de push sem falha da publicação, idempotência/restart, concorrência e autorização do toque. Complementar com walkthrough funcional individual viável.
- **FR-016 (P1)**: Se habilitado, prever lembrete aproximadamente 24 horas antes de `expiresAt` atual; ausência de expiresAt não gera lembrete; no máximo um evento por valor de expiresAt e uma submissão por instalação elegível nesse evento.
- **FR-017 (P1)**: Suprimir lembrete de comunicado excluído/expirado. Alteração de expiração cancela pendências do valor anterior e calcula a janela do valor atual; o mesmo valor nunca gera outro evento.
- **FR-018 (P1)**: Reutilizar idempotência, restart safety, elegibilidade, privacidade e navegação do P0; sem reenvio incerto.
- **FR-019 (P1)**: A flag P1 pode ficar desabilitada sem bloquear o fluxo P0. A entrega completa desta Spec inclui o scheduler e seus testes, mesmo com flag operacional default false.
- **FR-020 (P0)**: A ação visual de teste neutro e seu feedback ficam disponíveis somente em desenvolvimento ou em build preview/development explicitamente configurada. Produção e configuração ausente ocultam a ação; preservar endpoint, infraestrutura, cooldown, opt-in e logout da 010.

### Melhorias futuras — Spec 012 (registro, sem implementação nesta Spec)

- Onboarding contextual no primeiro uso convidando a ativar notificações, com CTA explícito antes de qualquer prompt nativo.
- Estudar persistência da preferência por usuário/dispositivo, com revogação segura no logout e sem herança entre contas. A 011 preserva o lifecycle atual de opt-in/logout; estas ideias não bloqueiam T060/T061.

### Key Entities

- **Announcement**: comunicado existente, autor, turma, publicação e expiração; recurso autorizado normalmente.
- **UserClassroom**: vínculo que limita destinatários e acesso ao detalhe.
- **PushRegistration / instalação**: identidade e consentimento da 010 vinculados à conta/sessão atuais.
- **Evento de notificação**: publicação ou lembrete, identidade persistente e candidatos fixados uma vez.
- **Entrega por instalação**: pendência, supressão, aceite, rejeição ou resultado incerto de um evento para uma instalação.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001 (P0)**: Nos cenários controlados, todos os candidatos pertencem à turma; contas externas, autor e instalações inelegíveis têm zero submissões.
- **SC-002 (P0)**: Rejeição, indisponibilidade, falha de enqueue e timeout de push preservam o comunicado confirmado e não exigem republicação.
- **SC-003 (P0)**: Repetição, duas execuções concorrentes e reinício nos pontos controlados produzem no máximo uma submissão por evento/instalação, inclusive em resultado incerto.
- **SC-004 (P0)**: Walkthrough individual abre o detalhe correto pelo toque; cenários automatizados de perda de acesso/troca de conta/cache antigo mostram zero conteúdo protegido indevido.
- **SC-005 (P0)**: Com processamento e serviço saudáveis, novo aviso é submetido em até dois minutos nos cenários controlados e em medição individual quando realizada; aceite não comprova exibição.
- **SC-006 (P0)**: Capturas automatizadas confirmam push sem corpo completo, dados pessoais, credenciais ou capabilities; somente nome da turma/título no texto e os quatro campos mínimos em `data`. Logs não expõem esses textos nem segredos; respostas REST preservam o contrato autorizado existente. Produção oculta o botão de teste sem alterar ativação/desativação.
- **SC-007 (P1)**: Com P1 habilitado e processamento saudável, selecionar lembrete entre 24 horas e 23 horas e 55 minutos antes da expiração; repetição/reinício não gera outro. Retomada tardia somente enquanto ativo.
- **SC-008 (P0)**: MVP demonstrável/aprovável com lembretes desabilitados e sem regressão do consentimento/teste da 010.

## Assumptions

- Branch rebaseada sobre develop com 010 mergeada, base `416256032a645e7335229a42bb2a825d174c85c0` (verificada em 2026-10-07). T073/T074 da 010 estão checked nos artefatos atuais, verificados em 2026-10-07 e intocados nesta execução. P0 autorizado em 2026-10-06; entrega completa autorizada em 2026-10-07.
- A 011 substitui o planejamento anterior dividido entre 011/012. Nenhuma Spec 012 é criada. Entrega completa autorizada = US1 + US2 + US3; a flag de US3 permanece independente do funcionamento de P0.
- Candidatos são fixados no primeiro processamento durável do evento: membros pré-selecionados com instalações elegíveis, sem autor, ainda elegíveis ao confirmar o snapshot. Quem entra/ativa depois da pré-seleção não é acrescentado nesse processamento. Revalidar antes do envio; registro substituído não redireciona aviso a outra conta.
- Revogação/perda de acesso anterior à autorização final impede envio. Push já submetido pode chegar depois da mudança e não pode ser recolhido; somente nome da turma/título são exibidos, e conteúdo completo depende da consulta atual autorizada.
- Um evento NEW por comunicado e um EXPIRING por valor de expiresAt; edição não dispara NEW novamente.
- Comunicado criado com menos de 24 horas restantes não recebe lembrete imediato; indisponibilidade posterior a uma janela válida permite recuperação enquanto ativo.
- Sem inbox, histórico para usuário, segundo transporte, campanhas nativas especializadas, auditorias físicas ou estudos com participantes. Constituição 2.1.0 e escopo individual vigente; relatos reais usam `PASS (user-reported)`.
- Falha do banco que impossibilita salvar o próprio comunicado continua sendo falha normal de publicação; FR-005 cobre o subsistema de notificação, não promete recurso principal que não foi persistido.
