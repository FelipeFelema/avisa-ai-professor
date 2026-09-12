# Evidência US1 — Exclusão segura de turma

Data da validação: 2026-09-01

## Escopo validado

Esta evidência cobre somente a Phase 3 (T018–T025): owner explícito, bloqueio de saída do owner, DELETE 204, receipt de repetição, concorrência, rollback, cascatas, visibilidade mobile, confirmação, single-flight, invalidação e retorno seguro à lista.

## Resultados automatizados

| Superfície | Comando | Resultado | O que a evidência comprova |
|---|---|---|---|
| Backend unitário | `& .\\node_modules\\.bin\\jest.cmd --ci --runInBand` em `backend` | PASS — 12 suítes, 64 testes | Inclui owner explícito, leave `409`, receipt, retry, concorrência e `204` do controller. |
| Backend integração | `& .\\node_modules\\.bin\\jest.cmd --config .\\test\\jest-integration.json --ci --runInBand` em `backend` | PASS — 5 suítes, 27 testes | Exercita `204/401/403/404`, cascata PostgreSQL, repetição, concorrência e rollback sem persistir receipt falso. O rollback registra no log apenas o erro simulado esperado. |
| Backend e2e | `& .\\node_modules\\.bin\\jest.cmd --config .\\test\\jest-e2e.json --ci --runInBand` em `backend` | PASS — 2 suítes, 3 testes | Confirma o bootstrap compartilhado e o fluxo owner DELETE 204/repetição, além de rejeição anônima. |
| Backend saúde | `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` em `backend` | PASS | Código e testes da Phase 3 compilam, respeitam lint/formatação e geram o build Nest. |
| Mobile comportamento | `& .\\node_modules\\.bin\\jest.cmd --ci --runInBand --passWithNoTests` em `mobile` | PASS — 11 suítes, 23 testes | Inclui DELETE 204/404, keys exatas, single-flight, ausência de retry automático, retry explícito, visibilidade owner/non-owner, cancelamento sem mutation, confirmação e navegação/not-found. |
| Mobile saúde | `npm run typecheck`, `npm run lint`, `npm run format:check` em `mobile` | PASS | Código da Phase 3 compila, passa lint e está formatado. |
| Diff | `git diff --check` | PASS | Não há erros de whitespace no diff da Phase 3. |

## Matriz funcional

- Owner professor: DELETE inicial retorna `204` vazio, cria um único receipt e remove turma, memberships e comunicados em cascata.
- Retry do mesmo owner: DELETE repetido retorna `204` sem novo efeito físico.
- Concorrência: duas requisições do mesmo owner convergem para um único receipt/remoção e ambas retornam `204`.
- Autoridade: anônimo recebe `401`; parent e professor non-owner recebem `403`; turma ausente sem receipt correspondente recebe `404`.
- Membership: o owner não pode usar leave e recebe `409`; membro non-owner mantém a ação Sair.
- Mobile: somente `user.id === ownerId` vê Excluir turma; cancelamento não chama o serviço; confirmação usa estado pending/single-flight e sucesso substitui a rota por `/classrooms`.
- Mobile not-found: ausência da turma após refresh renderiza estado acessível e ação Ver turmas.

## Limites do checkpoint

Os testes mobile usam mocks do serviço e do router para provar comportamento de UI/hook; a autorização, transação e cascata reais são comprovadas pelas suítes backend. Export bundle, Expo Doctor, workflows CI, OpenAPI e auditorias manuais pertencem a fases posteriores e não foram executados nesta Phase 3.

Observação de ambiente: a suíte mobile pode emitir o aviso do React Native sobre act/concurrent test environment, mas terminou com exit 0 e todos os 23 testes passaram.
