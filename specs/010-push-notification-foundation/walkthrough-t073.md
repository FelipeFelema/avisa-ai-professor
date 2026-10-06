# Walkthrough individual T073 — Android preview

**Preparado**: 2026-10-06

**Estado**: FAIL (user-reported) no retorno das configurações Android, com estado ativo transitório e erro 429/alternância visual. [Diagnóstico e correção](walkthrough-t073-429-diagnosis.md); reteste em novo APK pendente. Os demais passos continuam sem aprovação inferida; T073/T074 permanecem abertas.

Usar o APK da build preview já enviada, celular na mesma rede e backend normal ligado em `http://192.168.0.100:3000/api/v1`, banco local `avisa_ai`. A resposta health pelo celular já foi relatada como `PASS (user-reported)`; isso não comprova o fluxo de push abaixo. Não executar suites destrutivas nesse banco.

| Ordem | Ação                         | Conferir/registrar                                                                                                                             |
| ----- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Abrir o app                  | Abre normalmente, sem prompt espontâneo de notificações.                                                                                       |
| 2     | Fazer login                  | Sessão válida e navegação normal.                                                                                                              |
| 3     | Perfil → Notificações        | Registrar estado inicial e explicação, sem prompt automático.                                                                                  |
| 4     | Tocar em Ativar notificações | Solicitação explícita inicia o fluxo; registrar erro/indisponibilidade real se ocorrer.                                                        |
| 5     | Aceitar a permissão Android  | Registrar a resposta do sistema. Se já concedida anteriormente, registrar esse fato, sem inventar novo prompt.                                 |
| 6     | Confirmar ACTIVE             | Confirmar vínculo ativo para a conta/instalação atual; medir tempo só se efetivamente observado.                                               |
| 7     | Tocar em Enviar teste        | Registrar retorno/feedback do backend: aceito, recusado, falha ou indeterminado. Aceite não é recebimento.                                     |
| 8     | Observar foreground          | Registrar se a mensagem neutra foi vista e se houve uma única apresentação. O toque deve abrir a área de notificações.                         |
| 9     | Testar background            | Aguardar liberação do botão, pedir outro teste e mandar o app para background. Registrar recebimento observado e retorno pelo toque.           |
| 10    | Verificar cooldown           | Após um envio permitido, nova tentativa antes de 30 s/na pendência fica bloqueada ou recebe feedback de limite; não há duplicação intencional. |
| 11    | Desativar e retornar à tela  | Registrar opt-out e reconciliação; voltar ao foreground não reativa. A permissão do Android pode continuar concedida.                          |
| 12    | Logout e retorno/login       | Confirmar saída e reconciliação sem vínculo residual da conta anterior ou reativação espontânea da instalação desativada.                      |

Em falha, pausar o cenário e localizar a camada antes de alterar código: UI/permissão → token/configuração nativa → conectividade/autenticação → vínculo/elegibilidade no backend → despacho Expo/FCM → apresentação/toque. Registrar o erro seguro, sem tokens, capabilities, service account ou conteúdo privado.

Evidência mínima por linha: data, resultado `PASS (user-reported)`, FAIL ou NOT RUN, estado/feedback e observação efetivamente relatada. Separar solicitação aceita, handoff/receipt e exibição observada. Não atribuir PASS a passos ainda não realizados. Temas e navegação existentes podem ser conferidos no mesmo walkthrough viável, conforme [quickstart.md](quickstart.md).

As pendências automatizadas ficam em [validation-follow-up-2026-10-06.md](validation-follow-up-2026-10-06.md). O término deste checklist ainda exige avaliação de T073/T074, sem fechamento automático.
