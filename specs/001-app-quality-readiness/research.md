# Phase 0 Research: Consolidação de Experiência e Qualidade

## 1. Preservar a arquitetura em camadas existente

**Decision**: Manter o monólito modular NestJS com fluxo `Controller → DTO → Service → PrismaService/PostgreSQL` e o mobile com `Expo Router screen → component/hook → service → Axios`, usando providers para sessão, Zod para formulários, Secure Store para tokens e React Query para estado remoto. Extrair apenas primitivas compartilhadas exigidas pela feature: bootstrap Nest, response DTOs, query keys, erros, confirmação e componentes de estado.

**Rationale**: A estrutura atende à constituição e já separa transporte, regra, persistência, navegação, cache e apresentação. As inconsistências observadas são locais: bootstrap duplicado nos testes, services de comunicado fragmentados, query keys literais e navegação dentro de hooks. Um endurecimento incremental reduz acoplamento e preserva o trabalho mobile em andamento.

**Alternatives considered**:

- Repository genérico: rejeitado porque apenas encapsularia Prisma já isolado pelos services.
- CQRS/DDD completo: rejeitado por complexidade sem requisito correspondente.
- Redux/Zustand: rejeitados; React Query e `AuthContext` já cobrem estado remoto e sessão.
- Refactor global antes dos fluxos: rejeitado pelo risco de conflito com o WIP e escopo excessivo.

## 2. Ownership explícito e exclusão segura de turma

**Decision**: Preservar `DELETE /api/v1/classrooms/{id}`, guards JWT/role e validação de `ownerId`; retornar `204` após a primeira remoção autorizada e após a repetição pelo mesmo owner. Expor `ownerId` nos resumos, obter o professor pela relação `owner`, impedir o owner de executar `leave` e conservar as cascatas de `Announcement` e `UserClassroom` nas FKs PostgreSQL. Criar `ClassroomDeletionReceipt` durável com somente `classroomId`, `ownerId` e `deletedAt`: a transação registra o receipt e remove a turma; se a turma já não existe, receipt do mesmo owner produz `204`, receipt ausente ou de outro owner produz `404`, e non-owner de turma existente recebe `403`.

**Rationale**: O banco já possui owner obrigatório e `ON DELETE CASCADE`; remover dependências manualmente duplicaria a fonte de verdade. O resumo atual usa o primeiro professor membro, que não é uma prova de ownership. O fluxo atual `findUnique` seguido de `delete` pode lançar `P2025` se duas deleções concorrerem e retorna `404` no retry esclarecido como sucesso. Responder `204` para qualquer ausência enfraqueceria a distinção entre o retry do owner e uma tentativa sem autorização; o receipt mínimo preserva ambas as garantias sem reter conteúdo recuperável da turma.

**Alternatives considered**:

- Transação com deletes manuais: rejeitada; as FKs já garantem a atomicidade necessária.
- `204` para todo classroom ausente: rejeitado porque não comprova que a repetição veio do owner original.
- `Idempotency-Key` enviado pelo mobile: válido, mas rejeitado porque amplia o contrato cliente/API; o receipt pelo identificador/owner cobre exatamente a repetição requerida.
- Soft delete do conteúdo: rejeitado porque viola a exclusão permanente e adiciona estado recuperável.
- Inferir ownership por `teacher.id`: rejeitado quando houver múltiplos professores membros.

**Operational note**: A migration histórica `20260807202044_add_classroom_owner` adiciona uma coluna obrigatória sem backfill. Ela não deve ser reescrita, mas ambientes que ainda não a aplicaram precisam ser auditados antes do deploy.

## 3. Perfil self-service, normalização e sessão JWT

**Decision**: Substituir o update genérico por `UpdateProfileDto` com somente `name?` e `email?`, pelo menos um campo efetivo e rejeição de `password`, `role`, `id` e desconhecidos. Trimar nome, preservar acentos/capitalização interna, trimar e converter e-mail para lowercase e reutilizar a mesma normalização em cadastro, lookup/login e update. Retornar o perfil público; conflitos de unicidade permanecem `409` por `P2002`. Substituir o refresh singleton em `User` por `AuthSession` persistente e `sid` obrigatório nos dois JWTs. Login/register criam uma sessão por dispositivo, refresh gira apenas seu hash, e o guard valida sessão ativa mais o usuário atual a cada acesso protegido.

**Rationale**: O DTO atual aceita password fora do escopo e o service não trima nome. A unicidade do banco resolve corridas, enquanto a normalização canônica resolve diferenças de case/espaço. Se o payload normalizado não alterar nada, o service retorna o perfil sem write e sem mudar `updatedAt`.

Após uma troca efetiva de e-mail, a atualização do usuário e a revogação de todas as `AuthSession` exceto o `sid` atual ocorrem na mesma transação. O JWT atual continua válido porque o guard resolve identidade e sessão atuais pelo `sub`/`sid`; dispositivos revogados recebem `401` no próximo access ou refresh. Name-only e no-op não revogam sessões. Secure Store continua armazenando apenas os tokens do dispositivo atual, evitando uma segunda fonte persistente para o perfil.

**Alternatives considered**:

- Reautenticar sempre: rejeitado; email verification/password re-entry estão fora do escopo e e-mail não governa autorização.
- `sessionVersion` global e tokens novos no PATCH: rejeitado por acoplar users e auth, derrubar o dispositivo atual se a resposta se perder e não representar sessões por dispositivo.
- Manter o refresh singleton: rejeitado porque outros access tokens continuam válidos até expirar e não há revogação seletiva.
- Persistir o perfil no Secure Store: rejeitado pelo risco de estado obsoleto.
- `citext`/índice funcional: rejeitado porque storage lowercase + unique atende ao baseline sem exigir uma migration adicional à evolução de sessões/receipts; dados históricos devem ser auditados.

## 4. Confirmação reutilizável e prevenção de double-submit

**Decision**: Criar `ConfirmationDialog` com `Modal` nativo, resumo estruturado, variante neutra/destrutiva, estado pending/error e semântica acessível. Validar com React Hook Form/Zod antes de abrir o diálogo. Usar single-flight síncrono, `isPending` e `retry: false` para garantir uma chamada por decisão confirmada.

**Rationale**: `Alert.alert` não representa bem diffs de perfil ou consequências em cascata e é menos controlável em testes. Apenas `isPending` deixa uma janela até o rerender; `scope.id` do React Query enfileira, mas não elimina, chamadas duplicadas. Um guard síncrono cobre a janela, e o botão disabled/busy comunica estado. Cancelar não chama service e mantém valores; falhar mantém tela/dialog e exibe recuperação em português.

**Alternatives considered**:

- Wrapper de `Alert.alert`: insuficiente para resumo, design system e testes de estados.
- Biblioteca externa de dialog: rejeitada; `Modal` cobre o caso sem dependência.
- Debounce/throttle: rejeitado porque tempo não representa a semântica single-flight.
- Apenas serializar mutations: rejeitado porque ambas ainda seriam executadas.

## 5. Fundação visual e acessibilidade

**Decision**: Evoluir `AUTH_THEME` para um tema global que documente cores semânticas, contraste WCAG 2.2 AA, tipografia/line-height, spacing, radius, elevation, ícones, touch targets mínimos específicos por plataforma e estados. Criar primitivas `Button`, `FormField`, `ScreenState` e `ConfirmationDialog`; adotar loading, empty, error, success e not-found explícitos. Usar a identidade verde/neutra existente como referência aprovada pelo plano, sujeita à validação final do product owner.

**Rationale**: Os tokens existentes estabelecem uma direção coerente, mas ainda são específicos de auth e coexistem com cores literais. Algumas telas retornam `null` em loading/missing, e `ClassroomCard` aninha `Pressable`. A fundação global elimina duplicação, fornece affordances consistentes e permite testar label, role, hint e `accessibilityState`. Contraste WCAG 2.2 AA e alvos mínimos de 44×44 pt no iOS e 48×48 dp no Android orientam automação e auditoria; destrutivo usa texto/ícone além de cor.

**Alternatives considered**:

- UI framework completo: rejeitado por dependência e migração desnecessárias.
- Redesign integral: rejeitado; a evolução do verde/neutro satisfaz o requisito.
- Tokens somente de autenticação: rejeitados porque perpetuam divergência nos demais fluxos.

## 6. OpenAPI executável fora de produção

**Decision**: Adicionar `@nestjs/swagger` e configurar, pelo bootstrap compartilhado, UI em `/api/v1/docs` e JSON em `/api/v1/docs/openapi.json`. Habilitar por padrão somente em development/test, aceitar `API_DOCS_ENABLED=false` como kill switch e negar sempre em production. Usar Bearer JWT sem credenciais embutidas, tags por domínio, request/response/error DTOs em classes e metadados explícitos de role/ownership/autoria.

**Rationale**: Reflexão isolada não documenta interfaces TypeScript, bodies primitivos, responses inline nem regras de autorização. A referência deve cobrir as 19 operações externas, incluindo substituir o placeholder não versionado por `GET /api/v1/health`. Um teste estrutural do documento verifica inventário, schemas, security e responses relevantes sem o ruído de snapshot integral.

**Alternatives considered**:

- OpenAPI manual como fonte de runtime: rejeitado por drift; `contracts/openapi.json` é o contrato de design e os decorators/DTOs geram a fonte executável.
- Swagger em produção: rejeitado pela política de deny-by-default da feature.
- Proteger somente a UI com JWT: rejeitado; não substitui a restrição ambiental.
- OpenAPI 3.1/3.2: rejeitado; o formato 3.0 gerado pelo Nest atende ao escopo.

## 7. Testes e quality gates

**Decision**: Manter workflows separados e tornar determinísticos os seguintes gates:

- Backend: `npm ci`, Prisma generate/validate/migrate deploy, format, lint, typecheck, unit+coverage, integração, e2e e build.
- Contrato: geração OpenAPI em memória e asserts estruturais das 19 operações.
- Mobile: `npm ci`, typecheck, lint, format, Expo Doctor travado, Jest Expo/RNTL com cobertura dos módulos críticos e `expo export --platform all`.
- Repositório: Commitlint sobre todos os commits da PR.

**Rationale**: O backend já tem 11 suites/65 testes unitários verdes na pesquisa, mas a integração cobre pouco dos fluxos alvo e o e2e atual só testa Hello World. O mobile não possui testes de comportamento. Jest Expo + React Native Testing Library é a opção oficial compatível com Expo/React atuais; testes de rota ficam fora de `app/`. RNTL cobre as regras automatizáveis da feature sem depender de conta/build EAS.

Manter o piso backend atual (60% statements/branches/lines, 50% functions) e aplicar 80% statements/lines/functions e 70% branches aos novos módulos mobile críticos. Cenários de autorização, cascata, confirmação e conflito são obrigatórios independentemente da média.

Para demonstrar SC-009, executar em alterações descartáveis uma falha controlada por categoria: formatação, correção estática, build/export, comportamento/contrato, saúde de ambiente/dependências e convenção de commit. Cada falha deve atingir o check esperado, produzir log acionável e ser descartada após a captura da evidência.

**Alternatives considered**:

- Workflow monolítico: rejeitado porque piora diagnóstico e acopla componentes.
- Somente gates estáticos mobile: rejeitado por FR-022/FR-024.
- Aumentar cobertura global de wrappers legados: rejeitado porque incentiva testes sem valor.
- Maestro/Detox como gate imediato: rejeitados pela necessidade de runtime/conta externa; podem ser evolução futura.
- `npx` não travado: rejeitado para ferramentas de gate.

## 8. Conventional Commits e enforcement externo

**Decision**: Adicionar tooling Commitlint travado no pacote raiz e workflow com histórico completo para validar `type(scope): description`. Usar commits pequenos por domínio. Executar os workflows para registrar os nomes estáveis e configurar rulesets/branch protection de `develop` e `main` para exigir os checks de backend, mobile e commits antes do merge. A feature permanece incompleta até que essa configuração esteja ativa, uma falha deliberada bloqueie uma PR e a evidência administrativa seja anexada.

**Rationale**: O histórico já usa majoritariamente Conventional Commits, mas não há validação. Hook local é contornável; gate de CI produz evidência. Workflows não bloqueiam merge por si mesmos, portanto required checks são uma dependência administrativa bloqueante, não uma pendência opcional separável do aceite.

**Alternatives considered**:

- Validar apenas título da PR: insuficiente sem política de squash externa.
- Husky como única garantia: rejeitado porque pode ser ignorado.
- Regex caseira: rejeitada por não implementar a convenção completa.
- Instalar Commitlint no backend/mobile: rejeitado por acoplar tooling transversal a um componente.

## Primary Sources

- [NestJS OpenAPI introduction](https://docs.nestjs.com/openapi/introduction)
- [NestJS OpenAPI security](https://docs.nestjs.com/openapi/security)
- [NestJS OpenAPI operations](https://docs.nestjs.com/openapi/operations)
- [NestJS OpenAPI CLI plugin with ts-jest](https://docs.nestjs.com/openapi/cli-plugin)
- [NestJS testing](https://docs.nestjs.com/fundamentals/testing)
- [Prisma referential actions](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/referential-actions)
- [Prisma transactions and idempotent APIs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [RFC 9110: idempotent methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)
- [TanStack Query mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [TanStack invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [React Native Modal](https://reactnative.dev/docs/modal)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
- [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)
- [Expo Router testing](https://docs.expo.dev/router/reference/testing/)
- [Expo Router authentication](https://docs.expo.dev/router/advanced/authentication/)
- [Expo CLI/export](https://docs.expo.dev/more/expo-cli/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
