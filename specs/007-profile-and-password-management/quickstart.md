# Quickstart: Profile and Password Management

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Date**: 2026-10-02

Guia para validar a implementação futura, não registro de execução. Contrato: [contracts/profile-and-password.md](./contracts/profile-and-password.md); estados/invariantes: [data-model.md](./data-model.md). Suites novas abaixo só existirão após implementação.

## Preparação

- Node.js 22+, dependências existentes backend/mobile; se necessário `npm ci` em cada pacote. Sem pacote novo.
- PostgreSQL local isolado com nome contendo `test`, por exemplo `avisa_ai_test`. Selecionar DATABASE_URL de teste antes de migrate/test; preservar `assertSafeTestDatabase` em `backend/test/helpers/test-database.helper.ts`. Docker Compose existente inicia banco de desenvolvimento `avisa_ai`, que não deve receber cleanup dos testes.
- Reproduzir env de `.github/workflows/backend-ci.yml` com placeholders/segredos locais de teste. Nunca copiar tokens/credenciais reais para evidência. Aplicar migrations existentes; esta feature não gera migration.
- Fixtures para PARENT/PROFESSOR/ADMIN, outra conta com e-mail ocupado, 2+ sessões distintas por conta, sessão expirada/revogada, credencial bcrypt legada e scrypt nova. Testar ASCII/acentos/emojis/espaços significativos e 5/6/72/73 pontos de código; incluir senha com até 72 caracteres e mais de 72 bytes.
- Mobile apontado à API de desenvolvimento via configuração local atual. Android aparelho/emulador para walkthrough; registrar modelo/versão/font scale/AT. Ausência de observação = `NOT MEASURED`.

## Backend: validação dirigida

Em `backend`, com banco isolado já selecionado:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm test -- --runInBand src/common/security/password-hasher.spec.ts src/auth/dto/change-password.dto.spec.ts src/auth/auth.service.spec.ts src/auth/auth.controller.spec.ts src/auth/auth-session.service.spec.ts src/users/users.service.spec.ts src/users/users.controller.spec.ts
npm run test:integration -- --runTestsByPath test/password-change.integration.spec.ts test/auth.integration.spec.ts test/users.integration.spec.ts
npm run test:e2e -- --runTestsByPath test/profile.e2e-spec.ts
npm run test:contract
```

Resultados esperados: senha inteira/compatibilidade legada, contrato fechado, conta/sid server-side, atualização/revogação atômica e tokens atuais preservados. Nova suite HTTP usa `createTestApp`/`configureApp`, incluindo conversão implícita real; testes de DTO isolados não substituem prova de rejeição de números/objetos no endpoint.

Fault injection deve falhar dentro da transação, após escrita e após revogação antes de commit. Conferir hash/timestamps/sessões restaurados no banco real; rejeitar o callback antes de executá-lo não demonstra rollback. Barreira controlada coordena duas trocas e login usando snapshot antigo; evitar sleep probabilístico. Não anexar hashes/segredos à saída de falha das asserções.

## Mobile: validação dirigida

Em `mobile`, após criar as novas suites de senha:

```powershell
npm test -- --runInBand tests/validations/changePassword.schema.spec.ts tests/hooks/useChangePassword.spec.tsx tests/services/auth.service.spec.ts tests/routes/profile-change-password.spec.tsx tests/routes/profile.spec.tsx tests/routes/profile-edit.spec.tsx
npm test -- --runInBand tests/validations/updateProfile.schema.spec.ts tests/hooks/useUpdateProfile.spec.tsx tests/providers/AuthProvider.spec.tsx tests/routes/secondary-navigation.spec.tsx tests/routes/theme-surfaces.spec.tsx tests/accessibility/touch-targets.spec.tsx
```

Reusar `tests/helpers/render.tsx`/providers; não invocar componente com hooks diretamente. Inspecionar QueryClient real, mocks de storage/console e erros sanitizados. Testar hardware/remoção de rota e defaults dos componentes compartilhados, além de disabled visível. Não inserir senha em snapshots/diagnósticos de teste; usar dados sintéticos e assertions booleanas nos pontos sensíveis.

## Matriz de aceitação

| Grupo              | Prova esperada                                                                                                                                             | Requisitos                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Identidade/papel   | PARENT/PROFESSOR/ADMIN: papel no Perfil principal, ausente do editor; role/id/senha/extras rejeitados por HTTP sem write                                   | FR-001–005; SC-001                 |
| Perfil normalizado | Nome/e-mail/conjunto, no-op sem chamada/write, resumo confirmado/cancelado sem perda, conflito preservando estado e sessões                                | FR-005–010; SC-002                 |
| Sessões de e-mail  | Nome-only/no-op preservam todos; e-mail preserva sid atual e invalida access/refresh dos outros; falha intermediária faz rollback                          | FR-008–010/021/028; SC-002/010     |
| Rota/campos        | Ação separada; exatamente três labels, entrada protegida/finalidade acessível                                                                              | FR-011/012; SC-009                 |
| Validação          | Vazios/tipos/extras, 5/6/72/73 pontos de código, emojis/>72 bytes, espaços/caixa exatos, divergência e igualdade; cliente e servidor                       | FR-013–018; SC-004                 |
| Senha incorreta    | 400 recuperável no campo atual, zero write/revoke/refresh; mesma senha/confirm divergente também não alteram                                               | FR-015–018/026; SC-004             |
| Troca válida       | Nova autentica, antiga recusa, hash seguro/sem resposta secreta; sessão atual opera com mesmos tokens, outras access/refresh 401                           | FR-017–022; SC-003/005             |
| Rollback           | Falha depois de write/depois de revoke restaura credencial/timestamps/sessões; login antigo permanece válido                                               | FR-019/026; SC-006                 |
| Races              | No máximo uma troca vence por snapshot; sid revogado/expirado não grava; login com snapshot antigo não cria sessão tardia utilizável                       | FR-017/019–022/028; SC-005/006/010 |
| Pending            | Toques simultâneos = uma operação; feedback busy, campos/envio/Voltar/back/gesto bloqueados; expiração segue redirecionamento                              | FR-025/028; SC-007/010             |
| Memória/erro       | Sem credenciais em respostas, logs, AuthUser, storage, queries/mutations ou objetos de erro retidos; limpar após sucesso/abandono/expiração, reabrir vazio | FR-023/024/026; SC-008             |
| UX/temas           | Tema dinâmico preserva edição/erro; teclado, largura estreita, fonte ampliada, labels/foco/targets                                                         | FR-027; SC-009                     |
| Regressão/contrato | Cadastro/login legado e novo, refresh/logout, identidade/tema, turmas/comunicados; Swagger/canônico iguais, schema sem migration                           | FR-028/029; SC-010                 |

Medir custo de scrypt/latência em ambiente registrado; verificar erro de memória/custo seguro sem downgrade para hash fraco. Não impor SLA inventado. Timeout/rede após commit pode produzir resultado indeterminado: nenhuma repetição automática de domínio ou afirmação de que credencial anterior foi mantida sem verificar o resultado.

### Benchmark local reproduzível (Phase 5)

Em `backend`, com `DATABASE_URL` já selecionando o PostgreSQL local isolado e `NODE_ENV=test`:

```powershell
node -r ts-node/register test/profile-password.benchmark.ts
```

O script verifica `assertSafeTestDatabase`, cria e remove somente suas oito contas sintéticas e mede derivação, verificação e HTTP real com concorrência 1/2/4/8, três ondas por nível. A saída contém somente ambiente, contagens, tempos e RSS. JWT, validação e transação são reais; o limite por IP é substituído apenas neste benchmark, pois seu funcionamento é comprovado pela suite de aceitação. O tempo do callback sob lock exclui espera pela aquisição e commit. A primeira onda revoga a segunda sessão; ondas seguintes medem o mesmo caminho com essa sessão já revogada. RSS é do processo completo, não memória isolada do scrypt; a sonda negativa de memória restringe apenas uma chamada nativa sintética a 1 MiB, sem alterar a configuração adotada. Amostras pequenas e localhost não representam carga, rede ou SLA de produção.

## Gates completos de implementação

Em `backend`, banco isolado:

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

Na raiz, `git diff --check`. Workflows existentes permanecem merge gate; registrar resultados reais/falhas preexistentes sem corrigir WIP fora de escopo. Não executar suites destrutivas contra banco de desenvolvimento. Não declarar gates aprovados a partir deste guia.

## Walkthrough Android

Com API/fixtures de desenvolvimento e dispositivo disponíveis, em `mobile`:

```powershell
npm run android
```

1. Em cada papel, verificar identidade/papel no Perfil e ações Editar perfil/Alterar senha/Sair. Editor contém somente Nome/E-mail. Confirmar/cancelar mudança, no-op e conflito, sem perda de valores ou logout.
2. Abrir senha e conferir três campos protegidos vazios. Validar obrigatórios, tamanho, senha igual e confirmação divergente, espaços/caixa significativos e senha atual incorreta recuperável.
3. Com duas sessões, concluir troca em A. Conferir sucesso, limpeza e continuidade dos tokens atuais; B perde access e refresh. Novo login aceita nova senha e recusa antiga. Guardar apenas resultado, nunca valores/tokens/hash.
4. Simular latência: tocar Salvar repetidamente, tentar Voltar/back/gesto e observar pending sem cancelamento fictício. Após erro conhecido, corrigir/repetir; após timeout indeterminado, não pressupor rollback. Expiração continua fluxo de autenticação.
5. Abandonar/reabrir antes de enviar: nenhum valor restaurado. Repetir sucesso e sessão expirada; senha não aparece em Perfil ou preferências.
6. Claro/Escuro, teclado aberto, largura estreita, texto ampliado, foco/ordem de leitura/erros e actions alcançáveis. TalkBack quando disponível. iOS/VoiceOver e participantes exigem evidência própria.
7. Regressão de tema persistido/logout, login/cadastro/refresh, turmas e comunicados, mantendo permissões e navegação.

## Registro e auditoria futuros

Na implementação, criar `specs/007-profile-and-password-management/evidence/profile-password-validation.md` com cenário/comando, ambiente, resultado, limite e observação. `PASS/WARN/FAIL/NOT RUN` para checks; `NOT MEASURED` para manual indisponível. Export/Jest/Doctor não provam ergonomia em dispositivo.

Auditar FR-001–029/SC-001–010 contra implementação/testes/contratos/evidência. Confirmar ausência de migration/pacote/exclusão de conta e preservação de WIP. Este planejamento não cria evidência de execução, tasks marcadas ou implementação.
