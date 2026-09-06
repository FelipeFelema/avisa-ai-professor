# Resultados de usabilidade — Phase 7

Data da validação: 2026-09-05 (America/Sao_Paulo)  
Escopo: T025, T036, T057–T058; exclusão de turma, edição de perfil e tarefas representativas mobile.

## Resultado

Resultado parcial: `WARN` / `NOT RUN`.

Os proxies automatizados dos fluxos funcionais passaram. Não houve sessão com
participantes neste ambiente, então não é possível calcular honestamente os
percentuais de primeira tentativa nem os tempos exigidos por SC-002, SC-003 e
SC-008. T058 permanece desmarcada; esta evidência não transforma timeout de teste
em tempo de tarefa humana.

## Proxies automatizados executados

| Cenário                                                      | Comando/conjunto                                                                                                                | Resultado                                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Exclusão de turma própria com confirmação e navegação segura | `tests/routes/classrooms-list.spec.tsx`, `tests/routes/classroom-details.spec.tsx`, `tests/routes/confirmation-matrix.spec.tsx` | `PASS` dentro do conjunto de 5 suítes/13 testes; cobre owner, confirmação, cancelamento, single-flight e sucesso |
| Edição de nome/e-mail e confirmação                          | `tests/routes/profile-edit.spec.tsx`, `tests/routes/profile.spec.tsx`, `tests/routes/confirmation-matrix.spec.tsx`              | `PASS` dentro do conjunto de 5 suítes/13 testes; cobre diff, no-op, erro e sincronização observável em teste     |
| Tarefas representativas e estados primários                  | `tests/routes/primary-states.spec.tsx` e suíte mobile completa                                                                  | `PASS` — 3 suítes/7 testes de estados T052; 26 suítes/61 testes no total                                         |

Execução limpa dos cenários de rota:

```text
.\node_modules\.bin\jest.cmd --ci --runInBand --runTestsByPath tests/routes/classrooms-list.spec.tsx tests/routes/classroom-details.spec.tsx tests/routes/profile-edit.spec.tsx tests/routes/profile.spec.tsx tests/routes/confirmation-matrix.spec.tsx
```

Resultado: `PASS` — 5 suítes, 13 testes.

## Critérios mensuráveis

| Critério                                                              | Resultado nesta execução | Por que não foi declarado PASS                                                              |
| --------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| SC-002 — >=95% dos participantes concluem exclusão em menos de 45 s   | `NOT RUN`                | Não houve participantes, cronômetro humano ou assistência registrada.                       |
| SC-003 — >=95% dos participantes atualizam perfil em menos de 2 min   | `NOT RUN`                | Não houve participantes nem sessão cronometrada; `waitFor`/tempo do Jest não mede a tarefa. |
| SC-008 — >=90% concluem tarefas representativas na primeira tentativa | `NOT RUN`                | Não houve amostra de participantes nem registro de primeira tentativa.                      |

## Protocolo para fechar o gate humano

Com uma versão do app instalada em iOS e Android, selecionar participantes que
representem professor e responsável, sem treinamento do fluxo. Medir separadamente
o início e fim de cada tarefa, registrar assistência, sucesso/abandono e primeira
tentativa, e preservar apenas métricas agregadas sem dados pessoais. Repetir a
exclusão da turma própria, atualização de nome/e-mail e um conjunto representativo
de login/cadastro, turmas, comunicados e perfil. Calcular os percentuais contra os
limiares de SC-002, SC-003 e SC-008 antes de marcar T058.

## Limite de fase

O relatório registra a cobertura automatizada disponível e o bloqueio externo de
usabilidade. A Phase 8 não foi iniciada.
