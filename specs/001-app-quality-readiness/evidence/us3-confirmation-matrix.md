# Evidência US3 — Matriz de confirmações

Data da validação: 2026-09-03  
Escopo: Phase 5, T037–T043 somente. A execução foi encerrada antes da Phase 6; T044 e posteriores não foram iniciadas nem marcadas.

## Resultado

PASS para a implementação mobile da confirmação de atualização, exclusão e saída de turma.

- Os serviços de comunicados foram consolidados em `announcement.service.ts`, com reexports de compatibilidade para os caminhos existentes.
- As mutations de leave, update e delete usam `retry: false`, invalidam as query keys compartilhadas e não fazem navegação embutida; cada tela navega somente após o sucesso e a invalidação aguardada.
- O editor canônico de comunicados mostra o diff dos campos alterados, não abre request em no-op/cancelamento, bloqueia double-tap, mantém valores e diálogo em falha e retorna à tela anterior somente depois do sucesso.
- O detalhe de comunicado substitui `Alert` pelo `ConfirmationDialog`, inclui consequência irreversível, single-flight e erro recuperável sem perder o contexto.
- As telas de turmas confirmam somente a saída de non-owner; join e criação continuam ações diretas, sem confirmação.
- A rota duplicada `mobile/app/(app)/classrooms/[id]/edit.tsx` foi removida somente depois de o editor canônico e a matriz passarem; `mobile/app/(app)/announcements/[id]/edit.tsx` permanece presente.

## Matriz funcional

| Ação | Cobertura executada | Cancelamento | Confirmação/single-flight | Falha e sucesso |
| --- | --- | --- | --- | --- |
| Atualizar perfil | `tests/routes/profile-edit.spec.tsx`, `tests/hooks/useUpdateProfile.spec.tsx` | zero mutation | diff e confirmação existentes da US2 | perfil retornado aplicado e rota volta após sucesso |
| Excluir turma como owner | `tests/routes/classrooms-list.spec.tsx`, `tests/routes/classroom-details.spec.tsx`, `tests/hooks/useDeleteClassroom.spec.tsx` | zero delete | diálogo destrutivo e bloqueio de envio duplicado existentes da US1 | retorno seguro após sucesso; not-found preserva navegação segura |
| Sair como non-owner | `tests/routes/confirmation-matrix.spec.tsx`, `tests/hooks/useLeaveClassroom.spec.tsx` | zero leave | uma mutation em double-tap; owner não recebe Sair | falha sem retry automático; sucesso invalida turmas e comunicados |
| Atualizar comunicado | `tests/routes/confirmation-matrix.spec.tsx`, `tests/hooks/useUpdateAnnouncement.spec.tsx` | zero PATCH e valores preservados | summary com diff e uma mutation em double-tap | falha mantém editor/diálogo/erro; sucesso invalida detalhe, lista e resumo da turma antes de voltar |
| Excluir comunicado | `tests/routes/confirmation-matrix.spec.tsx`, `tests/hooks/useDeleteAnnouncement.spec.tsx` | zero DELETE | target/consequência irreversível e uma mutation em double-tap | falha mantém detalhe/diálogo/erro; sucesso invalida detalhe, lista e resumo da turma antes de voltar |

Também foram exercitados no teste de matriz os limites negativos do checkpoint: entrar em turma e criar turma não exibem confirmação. `tests/components/ConfirmationDialog.spec.tsx` cobre cancelamento e semântica de pending/busy do componente compartilhado.

## Comandos e resultados

| Superfície | Comando | Resultado |
| --- | --- | --- |
| Matriz T037 | `& '.\\node_modules\\.bin\\jest.cmd' --runInBand 'tests/routes/confirmation-matrix.spec.tsx' 'tests/hooks/useLeaveClassroom.spec.tsx' 'tests/hooks/useUpdateAnnouncement.spec.tsx' 'tests/hooks/useDeleteAnnouncement.spec.tsx'` em `mobile` | PASS — 4 suítes, 12 testes |
| Mobile completo | `npm run test:ci` em `mobile` | PASS — 23 suítes, 54 testes; WARN de `act(...)` no ambiente de teste em `useDeleteClassroom.spec.tsx` e `useLeaveClassroom.spec.tsx`, sem falha funcional |
| TypeScript | `npm run typecheck` em `mobile` | PASS |
| Lint | `npm run lint` em `mobile` | PASS |
| Formatação | `npm run format:check` em `mobile` | PASS |
| Diagnóstico Expo | `npm run doctor` em `mobile` | WARN — 19/21 checks passaram; os dois checks restantes exigem Expo API/React Native Directory e falharam por `fetch failed`/`connect EACCES` do ambiente |
| Whitespace | `git diff --check` | PASS |
| Rota duplicada | `Test-Path -LiteralPath 'mobile/app/(app)/classrooms/[id]/edit.tsx'` | PASS — `False`; editor canônico permanece `True` |

O comando prescrito na tarefa, `npm --prefix mobile run test:ci -- --runTestsByPath ...`, também foi executado e terminou com 4 suítes/12 testes PASS; o npm 11 emitiu avisos de parsing dos argumentos e essa execução reproduziu os avisos de `act(...)`, por isso o Jest direto acima é a evidência limpa do mesmo conjunto.

## Proteção de WIP e limite da fase

`evidence/wip-baseline.md` foi consultado antes da implementação. O hash prévio do detalhe de comunicado foi preservado até T040, quando a alteração prevista foi aplicada; o editor canônico não foi restaurado nem sobrescrito com a duplicata. O worktree estava limpo no início, e a remoção da duplicata ocorreu apenas após os testes do editor correto passarem.

Não houve alteração de backend, OpenAPI, export bundle, acessibilidade visual, workflows CI ou documentação das fases posteriores. Esses gates são `NOT APPLICABLE` ou `NOT RUN` neste checkpoint; a Phase 6 começa em T044 e permanece intocada.
