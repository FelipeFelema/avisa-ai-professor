# Implementation Plan: Admin Teacher Invite Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Branch**: `009-admin-teacher-invite-management` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/009-admin-teacher-invite-management/spec.md`

## Summary

Entregar uma área ADMIN simples, acessível pelo Perfil, para gerar e copiar um convite PROFESSOR temporário. Reutilizar `POST /api/v1/invite-codes`, restringindo o corpo a `{ "role": "PROFESSOR" }`, fixando validade no servidor em 604800000 ms e impedindo criação pública de ADMIN por qualquer convite, inclusive histórico. O serviço revalida sessão/papel atuais; consumo do convite e criação do professor passam a compartilhar uma transação.

O mobile usa uma rota secundária, serviço tipado, validação Zod e hook com estado local transitório, trava síncrona, descarte de respostas antigas e `noAuthReplay: true`. A única dependência nova prevista é `expo-clipboard`, instalada pela ferramenta Expo na implementação. Não há tabela, migração, listagem, revogação, envio externo ou configuração de papel/validade.

Esta etapa gera somente design. A incompatibilidade constitucional relativa a ADMIN está registrada abaixo como exceção de planejamento com correção obrigatória antes de implementar.

## Technical Context

**Language/Version**: Node.js 22+; backend TypeScript 5.9.3; mobile TypeScript ~6.0.3, React 19.2.3 e React Native 0.86.3, conforme manifests atuais.

**Primary Dependencies**: NestJS 11, Prisma 7.6, PostgreSQL 15+, class-validator/class-transformer, JWT/Passport; Expo ~57.0.26, Expo Router ~57.0.24, Axios e Zod existentes. Adição planejada: `expo-clipboard` compatível com SDK 57 e lockfile sincronizado.

**Storage**: PostgreSQL, modelos existentes `InviteCode`, `User`, `AuthSession`. Segredo no banco existente; resultado mobile somente em memória da rota. Nenhum cache de consulta/mutação para o convite, AsyncStorage ou SecureStore para códigos.

**Testing**: Jest unitário, integração PostgreSQL e Supertest/e2e/contrato OpenAPI; Jest Expo e React Native Testing Library; walkthrough com tempo/cópia e verificação nativa de tecnologia assistiva separados de testes automatizados.

**Target Platform**: API NestJS/PostgreSQL e aplicativo Expo Android/iOS; preservar export web e validar fallback de clipboard no navegador.

**Project Type**: Aplicativo mobile com API REST versionada.

**Performance Goals**: SC-005, localizar/gerar/copiar em até um minuto; uma geração HTTP por ação deliberada, sem replay. Transações curtas, hash de senha fora do lock, busca por índice único de código; até três tentativas internas de colisão, sem repetir resultado incerto.

**Constraints**: PROFESSOR fixo; 7 × 24 horas exatas; autorizar novamente em cada POST; uso único atômico; rejeitar campos/papéis manipulados; preservar resultado anterior em falha; nenhum segredo em logs/erros/caches persistentes; temas/texto ampliado/AT. Não garantir atualização remota instantânea sem comunicação com o servidor.

**Scale/Scope**: Um endpoint existente alterado, um fluxo público endurecido, uma rota secundária mobile, uma entrada no Perfil, uma dependência Expo; sem CRUD administrativo adicional. Independente das capacidades 007/008/010, preservando regressões já presentes no checkout.

## Constitution Check

Avaliação anterior à pesquisa: arquitetura, contratos, testes, dados e UX têm abordagem compatível; a regra de cadastro privilegiado possui conflito identificado e justificado para esta etapa de design.

| Gate                                          | Resultado no planejamento | Evidência / condição                                                                                                                                        |
| --------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Arquitetura modular                        | PASS                      | Controller/DTO/service em `invites-code`, orquestração de cadastro em `users`; mobile separado por rota/hook/service/schema. Sem dependência circular nova. |
| II. Contratos e autorização                   | PASS                      | URI v1, DTO fechado, JWT/sessão/papel atual e revalidação transacional; testes negativos HTTP e serviço.                                                    |
| III. Entrega testável                         | PASS no design            | Matriz em quickstart com unitários, persistência, HTTP, OpenAPI, mobile e gates CI; nenhuma execução de produto alegada.                                    |
| IV. Integridade/evolução                      | PASS                      | Schema/migrations preservados; unique atual, lock e transação consumo/cadastro, rollback, validade estrita em UTC.                                          |
| V. UX acessível                               | PASS no design            | Estados PT-BR, temas, texto selecionável, feedback acessível, limpeza por foco/identidade.                                                                  |
| Constraint: cadastro privilegiado por convite | EXCEÇÃO DE PLANEJAMENTO   | A redação atual inclui ADMIN; FR-018 exige provisionamento manual externo. Emenda revisada é pré-requisito de implementação.                                |

### Exceção constitucional e gate de implementação

A constituição em `.specify/memory/constitution.md`, Technical & Product Constraints, exige que cadastro privilegiado continue por convite. A redação abrange os papéis privilegiados sem distinguir ADMIN; não assumir compatibilidade automática com FR-018/FR-019.

- **Escopo**: somente elaborar o design da 009 para cadastro PROFESSOR por convite e ADMIN fora do cadastro público; nenhuma alteração de comportamento autorizada nesta etapa.
- **Motivo**: atender à finalidade explícita da spec e fechar a elevação pública para ADMIN, preservando autenticação de ADMIN já existente e registro de PROFESSOR por convite.
- **Responsável**: mantenedor do projeto, na revisão dos artefatos da 009.
- **Expiração**: antes do primeiro trabalho de implementação que altere emissão/consumo ou cadastro privilegiado.
- **Correção/follow-up obrigatório**: emenda revisada à constituição, com Sync Impact Report e versão apropriada, explicitando que cadastro público privilegiado é exclusivamente PROFESSOR por convite e ADMIN é provisionado operacionalmente fora do app. Derivar esse pré-requisito no próximo workflow de tasks; não alterar a constituição silenciosamente nem interpretar este plano como aprovação da emenda.
- **Gate**: implementação dessas regras permanece bloqueada até resolver formalmente a incompatibilidade. Demais gates de design passam; não há gate injustificado ignorado.

## Project Structure

### Documentation (this feature)

```text
specs/009-admin-teacher-invite-management/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/teacher-invites.md
└── quickstart.md
```

`tasks.md` pertence ao workflow posterior `$speckit-tasks` e não é criado pelo planejamento.

### Source Code (repository root)

Paths novos abaixo são propostas para implementação, não arquivos entregues nesta etapa.

```text
backend/
├── src/invites-code/
│   ├── dto/create-invite-code.dto.ts
│   ├── types/invite-code-role.types.ts
│   ├── invite-code.controller.ts
│   ├── invite-code.controller.spec.ts             (novo)
│   ├── invite-code.service.ts
│   └── invite-code.service.spec.ts
├── src/users/users.service.ts
├── src/users/users.service.spec.ts
├── src/auth/auth.controller.ts
├── test/invite-codes.integration.spec.ts          (novo)
├── test/invite-codes.e2e-spec.ts                  (novo)
├── test/openapi.contract.spec.ts
├── test/helpers/admin-user.helper.ts             (novo)
└── prisma/schema.prisma                          (preservado)
mobile/
├── app/(app)/(tabs)/profile.tsx
├── app/(app)/admin/teacher-invites.tsx             (novo)
├── src/hooks/useTeacherInvite.ts                 (novo)
├── src/services/admin/teacher-invite.service.ts   (novo)
├── src/types/teacher-invite.ts                   (novo)
├── src/validations/teacherInvite.schema.ts        (novo)
├── src/components/ui/SecondaryScreen.tsx          (reuso)
├── src/lib/api.ts                                (reuso noAuthReplay)
├── src/providers/AuthProvider.tsx                (reuso applyProfileUpdate/expireSession)
├── tests/hooks/useTeacherInvite.spec.tsx          (novo)
├── tests/services/teacher-invite.service.spec.ts  (novo)
├── tests/routes/admin-teacher-invites.spec.tsx    (novo)
└── tests/validations/teacherInvite.schema.spec.ts (novo)
```

**Structure Decision**: manter domínios existentes. `UsersService` abre a transação e passa `Prisma.TransactionClient` ao consumo em `InviteCodeService`; não criar um serviço auth dentro de invites-code. A emissão recebe identidade/sid do guard e usa Prisma para revalidar dentro de sua transação. A tela não contém regras de negócio nem armazena o resultado no contexto global.

## Technical Design

### API e emissão

Manter path/operationId `inviteCodes.create`. DTO aceita somente `role` obrigatório igual a PROFESSOR; `expiresInDays` deixa de ser aceito. Isso é mudança incompatível explícita do contrato anterior, que aceitava ADMIN e duração configurável. Resposta preserva campos atuais, estreitando `role` e `isActive` no contrato de criação.

O serviço fixa papel/duração independentemente do DTO. Sob transação, bloquear `User` e depois `AuthSession`, validar existência, vínculo, revogação, expiração e papel atual. Usar a ordem já empregada em operações de sessão/conta. O ponto de autorização é essa revalidação antes da inserção; revogação posterior ao commit não desfaz convite previamente autorizado.

Gerar `PROF-` mais 16 bytes criptográficos em hexadecimal maiúsculo. Calcular um único `createdAt` após revalidação e persistir também `expiresAt = createdAt + 604800000`, sem default separado para criação. Unique no banco é autoridade final. Em `P2002` específico de `code`, iniciar uma transação nova com segredo novo, no máximo três tentativas totais. Não repetir dentro de uma transação PostgreSQL já abortada. Falhas internas não carregam mensagem/cause/valores brutos de Prisma para logs ou transporte. Adotar `Cache-Control: no-store` na emissão e resposta de cadastro que contém tokens.

### Cadastro e consumo

PARENT sem convite mantém fluxo atual. Cadastro com `teacherCode` aceita somente um registro PROFESSOR, ativo e com `expiresAt` estritamente maior que o instante de consumo. Convites ADMIN históricos ou qualquer outro papel retornam o mesmo erro genérico dos inválidos, sem alteração de estado.

Após validar formulário e calcular hash fora da transação, `UsersService` abre transação interativa. Consumo bloqueia a linha por código com SQL parametrizado (`FOR UPDATE`), verifica papel e desativa condicionalmente; criação de `User` ocorre com papel PROFESSOR fixo no mesmo `tx`. Falha de criação, inclusive conflito concorrente de e-mail, desfaz a desativação. Decidir expiração depois da espera pelo lock com `clock_timestamp() AT TIME ZONE 'UTC'`, compatível com `TIMESTAMP(3)` existente; não usar `NOW()` no início da transação nem comparação inclusiva. O sucesso só fica visível após commit.

Sessão/tokens continuam sendo emitidos pelo auth após criação da conta, sem ampliar esta feature para atomizar todo o login. Se essa resposta se perde após cadastro confirmado, não reaproveitar o convite; recuperar por login existente. Não adicionar retry automático de registro.

### Mobile e segredos

Entrada “Convites de professores” no Perfil para ADMIN; rota `/admin/teacher-invites` com guard local também para deep link. Revalidar perfil por leitura segura no foco e resume; bloquear ações enquanto verificação estiver pendente/indeterminada. Aplicar perfil atualizado por `applyProfileUpdate` somente na geração de sessão corrente. Não depender apenas de `sessionGeneration` para identificar rebaixamento de papel.

Hook usa ref síncrona para geração/cópia, `AbortController` e epochs de foco/operação, identidade e papel. Chamar POST com `noAuthReplay: true`; esse flag não encerra sessão sozinho, então tratar 401 explicitamente via `expireSession(generation)`. Em 403, limpar imediatamente o resultado e reconciliar identidade/retornar ao Perfil permitido; nunca restaurar segredo enquanto a verificação falha. Em mudança de conta/papel, blur, logout ou unmount, descartar resultado e feedback e invalidar continuations. No background, bloquear/ocultar resultado até revalidar ao resume; falha de rede nessa leitura não comprova perda de papel nem permite copiar.

Sem React Query para geração ou resposta secreta. Serviço transforma Axios/Zod em categorias seguras, descartando erro/config/response bruto. Validar papel, estado, código, timestamps e delta de validade. Response malformada, timeout, cancelamento ou 5xx são resultado incerto: pode existir convite criado. Sem retry automático; nova ação deliberada pode gerar outro, preservando o resultado anterior recebido quando ainda autorizado.

Copiar invoca `Clipboard.setStringAsync` diretamente do gesto explícito, após guard síncrono; `false` e rejection são falhas. Não inserir leitura HTTP entre gesto e clipboard web. Nunca ler clipboard para conferir nem apagá-lo ao sair. Texto selecionável oferece fallback. Resultado anterior permanece em falha de geração/cópia; um sucesso posterior substitui somente a exibição. Expiração local atualiza rótulo e desabilita copiar quando vencido, mas o app não afirma ter consultado consumo remoto.

### Documentação e regressões

Atualizar, na implementação, README raiz/backend/mobile, Swagger de convite e cadastro e `specs/001-app-quality-readiness/contracts/openapi.json`, porque `backend/test/openapi.contract.spec.ts` usa esse arquivo como baseline executável. Preservar contratos não afetados. Substituir fixtures ADMIN criadas pelo registro público por helper de provisionamento Prisma, com hash de senha e login HTTP reais, isolado no banco de teste. Incluir `classrooms.integration`, `users.integration`, `profile.e2e` e `account-deletion.e2e`, além de qualquer ocorrência encontrada em varredura direcionada.

## Delivery Boundaries and Validation

| Bloco para derivação futura | Entrega                                                          | Requisitos / critérios                 |
| --------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| Fundação                    | Emenda constitucional revisada, contrato, fixtures ADMIN e tipos | FR-005/006/018/019/025; SC-003/009     |
| US1                         | Emissão ADMIN, cadastro atômico, rota e exibição                 | FR-001–010/014–020/023; SC-001–004/006 |
| US2                         | Cópia, feedback, segundo convite, ciclo de vida                  | FR-011–016/021–024; SC-005–008         |
| Fechamento                  | OpenAPI/README, gates, regressão e evidência manual              | FR-024/025; SC-008/009                 |

Não declarar US1 pronta mantendo cadastro público ADMIN ou consumo fora da transação. Validar regra de sete dias exatos, igualdade no vencimento, espera por lock até expirar, colisão/limite/erro sanitizado, duas tentativas com e-mails diferentes e rollback no mesmo e-mail. Mobile cobre uma solicitação por toque deliberado, não replay, 401/403, código anterior preservado, clipboard true/false/throw, expiração, foco/conta/papel/respostas tardias e ausência de segredo no estado persistente/cache.

Comandos e resultados esperados estão em [quickstart.md](./quickstart.md). Gates backend/mobile são requeridos na implementação; walkthrough funcional cronometrado e TalkBack/VoiceOver/texto ampliado têm evidência própria. Export/checks não comprovam comportamento nativo ou AT.

## Post-Design Constitution Check

Design de arquitetura/contratos/integridade/testabilidade/UX: **PASS de planejamento**. Dependência nova tem necessidade documentada e instalação com lockfile prevista. Exceção sobre ADMIN permanece explícita, justificada e limitada ao design; o **gate de implementação exige emenda constitucional revisada**. Nenhuma implementação, migração, alteração constitucional ou task executada neste workflow.

## Complexity Tracking

| Violation                                                                       | Why Needed                                                                                                         | Simpler Alternative Rejected Because                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Constraint atual de cadastro privilegiado por convite conflita com ADMIN manual | A spec remove cadastro público ADMIN e limita convites a PROFESSOR; design precisa registrar a mudança de política | Manter ADMIN por convite viola FR-018/019; reinterpretar silenciosamente não resolve a governança. Exceção somente para planejamento; emenda antes da implementação, responsável e expiração acima. |

Lock/SQL parametrizado é necessário para consumo concorrente e validade após espera; usa estruturas existentes. Não há abstração de repositório, sistema de idempotência, CRUD de convites ou dependência auth cíclica adicional.
