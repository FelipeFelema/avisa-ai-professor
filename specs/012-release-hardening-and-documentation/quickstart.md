# Quickstart: validação da Spec 012

**Status**: Fases 1–3 concluídas (18/18); logout SEC-001 remediado/retestado. [Checkpoint](evidence/phase1-3-gates.md). Roteiros restantes são futuros/NOT RUN; Fases 4–6 não executadas.

## Pré-requisitos

- Node 22+, dependências resolvidas pelos lockfiles, PostgreSQL isolado no loopback com nome **exato** `avisa_ai_test`, guardas existentes ativas e ambiente test para suites destrutivas.
- Configuração de teste obtida por mecanismo privado existente. Não copiar `.env` dev automaticamente: o exemplo backend aponta para `avisa_ai`, proibido para fixtures/reset.
- Credenciais externas/produção somente por armazenamento privado; Expo bearer/JWT/DATABASE_URL/service account não são dados de evidência pública.
- Matriz de contas/turmas/papéis/sessões/instalações de T004/T005; provider mock para automação; nenhum envio externo durante suites.
- Para smoke: candidato Android **production** identificado por SHA/build ID/hash, API pública HTTPS funcional, migrations/configuração/provider validados e autorização do build externo. Preview/Expo Go/export não substituem esse artefato.

## Guardar o banco antes de comandos destrutivos

Execute no PowerShell de backend, com DATABASE_URL privada de teste já configurada. Este bloco apenas verifica destino; não injeta nem imprime credenciais:

```powershell
Set-Location C:\src\avisa-ai-professor\backend
if (-not $env:DATABASE_URL) { throw 'Configure DATABASE_URL privada de teste primeiro.' }
$releaseTestDbUri = [Uri]$env:DATABASE_URL
if ($releaseTestDbUri.Scheme -notin @('postgresql', 'postgres') -or
    $releaseTestDbUri.Host -notin @('localhost', '127.0.0.1', '::1', '[::1]') -or
    $releaseTestDbUri.AbsolutePath.Trim('/') -ne 'avisa_ai_test') {
    throw 'Destino recusado: use somente loopback/avisa_ai_test.'
}
$env:NODE_ENV = 'test'
```

Manter também `assertSafeTestDatabase` nas suites. Não rodar suites/reset/restore/migration simultaneamente no mesmo banco. Sem migrate reset contra banco real; operações de deploy real exigem runbook/autorização próprios.

## Gates backend

Preparação futura de dependências (não executada agora): `npm ci` em backend e mobile após configurar o ambiente e conferir os lockfiles; não usar atualização automática como setup.

Depois da guarda, executar cada comando e registrar resultado/exit individualmente; parar/analisar falhas antes de alegar PASS:

```powershell
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
npm audit --json
npm audit --omit=dev --json
```

Audit não zero por advisory requer triagem em [dependency-assessment](dependency-assessment.md); falha de rede não é audit limpo. Saída bruta privada antes de sanitizar resumo. Não usar forceExit para mascarar cleanup nem reduzir gates por falha; registrar resultado qualificado e resolver o necessário.

## Gates mobile

```powershell
Set-Location C:\src\avisa-ai-professor\mobile
npm run format:check
npm run lint
npm run typecheck
npm run test:ci
npm run doctor
npm run export:ci
npm audit --json
npm audit --omit=dev --json
```

Export CI all-platform é o gate existente, sem campanha nativa iOS. Para análise Android, no ambiente production candidato com variáveis públicas não secretas já validadas, conferir primeiro as flags em `npx expo export --help` do SDK instalado; comando previsto:

```powershell
$env:EAS_BUILD_PROFILE = 'production'
npx expo export --platform android --no-bytecode --source-maps --output-dir .expo-release-security-export
```

Inspecionar `.expo-release-security-export` como artefato temporário/privado, manter fora do Git e checar secret handling antes de publicar evidência. Demonstrar __DEV__ false, módulos/cadeias/inclusão e configuração resolvida; não inferir ausência por busca textual de nome minificado. Fazer reanálise se código/config/dependencies mudarem.

O perfil production será criado em T041. **Comando futuro externo, somente após autorização da etapa/build**:

```powershell
npx eas-cli build --platform android --profile production
```

Escolher formato/instalação viável no runbook mantendo ambiente/config production. Se o candidato for AAB, validar via trilha/artefato de instalação autorizado; não trocar para preview só para instalar. Não submeter/publicar automaticamente.

## Matriz mínima de cenários

| Grupo | Execução / expectativas | Fonte |
| --- | --- | --- |
| Cadastro/login | PARENT padrão, PROFESSOR só convite válido, nenhum ADMIN público; erro claro, sem internos | unit/integration/E2E e walkthrough individual |
| Refresh/logout/sessão | rotação/replay/expiração/sid; access e refresh revogados recusados; sem acesso após logout | auth integration/mobile session |
| Perfil/senha/exclusão | sucesso próprio, rejeição por conta/papel/ID indevido, cascades/neutralização | users/password/deletion suites |
| Administração/convites | ADMIN atual, demotion/revocation, inputs/abuso e datas/estado | invites E2E/integration |
| Turmas/entrada-saída | busca/join/leave, ownership, turma externa e IDs manipulados | classrooms integration/E2E |
| Comunicados | CRUD por regras atuais, leitura announcementId e isolation, expiração editada | announcements suites |
| Push novo/lembrete | backend deriva destinatário; externo/REVOKED/INVALID zero envio; restart/concurrency e UNKNOWN | fanout/dispatch/reminders/locks/privacy suites |
| Troca de conta | callbacks/cache/refresh/push antigos não contaminam B nem nova sessão A | mobile auth/private/session/push suites |
| Onboarding/intenção | primeiro convite sem prompt; Ativar/Agora não; Perfil; recusa/bloqueio; A→B→A, opt-out/offline/legado/corrupção | US5 tests + walkthrough |
| Production | HTTPS/package/projeto/Firebase/FCM corretos, startup/health, docs indisponíveis, sem teste/debug/UI interna/URL local | production tests + candidato/smoke |
| Recovery | base vazia/upgrade/cascades/órfãos, backup/restore/kill switch/rollback app compatível | rehearsal test DB/runbook |

Não inventar relatos. Smoke individual pode ser feito pelo proprietário: registrar exatamente ações/resultado/build/API/horário, `PASS (user-reported)` por cenário confirmado. Cenário ausente fica NOT RUN; ticket/handoff/configuração não vira prova de receipt real. Sem TalkBack/VoiceOver, amostras, participantes independentes, auditoria física ou campanha especializada como gate.

## CI e fechamento

Somente após autorização Git: executar/obter Backend CI, Mobile CI, Commit Conventions e required checks reais. Feature push sozinho não dispara workflows de push que filtram develop/main; usar PR/dispatch apenas quando autorizado. Registrar run/job/link/head/merge SHA conforme realidade. Fechamento documental publicado recebe checks no novo HEAD; não reaproveitar SHA anterior como prova final.

Reconciliar findings/tasks/docs e [release-gate](release-gate.md). Qualquer blocker real/prova obrigatória faltante impede READY. A decisão final não publica o app nem autoriza outro deploy.

## Preparação do walkthrough individual — bloco 1–3 (T006)

Ainda NOT RUN manual; executor futuro: proprietário, sem requisito de aparelho específico. Usar duas contas/turmas sintéticas isoladas; PROFESSOR A/B, PARENT A/B e ADMIN provisionado somente no test DB. Fixture automatizada: backend/test/helpers/release-security.fixture.ts; sids/instalações distintos, UUID inexistente e ID inválido. Não mostrar tokens na UI nem copiar secrets para relatos.

Para walkthrough viável no app atual: login A → listar perfil/turma/comunicado A; iniciar carregamento → logout → login B; conferir que perfil/cache/resposta antiga A não aparece; logout/relogin A com nova sessão; rejeitar deep link de turma externa; perfil/senha/exclusão só da própria conta. Manipulação manual de IDs/papéis/replay é prova automatizada server-side, sem depender de controles visuais. Registrar por cenário data/hora America/Sao_Paulo, app/revisão/ambiente e ações/resultado exatamente observados; PASS (user-reported) somente após relato. O artefato atual não foi instalado/observado nesta execução; candidato production e smoke ficam nas fases posteriores.

## Estado do bloco Fases 1–3

Automação executada e resultados em evidence/phase1-3-gates.md. Manual/walkthrough: NOT RUN, nenhum relato inventado. Logout remoto SEC-001 permanece blocker: não presumir que limpar tokens locais revoga sid no backend. T010/T018 abertas; scripts gerais de fases futuras acima não foram todos executados nesta rodada.
