# Fechamento da Spec 010 — checklist atual

Data: 2026-10-06. **T073 concluída como PASS (user-reported); T074 consolidada localmente e aberta somente pelo CI remoto NOT RUN.** Todos os gates finais locais passaram após adapter e cinco patches Expo; Doctor 21/21. Triagem de segurança aceita e registrada em [final-validation.md](final-validation.md). Nenhuma alteração adicional de runtime/dependências pelo agente, nova build, commit ou publicação. A 011 permanece no mesmo stash.

## T073 concluída / limites preservados

Roteiro viável integral relatado em [walkthrough-t073.md](walkthrough-t073.md), sem inventar medições: tempo de ativação e instante exato de background NÃO MEDIDO. O APK testado fisicamente é a segunda build corrigida anterior ao alinhamento dos patches; não afirmar novo APK/walkthrough após o alinhamento. Gate atual confirma regressões automatizadas. ID/URL desse segundo APK não informado; não usar o ID da primeira como substituto.

## T074: resultado atual

- **Gates locais PASS:** Prisma validate/generate/migrate deploy; backend format/lint/typecheck, 26/318 unitárias com cobertura, 19/176 integração, 1/9 contrato, 6/70 E2E e build; mobile typecheck/lint/format, 82/591 com cobertura, Doctor 21/21 e export Android/iOS/web. Testes com exit 0 natural, sem forceExit/timeouts maiores; PostgreSQL destrutivo somente avisa_ai_test.
- **Triagem aceita:** shell-quote@1.9.0 Critical ausente do bundle Android, DEV/TOOLING ONLY; decode-uri-component@0.2.2 Moderate presente, REMEDIAR NA SPEC 012 sem mitigação completa. Ambas com remediação obrigatória na futura 012. Não executar npm audit fix nem --force na 010; auditoria com advisories não é apresentada como verde.
- **Documentação consolidada:** FR-001–030/SC-001–010, qualificações de SC-005/006, OpenAPI canônico/runtime, migration aditiva preservando fixtures, recovery sem apagar tabelas e regressões atuais em final-validation.
- **Escopo/privacidade PASS:** 236 arquivos de runtime/config preservados byte a byte durante os gates; 558 arquivos rastreados inspecionados, zero correspondências com segredos privados ou arquivos de credenciais/ambiente privado. Stash da 011 preservado e arquivos da 011 ausentes.
- **Única pendência real identificada:** Backend CI/Mobile CI remotos NOT RUN. Registrar resultados reais quando publicação for autorizada; sem dispensa ou PASS inventado. T074 permanece aberta até esse gate.

## Sequência de fechamento

- [x] Instalação/reteste do segundo APK confirmados pelo proprietário; ID/URL não informado.
- [x] Registrar walkthrough individual, separando aceite, receipt e recebimento físico.
- [x] Diagnosticar e corrigir loop/429, parsing do ticket e IAM antes do reteste.
- [x] Registrar triagem aceita e obrigações futuras de remediação, sem audit fix.
- [x] Alinhamento dos cinco patches pelo proprietário e repetição completa com Doctor 21/21.
- [x] Consolidar FR/SC, gates locais, contratos, migration/recovery, escopo e privacidade.
- [ ] Registrar workflows remotos na publicação autorizada.
- [ ] Fechar T074 após CI real aprovado; não restaurar a 011 nesta avaliação.

## Comandos finais — executados nesta avaliação

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

Os cinco patches foram alinhados pelo proprietário e a repetição atual confirmou Doctor 21/21. A triagem aceita proíbe npm audit fix / --force na 010; nenhuma atualização adicional foi feita nesta execução. O export all-platform é validação automatizada e não assina APK nem comprova entrega de push.

Revisão final, sem staging:

```powershell
Set-Location 'C:\src\avisa-ai-professor'
git diff --check
git status --short
git diff --stat
```

`git diff` não inclui conteúdo dos arquivos ainda sem rastreamento; revisar também esses arquivos conforme [git-scope-review.md](git-scope-review.md). Em checkout limpo de CI, os workflows usam `npm ci` antes dos mesmos gates; nenhum install/upgrade foi executado nesta preparação.
