# Implementation Plan: Account Deletion and Data Lifecycle

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Branch**: `008-account-deletion-data-lifecycle` | **Date**: 2026-10-03 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/008-account-deletion-data-lifecycle/spec.md`

## Summary

Adicionar exclusão permanente da própria conta para PARENT, PROFESSOR e ADMIN, iniciada no Perfil. Uma tela dedicada apresenta o impacto calculado pelo servidor e exige senha atual e a frase exata `EXCLUIR MINHA CONTA`. Um serviço em `users` remove conta, sessões, participações, autoria, turmas próprias e receipts vinculados em uma única transação, preservando contas e recursos de terceiros. Bloquear a última ADMIN inclusive sob exclusões simultâneas.

Após sucesso, limpar tokens, identidade, caches e formulários; retornar à autenticação e preservar o tema. A operação destrutiva não tem retry nem replay após refresh. Resposta perdida exige verificação somente de leitura, com estado indeterminado explícito. Sem pacote, tabela, migration ou dependência funcional da gestão de perfil/senha da 007.

## Technical Context

**Language/Version**: Node.js 22+; backend TypeScript 5.9.3; mobile TypeScript 6.0.3, React 19.2.3 e React Native 0.86.3, conforme manifests atuais.

**Primary Dependencies**: NestJS 11, Prisma 7.6/adapter-pg, PostgreSQL 15+, class-validator/class-transformer, Swagger e verificador de senha existente; Expo SDK 57, Expo Router, React Hook Form, Zod 4, Axios e TanStack Query 5. Nenhuma dependência nova.

**Storage**: tabelas atuais User, AuthSession, Classroom, UserClassroom, Announcement e ClassroomDeletionReceipt; InviteCode preservada. SecureStore somente tokens; AsyncStorage para tema. Senha/frase e resumo apenas transitórios. Sem receipt de exclusão de conta.

**Testing**: Jest; Supertest/PostgreSQL isolado; OpenAPI runtime/canônico; Jest/RNTL para schemas, services, hooks, providers, interceptor e navegação. Rollback e concorrência real; walkthrough Android/TalkBack independente dos gates.

**Target Platform**: REST `/api/v1`; Expo mobile, Android como alvo manual principal. Compatibilidade iOS preservada; evidência iOS/VoiceOver exige execução própria.

**Project Type**: monorepo mobile + API em camadas.

**Performance Goals**: uma solicitação por envio pendente; verificar hash fora da transação; exclusões em lote, sem requisição por turma. Medir espera por locks/duração contra timeout Axios de 10 s e limites Prisma. Sem SLO novo ou benchmark medido; não ampliar timeout global sem evidência.

**Constraints**: alvo exclusivamente JWT/sid; frase/senha exatas sem coerção; último ADMIN preservado; rollback integral; SQL parametrizado; nenhum segredo em respostas/logs/caches; tokens antigos inválidos; resultado incerto comunicado honestamente.

**Scale/Scope**: três histórias, dois endpoints e uma tela. Apoio limitado em emissão/refresh, writer de receipt e ciclo local de sessão, necessário às invariantes da exclusão. Sem produto administrativo, transferência de ownership, backup/retention policy ou notificações.

## Constitution Check

_Gate anterior à pesquisa. PASS descreve aderência do desenho, não execução._

| Princípio                             | Resultado | Aplicação                                                                                           |
| ------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| I. Domain-Modular Architecture        | PASS      | Serviço users dedicado; Controller/DTO/Prisma e camadas mobile separados; sem ciclo users/auth.     |
| II. Secure, Explicit API Contracts    | PASS      | REST versionado, JWT/sid, whitelist fechada, rate limit existente e entradas write-only.            |
| III. Testable Delivery                | PASS      | Unitários, HTTP, matriz de relações, rollback, races e gates definidos.                             |
| IV. Data Integrity and Safe Evolution | PASS      | FKs/cascades atuais e exclusões explícitas atômicas; writer de receipt coordenado; sem schema novo. |
| V. Predictable and Accessible UX      | PASS      | Português, confirmação ativa, pending, temas, teclado, texto ampliado e evidência manual.           |

## Research and Design Decisions

1. **Contratos**: GET `/users/account-deletion`, operação `users.getAccountDeletionImpact`; DELETE `/users/account`, `users.deleteOwnAccount`, corpo fechado `currentPassword`/`confirmationPhrase`; 204 sem corpo/tokens. Rejeitar query fields e body inesperado no GET; nenhum id alvo ou selector de papel. DTO preserva tipos JSON originais apesar da conversão implícita global.
2. **Resumo**: papel, elegibilidade e contagens de turmas próprias, comunicados dessas turmas, participações em turmas de terceiros e comunicados próprios nessas turmas. Sem ids/nomes de terceiros ou total de ADMINs. Carregar ao entrar/retomar e após conflito, com leitura consistente; zero relações é válido. Resumo informativo, nunca autorização/limite para exclusão. Recalcular grafo vigente na transação, inclusive dados expirados e vínculos inesperados para o papel.
3. **Transação**: validar frase e verificar senha snapshot fora dos locks. READ COMMITTED; gate advisory transacional fixo antes de User FOR UPDATE; reler User/sid/hash/papel; bloquear último ADMIN; travar turmas próprias por id; remover autoria, participações próprias, turmas com cascades, receipts, sessões e User. Usar um TransactionClient, sem chamar o DELETE público de turma nem criar receipt novo. Responder somente após commit.
4. **ADMINs**: todas as autoexclusões usam o mesmo gate, antes de qualquer row lock. Contar ADMINs após espera/commit anterior e retornar 409 `LAST_ADMIN_REQUIRED` se restar uma. Não travar todas as ADMINs após travar a conta. Futuras remoções/rebaixamentos de ADMIN devem participar do protocolo; não há endpoint vigente que altere papel.
5. **Sessões**: login já coordena snapshot/lock User. Completar refresh/emissão para revalidar User, sid, expiração e snapshot do refresh sob o mesmo lock; hashes fora da transação, claims dos dados atuais, rotação sem upsert, ausência/revogação = 401. Sessão criada antes da exclusão será apagada; após ela, não pode ser criada. Estratégias JWT consultam sessão persistida.
6. **Receipt sem FK**: ClassroomsService.delete passa a travar/reler User chamador antes de ler/criar receipt, conservando ownership, 403/404 e idempotência para conta existente. Se exclusão de conta vencer, retornar 401 sem receipt; se turma vencer, a conta limpa seu receipt. Coordenar o único writer identificado evita migration/cascade amplo de User.
7. **Relações concorrentes**: lock User e FKs impedem novos vínculos à conta; locks das turmas próprias estabilizam descendentes de terceiros. Escritas anteriores entram na política vigente. Deadlock/timeout aborta tudo com erro sanitizado; nenhuma repetição automática. Testar interleavings reais e receipt.
8. **Mobile**: service imperativo/hook local com ref single-flight, sem mutation cache ou request global. Flag opt-in tipada no Axios impede refresh/replay do DELETE; outras chamadas conservam contratos. 400 não encerra sessão; 401 leva à verificação de leitura, sem reenviar DELETE. Erros sanitizados sem Axios config/body/request/cause.
9. **Limpeza concorrente**: invalidar geração da sessão sincronamente; serializar escrita/remoção de tokens e impedir aplicação de refresh/perfil/queries/mutations antigas. Cancelar consultas privadas e limpar QueryClient/identidade mesmo se SecureStore falhar; tentar ambas as chaves e manter autenticação fechada até recuperação. Propagar AbortSignal nos hooks/services privados necessários. Tema separado e preservado.
10. **Resposta perdida**: `valid`/`invalid`/`indeterminate` na verificação somente de leitura; refresh permitido só nessa leitura e geração. 401 definitivo limpa sessão sem atribuir sucesso da exclusão sem 204; rede/5xx/429 continuam indeterminados. Um 200 prova validade naquele instante, não rollback de DELETE pendente. Nova tentativa exige resumo fresco e confirmação manual nova, nunca resend automático ou consulta por e-mail.
11. **Tela**: `/profile/delete-account`, ação destrutiva distinta de logout, aviso de permanência, relações removidas/preservadas, senha protegida e frase exata. Reusar SecondaryScreen, ScreenState, AuthField/FormField e Button destrutivo; paleta ativa, scroll/teclado e guards. Pending bloqueia campos/cancelar/back/gesto/hardware enquanto há usuário; expiração desarma guarda. Limpar valores em cancelamento, blur, unmount, expiração, sucesso e resultado incerto. Sucesso transitório sem identidade na autenticação.
12. **OpenAPI**: atualizar Swagger e `specs/001-app-quality-readiness/contracts/openapi.json` juntos na implementação, pois o teste compara inventário exato. Nesta execução o contrato novo fica só na 008.

Evidências, fontes e alternativas: [research.md](./research.md).

## Phase 0: Research Output

[research.md](./research.md) consolida pesquisa separada de backend/mobile e resolve contratos, impacto, cascades, ADMINs, locks, receipts, sessões e recuperação. Sem decisões técnicas pendentes.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): entidades, política e estados.
- [contracts/account-deletion.md](./contracts/account-deletion.md): HTTP e UI.
- [quickstart.md](./quickstart.md): ambiente, comandos e matriz de validação.

## Project Structure

### Documentation (this feature)

```text
specs/008-account-deletion-data-lifecycle/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/account-deletion.md
└── quickstart.md
```

`tasks.md` pertence ao workflow posterior `speckit-tasks`, não produzido aqui.

### Source Code (repository root)

```text
backend/
├── src/users/{users.controller,users.module}.ts
├── src/users/account-deletion.service.ts / .spec.ts        # novos
├── src/users/dto/{delete-account,account-deletion-impact}.dto.ts # novos
├── src/auth/{auth.service,auth-session.service}.ts / .spec.ts
├── src/classrooms/classrooms.service.ts / .spec.ts
├── prisma/schema.prisma / migrations/                     # reuso sem alteração
└── test/{account-deletion.integration.spec.ts,account-deletion.e2e-spec.ts,
          auth.integration.spec.ts,classrooms.integration.spec.ts,openapi.contract.spec.ts}
mobile/
├── app/(app)/(tabs)/profile.tsx
├── app/(app)/profile/delete-account.tsx                    # novo
├── src/validations/deleteAccount.schema.ts                # novo
├── src/hooks/useDeleteAccount.ts                          # novo
├── src/services/auth/{account-deletion.service,index}.ts
├── src/types/{auth.ts,axios.d.ts}
├── src/lib/api.ts
├── src/providers/AuthProvider.tsx
├── src/storage/auth.storage.ts
├── src/hooks/{useMyClassrooms,useAnnouncement,useClassroomAnnouncements}.ts
├── src/services/{classes,announcements}/...               # cancelamento/geração quando necessário
└── tests/{routes,validations,hooks,services,providers,lib,storage}/...
specs/001-app-quality-readiness/contracts/openapi.json      # implementação
backend/README.md / mobile/README.md                       # capacidade nova
```

**Structure Decision**: AccountDeletionService registrado em UsersModule injeta Prisma diretamente. Não importar AuthModule (já depende de UsersModule) ou criar transações aninhadas via ClassroomsService. Auth conserva emissão/refresh; Classrooms conserva receipt. Utilitário pequeno em storage/lib pode compartilhar geração/fila local sem ciclo de imports; evitar reestruturação ampla.

## Validation and Handoff

| Checkpoint futuro | Entrega                                             | Cobertura                              |
| ----------------- | --------------------------------------------------- | -------------------------------------- |
| Preparação        | Baseline, banco seguro e fixtures/matriz            | FR-026; SC-002/010                     |
| Fundação          | Locks, sessões, receipt e DTO/contratos             | FR-002/006/009/014–019                 |
| US1 / P1          | Resumo, ação/tela, senha/frase, cancelar e bloqueio | FR-001–008/015/024/025; SC-001/006/009 |
| US2 / P2          | Exclusão integral, e-mail reutilizável e OpenAPI    | FR-009–019; SC-002–005                 |
| US3 / P3          | Sem replay, limpeza/geração e resposta perdida      | FR-017/020–023; SC-004/007/008         |
| Fechamento        | Regressão, gates, walkthrough e AT                  | FR-024–026; SC-006/009/010             |

Fundação/contrato antecedem envio real; US1 é verificável sem concluir exclusão. Não declarar US2/US3 completas sem rollback, concorrência e recuperação. Detalhar tarefas no próximo workflow; não iniciar implementação.

## Post-Design Constitution Check

| Gate                  | Resultado | Evidência de design                                             |
| --------------------- | --------- | --------------------------------------------------------------- |
| Arquitetura           | PASS      | Serviço users sem ciclo, camadas mobile existentes.             |
| Contratos/autorização | PASS      | Self-only/sid, DTO fechado, segredo transitório, sucesso vazio. |
| Testabilidade         | PASS      | Matriz de relações, HTTP, rollback/races e resultado incerto.   |
| Dados                 | PASS      | Schema preservado, transação, gate ADMIN e receipt coordenado.  |
| UX/acessibilidade     | PASS      | Confirmação, estados, guardas, temas e evidência manual.        |

Resultado pós-design: **PASS**, sem exceções. Testes/gates de implementação não executados nesta etapa.

## Complexity Tracking

Sem violação constitucional. Gate advisory serializa uma operação infrequente sem tabela adicional; geração/fila local fecha a race de refresh/limpeza sem novo mecanismo de autenticação.

## Fechamento de copy e evidência — 2026-10-05

A solicitação explícita do usuário em 2026-10-05 ajusta somente a apresentação do aviso na rota de exclusão: resumo por papel, sem detalhes internos e sem atribuir publicação de comunicado a PARENT. Relações atuais do servidor, confirmação, bloqueio do último ADMIN e política backend permanecem inalterados. As regressões da rota e os gates mobile afetados validam a alteração; T064 está dispensada, T065 está concluída via 009:T073. A consolidação transversal 009:T074 registra separadamente T057/T069 ainda ativas. Ver [validation.md](./validation.md).
