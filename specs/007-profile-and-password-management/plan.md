# Implementation Plan: Profile and Password Management

**Branch**: `007-profile-and-password-management` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/007-profile-and-password-management/spec.md`

## Summary

Completar autoatendimento de identidade e senha para PARENT, PROFESSOR e ADMIN. Remover o campo somente leitura “Perfil” de Editar perfil, preservar Nome/E-mail e confirmação, e adicionar “Alterar senha” em rota separada. A API identifica usuário/sid autenticados, verifica a senha atual e grava nova credencial junto da revogação das demais sessões numa transação; tokens da sessão iniciadora permanecem válidos.

Edição de nome/e-mail e consulta de sessões revogadas já existem. O trabalho novo concentra-se no contrato de senha, armazenamento da senha inteira, concorrência e formulário seguro. Sem nova tabela, migration ou pacote; exclusão de conta pertence à spec 008.

## Technical Context

**Language/Version**: Node.js 22+; backend TypeScript 5.9.3; mobile TypeScript 6.0.3, React 19.2.3 e React Native 0.86.3.

**Primary Dependencies**: NestJS 11, Prisma 7.6, PostgreSQL 15+, bcrypt 6, class-validator/class-transformer e Swagger; `node:crypto` nativo; Expo SDK 57, Expo Router, React Hook Form, Zod 4, Axios e TanStack Query 5. Todas existentes.

**Storage**: `User.password` e `AuthSession` existentes; senha somente em memória transitória do formulário/requisição. Sem senha em SecureStore, AsyncStorage, AuthUser ou QueryClient. Hashes legados legíveis, sem migração em massa.

**Testing**: Jest, Supertest/PostgreSQL isolado, OpenAPI runtime/canônico; Jest/RNTL com providers para formulários, navegação, temas e inspeção de caches. Walkthrough Android independente dos checks automatizados.

**Target Platform**: API REST `/api/v1`; Expo, Android como alvo manual principal. Compatibilidade iOS preservada; evidência iOS/VoiceOver exige execução própria.

**Project Type**: monorepo mobile + API.

**Performance Goals**: uma operação por envio pendente; hashing assíncrono fora de transações longas; transação curta por conta. Medir custo do hash/latência sob concorrência contra timeout Axios existente de 10 s; nenhum benchmark declarado nesta etapa.

**Constraints**: nova senha 6–72 pontos de código Unicode, igualdade exata, sem trim/normalização; autoridade servidor; tokens atuais preservados; rollback integral; nenhum segredo em respostas/logs/cache; sem dependência/schema novos.

**Scale/Scope**: duas histórias; editor existente, um endpoint e uma tela novos, apoio de navegação/credenciais, contratos e testes. Sem redesign de domínio ou mudança geral de logout/refresh.

## Constitution Check

_Antes da pesquisa; reavaliar após design. PASS avalia desenho, não execução._

| Princípio                             | Resultado | Aplicação                                                                                                    |
| ------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| I. Domain-Modular Architecture        | PASS      | Auth controller/DTO/service, Prisma; utilitário de credenciais sem domínio; schema/service/hook/tela mobile. |
| II. Secure, Explicit API Contracts    | PASS      | Endpoint versionado, JWT/sid server-side, tipos/propriedades estritos, write-only e OpenAPI sincronizado.    |
| III. Testable Delivery                | PASS      | HTTP real, rollback intermediário, concorrência, compatibilidade de hashes e gates dos dois pacotes.         |
| IV. Data Integrity and Safe Evolution | PASS      | Coluna String/sessões existentes; escrita/revogação atômicas, sem migration ou relação nova.                 |
| V. Predictable and Accessible UX      | PASS      | Português, temas dinâmicos, teclado/texto ampliado, entrada protegida e navegação pendente.                  |

## Research and Design Decisions

1. **US1**: manter GET/PATCH `/api/v1/users/profile`. Remover Perfil somente do editor. Reusar `updateProfileSchema`, `buildUpdateProfilePayload`, confirmação, `useUpdateProfile` e `AuthProvider.applyProfileUpdate`. Nome-only/no-op não revogam; mudança efetiva de e-mail preserva sid e revoga outras. Complementar provas HTTP/rollback e navegação pendente.
2. **Endpoint de senha**: POST `/api/v1/auth/change-password`, `auth.changePassword`, JWT e rate limit existente, corpo fechado de três strings write-only; 204 sem corpo/tokens. Reusar `ErrorResponse` com mensagens estáveis para mapear campos, sem propriedade global nova.
3. **Interpretação da spec adotada**: FR-016 exige confirmação no servidor; entidades/assumptions dizem exclusivamente cliente. Priorizar o requisito MUST: enviar `confirmNewPassword`, validar e nunca persistir/devolver. Preservar 6–72 caracteres com hash versionado da senha inteira, em vez de introduzir limite de 72 bytes. As escolhas foram apresentadas ao usuário; são decisões de design adotadas na ausência de preferência diferente, não aprovação atribuída ao usuário. A spec original permanece preservada; esta reconciliação está explícita no contrato.
4. **Validação**: contar pontos de código Unicode no novo schema/DTO, alinhando 5/6/72/73 e emojis. Senha atual string não vazia, sem máximo novo sobre credenciais existentes. Igualdade exata confirmação/nova e diferença atual/nova em ambas as fronteiras. Impedir coerção implícita de números/objetos no novo DTO sem alterar o pipe global; erros nunca expõem objeto/valor de entrada.
5. **Hash compatível**: novo utilitário puro `common/security/password-hasher.ts` verifica bcrypt legado e scrypt v1. Cadastro/troca passam a gravar scrypt assíncrono nativo, salt aleatório 16 bytes, chave 32 bytes, N=32768/r=8/p=3/maxmem=64 MiB. Parser fechado, custos fixos por versão e comparação constante. Login verifica ambos; cadastro conserva contrato/regras públicas. Não rehash em login, migrar em massa ou alterar hash de refresh tokens/TTL/claims.
6. **Atomicidade/races**: verificar snapshot e derivar hash fora da transação. Dentro da transação, lock parametrizado da linha User, revalidação de sid ativo e hash snapshot, escrita e revogação pelo mesmo TransactionClient. Segunda troca com snapshot vencido não grava. Coordenar criação da sessão de login com o mesmo lock e rechecagem: credencial antiga validada antes da troca não pode criar sessão utilizável depois dela. Revalidar sid no PATCH sensível de perfil. Ordem User antes de sessões, SQL parametrizado, sem reconstrução do ciclo geral de tokens. Sid inválido = 401; snapshot vencido = 409 recuperável.
7. **Erros/cache**: senha atual incorreta = 400 `CURRENT_PASSWORD_INVALID`; 401 reservado à sessão inválida, pois Axios faz refresh/retry. Serviço de senha retorna erro sanitizado sem AxiosError/config/body/cause. Chamada imperativa sem TanStack mutation, retry de domínio ou update otimista. Refresh automático por 401 segue existente; nenhum 401 pode ocorrer após commit da troca.
8. **UX**: nova `/profile/change-password`, três campos protegidos e nenhum resumo de valores secretos. Ref imediata + pending, campos/envio/saídas voluntárias bloqueados. Apoio opt-in em SecondaryScreen/BackButton e guarda de remoção de rota para Voltar/hardware back/gesto; expiração ainda redireciona. Teclado/scroll nos dois formulários. Limpar em sucesso/abandono/blur/unmount/expiração; nova entrada vazia. Sucesso confirma troca sem logout.
9. **Contrato canônico**: implementar Swagger e atualizar `specs/001-app-quality-readiness/contracts/openapi.json` junto deste contrato; teste compara inventário exato. Registrar 204/400/401/409/429 e falha interna sanitizada; perfil público nunca inclui credencial.

Evidências/alternativas/fontes: [research.md](./research.md).

## Phase 0: Research Output

[research.md](./research.md) resolve fronteira, confirmação, Unicode/hash, transação, concorrência, cache e estados. Decisões adotadas explícitas; sem marcador técnico pendente.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): entidades, dados transitórios e invariantes.
- [contracts/profile-and-password.md](./contracts/profile-and-password.md): HTTP, segurança e formulários.
- [quickstart.md](./quickstart.md): ambiente, comandos, matriz e evidência manual.

## Project Structure

### Documentation (this feature)

```text
specs/007-profile-and-password-management/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/profile-and-password.md
└── quickstart.md
```

`tasks.md` pertence ao fluxo posterior `speckit-tasks`, não produzido nesta execução.

### Source Code (repository root)

```text
backend/
├── src/common/security/password-hasher.ts / .spec.ts           # novos
├── src/auth/dto/change-password.dto.ts / .spec.ts              # novos
├── src/auth/auth.controller.ts / .spec.ts
├── src/auth/auth.service.ts / .spec.ts
├── src/auth/auth-session.service.ts / .spec.ts
├── src/users/users.service.ts / .spec.ts
├── src/users/users.controller.ts / .spec.ts
└── test/
    ├── auth.integration.spec.ts
    ├── users.integration.spec.ts
    ├── profile.e2e-spec.ts
    ├── password-change.integration.spec.ts                   # novo
    └── openapi.contract.spec.ts
mobile/
├── app/(app)/(tabs)/profile.tsx
├── app/(app)/profile/edit.tsx
├── app/(app)/profile/change-password.tsx                      # novo
├── src/validations/changePassword.schema.ts                   # novo
├── src/hooks/useChangePassword.ts                            # novo, imperativo
├── src/services/auth/{auth.service,index}.ts
├── src/types/auth.ts
├── src/components/ui/{SecondaryScreen,BackButton}.tsx
└── tests/{routes,validations,hooks,services,components,accessibility}/...
specs/001-app-quality-readiness/contracts/openapi.json
```

**Structure Decision**: conservar módulos existentes. Utilitário puro evita ciclo auth↔users. Auth orquestra credenciais/sessions; Users mantém identidade. Login/cadastro mudam somente representação segura e emissão contra snapshot válido. UI compartilhada com opt-in preserva defaults de outras telas.

## Validation and Handoff

| Etapa futura     | Entrega/checkpoint                                                | Requisitos                         |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Preparação       | Baseline, fixtures por role/2+ sid, matriz e erros                | FR-003/017/028/029; SC-010         |
| Fundação         | Credencial compatível e protocolo transacional de sessão          | FR-014/017–023; SC-003/005/006/008 |
| US1 / P1         | Editor sem Perfil, confirmação/no-op/conflito, rollback de e-mail | FR-001–010; SC-001/002             |
| US2 / P2 backend | DTO/endpoint, operação atômica e contrato                         | FR-011–023/026/029; SC-003–006/008 |
| US2 / P2 mobile  | Ação/rota/schema/service/hook, limpeza, pending/navegação         | FR-011–016/023–027; SC-004/007–009 |
| Fechamento       | Regressão/gates/auditoria/walkthrough Android                     | FR-027/028; SC-009/010             |

Fundação antecede troca/login compatível; contrato antecede integração; guards antecedem fechamento dos formulários. US1 tem checkpoint independente de US2. Detalhar dependências/propriedade em `speckit-tasks`; não iniciar implementação.

## Post-Design Constitution Check

| Gate                | Resultado | Evidência de design                                                              |
| ------------------- | --------- | -------------------------------------------------------------------------------- |
| Arquitetura         | PASS      | Utilitário sem domínio, auth/users, schema/service/hook separados.               |
| Segurança/contratos | PASS      | Sid server-side, três valores transitórios, full-input hash e whitelist/OpenAPI. |
| Testabilidade       | PASS      | Rollback real, duas sessões, races, Unicode e inspeção de caches previstos.      |
| Dados               | PASS      | Sem tabela/migration; lock/transação e coluna String existentes.                 |
| UX/acessibilidade   | PASS      | Saída protegida, recuperação/limpeza, temas/teclado/manual definidos.            |

Resultado pós-design: **PASS** com as interpretações acima. Gates/testes de implementação não executados nesta etapa.

## Complexity Tracking

Sem violação constitucional. Hash versionado e coordenação de emissão de sessão satisfazem comparação integral/revogação sob concorrência sem infraestrutura/pacote adicional.
