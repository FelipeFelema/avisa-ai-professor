# Resultados de usabilidade — Phase 7

Data da validação: 2026-09-06 (America/Sao_Paulo)
Escopo: T025, T036, T057–T058; exclusão de turma, edição de perfil e tarefas representativas mobile.

## Resultado

Resultado: `ACCEPTED WITH LIMITATIONS`.

Os proxies automatizados dos fluxos funcionais passaram. Também foi executado um
teste manual individual ponta a ponta, cobrindo registro, login, criação de sala,
comunicados, edição de perfil, edição de comunicados, exclusão de sala e entrada
de usuário em sala. Não houve amostra independente de participantes, portanto os
percentuais e tempos populacionais de SC-002, SC-003 e SC-008 continuam não medidos.
A limitação foi aceita e está registrada em `evidence/phase-7-closure.md`.

## Proxies automatizados executados

| Cenário                                                      | Comando/conjunto                                                                                                                | Resultado                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Exclusão de turma própria com confirmação e navegação segura | `tests/routes/classrooms-list.spec.tsx`, `tests/routes/classroom-details.spec.tsx`, `tests/routes/confirmation-matrix.spec.tsx` | `PASS` dentro do conjunto de 5 suítes/13 testes; cobre owner, confirmação, cancelamento, single-flight e sucesso |
| Edição de nome/e-mail e confirmação                          | `tests/routes/profile-edit.spec.tsx`, `tests/routes/profile.spec.tsx`, `tests/routes/confirmation-matrix.spec.tsx`              | `PASS` dentro do conjunto de 5 suítes/13 testes; cobre diff, no-op, erro e sincronização observável em teste     |
| Tarefas representativas e estados primários                  | `tests/routes/primary-states.spec.tsx` e suíte mobile completa                                                                  | `PASS` — 3 suítes/7 testes de estados T052; 28 suítes/63 testes no total                                         |
| Walkthrough manual individual                              | Teste ponta a ponta no Android realizado pelo responsável pelo produto                                                           | `PASS` funcional — registro, login, sala, comunicados, perfil, exclusão e entrada em sala executados; não mede amostra, primeira tentativa ou percentuais de participantes. |

Execução limpa dos cenários de rota:

```text
.\node_modules\.bin\jest.cmd --ci --runInBand --runTestsByPath tests/routes/classrooms-list.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/profile-edit.spec.tsx tests/routes/profile.spec.tsx tests/routes/confirmation-matrix.spec.tsx
```

Resultado: `PASS` — 5 suítes, 13 testes.

## Critérios mensuráveis

| Critério                                                              | Resultado nesta execução | Por que não foi declarado PASS                                                              |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| SC-002 — >=95% dos participantes concluem exclusão em menos de 45 s   | `NOT MEASURED`           | O walkthrough individual não representa uma amostra de participantes.                       |
| SC-003 — >=95% dos participantes atualizam perfil em menos de 2 min   | `NOT MEASURED`           | Não houve participantes nem sessão populacional cronometrada.                               |
| SC-008 — >=90% concluem tarefas representativas na primeira tentativa | `NOT MEASURED`           | Não houve amostra independente nem registro estatístico de primeira tentativa.               |

## Limitação aceita e follow-up opcional

Não há participantes independentes ou ambiente iOS disponíveis nesta entrega.
Por isso, o teste individual é aceito como evidência funcional de uso ponta a
ponta, mas os critérios populacionais permanecem não medidos. Se esses recursos
estiverem disponíveis em uma entrega futura, repetir a revisão com participantes
que representem professor e responsável, registrando tempo, assistência,
sucesso/abandono e primeira tentativa antes de recalcular SC-002, SC-003 e SC-008.

## Limite de fase

O relatório registra a cobertura automatizada, o walkthrough individual e a
limitação externa de usabilidade. A Phase 8 não foi iniciada.
