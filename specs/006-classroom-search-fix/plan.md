# Implementation Plan: Classroom Search Fix

**Branch**: `006-classroom-search-fix` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-classroom-search-fix/spec.md`

## Summary

Corrigir a descoberta de turmas por nome no endpoint existente e na seção “Turmas disponíveis”. Normalizar espaços externos, validar até 80 caracteres no cliente e no servidor, aguardar 300 ms de pausa e exibir somente estados do termo atual. Corrigir a invalidação de todas as buscas após entrar, sair ou excluir. “Minhas turmas” permanece independente da busca; cards, permissões, confirmações, navegação e temas existentes são preservados.

O defeito de cache foi confirmado: `classroomKeys.available()` inclui o termo vazio e não representa o prefixo de todas as variantes. A tela envia cada edição imediatamente, e a API documenta o limite sem validá-lo em um DTO de query. Evidências e alternativas: [research.md](./research.md).

## Technical Context

**Language/Version**: backend TypeScript 5.9.3; mobile TypeScript 6.0.3, React 19.2.3 e React Native 0.86.3; baseline Node.js 22+.

**Primary Dependencies**: NestJS 11, Prisma 7.6, PostgreSQL 15+, class-validator/class-transformer e Swagger; Expo SDK 57, Expo Router, TanStack React Query 5.101.2 instalado, Axios e Zod 4. Todas já existem.

**Storage**: PostgreSQL e memberships existentes; cache em memória do QueryClient. Texto e estado locais à tela, sem persistência nova.

**Testing**: Jest backend para DTO/controller/service; Supertest e PostgreSQL isolado para query, autorização e participação; contrato OpenAPI; Jest/RNTL com timers e QueryClient real para debounce, corridas e cache; matriz manual Android Claro/Escuro.

**Target Platform**: API REST `/api/v1`; Android como alvo inicial de validação manual, mantendo compatibilidade React Native com iOS. Evidência manual de cada plataforma/tecnologia assistiva é independente.

**Project Type**: monorepo API NestJS/Prisma + app Expo/React Native.

**Performance Goals**: edição visual imediata; zero novas consultas por edição antes de 300 ms de pausa; no máximo uma consulta para o termo final da sequência. Sem meta nova de latência da API ou ranking.

**Constraints**: substring de nome, case-insensitive e sensível a acentos; trim externo; 80 caracteres após trim; parâmetro opcional e único; sem endpoint, campo de resposta, migration, schema ou pacote novo. Sem filtro em “Minhas turmas”, alteração de domínio ou redesign geral.

**Scale/Scope**: um endpoint, DTO de query, serviço de listagem, OpenAPI canônico, tela de Turmas, hook de busca, hook/service de disponíveis, chaves e três hooks de mutation.

## Constitution Check

Gate antes da pesquisa: **PASS**, condicionado às verificações de implementação descritas no quickstart.

| Princípio/gate                                | Resultado de design | Aplicação                                                                                                          |
| --------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| I. Domain-Modular Architecture                | PASS                | Transporte/DTO no módulo classrooms; critério no service; validação Zod e estado em hooks; tela compõe estados.    |
| II. Secure, Explicit API Contracts            | PASS                | DTO class-validator na fronteira, JWT mantido, query única e OpenAPI sincronizado. Testar perfis existentes e 401. |
| III. Testable Delivery                        | PASS                | Unitários, integração PostgreSQL/HTTP, contrato e cache real previstos; gates e manual separados.                  |
| IV. Data Integrity and Safe Evolution         | PASS                | Schema/migrations e participação, ownership e cascata existentes preservados.                                      |
| V. Predictable and Accessible User Experience | PASS                | Espera, validação, loading, resultado, vazios e erro/retry em português para Claro/Escuro.                         |
| Restrições de produto                         | PASS                | Sem dependência, autorização, persistência ou recurso adicional.                                                   |

Não há pendência de arquitetura ou violação constitucional. PASS de design não significa que testes ou cenários manuais já foram executados.

## Research and Design Decisions

1. **Fronteira HTTP**: introduzir `FindAvailableClassroomsQueryDto` em `backend/src/classrooms/dto/find-available-classrooms-query.dto.ts`, recebido pelo `@Query()` do controller. Ausência permitida, texto único, trim antes do comprimento e 400 para inválidos. Preservar o tipo bruto até a validação, evitando que a conversão implícita global transforme arrays/objetos em texto aceito; não mudar `configure-app.ts` globalmente. Query extra é rejeitada pelo whitelist. Testar o parser Express instalado.
2. **Comprimento e critério**: contar pontos de código Unicode após trim, com o mesmo predicado em class-validator e Zod. Não truncar silenciosamente ou limitar texto bruto com `TextInput.maxLength=80`. Preservar caixa, espaços internos, pontuação e acentos; servidor aplica `contains` + `mode: 'insensitive'` e `none: { userId }`. Escapar metacaracteres de padrão `%`, `_` e barra invertida para substring literal; provar no PostgreSQL. Ordem existente preservada.
3. **Estado**: novo `useClassroomSearch.ts` controla texto imediato, termo normalizado/estabilizado, validação, pausa de 300 ms, limpeza e retry. Toda edição reinicia a pausa; trim equivalente não cria variante ou consulta se o critério já estiver atualizado. Durante espera/validação, ocultar feedback antigo e desabilitar consulta automática. Limpar elimina feedback antigo imediatamente; consulta sem filtro respeita a pausa.
4. **Consulta atual**: `useAvailableClassrooms` aceita habilitação e usa termo normalizado na chave e no service. Encaminhar `AbortSignal` ao Axios. Sem placeholder do termo anterior. A apresentação exige correspondência entre termo atual e estabilizado. Retry só consulta o termo atual válido e estabilizado.
5. **Cache após sucesso**: adicionar `classroomKeys.availableRoot()` = `['classrooms', 'available']`, mantendo `available(term)` compatível. Em `onSuccess` de join/leave/delete, cancelar consultas de listas em andamento antes de invalidar `my()` e o prefixo. Aguardar refetch ativo; variantes inativas ficam invalidadas e atualizam no reuso. Dados de disponíveis stale ou em refetch não ficam acionáveis: loading/erro precedem cards, mesmo quando `isLoading` é falso. Manter invalidações de comunicados, retry e guard de exclusão. Sem atualização otimista. Erro no refresh é falha da listagem, sem fingir reversão da mutation bem-sucedida.
6. **Interface**: mover campo para disponíveis; reutilizar `FormField`, `Button`, `ScreenState`, cards e `useTheme`. Limpeza acessível, validação “Use até 80 caracteres na pesquisa”, nenhuma correspondência contextualizada e retry com termo preservado. “Minhas turmas” mantém sua query e seus estados.
7. **Contrato**: atualizar na implementação Swagger e `specs/001-app-quality-readiness/contracts/openapi.json`. Documentar comprimento após trim, vazio sem filtro e rejeição de valores múltiplos. Manter `classrooms.findAvailable`, envelope de erro e `ClassroomSummary[]`. Evitar registrar schema público desnecessário só para o DTO; se o runtime gerar schema adicional, sincronizar inventário canônico.

## Phase 0: Research Output

[research.md](./research.md) resolve fronteira, debounce, corridas, cache e validação com evidência local e fontes primárias.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): entidades conceituais, invariantes e transições; sem modelo persistente novo.
- [contracts/classroom-search.md](./contracts/classroom-search.md): HTTP, interface, estados e consistência.
- [quickstart.md](./quickstart.md): ambiente isolado, comandos e matrizes para US1–US3 e regressão.

## Project Structure

### Documentation (this feature)

```text
specs/006-classroom-search-fix/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/classroom-search.md
└── quickstart.md
```

`tasks.md` pertence ao fluxo posterior `speckit-tasks`, não produzido nesta execução.

### Source Code (repository root)

```text
backend/
├── src/classrooms/
│   ├── dto/find-available-classrooms-query.dto.ts       # novo
│   ├── dto/find-available-classrooms-query.dto.spec.ts  # novo
│   ├── classrooms.controller.ts / .spec.ts
│   └── classrooms.service.ts / .spec.ts
└── test/{classrooms.integration,openapi.contract}.spec.ts
mobile/
├── app/(app)/(tabs)/classrooms.tsx
├── src/validations/classroomSearch.schema.ts            # novo
├── src/hooks/useClassroomSearch.ts                     # novo
├── src/hooks/useAvailableClassrooms.ts
├── src/hooks/use{Join,Leave,Delete}Classroom.ts
├── src/config/query-keys.ts
├── src/services/classes/classroom.service.ts
└── tests/{validations,hooks,services,routes,accessibility}/...
specs/001-app-quality-readiness/contracts/openapi.json
```

**Structure Decision**: manter camadas existentes; lógica em schema/hook e contrato de entrada no domínio classrooms. Ajustar hooks compartilhados de mutation sem reescrever Home, detalhes, autenticação ou provider de tema; seus consumidores entram na regressão necessária.

## Validation and Handoff

A geração futura de tasks segue as dependências:

| Etapa futura | Entrega e checkpoint                                               | Cobertura                                                    |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Preparação   | Baseline, fixtures, matriz e definição de chaves/termos            | Sem implementação fora da 006                                |
| US1 / P1     | DTO/critério/OpenAPI, schema/normalização/service e busca por nome | FR-001–FR-008, FR-011, FR-023–FR-024; SC-001, SC-005, SC-008 |
| US2 / P2     | Debounce, habilitação/cancelamento, estados, limpar/retry e campo  | FR-002, FR-009–FR-017; SC-002–SC-005, SC-008–SC-009          |
| US3 / P3     | Prefixo, cancelamento/invalidação, refresh e reuso                 | FR-018–FR-021; SC-006–SC-007                                 |
| Fechamento   | Regressão de ações/temas, gates e evidência Android                | FR-022; SC-009–SC-010 e auditoria integral                   |

US2 depende da normalização/chave de US1. US3 usa queries e apresentação de dados atuais; o prefixo pode ser preparado antes, mas a validação integral depende desses estados. Não considerar concluída uma etapa com testes que apenas espiam `invalidateQueries`.

## Post-Design Constitution Check

| Gate                | Resultado | Evidência de design                                                           |
| ------------------- | --------- | ----------------------------------------------------------------------------- |
| Arquitetura         | PASS      | DTO/service, schema/hook e tela separados.                                    |
| Contratos/segurança | PASS      | Fronteira estrita, JWT, OpenAPI e cobertura HTTP.                             |
| Testabilidade       | PASS      | Matriz liga 24 FR e 10 SC a testes/evidência; gates existentes identificados. |
| Dados               | PASS      | Sem alteração de Prisma, migration ou domínio.                                |
| UX/acessibilidade   | PASS      | Estados atuais/independentes, português, temas e controles acessíveis.        |

Resultado pós-design: **PASS**. Implementação/testes ficam para etapas posteriores.

## Complexity Tracking

Não aplicável: nenhuma violação constitucional ou dependência nova.
