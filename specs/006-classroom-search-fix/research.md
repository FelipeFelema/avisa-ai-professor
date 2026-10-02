# Research: Classroom Search Fix

**Data**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

Pesquisa do checkout atual, sem implementação. O script oficial resolveu a branch `006-classroom-search-fix`. Não existe `.specify/extensions.yml`; nenhum hook de planejamento está registrado. A checklist preenchida contém evidência histórica que não foi reexecutada nesta etapa.

## 1. Fronteira e normalização

**Decision**: DTO class-validator para a query; trim somente em texto; ausência/vazio sem filtro; rejeição de valores múltiplos, não textuais e desconhecidos. Preservar o tipo bruto contra coerção implícita até validar.

**Rationale**: `classrooms.controller.ts` recebe um parâmetro primitivo; o limite Swagger não valida runtime. `configure-app.ts` já possui whitelist, rejeição de extras, transformação e conversão implícita. O Express instalado usa parser `simple`: duplicação resulta em array; notação com colchetes precisa ser coberta como query inválida, sem pressupor parsing de objetos. O [ValidationPipe NestJS](https://docs.nestjs.com/techniques/validation) documenta DTO concreto e validação de query. Manter a camada existente, sem mudar opções globais.

**Alternatives considered**: validar só no cliente deixa chamadas diretas desprotegidas; `String()` aceita arrays; alterar conversão global afeta outros domínios.

## 2. Comprimento e substring literal

**Decision**: vazio ou até 80 pontos de código Unicode após trim, com predicado equivalente em class-validator e Zod. Preservar `contains` case-insensitive e exclusão de memberships; escapar `%`, `_` e barra invertida usados como padrões.

**Rationale**: `class-validator/MaxLength` instalado chama `validator/isLength`, cuja contagem trata surrogate pairs e sequências de apresentação. `.length` ou Zod `.max()` podem divergir; regra explícita de pontos de código mantém os limites alinhados. Não remover acentos ou aplicar normalização Unicode. A documentação de [padrões PostgreSQL 15](https://www.postgresql.org/docs/15/functions-matching.html) explica curingas e escapes. A correção literal deve ser provada na integração com o Prisma instalado.

**Alternatives considered**: limite bruto bloqueia termos válidos com espaços externos; truncamento oculta erro; full-text, unaccent e novos índices ampliam escopo.

## 3. Debounce e atualidade

**Decision**: `useClassroomSearch` controla texto imediato, schema Zod e termo estabilizado em 300 ms; cancelar timers em edição/unmount. Bloquear query durante espera/validação. Limpar remove feedback antigo imediatamente e estabiliza vazio após 300 ms.

**Rationale**: `classrooms.tsx` envia cada edição ao hook. Um único dono da pausa permite provar 299/300 ms. Entre A e B, ocultar resultados/erros de A e não usar placeholder anterior. Trim equivalente não gera variante ou nova consulta por edição se o critério já está atualizado.

**Alternatives considered**: atrasar o campo prejudica a edição; debounce só no service deixa estados intermediários; duas camadas duplicam espera; consulta imediata após limpar contradiz a pausa uniforme definida na spec.

## 4. Corridas e cancelamento

**Decision**: chave por termo normalizado; signal do queryFn encaminhado ao Axios; apresentação condicionada ao termo atual coincidir com o estabilizado.

**Rationale**: hook/service atuais não encaminham signal. O [cancelamento TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) permite consumi-lo no transporte. Chaves isolam estados de termos diferentes; cancelamento reduz trabalho, mas a correção não depende só do abort. Testar inclusive mocks que concluam requisição antiga.

**Alternatives considered**: contador manual duplica o cache existente; confiar apenas em abort não protege apresentação; manter dados do termo anterior gera mensagens incompatíveis.

## 5. Participação e variantes

**Decision**: `availableRoot()` = `['classrooms', 'available']`; no sucesso de join/leave/delete, cancelar requests anteriores de listas, invalidar `my()` e prefixo, aguardar refresh ativo; inativas ficam stale. Ocultar disponíveis stale/em refetch, com erro prioritário sobre cards antigos.

**Rationale**: `query-keys.ts` produz `available()` = `['classrooms', 'available', '']`; os três hooks invalidam só essa variante. O QueryClient mantém staleTime de cinco minutos. O código TanStack instalado confirma `isLoading=false` com cache e possível reuso de primeira consulta pendente sem dados; cancelamento após sucesso evita esse snapshot de participação anterior. A [invalidação TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) permite matching por prefixo e refresh ativo. A regra adicional de apresentação protege o reuso das inativas.

**Alternatives considered**: enumerar termos deixa variantes de fora; refetch de todas aumenta tráfego; limpar QueryClient inteiro afeta outros domínios; atualizações otimistas podem falsificar sucesso e services de mutation retornam void, sem resumo completo para inserção.

Join hoje não aguarda invalidação; leave/delete aguardam. Tornar os três aguardáveis, preservando comunicados, confirmação, guard e retry. `useCreateClassroom` e atualização de perfil também usam `available()`; manter essa API compatível, sem expandir o escopo para essas mutations.

## 6. Interface e evidência

**Decision**: campo em disponíveis; `FormField.error`, botão “Limpar pesquisa”, estados/retry em português e paleta ativa. Complementar mocks de rota com QueryClient real nos hooks.

**Rationale**: campo hoje precede “Minhas turmas”; vazio filtrado e geral se confundem. `FormField` já tem erro acessível, ícone decorativo e tema reativo. Spies de invalidação não provam cache real. Jest/Doctor/export não medem teclado, foco nativo, TalkBack ou legibilidade reais.

**Alternatives considered**: novo input geral amplia mudança; repetir teste de passagem de parâmetros mantém lacuna; herdar evidência manual de outras specs não demonstra esta feature.

## Resultado

Pontos técnicos resolvidos, sem dependência nova. Cenários/gates: [quickstart.md](./quickstart.md). Nenhum teste de implementação ou resultado manual é declarado concluído por esta pesquisa.
