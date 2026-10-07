# Quickstart: Push Notification Foundation

**Date**: 2026-10-05 | **Plan**: [plan.md](plan.md)

Roteiro de validação da implementação. Os resultados observados em cada execução ficam em [final-validation.md](final-validation.md); este roteiro não afirma build assinada, provisionamento ou entrega real de push. Contratos: [API](contracts/push-api.md), [mobile/provedor](contracts/mobile-and-provider.md); invariantes: [data-model.md](data-model.md).

## Prerequisites

- Node 22.12+, dependências/lockfiles sincronizados e migrations revisadas.
- PostgreSQL local isolado `avisa_ai_test` disponível pelo Docker Compose; nunca importar cegamente DATABASE_URL de backend/.env.example, que aponta para banco de desenvolvimento.
- Provider/SDK mockados para automação: nenhum teste automatizado de regressão envia push real ou exige credenciais EAS/FCM/APNs.
- Para walkthrough de push real: build independente compatível de distribuição interna/preview, projeto/identificadores nativos correspondentes, FCM V1/APNs e enhanced push security configurados. Uma instalação viável e o próprio proprietário bastam; não exigir campanha Android+iOS ou protocolos especializados.
- Use `EXPO_PUBLIC_EAS_PROJECT_ID`, `EXPO_PUBLIC_ANDROID_APPLICATION_ID` e `EXPO_PUBLIC_IOS_BUNDLE_IDENTIFIER` para identificadores públicos da build. Forneça `GOOGLE_SERVICES_FILE` por configuração segura do ambiente de build; o arquivo JSON não deve ser versionado. Mantenha `EXPO_PUSH_ACCESS_TOKEN` exclusivamente no ambiente privado do backend.
- Sem build/configuração compatível, validar indisponível/recusa e demais funções. Isso não comprova envio/recebimento real; documentar limitação operacional de configuração sem transformá-la em campanha nativa dispensada.

## Safe backend setup and automated gates

Comandos PowerShell após implementação, não execução neste documento. Credenciais abaixo são somente do banco local de teste.

```powershell
Set-Location 'C:\src\avisa-ai-professor\backend'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/avisa_ai_test'
$env:NODE_ENV = 'test'
$env:JWT_ACCESS_SECRET = 'test_access_secret'
$env:JWT_REFRESH_SECRET = 'test_refresh_secret'
$env:EXPO_PUSH_ENABLED = 'false'

$pushTestDatabaseUri = [Uri]$env:DATABASE_URL
if ($pushTestDatabaseUri.Host -notin @('localhost', '127.0.0.1') -or
    $pushTestDatabaseUri.AbsolutePath -ne '/avisa_ai_test') {
  throw 'Use exclusivamente PostgreSQL local avisa_ai_test.'
}

npm ci
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

Manter assertSafeTestDatabase ativo nos helpers/suites; a verificação acima não o substitui. Suites push habilitam configuração fake e injetam adapter mock em memória quando necessário; enabled=false cobre degradação. Nunca apontar testes/cleanup para `avisa_ai`.

Verificar migração em banco isolado novo e em fixture com User/AuthSession/Classroom/Announcement/InviteCode existentes: dados antigos preservados, nenhum registro ativo criado por migração, constraints/FKs/cascatas funcionando. SQL/migration e client gerados apenas na implementação.

## Mobile automated gates

```powershell
Set-Location 'C:\src\avisa-ai-professor\mobile'
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
npm run doctor
npm run export:ci
```

`expo-crypto` já está no manifest e lockfile. Suites isolam imports nativos para web e SDK/provedor/storage/timers. Verifique app.config/plugin em fixture temporária fora dos diretórios nativos reais; não use prebuild destrutivo sobre WIP. Assertar package/bundle/projectId, canal, plugin Notifications, exclusões SecureStore/AsyncStorage em fullBackupContent e cloud/device-transfer e flag iOS de backup.

Gates aplicáveis continuam os workflows Backend CI/Mobile CI; passes locais não representam execução remota do GitHub. Falhas de dependências/CI/configuração externa permanecem pendências reais, não dispensadas pelo escopo individual.

## Required automated matrix

| Cenário                                                              | Resultado esperado                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| not-requested / denied / unavailable / granted                       | nenhum prompt automático; só ação explícita ativa; recusa/indisponível não bloqueiam outros fluxos     |
| permissão granted com opt-in false                                   | reconciliação não ativa; UI oferece Ativar                                                             |
| permissão granted mas token/config/rede falha                        | erro seguro; nenhum registro ACTIVE ou token fictício                                                  |
| reserva cujo response se perde                                       | somente RESERVED inelegível; retry retorna mesma reserva                                               |
| SecureStore falha antes de activation                                | não ativar; recovery/best-effort revoke sem bloquear conta                                             |
| 2 contas × 2 sessões × 2 instalações                                 | uma associação correta por instalação; dispositivos válidos não afetados                               |
| segredo ausente/errado, IDs alheios, campos extras, tokens inválidos | zero envios e zero alterações no vínculo protegido                                                     |
| colisão de token em instalação elegível                              | 409 seguro sem transferência ou envio                                                                  |
| ativação idempotente / rotation CAS                                  | exatamente um vínculo ativo; revision só muda com token/plataforma novos                               |
| DELETE antes/durante resposta atrasada PUT                           | REVOKED terminal; não reativa; receipt antigo não toca token novo                                      |
| logout online                                                        | binding revogado com comunicação disponível; limpeza local sempre conclui                              |
| logout offline/process restart/login outra conta                     | pendência sem JWT/token; flush capability-only antes de novo binding                                   |
| pendência storage/rede falha                                         | logout continua; push informa recovery/pending e não confirma desativação fictícia                     |
| refresh / senha / e-mail / expiry                                    | refresh mantém sid; outras sessões revogadas inelegíveis; atuais válidas preservadas                   |
| exclusão de conta concorrente                                        | cascade remove Registration/Attempt; não reaparece por callback; instalações de outras contas intactas |
| token nativo muda                                                    | readquirir Expo token; nunca registrar FCM/APNs como Expo token                                        |
| DeviceNotRegistered ticket/receipt                                   | somente revisão/fingerprint enviados invalidam                                                         |
| 429/5xx/MessageRateExceeded/config inválida                          | erro sanitizado e token válido preservado                                                              |
| 2 POST concorrentes/multiprocesso/cooldown/restart                   | no máximo 1 despacho por intenção, 1 aceite/instalação/30 s                                            |
| timeout/crash após send                                              | UNKNOWN, sem retry automático de envio; lease libera só para nova intenção após cooldown               |
| receipt ausente/backoff/deadline/shutdown                            | consultas recuperáveis/limitadas, UNKNOWN em deadline, sem handles abandonados                         |
| foreground/background mocks                                          | handler/listener definidos; feedback não duplicado; mocks não são recebimento real                     |
| sentinelas token/capability/instalação                               | zero ocorrências nos logs/URLs/errors/analytics/documentos versionados                                 |
| temas/labels/targets/texto ampliado                                  | estados e ações legíveis, sem cor como único indicador                                                 |
| regressão auth/conta/convites/turmas/comunicados                     | resultados anteriores preservados; zero notificações de negócio                                        |

Teste de cooldown deve incluir primeiro aceite 5 s após início: nova intenção em t=30 s é recusada, pois não houve intervalo de 30 s entre aceites. Validar nextTestAvailableAt persistido após restart e concorrência.

Os percentuais SC-001–004/007–010 se referem à matriz finita executada, não pesquisa com população/participantes. Na SC-007, preparar vínculos de usuário/sessão/instalação/token pelo fluxo controlado antes dos testes negativos e verificar zero-envios/zero alterações na vítima. Por decisão do proprietário em 2026-10-05, não exigir prova universal de posse de token desconhecido nem enviar desafio de verificação. Expo Push Token não é atestação; rationale em research R3.

## Operational configuration

Configure a build conforme [mobile/provedor](contracts/mobile-and-provider.md#nativebuild-configuration); exemplos versionados contêm somente nomes/placeholders. FCM V1 deve corresponder à identidade Android; a credencial APNs deve corresponder à identidade Apple; ambas devem usar o projeto EAS indicado pela build. Mantenha service-account JSON, chave APNs e `EXPO_PUSH_ACCESS_TOKEN` em armazenamento seguro do respectivo ambiente, nunca em variáveis `EXPO_PUBLIC_*`, app config versionado ou evidência. Não anexe credenciais, tokens, installationIds/capabilities completos em evidência. Consulte também a documentação oficial de [configuração de push](https://docs.expo.dev/push-notifications/push-notifications-setup/) e [envio/receipts](https://docs.expo.dev/push-notifications/sending-notifications/).

O perfil `preview` em `mobile/eas.json` produz distribuição interna independente e não contém credenciais. Após revisar a configuração, o proprietário pode produzir/instalar uma build compatível. Para o walkthrough, use o backend normal e não execute suites destrutivas no banco de desenvolvimento; `EXPO_PUSH_ACCESS_TOKEN` fica somente no backend. A exportação local não assina uma build nem provisiona EAS.

Config ausente deve gerar indisponível; nunca invente projectId, credential ou token. Não confunda export/Doctor com assinatura/configuração de transporte. Ausência de provisionamento externo é dependência operacional para push real e não é campanha de dispositivo.

Em uma recuperação, defina `EXPO_PUSH_ENABLED=false`, revogue os vínculos afetados quando aplicável e reverta a versão da aplicação se necessário. Preserve as tabelas da migration até uma revisão explícita de remoção; rollback não exige apagar os dados.

## Individual functional walkthrough

Executar somente cenários viáveis; complementar variações com automação, sem obrigar múltiplos aparelhos ou conta administrativa provisionada para o relato manual.

1. Abrir Perfil → Notificações. Confirmar explicação/estado, nenhum prompt espontâneo e outros fluxos utilizáveis.
2. Ativar explicitamente. Relatar permissão concedida/recusada ou indisponibilidade. Em ambiente compatível, medir tempo até confirmação de registro para SC-005; em recusa, orientação para configurações.
3. Com ACTIVE, solicitar teste. Confirmar mensagem de aceite somente se ticket aceito; relatar se a mensagem neutra foi realmente vista. Foreground usa apresentação única; testar background quando viável na mesma instalação, sem exigir campanha especializada.
4. Tentar novamente antes de 30 s e enquanto pendente: botão bloqueado/feedback de limite; nenhum teste duplicado intencional.
5. Desativar, retornar à tela/foreground e confirmar app disabled sem dizer que permissão SO foi removida. Reativação explícita cria vínculo novo.
6. Logout com rede e sem rede quando viável: conta sai, pendência é clara, retorno/reconexão reconcilia antes de associar outra conta. Nenhum dado/token da conta anterior na UI.
7. Conferir estados Claro/Escuro, labels/feedback e navegação existente. Variantes de múltiplas sessões/dispositivos/reinstalação são cobertas prioritariamente pelos testes automatizados; não exigir frota física.

Registro de evidência: data, executor, ambiente em termos gerais sem IDs privados, cenários realmente realizados, resultado automatizado ou PASS (user-reported), tempo se medido e recebimento observado separado de aceite/ticket. Falhas reais permanecem FAIL; cenário não relatado não vira PASS. SC-006 admite registrar honestamente aceite sem exibição observada, conforme sua cláusula de falha/indeterminação.

## Validation scope and completion

Campanhas Android/iOS especializadas, TalkBack/VoiceOver, auditoria física e estudos com participantes são DISPENSADA POR ESCOPO, sem checkbox, sem PASS e sem bloquear dependências/release ou migrar para specs posteriores. Semântica UI, testes, integridade, supply-chain/CI e configuração operacional permanecem exigidos.

A clarificação da SC-007 foi resolvida pelo proprietário em 2026-10-05 e sincronizada em spec, plan, research e contrato: proteger vínculos existentes pelo fluxo controlado, sem garantia universal de posse de token desconhecido e sem desafio de verificação. Os testes automatizados verificam essa fronteira; consulte [final-validation.md](final-validation.md) para resultados, qualificações e itens ainda sem evidência.

Gates locais não representam execução remota de CI. Um ticket aceito e um receipt positivo também não comprovam exibição. Registre `PASS (user-reported)` somente para cenários realmente relatados; sem relato, mantenha `NOT RUN`. Configuração operacional de terceiros/CI continua sendo dependência real, não dispensa. As exclusões de escopo acima não bloqueiam conclusão nem podem ser transferidas para outra spec.
