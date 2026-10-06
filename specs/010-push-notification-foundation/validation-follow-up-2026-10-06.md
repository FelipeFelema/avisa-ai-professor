# Validação complementar — 2026-10-06

Registro posterior à captura histórica de [final-validation.md](final-validation.md). As evidências históricas não representam o estado atual do Doctor ou o walkthrough ainda pendente. T073/T074 permanecem abertas.

## PushProvider — causa no harness e correção limitada aos testes

Ambiente: Windows, Node 22.14.0, Jest/babel-jest 29.7.0, jest-expo 57.0.5.

- Reprodução pelo script oficial `npm run test`: a suite `tests/providers/PushProvider.spec.tsx` apresentou 4 falhas e 1 teste aprovado; nenhuma reconciliação ocorreu nos quatro cenários que dependem do carregamento do SDK.
- O teste isolado `tests/config/dynamic-import-harness.spec.ts`, antes da correção, falhou diretamente no `import('expo-notifications')` com `TypeError: A dynamic import callback was invoked without --experimental-vm-modules`. É o erro de VM identificado pelo Node como [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG](https://nodejs.org/docs/latest-v22.x/api/errors.html#err_vm_dynamic_import_callback_missing_flag).
- O `PushProvider` captura a falha de importação e sai antes de instalar listeners/reconciliar. Por isso os testes antigos mostram falta de chamadas em vez do erro original.
- O preset instalado converte imports estáticos para CommonJS, mas mantém essa expressão `import()` para o carregador ESM da VM. Os mocks estáticos em `tests/helpers/push.ts` não corrigem esse limite do carregamento nativo.
- Comparação: `push-device.service.spec.ts` injeta o SDK mockado nas funções de dispositivo; não percorre seu fallback dinâmico. Outros testes usam imports estáticos ou `require`, inclusive no setup de React Native. A busca não encontrou outro `import()` executável nos testes antes do novo caso isolado; os demais usos eram tipos TypeScript.
- Classificação: **falha do harness Jest/Node ao executar o carregamento dinâmico**, não evidência de regressão do comportamento de produção. O comportamento real no APK continua dependente do walkthrough físico.

Correção: `mobile/jest.config.js` estende o transformador existente de `jest-expo`, preservando seus presets, caller, transformadores de assets e hoisting. O plugin local `mobile/tests/helpers/transform-dynamic-import.cjs` converte imports dinâmicos com nome literal em carregamento CommonJS assíncrono com namespace interoperável, exclusivamente no Jest. Nenhum Babel config de produção foi criado; Metro e `PushProvider` continuam intactos. O plugin aceita o formato usado pelos SDKs atuais; imports futuros com nome calculado/atributos precisam de avaliação explícita do harness.

Isso segue a separação entre [transformadores do Jest](https://jestjs.io/docs/29.7/code-transformation) e transformação de `import()` para CommonJS descrita pelo [Babel](https://babeljs.io/docs/babel-plugin-transform-dynamic-import). Não foi instalado plugin/dependência adicional.

| Verificação                                                                                                                      | Resultado                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm run test -- --runInBand --runTestsByPath tests/config/dynamic-import-harness.spec.ts tests/providers/PushProvider.spec.tsx` | PASS — 2 suites, 6 testes; todos os 5 testes do provider passaram.                                                |
| `npm run test:ci`, primeira execução                                                                                             | 80/81 suites; 584/585 testes. Timeout de 5 s em um caso de `confirmation-matrix`, separado do erro de importação. |
| `confirmation-matrix` com configuração anterior, sem o novo transformador                                                        | PASS — 12/12; o caso que havia estourado levou 4,24 s.                                                            |
| `confirmation-matrix` com configuração atual                                                                                     | PASS — 12/12; o mesmo caso levou 0,649 s.                                                                         |
| `npm run test:ci`, repetição após investigação do timeout                                                                        | PASS — 81 suites, 585 testes, cobertura/gates aprovados, exit 0 natural, sem `forceExit` e sem aumentar timeout.  |
| `npm run typecheck` / `npm run lint`                                                                                             | PASS.                                                                                                             |

No PowerShell deste ambiente, foi usado `npm.cmd` para preservar os argumentos após `--` sem o shim `npm.ps1` reinterpretá-los. Os scripts oficiais de package.json não foram alterados.

O timeout da primeira execução não voltou a ocorrer nos controles ou no gate completo repetido. A evidência é compatível com timing do ambiente/harness; sua causa de desempenho não foi medida, e não houve mudança no teste nem no runtime para mascará-la.

## Expo Doctor — pendência separada de dependências

`npm run doctor` reproduziu **20/21**. Único check falhando: **Check that packages match versions required by installed Expo SDK**. Todos os cinco desalinhamentos são de patch; as versões atuais abaixo são as instaladas, não apenas os ranges declarados.

| Pacote               | Atual     | Esperada pelo Doctor | Impacto provável / evidência                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | --------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo`               | `57.0.26` | `~57.0.27`           | Desalinhamento com o patch recomendado; o [changelog 57.0.27](https://github.com/expo/expo/blob/sdk-57/packages/expo/CHANGELOG.md) não registra mudança visível ao usuário. Isso não garante ausência de efeitos internos.                                                                                                                                      |
| `expo-constants`     | `57.0.20` | `~57.0.21`           | Desalinhamento de compatibilidade; o [changelog 57.0.21](https://github.com/expo/expo/blob/sdk-57/packages/expo-constants/CHANGELOG.md) não registra mudança visível ao usuário.                                                                                                                                                                                |
| `expo-linking`       | `57.0.11` | `~57.0.12`           | Desalinhamento de compatibilidade; o [changelog 57.0.12](https://github.com/expo/expo/blob/sdk-57/packages/expo-linking/CHANGELOG.md) não registra mudança visível ao usuário.                                                                                                                                                                                  |
| `expo-notifications` | `57.0.21` | `~57.0.22`           | O [patch 57.0.22](https://github.com/expo/expo/blob/sdk-57/packages/expo-notifications/CHANGELOG.md) corrige retry de obtenção do token nativo após falha transitória, preservando requisições em andamento compartilhadas. Inferência: a versão atual pode afetar uma nova tentativa de registro após esse tipo de falha; não é prova de falha da build atual. |
| `expo-router`        | `57.0.24` | `~57.0.25`           | O [patch 57.0.25](https://github.com/expo/expo/blob/sdk-57/packages/expo-router/CHANGELOG.md) corrige parsing/chaves de carregamento de rotas específicas por plataforma. Inferência: fluxos que dependam desse formato de rota podem ser afetados; o impacto neste aplicativo ainda não foi observado.                                                         |

Os cinco patches esperados foram publicados em 2026-10-06. A aprovação histórica 21/21 não cobre esse novo conjunto recomendado. O check aponta compatibilidade de dependências; não demonstra sozinho regressão causada pelas correções de app.config/push-config.

**Estado: PENDENTE para avaliação em T074.** Não executar `expo install`, alterar manifests/lockfiles ou ignorar o check para fazê-lo passar enquanto a build atual e o walkthrough estiverem pendentes.

## Preservação da primeira build/runtime — captura histórica

- O upload foi inspecionado antes de iniciar a build. A única correção pré-build foi `credentials/` no `.gitignore` da raiz para contornar a exclusão de arquivos por caminhos Windows no EAS CLI; a repetição da inspeção encontrou zero arquivos de service account, zero ambientes privados e zero correspondências com os segredos privados locais.
- Durante esta investigação, 243 arquivos de código/runtime, assets, configuração e dependências do mobile/backend foram comparados byte a byte com o pacote enviado. **Zero diferenças**, inclusive em `mobile/package.json`, `mobile/package-lock.json`, `app.config.ts`, `eas.json`, código de produção e migrations.
- Alterações após o envio: harness/teste Jest e documentação desta validação, checklist T073 e rascunho da 011. Não foi alterado o backend em execução, não houve restart, migration, envio de notificação ou nova build.
- Os monitores locais foram encerrados por solicitação do usuário, sem cancelar o job remoto. A build existente é [1d382cb0-d808-496e-b0e1-9bdd453f7728](https://expo.dev/accounts/kratinhos/projects/mobile/builds/1d382cb0-d808-496e-b0e1-9bdd453f7728).

## Walkthrough e próxima spec

- Checklist curto preparado em [walkthrough-t073.md](walkthrough-t073.md). Na captura inicial os passos de push estavam NOT RUN. Posteriormente, o retorno das configurações Android apresentou FAIL (user-reported); diagnóstico e reteste estão em [walkthrough-t073-429-diagnosis.md](walkthrough-t073-429-diagnosis.md).
- Na captura histórica foi preparado um rascunho da 011. Ele foi posteriormente removido por solicitação do proprietário; nenhum arquivo da 011 permanece na branch 010. A recriação será feita somente na branch própria.
- A pendência dos quatro testes do provider foi resolvida no harness; Doctor 20/21 permanece separado. T073/T074 continuam abertas e só serão avaliadas após o walkthrough e a consolidação dos gates aplicáveis.
