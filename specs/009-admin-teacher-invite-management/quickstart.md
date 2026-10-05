# Quickstart Validation: Admin Teacher Invite Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Date**: 2026-10-04 | **Plan**: [plan.md](./plan.md) | **Contract**: [teacher-invites.md](./contracts/teacher-invites.md) | **Model**: [data-model.md](./data-model.md)

Guia reprodutível para validar a implementação da Spec 009. A emenda constitucional foi revisada e ratificada em 2026-10-04. Os resultados atuais estão em `backend-validation.md`, `mobile-validation.md` e `validation.md`; export, testes automatizados e verificações locais não substituem evidência de CI ou walkthrough nativo.

## Prerequisites

- Checkout/branch `009-admin-teacher-invite-management`; Node.js 22+, npm e PostgreSQL 15+.
- Dependências e migrations existentes instaladas; nenhum schema/migration novo previsto para 009.
- Banco isolado local **avisa_ai_test**, acessível por configuração privada fora dos artefatos; nunca usar `avisa_ai` para integração/e2e.
- `backend/test/helpers/test-database.helper.ts::assertSafeTestDatabase` deve continuar ativo e recusar hostname/nome não seguros.
- ADMIN de testes provisionado por helper Prisma com hash existente e login HTTP; PARENT/PROFESSOR próprios de teste. Nenhum ADMIN por registro público. Não usar credenciais reais ou escrever códigos operacionais em fixtures/evidência.
- `mobile` usa a dependência `expo-clipboard` compatível com o SDK, instalada via `npx expo install expo-clipboard` e registrada no package-lock.

## Backend commands

Da raiz, em uma única sessão PowerShell. Antes de migrations/testes, informar por configuração local privada um DATABASE_URL de teste, sem imprimi-lo. O bloco exige o nome exato e preserva o override em todos os comandos seguintes:

```powershell
Set-Location -LiteralPath 'C:/src/avisa-ai-professor/backend'
if (-not $env:DATABASE_URL) { throw 'Configure DATABASE_URL para avisa_ai_test.' }
$inviteTestDbUri = [Uri]$env:DATABASE_URL
if ($inviteTestDbUri.Scheme -notin @('postgresql', 'postgres') -or
    $inviteTestDbUri.Host -notin @('localhost', '127.0.0.1', '[::1]', '::1') -or
    $inviteTestDbUri.AbsolutePath.Trim('/') -ne 'avisa_ai_test') {
  throw 'Use somente o banco local isolado avisa_ai_test.'
}
$env:NODE_ENV = 'test'
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run format:check
npm run lint
npm run typecheck
npm run test:cov
npm run test:integration
npm run test:contract
npm run test:e2e
npm run build
```

Verificar exit code de cada comando e interromper a sequência em qualquer falha. Segredos JWT de teste são definidos fora da documentação como na configuração existente; não usar produção. Os scripts integração/e2e executam limpeza destrutiva apenas no banco de teste com helper de segurança.

Para investigar isoladamente, depois que os arquivos planejados existirem:

```powershell
npm run test:integration -- --runTestsByPath test/invite-codes.integration.spec.ts
npm run test:e2e -- --runTestsByPath test/invite-codes.e2e-spec.ts
```

Esses alvos não substituem gates completos. `Backend CI / Run backend checks` é o merge gate do componente.

## Backend acceptance matrix

| Cenário                                                                                                | Resultado esperado                                                                             | Cobertura                  |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------- |
| ADMIN válido envia role PROFESSOR                                                                      | 201, PROFESSOR, ativo na criação, delta exato de sete períodos de 24h, no-store                | FR-001–010; SC-001/002     |
| Sem token, expirado, revogado, conta removida, sessão sem vínculo                                      | 401, zero registros, nenhuma metadata                                                          | FR-002/003/016; SC-001     |
| PARENT/PROFESSOR ou ADMIN rebaixado com JWT anterior                                                   | 403, zero registros, sem detalhes administrativos                                              | FR-002/003; SC-001         |
| Mudança de papel/revogação entre guard e transação                                                     | Revalidação bloqueia criação quando mudança precede ponto de autorização                       | FR-002/016                 |
| ADMIN/PARENT/desconhecido, null, tipos incorretos, role ausente, arrays/body inválido, extras/validade | 400, zero registros; não converter/ignorar, não ecoar valores                                  | FR-005/006; SC-003         |
| Colisão de code forçada e sucesso posterior                                                            | Um registro novo, novo segredo, até três transações; sem P2002 bruto/log secreto               | FR-007/021                 |
| Três colisões forçadas / outra falha de persistência                                                   | 503 sanitizado por colisão ou erro interno sanitizado; zero criação nova nos casos de rollback | FR-007/021                 |
| Consumir PROFESSOR válido                                                                              | Um cadastro PROFESSOR, isActive=false após commit                                              | FR-017/025; SC-004         |
| Duas tentativas concorrentes, mesmo code, e-mails diferentes                                           | Um sucesso, outro 400 genérico, uma única conta nova                                           | FR-017; SC-004             |
| Inexistente/inativo/expirado/usado/ADMIN histórico                                                     | Mesmo 400 genérico; zero conta e sem mudar ADMIN histórico                                     | FR-018–020; SC-004         |
| Vencimento exatamente no consumo e enquanto espera lock                                                | Recusa estrita; teste controla boundary e espera real, sem flakiness baseada apenas em sleep   | FR-008/017; SC-004         |
| Fuso de sessão PostgreSQL diferente de UTC                                                             | Mesmo instante absoluto de validade; conversão UTC explícita funciona                          | FR-008/010/017             |
| Falha de User.create / unique de e-mail concorrente                                                    | Rollback do consumo; convite permanece utilizável se ainda dentro do prazo                     | FR-017/025                 |
| Segundo convite e ADMIN históricos existentes                                                          | Primeiro não revogado; históricos não expostos nem consumidos/reativados                       | FR-013/019                 |
| PARENT sem código e PROFESSOR legado válido                                                            | Fluxos preservados; sem exigir formato novo para código legado no registro                     | FR-025; SC-009             |
| Swagger/runtime/baseline                                                                               | Request fechado, enum PROFESSOR, expiresInDays removido, respostas/header/erros coerentes      | FR-005/006/009; SC-003/009 |

Unitários devem cobrir DTO/controller/service e `UsersService`; concorrência/rollback exigem PostgreSQL real e HTTP conforme o limite testado. Fixture de ADMIN fora do registro não dispensa login/autorização reais. Revisar regressões de `classrooms.integration`, `users.integration`, `profile.e2e`, `account-deletion.e2e` e demais fixtures encontradas.

Inspecionar logs capturados em memória e mappers usando sentinela secreta apenas de teste; nenhum erro/log inclui code, body, response, config Axios, erro Prisma ou Zod bruto. Não versionar saída/snapshot com código emitido pelo sistema, nem exportar dumps do banco.

## Mobile commands

```powershell
Set-Location -LiteralPath 'C:/src/avisa-ai-professor/mobile'
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
npm run doctor
npm run export:ci
```

Verificar cada exit code antes do próximo comando. Repetir Expo Doctor com acesso à rede se falhar por conectividade, sem alegar PASS a partir de falha de rede. `Mobile CI / Run mobile checks` é o merge gate; export não prova clipboard nativo ou tecnologia assistiva.

## Mobile acceptance matrix

| Cenário                                        | Resultado esperado                                                                                 | Cobertura              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| Perfil por papel e deep link                   | Apenas ADMIN vê/acessa; demais vão ao fluxo permitido, sem resultado                               | FR-001–004; SC-001     |
| Foco/resume e perfil ainda verificando/offline | Ações bloqueadas, segredo oculto; nunca gerar pela leitura de perfil                               | FR-002/016/022         |
| Geração com toques repetidos                   | Ref bloqueia antes de novo render; um único POST por ação                                          | FR-014; SC-006         |
| 401/403 / troca de usuário ou papel            | Limpa resultado/feedback e ignora respostas antigas; expireSession explícito no 401                | FR-016/022; SC-007     |
| Timeout/5xx/cancelamento/malformed response    | Sem retry/refetch/replay de POST; feedback de incerteza; preserva anterior autorizado              | FR-014/015; SC-006     |
| Validar resultado                              | Rejeita role/estado/formato/datas/delta incompatíveis; erro não contém resposta secreta            | FR-009/021             |
| Copiar true/false/throw e múltiplos toques     | Só string exata; sucesso ou erro acessível; nenhuma geração por cópia                              | FR-011/012; SC-005/006 |
| Web com clipboard limitado                     | Fallback selecionável; nenhuma leitura HTTP entre gesto e setStringAsync                           | FR-012/024             |
| Gerar outro com sucesso/falha                  | Aviso não revoga anterior; substitui somente no sucesso                                            | FR-013/015             |
| Blur/unmount/logout/restart/late response      | Zero reaparições; storage, query e mutation cache não contêm código                                | FR-021/022; SC-007/008 |
| Vencimento e fuso local                        | Data/hora local correta, prazo encerrado atualiza no timer/resume; sem afirmar consulta de consumo | FR-008/010/017         |
| Temas e texto ampliado/feedback                | Código/data legíveis e sem truncamento; labels/disabled/busy e feedback independente de cor        | FR-023/024             |

Alvos cobertos: `tests/services/teacher-invite.service.spec.ts`, `tests/hooks/useTeacherInvite.spec.tsx`, `tests/routes/admin-teacher-invites.spec.tsx`, `tests/routes/auth-session-boundary.spec.tsx` e `tests/validations/teacherInvite.schema.spec.ts`; as regressões de Perfil, `api-session`, cadastro e temas também fazem parte de `test:ci`. Não armazenar segredo em snapshots ou query/mutation cache para facilitar testes.

## Manual walkthrough and evidence

1. Em ambiente isolado com ADMIN, abrir Perfil → Convites de professores, gerar e copiar. Cronometrar da procura pela área até confirmação de cópia; alvo até 60 segundos (SC-005).
2. Colar em campo temporário local e comparar exatamente com exibição, sem publicar código ou screenshot. Cadastrar PROFESSOR com ele; confirmar um segundo cadastro recusado e nenhuma conta ADMIN criada.
3. Gerar outro deliberadamente e testar anterior ainda disponível se não consumido; simular falha de geração e verificar preservação. Exercitar falta de rede/resultado incerto sem reenvio automático e falha/restrição de clipboard com fallback.
4. Sair da rota, logout/reiniciar/trocar conta e rebaixar papel pelo fixture de teste; verificar segredo limpo e resposta tardia descartada. Conteúdo do clipboard do SO pode permanecer por decisão do SO, sem limpeza automática.
5. Verificar Claro/Escuro, texto ampliado, orientação/fuso e vencimento; testar TalkBack no Android e VoiceOver no iOS, incluindo foco/leitura do código selecionável, busy/disabled e anúncio de sucesso/erro sem segredo automático. Testar web clipboard/fallback separadamente.

Registrar data, plataforma/device/OS, app build, executor, duração e resultados sem códigos. Distinguir `PASS (automated)`, `PASS (user-reported)`, `PASS (manual measured)`, `FAIL` e `NOT MEASURED`; um relato funcional Android não comprova TalkBack/iOS. Nenhuma dessas evidências já existe pelo simples fato de planejar.

## Completion criteria

Emenda constitucional revisada resolvida; matrizes e regressões aplicáveis passam; runtime OpenAPI/baseline/README consistentes; nenhum segredo nas superfícies inspecionadas; gates CI passam e evidência manual mantém sua proveniência. Em planejamento, validar apenas estrutura/links/formatação dos artefatos; não marcar implementação ou native/AT como concluídas.
