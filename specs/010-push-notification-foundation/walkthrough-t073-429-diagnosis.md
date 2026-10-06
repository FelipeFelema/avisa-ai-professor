# T073 — loop de reconciliação após retorno das configurações Android

Data: 2026-10-06. **Walkthrough: FAIL (user-reported)** neste cenário; correção automatizada aprovada, reteste físico pendente. T073/T074 continuam abertas.

## Relato físico e limite da medição

O proprietário abriu Perfil → Notificações, foi orientado a abrir as configurações Android, concedeu a permissão e retornou ao app. A tela exibiu estado ativo/ações de desativar e enviar teste por aproximadamente 1–2 s, seguido do erro de muitas tentativas e alternância visual, sem toques repetidos. Esse intervalo é estimativa do relato, não medição de SC-005. Nenhum envio/recebimento de teste foi confirmado nesse relato.

Não havia captura HTTP do aparelho disponível nesta investigação. **As quantidades/tempos abaixo são da reprodução controlada, não são contagem da sessão real do celular.** O backend local em execução não foi reiniciado ou instrumentado, e nenhum segredo/capability/token real foi usado nos testes. Não inferir qual foi a primeira rota com 429 no aparelho apenas pela mensagem genérica da UI.

## Causa raiz comprovada em teste

`mobile/src/lib/api.ts` notificava listeners de conectividade para toda resposta do client autenticado, tanto sucesso quanto erro com resposta HTTP (incluindo 429). `PushProvider` usa esse aviso para chamar `reconcilePushNotifications`.

Uma reconciliação com opt-in e permissão concedida obtém o token, faz POST reserve e PUT activate. Cada resposta disparava outra reconciliação. O callback inicia uma leitura assíncrona de pending revocation antes de entrar no single-flight da ativação. Se essa leitura termina após a operação anterior liberar seu flight, começa outro ciclo. Uma resposta 429 também alimentava o mesmo ciclo. Portanto, single-flight protege simultaneidade, mas não interrompe realimentação sequencial pelas próprias respostas.

O teste `mobile/tests/providers/push-reconciliation-feedback.spec.tsx` integra **API/interceptors, PushProvider, hook, serviços e coordenador reais**. Apenas device/storage/auth/configuração e transporte são fixtures/mocks; não há network ou banco. Uma transição background → active após permissão concedida reproduz o defeito. Transporte tem 1 ms de latência e leitura de pending storage 5 ms, com timers controlados; o bucket simulado mantém a política de 10 requisições/60 s. O guard real foi verificado separadamente por seu script oficial de testes.

| Rota (prefixo real `/api/v1`)     | Antes, em 200 ms simulados         | Depois, no mesmo intervalo |
| --------------------------------- | ---------------------------------- | -------------------------- |
| POST `/push/installation/reserve` | 5 respostas 200 + 13 respostas 429 | 1 resposta 200             |
| PUT `/push/installation`          | 5 respostas 200                    | 1 resposta 200             |
| GET `/push/installation`          | 0 nesta fixture                    | 0 nesta fixture            |
| POST `/push/installation/test`    | 0                                  | 0                          |
| DELETE `/push/installation`       | 0                                  | 0                          |

São **23 chamadas antes / 2 depois** em uma janela controlada de 200 ms. Não extrapolar essa taxa para a rede real. Com orçamento já esgotado, a correção produz uma única reserva com 429 e estado ERROR estável, sem retry automático.

Outras rotas possíveis no fluxo real: GET é consultado pelo snapshot ao montar a tela, pela recuperação de uma ativação com resultado incerto/conflito e pela verificação de elegibilidade do teste. DELETE aparece somente em revogação/cleanup pendente. POST test depende da intenção explícita de enviar teste; o retorno das configurações não o dispara.

## Disparadores revisados

- AppState: o provider reconcilia na transição não-active → active; eventos active repetidos não criam novas transições. O novo teste inclui active repetido. Listeners de mudança de token nativo e respostas externas de API continuam sendo disparadores legítimos.
- Provider: efeito depende de `router`/`userId`, não do status que publica. Hook: assinatura/snapshot e apresentação são efeitos de montagem; timer depende apenas do cooldown e não faz HTTP. `refresh` só é chamado pelo botão de tentar novamente.
- Não há React Query/invalidation na tela/hook/coordenador de push. A tela recebe snapshots publicados; atualizar a UI não é o disparador HTTP identificado.
- O retorno das configurações permite uma reconciliação de foreground; as respostas dessa reconciliação eram o multiplicador. Não foi necessário presumir múltiplos eventos nativos para reproduzir a tempestade.

## Rate limiting

O `RateLimitGuard` real tem chave **apenas IP**, 10 requisições em janela móvel de 60 s. Os cinco métodos do PushController usam esse guard; GET/state consome o mesmo orçamento de reserve/activate/test/delete no contexto push. O teste do guard confirma que esgotar por reserve/activate também bloqueia GET/test/delete e que a janela volta a permitir chamadas após 60 s.

Esse agrupamento é amplo e permite contenção de leitura com operações sensíveis. **Não é a origem do loop**, e nenhum limite/chave/guard foi alterado para corrigi-lo. A avaliação de eventual contenção em uso normal fica condicionada à frequência real observada após o reteste; não usar aumento global como correção da realimentação.

## Correção mínima e validação

O notifier de conectividade do client autenticado agora ignora respostas de requests com URL relativa `/push/…`, inclusive 429. Os serviços atuais usam esse formato. Respostas dos outros endpoints continuam notificando conectividade e preservam resultado/rejeição. DELETE já usa client separado sem esse interceptor. Não há timer de retry, aumento de limite ou mudança no PushProvider/guard/coordenador/contrato.

- Teste de reprodução falhou antes da correção com a contagem acima; passou depois. Também cobre erro estável quando a quota já está esgotada.
- Testes relacionados inicialmente: **9 suites / 66 testes PASS**; após acrescentar o segundo cenário, o gate completo passou com **82 suites / 591 testes**, cobertura aprovada, exit 0 natural.
- A primeira execução completa após acrescentar o segundo cenário falhou somente no novo teste: ele selecionava o listener registrado na primeira fixture porque o histórico do mock AppState não era limpo entre os casos. Adicionado `jest.clearAllMocks()` no setup do teste; os dois cenários e a repetição completa passaram. Não houve alteração adicional de produção para satisfazer esse teste.
- Mobile `typecheck` e `lint`: PASS, repetidos após o ajuste final de fixture. Prettier dos arquivos alterados e `git diff --check`: PASS.
- Backend `npm.cmd run test -- --runInBand --runTestsByPath src/auth/guards/rate-limit.guard.spec.ts src/push/push-test.service.spec.ts`: **2 suites / 9 testes PASS**. Guard e single-flight/cooldown do serviço mantidos.

O log da reprodução contém apenas método, path fixa, status, tempos sintéticos e estados públicos. Nunca imprimir AxiosError/config completos, headers, bodies, installation identity ou credenciais para capturar esse problema.

## Próximo reteste físico

**Necessária uma nova build Android preview:** a correção altera JavaScript de produção incorporado ao APK; testes locais não atualizam o APK instalado. Não foi gerada build nem publicado update OTA nesta investigação. Reiniciar só o backend ou esperar o bucket liberar não instala a correção mobile.

O proprietário já iniciou manualmente a segunda build preview com esta correção. Quando seu APK estiver instalado, repetir retorno das configurações → estado estável e então continuar o walkthrough. Registrar método/rota/status/tempo por chamada se houver nova limitação. Falha física anterior não vira PASS pelo resultado automatizado. Doctor 20/21 e CI remoto permanecem separados; T073/T074 não foram marcadas.
