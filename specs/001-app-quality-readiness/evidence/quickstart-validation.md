# Quickstart validation — T067

Data da execução: 2026-09-09 (America/Sao_Paulo)

Escopo: execução atual de `specs/001-app-quality-readiness/quickstart.md`, usando
somente `avisa_ai_test` e credenciais/usuário descartáveis. Nenhum valor secreto,
token ou conteúdo de `backend/.env` foi registrado. Resultados históricos são
identificados como históricos e não substituem a execução desta validação.

## Resumo

Resultado geral: `WARN — todos os gates automatizados principais passaram, mas há
gates externos/manuais não medidos e vulnerabilidades de dependências a triar`.

## 1. Preparar serviços locais — WARN

Evidência atual:

- `node --version` → `v22.14.0`; `npm --version` → `11.10.1`.
- `docker --version` → `29.6.2`; `docker compose version` → `v5.3.1`.
- `docker compose ps` no acesso final autorizado → `PASS`; o serviço
  `avisa-ai-db` com PostgreSQL 15 estava `Up` e publicava a porta local 5432.
  A primeira tentativa confinada não acessou o Docker Engine. O compose declara
  o banco de desenvolvimento `avisa_ai`; os testes abaixo continuaram apontados
  explicitamente somente para `avisa_ai_test`.
- `backend npm ci` → `PASS`, instalação concluída; npm reportou 13
  vulnerabilidades (2 moderate, 11 high), sem executar `audit fix`.
- `mobile npm ci` → `PASS`, instalação concluída; npm reportou 18
  vulnerabilidades (13 moderate, 5 high), sem executar `audit fix`.
- Ambos os lockfiles permaneceram sem diff. As primeiras tentativas no sandbox
  falharam por `EPERM`/erro interno do npm; a execução final foi feita com
  autorização elevada e terminou com sucesso.
- Backend Prisma, apontando explicitamente para
  `postgresql://postgres:postgres@localhost:5432/avisa_ai_test`:
  `npm run prisma:validate` → `PASS`; `npm run prisma:generate` → `PASS`;
  `npm run prisma:migrate:deploy` → `PASS`, 11 migrations encontradas e zero
  pendentes.

Limite: o compose não define `healthcheck`, portanto `Up` confirma processo e
porta, não um estado Docker `healthy`. A conexão/migration no banco descartável
foi comprovada separadamente pelo Prisma e pelas suítes de boundary.

## 2. Iniciar e descobrir a API — PASS automatizado / NOT MEASURED manual

Foi iniciado temporariamente o backend na porta `3010`, com
`NODE_ENV=development`, `API_DOCS_ENABLED=true`, segredos de desenvolvimento
descartáveis e `DATABASE_URL` apontando somente para `avisa_ai_test`. O processo
foi encerrado após os checks.

Evidência atual:

- `GET /api/v1/health` → `200`, corpo `{"status":"ok"}`.
- `GET /api/v1/docs` → `200` (Swagger UI).
- `GET /api/v1/docs/openapi.json` → `200`, 19 operações e 6 tags.
- Usuário de registro descartável: `POST /auth/register` → `201`; usando o
  token retornado sem registrá-lo, `GET /users/profile` → `200` e
  `PATCH /users/profile` → `200`.
- Servidor separado com `NODE_ENV=production` e `API_DOCS_ENABLED=true`:
  `/api/v1/docs` → `404` e `/api/v1/docs/openapi.json` → `404`.

`NOT MEASURED`: o exercício SC-006 com um desenvolvedor que não implementou a
referência, cronômetro, assistência e screenshots não foi realizado. Os checks
acima são automação/cliente local e não são prova humana de onboarding.

## 3. Gates backend — PASS

Todos os comandos abaixo foram executados em `backend` com o `DATABASE_URL`
descartável `avisa_ai_test`:

| Comando                                   | Resultado atual | Evidência                                                                                                |
| ----------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                    | PASS            | Todos os arquivos conferidos pelo Prettier.                                                              |
| `npm run lint`                            | PASS            | Exit 0, sem diagnóstico.                                                                                 |
| `npm run typecheck`                       | PASS            | `tsc --noEmit`, exit 0.                                                                                  |
| `npm run test:cov -- --runInBand`         | PASS            | 12 suítes, 71 testes; cobertura global 70.8% statements, 60.7% branches, 62.01% functions, 70.63% lines. |
| `npm run test:integration -- --runInBand` | PASS            | 6 suítes, 39 testes; logs de falhas simuladas de rollback eram esperados pelos testes.                   |
| `npm run test:contract`                   | PASS            | 1 suíte, 1 teste OpenAPI.                                                                                |
| `npm run test:e2e -- --runInBand`         | PASS            | 3 suítes, 9 testes.                                                                                      |
| `npm run build`                           | PASS            | Build Nest concluído.                                                                                    |

O `--runInBand` adicional gerou apenas o warning de parsing do npm; não alterou
o resultado Jest. A execução não apontou limpeza ou mutação de `avisa_ai`.

## 4. Gates mobile — PASS

| Comando                | Resultado atual | Evidência / limite                                                                                                                                                                                                                          |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | PASS            | `tsc --noEmit`, exit 0.                                                                                                                                                                                                                     |
| `npm run lint`         | PASS            | `expo lint`, exit 0.                                                                                                                                                                                                                        |
| `npm run format:check` | PASS            | Todos os arquivos conferidos pelo Prettier.                                                                                                                                                                                                 |
| `npm run doctor`       | PASS            | A tentativa final com acesso externo autorizado passou 21/21 checks. A primeira tentativa confinada teve `fetch failed`/`connect EACCES`, classificado somente como limitação de rede.                                                      |
| `npm run test:ci`      | PASS            | 28 suítes, 79 testes; cobertura global 74.07% statements, 72.62% branches, 66.05% functions, 73.26% lines. Warnings React `act(...)` apareceram no console, sem falha de teste.                                                             |
| `npm run export:ci`    | PASS            | Web, iOS e Android foram empacotados com sucesso; o scan do bundle gerado encontrou zero referência a `DATABASE_URL`, secrets JWT, chaves privadas, URL PostgreSQL ou JWT literal. O diretório descartável foi removido após a verificação. |

`npm start`/walkthrough em simulador ou dispositivo não foi mantido aberto nem
executado nesta etapa.

## 5. Exclusão de turma — PASS automatizado / NOT MEASURED manual

Os testes atuais de backend (integração 39/39 e e2e 9/9) e mobile (28/28
suítes, incluindo rotas/hooks de turma) passaram dentro do comando das seções 3
e 4. Eles fornecem evidência automatizada para autorização, `204`, cascatas,
receipt/retry, cancelamento, single-flight, estados e navegação cobertos pelos
testes existentes.

`NOT MEASURED`: os dez passos do walkthrough manual (double-tap em dispositivo,
clientes simultâneos, perda real de resposta e acessibilidade do estado antigo)
não foram repetidos nesta execução. A evidência histórica
`evidence/us1-classroom-deletion.md` não é contada como execução atual.

## 6. Atualização de perfil — PASS automatizado / NOT MEASURED manual

Os testes atuais backend/mobile passaram, e o exercício API descartável da
seção 2 confirmou registro, GET protegido e PATCH protegido (`201/200/200`).

`NOT MEASURED`: não foram executados nesta validação o cenário manual por papel,
dois dispositivos, conflito visual `409`, revogação observada no dispositivo B,
tempo de 2 segundos ou migração legacy em ambiente povoado. A evidência
`evidence/us2-profile-update.md` é histórica.

## 7. Consistência de confirmações — PASS automatizado / NOT MEASURED manual

`npm run test:ci` passou 29 suítes/83 testes, incluindo suites de matriz de
confirmação e hooks de update/delete/leave. Isso prova somente os cenários
automatizados exercitados pelo Jest/RNTL: cancelamento, pending/single-flight,
falha e invalidação conforme coberto pelos testes.

`NOT MEASURED`: não foi realizada a inspeção manual de todas as cinco linhas da
matriz em dispositivo real. `evidence/us3-confirmation-matrix.md` permanece
referência histórica.

## 8. Visual e acessibilidade — WARN / NOT MEASURED cross-platform

Os gates automatizados atuais de mobile (typecheck, lint, format e Jest) estão
registrados nas seções 4 e 7. Não foi realizado nesta execução um novo audit
manual de contraste, touch targets, leitor de tela, texto grande, iOS e Android.

`evidence/accessibility-audit.md` e `evidence/usability-results.md` registram
validação Android/manual anterior com limitações; não são prova atual nem
aprovação cross-platform. Portanto, aprovação de product owner, auditoria iOS,
amostra independente e métricas SC-002/SC-003/SC-008 ficam `NOT MEASURED` nesta
execução.

## 9. Commit e enforcement de merge — PASS local / NOT MEASURED externo

- `npm exec -- commitlint -- --from HEAD~10 --to HEAD --verbose` → `PASS`:
  10 commits, zero problemas e zero warnings.
- Não foi aberta PR descartável nesta validação, e não houve inspeção atual de
  rulesets/branch protection por uma API do GitHub.
- `evidence/github-required-checks.md` é uma declaração/evidência externa
  registrada anteriormente; este documento não a transforma em prova de uma
  nova PR bloqueada.

Assim, a presença local dos workflows e o commitlint não medem novamente
required checks, branch up-to-date, restrição de bypass ou bloqueio efetivo de
merge.

## 10. Checklist de aceitação — WARN / bloqueios explícitos

| Item                                                    | Resultado atual                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Backend e commit workflow/gates locais                  | PASS nos comandos executados; workflows do GitHub não foram disparados nesta validação.                         |
| Mobile gates                                            | PASS: typecheck, lint, formato, Expo Doctor 21/21, 29 suítes/83 testes e export Web/iOS/Android.                |
| Rulesets e PR falha bloqueada                           | NOT MEASURED nesta execução.                                                                                    |
| Deliberate-failure matrix SC-009                        | NOT RUN; não foram introduzidas falhas descartáveis no worktree compartilhado.                                  |
| OpenAPI onboarding por novo desenvolvedor em até 15 min | NOT MEASURED.                                                                                                   |
| Walkthroughs temporizados SC-002/SC-003                 | NOT MEASURED; automação não substitui participantes.                                                            |
| Cancelamentos com zero alterações persistidas           | PASS somente nos testes automatizados atuais; não repetido manualmente.                                         |
| Retry após resposta perdida do DELETE                   | PASS somente na cobertura automatizada atual; não repetido com cliente controlado nesta execução.               |
| Revogação de sessão B após troca de e-mail              | PASS somente na cobertura automatizada atual; não medido em dois dispositivos.                                  |
| Visual foundation e accessibility approval              | WARN/NOT MEASURED cross-platform; histórico Android tem limitações.                                             |
| SC-008 first-attempt task rate                          | NOT MEASURED; exige amostra humana.                                                                             |
| Auditoria de owner migration em ambiente alvo           | NOT MEASURED nesta execução; ver `evidence/owner-migration-audit.md` como evidência externa/histórica separada. |
| Links/evidências para delivery review                   | PARCIAL: este documento e evidências anteriores existem; decisão final pertence ao T068.                        |

Conclusão T067: `DONE_WITH_CONCERNS`. O quickstart foi percorrido até onde o
ambiente permitiu, sem afirmar prova humana, enforcement externo ou export
mobile não observado. T067 não marca `tasks.md`.

---

## Addendum de convergência — T075 (2026-09-09)

O quickstart foi reexecutado após os overrides de dependências e a decisão de
escopo Android-only. Os gates locais passaram: backend Prisma, formato, lint,
typecheck, unitário (12/78), integração (6/46), contrato (1/7), e2e (3/11) e
build; mobile typecheck, lint, formato, Expo Doctor 21/21, Jest 29/83 e export
Web/iOS/Android. O export continua sendo evidência de empacotamento, não de
auditoria humana iOS.

`npm audit --omit=dev --json` foi executado com a autorização registrada para
consultar o registry. Depois dos overrides, o backend ficou com 8 entradas de
produção (8 high) e o mobile com 18 (5 high, 13 moderate). Os advisories
residuais, suas mitigações, owner e prazo estão em `final-readiness.md`.

Para o lançamento inicial, o walkthrough Android do único desenvolvedor é a
evidência humana disponível. Não há participantes independentes nem iOS nesta
iteração; SC-002, SC-003, SC-007 e SC-008 permanecem `NOT MEASURED` nas
dimensões que exigem essas evidências. A decisão é
`ANDROID-ONLY INITIAL RELEASE — ACCEPTED WITH EXPLICIT LIMITATIONS`.
