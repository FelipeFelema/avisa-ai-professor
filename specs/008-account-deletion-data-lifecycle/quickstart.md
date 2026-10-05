# Quickstart: Account Deletion Validation

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Spec**: [spec.md](./spec.md) | **Contract**: [contracts/account-deletion.md](./contracts/account-deletion.md) | **Model**: [data-model.md](./data-model.md)

Guia reutilizável para configurar o banco isolado, reproduzir os gates automatizados e executar a matriz de aceitação da Spec 008. A implementação está concluída; resultados medidos e limitações atuais estão em [validation.md](./validation.md), [backend-validation.md](./backend-validation.md), [mobile-validation.md](./mobile-validation.md) e nos registros manuais abaixo. A matriz descreve o comportamento esperado; este arquivo sozinho não é evidência de execução.

## Prerequisites

- Node.js 22+, dependências dos lockfiles, PostgreSQL 15+ local e cliente psql/Docker.
- `backend/.env.example` e `mobile/.env.example` como referência; usar segredos apenas locais e não incluir tokens/senha em evidência.
- Banco exclusivo `avisa_ai_test`. O Docker Compose cria `avisa_ai`; criar o banco de teste separadamente e nunca executar fixtures destrutivas no banco de desenvolvimento.
- Todos os helpers de integração/E2E chamam `assertSafeTestDatabase` antes de cleanup. Helpers/barreiras da spec 007 podem servir de referência, sem tornar a capacidade dependente dela.
- Android/emulador com contas descartáveis e mobile apontando à API `/api/v1`; segundo dispositivo/sessão para revogação. Validar iOS/VoiceOver separadamente se executado.

## Environment setup

Na raiz do repositório, subir PostgreSQL conforme o ambiente local:

```powershell
Set-Location 'C:\src\avisa-ai-professor'
docker compose up -d postgres
```

Se o banco de teste ainda não existir, no ambiente Compose padrão:

```powershell
docker exec avisa-ai-db psql -U postgres -d postgres -c 'CREATE DATABASE avisa_ai_test;'
```

Criar somente uma vez; se já existir, usar o existente. Em `backend`, selecionar explicitamente o banco e conferir destino antes de migrations ou testes:

```powershell
Set-Location 'C:\src\avisa-ai-professor\backend'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/avisa_ai_test'
$env:JWT_ACCESS_SECRET = 'local_test_access_only'
$env:JWT_REFRESH_SECRET = 'local_test_refresh_only'
$env:NODE_ENV = 'test'
$testDatabaseTarget = [Uri]$env:DATABASE_URL
if ($testDatabaseTarget.Host -notin @('localhost', '127.0.0.1') -or $testDatabaseTarget.AbsolutePath -ne '/avisa_ai_test') {
  throw 'Selecione o banco local avisa_ai_test antes de continuar.'
}
npm ci
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
```

Esperado: schema/migrations atuais aplicados; nenhuma migration nova da 008. URLs acima são exemplos do Compose local, não credenciais de produção. Não executar reset/migrate dev sobre banco com dados pessoais.

## Automated validation after implementation

Backend, primeiro testes relevantes e depois gates completos:

```powershell
npm test -- --runInBand --runTestsByPath src/users/account-deletion.service.spec.ts src/users/users.controller.spec.ts src/auth/auth.service.spec.ts src/auth/auth-session.service.spec.ts src/classrooms/classrooms.service.spec.ts
npm run test:integration -- --runTestsByPath test/account-deletion.integration.spec.ts test/auth.integration.spec.ts test/classrooms.integration.spec.ts
npm run test:e2e -- --runTestsByPath test/account-deletion.e2e-spec.ts
npm run format:check
npm run lint
npm run typecheck
npm run test:cov
npm run test:integration
npm run test:contract
npm run test:e2e
npm run build
```

Nomes novos são alvos planejados; ajustar nomes derivados em tasks sem perder a matriz abaixo. Testes de DTO também devem integrar a suíte unitária. Esperado: rollback/races em PostgreSQL real, HTTP/status/schema exatos, contratos antigos preservados; exit 0 nos gates.

Mobile:

```powershell
Set-Location 'C:\src\avisa-ai-professor\mobile'
npm ci
npm test -- --runInBand --runTestsByPath tests/validations/deleteAccount.schema.spec.ts tests/hooks/useDeleteAccount.spec.tsx tests/routes/profile-delete-account.spec.tsx tests/lib/api-session.spec.ts tests/providers/AuthProvider.spec.tsx
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run test:ci
npm run export:ci
```

Incluir service/storage/queries privadas nos testes relevantes. Esperado: nenhuma credencial em caches/errors, DELETE sem replay, histórico protegido, geração antiga sem efeitos e tema intacto. Doctor exige rede quando seus checks dependem de serviços externos; falha de rede não é aprovação nem reprovação funcional do fluxo. Na raiz, concluir com `git diff --check` e auditoria dos arquivos alterados.

## Fixture matrix

Preparar por helpers descartáveis, sem SQL copiado para executar em produção:

| Conta                 | Grafo mínimo                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PARENT A              | Participa em duas turmas de terceiros; duas sessões.                                                                                     |
| PROFESSOR B           | Turma vazia, turma com membros terceiros, anúncios próprios e de terceiros ativos/expirados; participação e autoria em turma preservada. |
| ADMIN C/D             | Duas ADMINs com sessões distintas; também cenário com somente uma ADMIN.                                                                 |
| Papel histórico       | PARENT ou ADMIN com ownership/autoria, mesmo que endpoints vigentes não criem essas relações.                                            |
| Terceiros preservados | Owner externo, membros, autores, sessões, anúncios não vinculados, InviteCode e receipts de outras contas.                               |

Salvar snapshot verificável de todas as tabelas antes de cada tentativa. Comparar conjunto removido e preservado após sucesso/falha, sem coletar senha/hash/token no relatório.

## Acceptance and integrity scenarios

| Cenário                                                                                                         | Resultado esperado                                                                                              | Rastreabilidade                         |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| GET impacto por papel/grafo; zero relações; resumo recarregado                                                  | Contagens atuais incluindo expirados; nenhum id terceiro/ADMIN count/segredo; zero é válido.                    | FR-001–004/014/016/024; US1; SC-006/009 |
| Frase/senha vazia, caixa/espaços/confusables, JSON de tipos errados, extras/id alvo em body/query, senha errada | 400/401 conforme contrato; zero alteração de tabelas/sessões; correção por campo.                               | FR-002/005–007/019; SC-001/009          |
| Cancel/back/blur antes do envio                                                                                 | Conta intacta e valores descartados; nova entrada vazia.                                                        | FR-006/007; US1                         |
| PARENT exclui                                                                                                   | Conta/sessões/participações removidas; turmas/membros/conteúdos alheios preservados.                            | FR-009/010/012/013; SC-002/003          |
| PROFESSOR com turmas/autoria externa exclui                                                                     | Turmas próprias e todos os dependentes removidos; autoria/membership externas removidas; terceiros preservados. | FR-010–014; SC-002/003                  |
| Receipts e InviteCode                                                                                           | Nenhum receipt com owner removido; receipts terceiros e InviteCode intactos.                                    | FR-010/013; SC-002/003                  |
| Último ADMIN e duas ADMINs simultâneas                                                                          | Último recebe 409 sem alterações; concorrência nunca deixa zero ADMINs.                                         | FR-015/016; SC-005                      |
| Papel/relacionamentos/credencial mudam antes do envio                                                           | Grafo/papel atuais aplicados; hash vencido = 409 e zero escrita.                                                | FR-014/016; edge cases                  |
| Novo cadastro com e-mail removido                                                                               | Aceito pelas regras normais; nova identidade/sid, tokens antigos continuam inválidos.                           | FR-018; SC-004                          |
| Tokens de todas as sessões após exclusão                                                                        | GET protegido e refresh recusados; dispositivo se torna não autenticado no próximo acesso.                      | FR-017/021; SC-004                      |
| Falha injetada após cada etapa de delete                                                                        | Snapshot anterior integralmente preservado, inclusive sessões/receipts; erro sanitizado.                        | FR-009/019; SC-005                      |

## Deterministic concurrency scenarios

Usar barreiras/fault injection nos helpers, não sleeps como prova de ordenação. PostgreSQL real, duas conexões/transações, ambos os sentidos de cada race:

1. Duas sessões excluem a mesma conta: uma remoção efetiva, segunda 401; nenhum receipt/órfão.
2. Duas ADMINs excluem: primeira commit, segunda count atualizado e 409; pelo menos uma preservada. Testar também rollback da primeira permitindo avaliação correta da segunda.
3. Login já verificou senha e espera lock: se conta excluiu, não emite sessão utilizável; se login venceu, sessão é removida pela exclusão.
4. Refresh já verificou hash e espera lock: revalida User/sid/hash; ausência/revogação = 401 sanitizado, sem P2025 exposto/upsert. Tokens recebidos tardiamente nunca autorizam após commit.
5. DELETE de turma/receipt concorrente: writer User-first; nenhuma recriação de receipt após exclusão. Idempotência e 403/404 para contas preservadas continuam corretas.
6. Criação de turma/membership/autoria e conteúdo/membro terceiro em turma própria durante exclusão: se confirmados antes, removidos conforme política; se bloqueados até remoção, nunca confirmam referência órfã. Deadlock/timeout, se provocado, reverte integralmente.

Relaciona FR-009/015–017/020 e SC-003–005/007. Medir duração/espera sem registrar credenciais; verificar comportamento perto do timeout mobile, sem presumir SLO novo.

## Mobile races and unknown result

- Toques imediatos antes de rerender → um envio; campos/cancel/back/gesture/hardware bloqueados enquanto pending; expiração ainda redireciona.
- DELETE 401 → nenhuma renovação/reexecução destrutiva; verificar sessão por leitura. Chamadas normais conservam políticas vigentes.
- Simular commit do DELETE e perda da resposta; simular perda antes do processamento; simular operação ainda pendente. Sempre feedback indeterminado até resposta conclusiva; nunca reenviar automaticamente.
- Verificação `invalid` → limpar/login neutro; `valid` → resumo fresco/nova confirmação manual sem alegar rollback; rede/5xx/429/refresh sem resposta → indeterminado.
- Resolver refresh/perfil/restore/query/mutation antigos depois da limpeza → tokens/user/cache continuam vazios. Incluir cancelamento de queries com signal, geração/fila de escrita e callbacks tardios.
- Falha de remoção de uma chave SecureStore → tentar ambas, limpar memória/cache e fechar telas privadas; recuperação segura, sem prometer persistência apagada. Reinício valida sessão no backend antes de mostrar dados.
- Tema Escuro antes → Escuro na autenticação e no reinício; nenhuma outra preferência/dado autenticado preservado.
- Inspecionar MutationCache/QueryCache, erro sanitizado, logs/respostas/params e storage: zero senha/frase digitada/credential ou identificador de terceiro exposto. Constante da frase exibida na UI é instrução, não retorno do formulário.

Relaciona FR-006/008/017/020–023 e SC-004/007–009. Regressão inclui login/cadastro/logout, perfil/senha, tema, turmas/comunicados não envolvidos, convite e idempotência do DELETE de turma.

## Manual walkthrough and evidence

Com fixtures descartáveis, executar PARENT/PROFESSOR/ADMIN elegível e último ADMIN, nos temas Claro/Escuro. Localizar a ação, ler impacto, cancelar e reabrir; depois confirmar exclusão autorizada da fixture. Com teclado aberto/texto ampliado/TalkBack, verificar leitura/foco/erros, ações alcançáveis, contraste visual e anúncios de pending. Medir o roteiro sem explicar quais dados serão removidos: objetivo de até dois minutos (SC-006).

Testar segunda sessão, back/deep link/reinício após remoção e preservação de tema. Registrar aparelho/SO, escala, tema, AT, cenário, resultado, duração e evidência sem dados sensíveis. Não atribuir observações iOS/VoiceOver a um teste Android.

| Evidência na etapa atual                                   | Estado                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Planejamento/inspeção e implementação da Spec 008          | Realizados; consultar os checkpoints e limites observados nos relatórios de validação.                  |
| Gates/testes/benchmarks automatizados                      | Executados; comandos e resultados em `backend-validation.md`, `mobile-validation.md` e `validation.md`. |
| Android/aparelho/teclado/texto ampliado/contraste/TalkBack | NOT MEASURED                                                                                            |
| Compreensão/duração de dois minutos                        | NOT MEASURED                                                                                            |
| iOS/VoiceOver                                              | NOT RUN / NOT MEASURED                                                                                  |

Atualize os relatórios com comando/exit e observações reais ao repetir os gates ou executar os roteiros manuais. Export, Doctor e testes unitários não substituem walkthrough. Os roteiros Android e de acessibilidade permanecem abertos até haver observações de aparelho/tecnologia assistiva.
