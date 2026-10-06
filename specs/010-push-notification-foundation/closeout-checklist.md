# Fechamento da Spec 010 — checklist preparado

Data: 2026-10-06. Este documento prepara a avaliação; não fecha T073/T074 nem afirma execução dos comandos abaixo. O proprietário já iniciou manualmente a segunda build preview com a correção do loop/429. Não gerar outra build nem alterar seu runtime, configuração ou dependências.

## Evidência que falta para T073

Executar o [walkthrough T073](walkthrough-t073.md) no APK efetivamente instalado. O health já relatado não cobre os passos de push. Registrar data, executor proprietário, build instalada, ambiente Android/backend local e resultado por cenário, sem identificadores privados ou segredos.

| Cenário ainda sem relato                | Evidência esperada                                                                                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Abertura, login e Perfil → Notificações | App utilizável, sem prompt espontâneo; estado inicial e explicação apresentados.                                                                                                                                                     |
| Ativar e responder à permissão          | Escolha explícita; resposta real do Android, inclusive permissão já concedida se for o caso.                                                                                                                                         |
| Confirmação do vínculo                  | Estado ACTIVE e conta/instalação atual; registrar tempo até confirmação para avaliar SC-005 (até 2 min), se efetivamente medido. Recusa/indisponibilidade deve ter orientação acionável. Sem medição, não afirmar o limite temporal. |
| Enviar teste / feedback do backend      | Resultado real: aceito, recusado, falha ou indeterminado. Não copiar token, capability ou ticket privado para evidência.                                                                                                             |
| Foreground e background viável          | Conteúdo neutro, apresentação única e retorno pelo toque à área de notificações; registrar cada exibição observada ou sua ausência. Aceite e receipt positivo não comprovam exibição.                                                |
| Cooldown / pendência                    | Nova intenção antes da liberação bloqueada ou limitada com feedback; nenhum envio duplicado intencional.                                                                                                                             |
| Desativar e retornar                    | Opt-out mantido ao retornar à tela/foreground; não confundir com revogação da permissão no Android.                                                                                                                                  |
| Logout e retorno/login                  | Reconciliação sem vínculo residual da conta anterior ou reativação espontânea. Sem rede, registrar somente se viável; variações restantes têm automação.                                                                             |
| Temas e navegação                       | Conferir Claro/Escuro, labels/feedback e navegação existente no mesmo walkthrough individual viável.                                                                                                                                 |

Usar `PASS (user-reported)` somente nos cenários relatados; FAIL e NOT RUN continuam explícitos. SC-006 permite registrar aceite sem exibição observada, sem inventar sucesso. Uma falha deve ser localizada por camada antes de qualquer mudança de código. Não exigir frota de aparelhos, campanha iOS/Android especializada, leitores de tela ou participantes independentes.

## O que falta para T074 além do walkthrough

1. **Gate de dependências:** avaliar/resolver o Doctor 20/21 após o checkpoint físico e com autorização para eventuais atualizações. Único check falhando: alinhamento com o SDK; `expo` 57.0.26 → ~57.0.27, `expo-constants` 57.0.20 → ~57.0.21, `expo-linking` 57.0.11 → ~57.0.12, `expo-notifications` 57.0.21 → ~57.0.22 e `expo-router` 57.0.24 → ~57.0.25. Não ocultar o check ou declarar dispensa. Os quatro testes do provider já não são uma falha pendente: a correção de harness e o gate completo aprovado estão registrados separadamente.
2. **Resultado do artefato:** registrar sucesso/falha final da build atual, APK instalado e configuração efetivamente testada. Upload e export não substituem build concluída. Se um ajuste futuro modificar runtime/dependências, evidência do APK atual não valida automaticamente o novo runtime; uma nova build exige autorização própria.
3. **Gates finais locais:** executar os scripts oficiais abaixo sobre o estado que será submetido, registrar exit codes, cobertura, ambiente e eventuais falhas/repetições. Os passes de 05/10 e do harness em 06/10 têm datas e escopos diferentes; não apresentá-los como nova execução integral.
4. **CI aplicável:** Backend CI/Mobile CI permanecem gates remotos sem execução neste trabalho local. Quando o usuário autorizar publicação, registrar os resultados reais desses workflows. Preparar PR não autoriza push/PR/dispatch, e um passe local não prova CI remoto.
5. **Consolidação documental:** atualizar a matriz FR-001–030 / SC-001–010 em `final-validation.md` com referências atuais, qualificações de SC-005/006 e resultados de regressão (auth, conta, convites, turmas e comunicados; sem notificações de negócio). Conferir contrato canônico/runtime, migração aditiva e recuperação por desabilitação preservando tabelas. A migration real já foi aplicada; não reaplicá-la nem executar rollback destrutivo para produzir evidência.
6. **Escopo e privacidade da entrega:** revisar o conjunto final de arquivos da 010, manter ausentes os arquivos da 011, cujo WIP anterior já foi removido, confirmar ausência de credenciais/ambientes privados e preservar a evidência da inspeção do upload. Consolidar provisionamento EAS/FCM e backend sem valores privados.

## Sequência de fechamento

- [ ] Obter o resultado da build atual e instalar seu APK; não gerar outra automaticamente.
- [ ] Executar e registrar o walkthrough individual, com distinção entre aceite, handoff e exibição.
- [ ] Diagnosticar eventuais falhas antes de decidir alterações; preservar a identificação do APK testado.
- [ ] Avaliar Doctor e autorizar separadamente eventual correção de dependências.
- [ ] Executar os gates finais e consolidar FR/SC, contratos, migration/recovery e evidências.
- [ ] Revisar o escopo do diff e o rascunho do PR; publicação depende de pedido do usuário.
- [ ] Registrar CI remoto quando houver publicação autorizada, sem antecipar PASS.
- [ ] Avaliar T073/T074 somente com suas evidências e gates aplicáveis; não marcar nesta preparação.

## Comandos finais — somente depois do walkthrough

Usar uma sessão PowerShell separada da operação do backend. Não copiar o `.env` real para configurar suites. As credenciais abaixo são as fixtures públicas de teste já usadas no quickstart; ajustar a conexão privada se necessário, mantendo obrigatoriamente destino local `avisa_ai_test`. Os testes continuam protegidos pelos helpers `assertSafeTestDatabase`.

Backend:

```powershell
Set-Location 'C:\src\avisa-ai-professor\backend'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/avisa_ai_test'
$env:NODE_ENV = 'test'
$env:JWT_ACCESS_SECRET = 'test_access_secret'
$env:JWT_REFRESH_SECRET = 'test_refresh_secret'
$env:EXPO_PUSH_ENABLED = 'false'

$pushCloseoutTestUri = [Uri]$env:DATABASE_URL
if ($pushCloseoutTestUri.Scheme -notin @('postgresql', 'postgres') -or
    $pushCloseoutTestUri.Host -notin @('localhost', '127.0.0.1') -or
    $pushCloseoutTestUri.AbsolutePath -ne '/avisa_ai_test') {
  throw 'Use exclusivamente PostgreSQL local avisa_ai_test.'
}

npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:cov
npm.cmd run test:integration
npm.cmd run test:contract
npm.cmd run test:e2e
npm.cmd run build
```

`prisma:migrate:deploy` acima é apenas para o banco isolado de teste; não executá-lo nas suites com `avisa_ai`. Parar no primeiro comando com exit code diferente de zero e registrar o resultado; não interpretar o sucesso do comando seguinte como recuperação automática do gate anterior.

Mobile:

```powershell
Set-Location 'C:\src\avisa-ai-professor\mobile'
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
npm.cmd run test:ci
npm.cmd run doctor
npm.cmd run export:ci
```

Com os cinco patches atuais, o Doctor permanece esperado como pendente até reavaliação; não executar `expo install` ou alterar lockfiles para esconder esse fato durante a espera. O export all-platform é validação automatizada e não assina APK nem comprova entrega de push.

Revisão final, sem staging:

```powershell
Set-Location 'C:\src\avisa-ai-professor'
git diff --check
git status --short
git diff --stat
```

`git diff` não inclui conteúdo dos arquivos ainda sem rastreamento; revisar também esses arquivos conforme [git-scope-review.md](git-scope-review.md). Em checkout limpo de CI, os workflows usam `npm ci` antes dos mesmos gates; nenhum install/upgrade foi executado nesta preparação.
