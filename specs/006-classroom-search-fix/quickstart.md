# Quickstart: Classroom Search Fix

**Data**: 2026-10-02

Roteiro para validar a implementação futura, não um registro de execução. Regras: [contracts/classroom-search.md](./contracts/classroom-search.md); estados: [data-model.md](./data-model.md). Novas suites indicadas abaixo serão criadas na implementação; não presumir que já existem.

## Pré-requisitos e preparação

- Node.js 22+, npm e dependências backend/mobile instaladas. Se necessário, usar `npm ci` em cada pacote, com lockfiles atuais.
- API de desenvolvimento para o walkthrough; `EXPO_PUBLIC_API_URL` do mobile configurada localmente. Usar segredos de teste/desenvolvimento conforme exemplos existentes, sem copiá-los para evidências.
- Integração/e2e exclusivamente em PostgreSQL local com nome contendo `test`, como `avisa_ai_test`. `docker-compose.yml` inicia o banco de desenvolvimento `avisa_ai`, que não é o destino dos testes destrutivos. Não reutilizar esse nome nas suites.
- Confirmar `DATABASE_URL` de teste antes de migrate deploy/testes. O helper `assertSafeTestDatabase` rejeita host remoto ou nome fora do padrão; preservar essa proteção. Reproduzir configuração de `.github/workflows/backend-ci.yml` em banco isolado e aplicar apenas migrations existentes.
- Fixtures isoladas: proprietário PROFESSOR, membro PARENT, PROFESSOR não proprietário e ADMIN autenticado; duas Matemáticas, uma Português, turma correspondente já associada, nomes com números/pontuação/espaços internos/acentos, `%`, `_` e barra invertida; casos 80/81 caracteres após trim. Cleanup limitado aos dados de teste.
- Para inspeção visual, aparelho/emulador Android; registrar modelo, versão, escala de fonte e tecnologia assistiva. Evidência indisponível permanece `NOT MEASURED`.

## Backend: validação dirigida

Em `backend`, com ambiente de teste isolado já selecionado:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm test -- --runInBand src/classrooms/dto/find-available-classrooms-query.dto.spec.ts src/classrooms/classrooms.controller.spec.ts src/classrooms/classrooms.service.spec.ts
npm run test:integration -- --runTestsByPath test/classrooms.integration.spec.ts
npm run test:contract
```

Resultados esperados: trim, vazio, substring, caixa, acentos, literalidade e memberships corretos; 80 aceito/81 rejeitado após trim; 400 para query repetida/desconhecida e formas inválidas; 401 sem autenticação/sessão válida; perfis existentes mantidos. Controller/service unitários devem verificar composição do critério; HTTP/PostgreSQL provam fronteira e semântica real. Contrato deve comparar Swagger runtime com OpenAPI canônico, sem novo endpoint ou resposta.

## Mobile: validação dirigida

Em `mobile`, após criar/atualizar as suites previstas:

```powershell
npm test -- --runInBand tests/validations/classroomSearch.schema.spec.ts tests/hooks/useClassroomSearch.spec.tsx tests/hooks/useAvailableClassrooms.spec.tsx tests/hooks/useJoinClassroom.spec.tsx tests/hooks/useLeaveClassroom.spec.tsx tests/hooks/useDeleteClassroom.spec.tsx tests/services/classroom.service.spec.ts tests/routes/classrooms-list.spec.tsx
npm test -- --runInBand tests/routes/home.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/confirmation-matrix.spec.tsx tests/routes/theme-surfaces.spec.tsx tests/accessibility/touch-targets.spec.tsx
```

Os novos testes de hooks precisam usar QueryClient real e services controlados por promises, além dos mocks de rota existentes. Usar fake timers apenas para o debounce e controlar o flush assíncrono; não esperar 300 ms reais em cada teste. Não substituir prova de freshness por spy de `invalidateQueries`.

## Matriz automatizada de aceitação

| Grupo/cenário                               | Asserção                                                                                                                                                   | Requisitos                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| US1: substring/caixa/trim/acentos/pontuação | Critério literal correto, memberships excluídas, my intacta.                                                                                               | FR-001, FR-003–FR-008, FR-011; SC-001, SC-008 |
| Limite/contrato                             | Vazio e 80 válidos; 81 inválido; trim antes de contar; Unicode alinhado; repetido/não textual/extras 400 sem listagem inválida.                            | FR-006, FR-023–FR-024; SC-005                 |
| US2: pausa                                  | Em 299 ms zero chamadas por edição; em 300 ms uma para valor final; nova edição reinicia timer; desmontagem limpa timer.                                   | FR-009–FR-010; SC-002                         |
| Equivalência                                | Texto com espaços externos usa mesma chave/critério e não causa consulta duplicada por edição.                                                             | FR-004–FR-005, FR-011                         |
| Respostas fora de ordem                     | A resolve/rejeita depois de B; A não muda loading/erro/dados de B, inclusive durante pausa e limpeza.                                                      | FR-012; SC-003                                |
| Estados                                     | Primeira carga, refetch com cache, resultado, no-match contextual, vazio geral e erro distintos; my independente.                                          | FR-013–FR-015; SC-004, SC-008                 |
| Retry/limpar                                | Texto preservado, retry do termo atual; edição desabilita retry antigo; limpar remove feedback antigo e consulta vazio após pausa.                         | FR-016–FR-017; SC-004                         |
| US3: sucesso                                | Semear variantes vazio/matemática/história; join/leave/delete atualizam query ativa e invalidam todas as inativas; revisit não mostra cards incompatíveis. | FR-018–FR-020; SC-006                         |
| Snapshot pendente                           | Mutation termina antes da primeira query antiga; cancelar/invalidar impede reapresentação do snapshot pré-participação.                                    | FR-012, FR-018–FR-020; SC-003, SC-006         |
| Falhas                                      | Pending/cancel/failure não altera participação; falha de refetch após sucesso mostra erro de lista, sem inventar falha da mutation.                        | FR-021; SC-007                                |
| Acessibilidade/temas                        | Campo, erro, limpar, retry e cards têm semântica/tokens ativos; troca preserva texto e timer.                                                              | FR-002, FR-022; SC-009                        |
| Regressão                                   | Criar/abrir/entrar/sair/excluir mantêm roles, confirmação, guard, retry, destino e feedback.                                                               | FR-022; SC-010                                |

Não usar testes de comportamento simplificados que só comprovem encaminhamento de search; validar tanto consulta quanto apresentação e cache.

## Gates completos de implementação

Em `backend`, com banco isolado:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run test:cov
npm run test:integration
npm run test:contract
npm run test:e2e
npm run build
```

Em `mobile`:

```powershell
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run test:ci
npm run export:ci
```

Na raiz: `git diff --check`. Registrar resultados e falhas preexistentes separadamente; não alterar pacotes/lockfiles ou trabalho alheio para ocultar falha fora do escopo. Avisos de `act`/handles não equivalem a falha se asserções/status passam, mas devem constar na evidência. Não declarar gates completos sem executá-los.

## Walkthrough Android

API existente e fixtures de desenvolvimento disponíveis:

```powershell
cd mobile
npm run android
```

Executar em Claro e Escuro:

1. Buscar `matemática`, uppercase, fragmento, espaços externos e vazio; conferir que somente disponíveis muda. Observar números, pontuação, acentos e ordem existente.
2. Digitar continuamente; observar feedback de espera/loading e ausência de flashes de termo anterior. Limpar enquanto há busca ativa; mensagens anteriores desaparecem, e o conjunto sem filtro retorna.
3. Digitar 80/81 caracteres normalizados, incluindo colagem com espaços externos; conferir validação sem truncamento silencioso, correção e limpeza.
4. Usar termo sem correspondência e diferenciar do empty geral. Simular conexão lenta/falha controlada; texto permanece, retry usa o mesmo termo. Recuperar a conexão. Trocar termo enquanto request anterior continua.
5. Entrar com filtro ativo; turma sai das disponíveis e entra em my. Sair de turma correspondente; movimento inverso conforme elegibilidade. Como owner, excluir e revisitar pesquisas anteriores. Repetir cancelamento, falha e pending, sem sucesso visual falso.
6. Criar/abrir turma e verificar destinos/permissões/confirmações; tema alternado durante espera/loading/erro não apaga texto ou reinicia busca. Sessão expirada segue autenticação existente.
7. Conferir labels, foco, teclado, ordem de leitura, limpeza/retry, texto ampliado, contraste e alvos. Medir TalkBack se disponível. iOS/VoiceOver exigem walkthrough próprio.

## Evidência e auditoria

Na implementação, registrar em `specs/006-classroom-search-fix/evidence/classroom-search-validation.md`: comando/cenário, configuração, resultado, observação e limite. Status: `PASS`, `WARN`, `FAIL`, `NOT RUN` para checks não executados e `NOT MEASURED` para observações manuais indisponíveis. Jest/Doctor/export não substituem evidência em dispositivo.

Antes de fechar a feature, conferir FR-001–FR-024 e SC-001–SC-010 contra artefatos, diff, testes e evidência. Sem novo endpoint/campo/migration/dependência, busca em my, mudança de domínio, redesign geral ou capacidades de outras specs. Este planejamento não cria o arquivo de evidência nem marca tasks de implementação.
