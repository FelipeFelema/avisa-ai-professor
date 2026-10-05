# Implementation Plan: Detail Surfaces Visual Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Branch**: `004-detail-surfaces-visual-polish` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-detail-surfaces-visual-polish/spec.md`

## Summary

Refinar a hierarquia e a leitura do detalhe da turma, do detalhe do comunicado e do Perfil no aplicativo Expo. O desenho reutiliza os tokens claros da spec 003, `SecondaryScreen`, `ScreenState`, `Button` e `ConfirmationDialog`. Reorganiza somente a apresentação: contexto da turma antes da seção de comunicados, ação destrutiva ao fim da lista ou estado vazio, título/autoria/metadados/corpo do comunicado em blocos legíveis e identidade/ações do Perfil coerentes com as demais superfícies autenticadas.

O card de comunicado passará a usar a função pura `getClassroomAnnouncementExpirationLabel` da spec 003 para as três formas de prazo, evitando uma segunda regra de calendário. Consultas, mutations, ownership, autoria, confirmação, navegação, invalidação, contratos de API e persistência permanecem os atuais.

## Technical Context

**Language/Version**: TypeScript 6.0.3 no mobile; Node.js 22+ como baseline

**Primary Dependencies**: React 19.2.3, React Native 0.86.3, Expo SDK 57, Expo Router, TanStack React Query, `@expo/vector-icons`, Jest e React Native Testing Library; somente pacotes já presentes

**Storage**: PostgreSQL/Prisma existentes, sem alteração de schema, migração ou persistência mobile

**Testing**: Jest/RNTL direcionado para card e três rotas; regressão de confirmações, ownership, autoria, navegação e acessibilidade; TypeScript, ESLint, Prettier, Expo Doctor e export; walkthrough Android com matriz de estados, largura estreita, texto ampliado e conteúdo longo

**Target Platform**: Android como alvo manual inicial; componentes React Native mantêm compatibilidade com iOS, cuja usabilidade manual requer evidência própria

**Project Type**: Monorepo API NestJS/Prisma + aplicativo Expo/React Native; esta feature altera apenas apresentação mobile e documentação da spec 004

**Performance Goals**: nenhuma consulta, mutation, timer, polling ou persistência adicional; cálculo de rótulo local e composição sem altura fixa para conteúdo variável

**Constraints**: preservar os três fluxos e seus estados; não modificar backend, OpenAPI, hooks, serviços, tipos de domínio, permissões ou regras de expiração; não criar dependência, tema, capacidades de conta ou mudanças de busca; texto visível em português, controles com alvo mínimo do projeto e conteúdo essencial legível com texto ampliado

**Scale/Scope**: três rotas autenticadas, `AnnouncementCard`, estilos visuais compartilhados somente quando necessários, testes mobile e evidência Android

## Constitution Check

_GATE: aprovado antes da pesquisa; reavaliado depois do design._

| Princípio/gate                                | Resultado | Aplicação                                                                                                                                                 |
| --------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Domain-Modular Architecture                | PASS      | As rotas continuam compondo componentes, hooks e tema existentes. O card usa a função de apresentação em `lib`; nenhuma regra de negócio vai para a tela. |
| II. Secure, Explicit API Contracts            | PASS      | Nenhum endpoint, DTO, input ou autorização muda. A visibilidade por papel, ownership e autoria é preservada; o servidor segue como autoridade.            |
| III. Testable Delivery                        | PASS      | Testes de rota/card cobrem ordem, estados, rótulos e regressões de ação. Gates mobile da constituição e evidência manual são previstos.                   |
| IV. Data Integrity and Safe Evolution         | PASS      | Nenhum dado ou schema muda. `expiresAt`, membership e autoria continuam vindo dos contratos atuais.                                                       |
| V. Predictable and Accessible User Experience | PASS      | Loading, erro, ausência, vazio e sucesso têm destinos definidos; hierarquia, nomes, leitura, contraste e alvos são verificados.                           |
| Restrições de produto                         | PASS      | Escopo restrito a Detalhe da turma, Detalhe do comunicado e Perfil. Specs 005–008 e superfícies primárias ficam fora da implementação.                    |

Não há violação constitucional nem `NEEDS CLARIFICATION` pendente.

## Research and Design Decisions

As observações do código, decisões e alternativas estão em [research.md](./research.md).

1. **Base visual única**: usar `theme`/`AUTH_THEME` existentes; `AUTH_THEME` deriva de `theme`. Limitar ajustes compartilhados aos componentes usados diretamente pelas três superfícies.
2. **Turma**: distinguir nome da turma e seção `Comunicados`, manter `+ Novo` ligado à seção sob a condição atual `user?.role === 'PROFESSOR'` e pôr a ação contextual depois dos cards, vazio ou estado recuperável da lista. `ownerId` continua escolhendo excluir ou sair para usuário identificado; turma ausente/404 não oferece a ação. O texto visível da saída será `Sair da turma`.
3. **Prazo**: substituir o cálculo local do `AnnouncementCard` pela função da spec 003. Prazo inválido ou já passado não produz rótulo negativo; não criar uma nova regra de validade nem filtrar comunicados no cliente.
4. **Comunicado**: título como heading principal, autoria logo abaixo, datas agrupadas com valores claros e corpo em bloco de leitura flexível. Ações de autor, confirmação e `SecondaryScreen` permanecem no mesmo fluxo.
5. **Perfil**: compor cabeçalho, avatar, Nome, E-mail e Perfil com tokens existentes, permitindo quebra natural. Manter edição, logout e estados de sessão, sem tocar na tela de edição nem acrescentar controles de conta.
6. **Validação**: combinar testes semânticos de rota/card e regressões de mutation com inspeção Android. Testes e export não serão tratados como prova de layout visual ou tecnologia assistiva.

## Phase 0: Research Output

[research.md](./research.md) registra os caminhos reais, as condições de visibilidade, os estados e as decisões. O baseline confirmou que a spec 003 fornece o helper de expiração e que a spec 004 não precisa de API, migration, pacote ou nova entidade. Nenhum ponto técnico permanece sem decisão.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): dados existentes, valores derivados e estados de apresentação; sem alteração de persistência.
- [contracts/detail-surfaces.md](./contracts/detail-surfaces.md): contrato de interface, ordem semântica, visibilidade e preservação funcional.
- [quickstart.md](./quickstart.md): comandos e matriz de validação Android.

## Project Structure

### Documentation (this feature)

```text
specs/004-detail-surfaces-visual-polish/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/detail-surfaces.md
└── quickstart.md

# tasks.md pertence à fase posterior de speckit-tasks.
```

### Source Code (repository root)

```text
mobile/
├── app/(app)/classrooms/[id].tsx
├── app/(app)/announcements/[id].tsx
├── app/(app)/(tabs)/profile.tsx
├── src/components/announcements/AnnouncementCard.tsx
├── src/components/ui/{Button,ConfirmationDialog,ScreenState,SecondaryScreen}.tsx
├── src/lib/classroom-expiration.ts
├── src/theme/{tokens,auth}.ts
├── src/types/{classroom,announcement}.ts
└── tests/
    ├── routes/{classroom-details,profile,confirmation-matrix,secondary-navigation}.spec.tsx
    ├── routes/detail-surfaces.spec.tsx (se necessário para novos cenários)
    ├── components/AnnouncementCard.spec.tsx (se necessário para o card)
    ├── lib/classroom-expiration.spec.ts
    └── accessibility/touch-targets.spec.tsx
```

**Structure Decision**: manter as rotas e componentes atuais. Testes novos devem completar as suítes existentes quando houver cobertura adequada; os nomes de arquivos sugeridos acima não exigem novas camadas de código. Nenhuma alteração backend ou de contrato externo é planejada.

## Validation and Handoff

O roteiro em [quickstart.md](./quickstart.md) cobre cada story de forma independente e fecha com regressão dos fluxos existentes. A futura execução deve registrar `PASS`, `WARN`, `FAIL`, `NOT RUN` ou `NOT MEASURED` por cenário, com dispositivo, versão e tecnologia assistiva quando conhecidos. A spec 003 foi verificada como concluída em `tasks.md`, mas seu walkthrough Android foi `NOT MEASURED`; a spec 004 não herda prova manual da 003.

Para a futura decomposição em tasks, a ordem de dependência é: (1) cobertura de baseline e regressão dos componentes/rotas existentes; (2) card e detalhe da turma, incluindo helper de prazo e ações contextuais; (3) detalhe do comunicado; (4) Perfil; (5) verificação transversal de acessibilidade, gates e evidência Android. Cada uma das três stories tem teste independente; a validação final confere o escopo inteiro.

Esta execução encerra o design. A decomposição em `tasks.md` é feita pelo fluxo separado `speckit-tasks`, antes da implementação.

## Post-Design Constitution Check

| Gate                    | Resultado | Evidência de design                                                                                  |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Arquitetura e limites   | PASS      | Alterações previstas nas três rotas e no card existente; helper e tokens são reutilizados.           |
| Segurança e contratos   | PASS      | Matriz de visibilidade preserva papel, ownership e autoria; API e autorização do servidor não mudam. |
| Testabilidade e gates   | PASS      | Quickstart inclui testes dirigidos, gates mobile e walkthrough com limites de evidência.             |
| Dados e evolução        | PASS      | Data model só descreve dados e estados atuais; nenhuma migration ou campo novo.                      |
| UX previsível/acessível | PASS      | Contrato define ordem, estados, ações, nomes, layout flexível e verificação manual.                  |

Resultado pós-design: **PASS**.

## Complexity Tracking

Não aplicável: nenhuma violação constitucional ou nova estrutura arquitetural.
