# Decisão final de readiness — T068

Data da revisão: 2026-09-09 (America/Sao_Paulo)

## Decisão

`BLOCKED — Phase 9 executada, mas a release não recebe aprovação final`.

T066–T068 fecharam a documentação, a execução do quickstart e esta decisão
com evidência verificável. A implementação automatizada permanece verde e o
scan não encontrou segredo real exposto. Isso não basta para declarar a aplicação
segura ou pronta: existem advisories de dependências, hardening pendente e
critérios humanos/cross-platform ainda não medidos.

Nenhum `audit fix`, downgrade, upgrade major ou mudança de código fora dos paths
de Phase 9 foi aplicado automaticamente. Essas correções precisam de tarefas
próprias, testes de compatibilidade e nova decisão de readiness.

## T066 — documentação operacional

Resultado: `PASS`.

- `README.md`, `backend/README.md` e `mobile/README.md` descrevem instalação
  determinística, gates completos, banco descartável, OpenAPI, HTTPS, CORS,
  Docker somente local e links para contratos/evidências.
- Os documentos classificam `DATABASE_URL`, `JWT_ACCESS_SECRET` e
  `JWT_REFRESH_SECRET` como segredos exclusivos do backend.
- O cliente publica somente `EXPO_PUBLIC_API_URL`; a documentação deixa explícito
  que toda variável `EXPO_PUBLIC_*` é legível no bundle e não pode conter token,
  senha, chave ou URL com credenciais.
- Todos os links Markdown locais adicionados aos três READMEs resolvem e os
  arquivos passam no Prettier.

## T067 — quickstart integral

Resultado: `WARN`, com os limites e todos os comandos registrados em
[quickstart-validation.md](./quickstart-validation.md).

| Superfície                         | Resultado atual                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL/Prisma descartável      | PASS — `avisa_ai_test`, schema/client/migration, 11 migrations e zero pendentes.                                       |
| Backend                            | PASS — formato, lint, typecheck, 12 suítes/71 unitários com cobertura, 6/39 integração, 1/1 contrato, 3/9 e2e e build. |
| OpenAPI runtime                    | PASS automatizado — health/UI/JSON, 19 operações, GET/PATCH protegidos e deny `404` em `NODE_ENV=production`.          |
| Mobile                             | PASS — typecheck, lint, formato, Expo Doctor 21/21, 28 suítes/79 testes e export Web/iOS/Android.                      |
| Commitlint                         | PASS — 10 commits do range local.                                                                                      |
| Exercícios manuais/externos atuais | NOT MEASURED — automação não substitui participante, dispositivo, ruleset ou deployment owner.                         |

Os warnings React `act(...)` não alteraram o exit das suítes. A primeira
tentativa do Expo Doctor foi limitada pela rede confinada; a repetição com
acesso externo passou 21/21. O export gerado foi escaneado e removido depois da
validação.

## Segredos e variáveis de ambiente

Resultado do objetivo de não exposição: `PASS` para o conteúdo rastreado e o
bundle atual.

| Check                         | Resultado                                                                                                               | Limite                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Arquivos sensíveis rastreados | PASS — nenhum `.env`, private key ou certificado sensível rastreado; `.env.example` contém somente placeholders locais. | Não audita secret managers externos.                                  |
| Ignore local                  | PASS — `backend/.env` e `mobile/.env` são ignorados e não rastreados.                                                   | O conteúdo local não foi impresso nem copiado para evidência.         |
| Variáveis Expo                | PASS — somente `EXPO_PUBLIC_API_URL` aparece como identificador `EXPO_PUBLIC_*`.                                        | A URL é pública por desenho e deve usar HTTPS em builds distribuídos. |
| Conteúdo atual                | PASS — zero candidato de alta confiança para private keys, AWS/GitHub/Slack/Google keys ou JWT literal.                 | Regex não é prova absoluta contra todo formato de segredo.            |
| Histórico Git                 | PASS — zero commit correspondente aos mesmos padrões de alta confiança.                                                 | Não substitui um scanner corporativo com entropia e revogação.        |
| Atribuições genéricas         | PASS após revisão — os dois candidatos fora de testes/docs eram somente nomes de chaves do Secure Store, não tokens.    | Fixtures e placeholders foram classificados separadamente.            |
| Logging sensível              | PASS — nenhum sink de log combina com token, secret, password, authorization ou `DATABASE_URL`.                         | Revisão estática do source atual.                                     |
| Bundle Expo                   | PASS — zero arquivo gerado continha nomes de secrets backend, URL PostgreSQL, private key ou JWT literal.               | Valida somente o export desta execução.                               |

Controles positivos observados: tokens mobile usam Expo Secure Store; refresh
tokens persistidos são hashes de digest SHA-256 com bcrypt; DTOs globais usam
whitelist com rejeição de campos extras; autenticação, papel, autoria e
ownership são validados no servidor; docs retornaram `404` no teste de produção.

## Scans de polish

| Scan                                       | Resultado                                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `git diff --check`                         | PASS na execução final; somente avisos informativos LF/CRLF do Git.                                                  |
| Marcadores `TODO`/`FIXME`/`TBD`/`CHANGEME` | PASS — zero marcador uppercase pendente fora de dependências/builds.                                                 |
| Placeholders de configuração               | PASS — `replace_with_a_strong_*` e `SEU_IP_LOCAL` são exemplos intencionais e identificáveis, não credenciais reais. |
| Cores literais fora do tema                | FAIL — seis ocorrências permanecem em três arquivos; ver bloqueio B3.                                                |
| Links de evidência                         | PASS — alvos Markdown locais em READMEs e evidências existem.                                                        |

## Revisão consolidada das evidências

| Área                          | Evidência                                                                                                                                                          | Estado                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Foundation                    | [foundation-readiness.md](./foundation-readiness.md)                                                                                                               | PASS automatizado com limites históricos explicitados.                 |
| Exclusão segura de turma      | [us1-classroom-deletion.md](./us1-classroom-deletion.md)                                                                                                           | PASS automatizado; cobertura atual foi repetida no quickstart.         |
| Atualização de perfil/sessões | [us2-profile-update.md](./us2-profile-update.md)                                                                                                                   | PASS automatizado; cobertura atual foi repetida no quickstart.         |
| Confirmações                  | [us3-confirmation-matrix.md](./us3-confirmation-matrix.md)                                                                                                         | PASS automatizado; inspeção manual atual não medida.                   |
| OpenAPI                       | [us4-openapi.md](./us4-openapi.md)                                                                                                                                 | PASS de contrato e onboarding histórico; hardening B2 permanece.       |
| Visual/a11y/usabilidade       | [phase-7-closure.md](./phase-7-closure.md), [accessibility-audit.md](./accessibility-audit.md), [usability-results.md](./usability-results.md)                     | CLOSED WITH LIMITATIONS; iOS e SC-002/003/008 não medidos.             |
| CI/enforcement/migration      | [us6-delivery-gates.md](./us6-delivery-gates.md), [github-required-checks.md](./github-required-checks.md), [owner-migration-audit.md](./owner-migration-audit.md) | PASS registrado em 2026-09-09; não refeito externamente no quickstart. |
| Execução final                | [quickstart-validation.md](./quickstart-validation.md)                                                                                                             | Automatização principal PASS; gates humanos/externos atuais separados. |

## Bloqueios de readiness

### B1 — vulnerabilidades de dependências

`npm audit --omit=dev --json` retornou:

- backend: 10 vulnerabilidades de produção (9 high, 1 moderate);
- mobile: 21 vulnerabilidades de produção (7 high, 14 moderate).

No backend, a cadeia Express/`qs` é plausivelmente alcançável por query parsing;
`multer` está no grafo runtime, embora o repositório não possua endpoint de upload.
No mobile, `expo-router` alcança `query-string`/`decode-uri-component`, relevante
para deep links/query parsing; vários outros avisos pertencem a CLI/build. As
sugestões automáticas incluem mudanças major/downgrades incompatíveis, portanto
exigem triagem e matriz de regressão em vez de `npm audit fix` cego.

Condição para liberar: atualizar/override compatível quando existir ou registrar
aceite formal temporário por advisory, com alcance, mitigação, owner, prazo e
revalidação dos gates completos.

### B2 — OpenAPI falha aberto para ambiente desconhecido

`isOpenApiEnabled()` desabilita docs apenas quando `NODE_ENV === 'production'`.
Produção configurada foi testada e retornou `404`, mas valor ausente, digitado
incorretamente, preview ou staging habilita docs por padrão. O contrato limita a
referência a development/test.

Condição para liberar: permitir explicitamente somente `development`/`test` (e
manter o kill switch), adicionar regressão para valor ausente/desconhecido e
reexecutar contrato/e2e.

### B3 — cores fora da fundação semântica

O scan encontrou seis ocorrências fora de `mobile/src/theme`:

- `mobile/app/(app)/(tabs)/_layout.tsx`: duas cores da tab bar;
- `mobile/src/components/ui/ConfirmationDialog.tsx`: uma cor `rgba` do backdrop;
- `mobile/app/(app)/classrooms/[id]/new-announcement.tsx`: duas cores de texto e
  uma de erro.

Condição para liberar: representar esses papéis como tokens semânticos, migrar
os consumidores e repetir testes de contraste/estados e export.

### B4 — evidência humana/cross-platform incompleta

- SC-002, SC-003 e SC-008 permanecem `NOT MEASURED` por ausência de amostra de
  participantes e medição de tempo/primeira tentativa.
- SC-007 tem automação e walkthrough Android sem issue crítico, mas não possui
  auditoria iOS/cross-platform completa.

A limitação foi aceita para encerrar a Phase 7, mas os thresholds mensuráveis
da especificação continuam sem prova e impedem aprovação irrestrita da release.

### Risco de manutenção — rate limit local

O rate limiter de autenticação é em memória e por processo. Além de não ser
compartilhado entre réplicas, o mapa mantém uma chave para cada IP observado sem
política periódica de expurgo. Antes de exposição pública, definir proxy/IP
confiável, armazenamento/limite apropriado e cobertura contra crescimento
indefinido.

## Disposição

- T066: concluída e validada.
- T067: concluída com limites registrados.
- T068: concluída ao registrar esta decisão bloqueada e seus critérios de saída.
- Phase 9: encerrada sem iniciar uma fase posterior.
- Release 001: `BLOCKED` até resolver ou aceitar formalmente B1–B4 e reexecutar
  as validações afetadas.

---

## Addendum de convergência — Phase 10

Data: 2026-09-09 (America/Sao_Paulo)

Status atual: `IN PROGRESS — readiness ainda bloqueada`.

### Pendências técnicas resolvidas

- T069 — `PASS`: o runtime e o documento OpenAPI foram alinhados nos 19
  endpoints. Login/refresh/leave usam os status documentados; respostas de auth
  não expõem `sid`; classrooms retornam `members`; announcements retornam
  `author`/`updatedAt` sem campos internos; schemas fechados, `minProperties`,
  patterns, parâmetros, descrições e responses agora são comparados pelo teste
  estrutural. O contrato passou em 1 suíte/7 testes, unitários em 12/78,
  integração em 6/46 somente no banco `avisa_ai_test` e e2e em 3/11.
- T070 — `PASS`: OpenAPI usa allowlist explícita de `development` e `test` e
  preserva o kill switch. Regressões cobrem `NODE_ENV` ausente, desconhecido,
  production, development e test tanto no helper quanto nas URLs reais.
- T072 — `PASS`: os seis literais de cor remanescentes foram substituídos por
  tokens semânticos. Testes de tokens/estados passaram e o export Web/iOS/
  Android foi gerado com sucesso; o diretório descartável foi removido depois.
- Reparo estático de T073 — `PASS`: a criação de comunicado agora expõe labels,
  hints, estados selected/disabled/busy, alerts e targets mínimos de 48×48. A
  regressão falhou antes pelo motivo esperado e passou em 1 suíte/3 testes.

### Bloqueios ainda abertos

- T071 / B1 — `BLOCKED`: a consulta atual ao registry foi negada no ambiente
  confinado e a execução externa exige autorização explícita porque envia ao
  `registry.npmjs.org` os nomes/versões da árvore de dependências. Sem o JSON
  atual não é possível triar cada advisory nem aplicar upgrade/override ou
  registrar aceite individual com owner e prazo.
- T073 / B4 — `NOT MEASURED` cross-platform: `adb`, `emulator` e `xcrun` não
  existem neste host. Os checks automatizados e o export não substituem
  contraste renderizado, medição física, texto ampliado e VoiceOver/TalkBack em
  iOS e Android reais.
- T074 / B4 — `NOT MEASURED`: nenhuma amostra independente representativa de
  professor e responsável foi disponibilizada. O protocolo e as fórmulas foram
  registrados em `usability-results.md`, sem inventar participantes, tempos ou
  taxas.
- T075 — `NOT READY`: a reexecução final deve ocorrer somente depois de
  T071–T074, pois uma mudança de dependência ou um finding de dispositivo pode
  alterar o resultado. Portanto, este addendum não converte os resultados não
  medidos em aprovação.

B2 e B3 estão tecnicamente resolvidos. A release permanece `BLOCKED` por B1 e
B4; T071, T073, T074 e T075 continuam abertas em `tasks.md`.

---

## Addendum de convergência — fechamento T071–T075

Data: 2026-09-09 (America/Sao_Paulo)

### Decisão de escopo

`ANDROID-ONLY INITIAL RELEASE — ACCEPTED WITH EXPLICIT LIMITATIONS`.

O responsável pelo produto decidiu lançar inicialmente somente Android, validar
com os gates automatizados e com o próprio walkthrough, e deixar iOS e testes
com participantes para uma iteração futura. Esta decisão permite uma entrega
plausível para o projeto solo, mas não é uma aprovação irrestrita da
especificação original: iOS, amostra independente e os thresholds populacionais
continuam explicitamente `NOT MEASURED`.

### T071 — auditoria de dependências e aceite temporário

Os comandos autorizados foram executados com acesso externo ao
`registry.npmjs.org`:

| Comando | Resultado final |
|---|---|
| `npm --prefix backend audit --omit=dev --json` | exit 1 por advisories; 8 entradas de produção, 8 high, 0 moderate, 0 critical; 301 dependências de produção |
| `npm --prefix mobile audit --omit=dev --json` | exit 1 por advisories; 18 entradas de produção, 5 high, 13 moderate, 0 critical; 836 dependências de produção |

O exit 1 é o comportamento esperado do npm quando ainda há advisories. Foram
aplicados apenas overrides de patch e os lockfiles foram sincronizados:

- backend: `fast-uri` `3.1.5 → 3.1.6` e `qs` `6.15.3 → 6.16.0`;
- mobile: `baseline-browser-mapping` `2.10.42 → 2.11.0`, `browserslist`
  `4.28.5 → 4.28.7` e `@expo/xcpretty/js-yaml` `4.3.1 → 4.3.2`;
- nenhum `npm audit fix`, downgrade ou upgrade major foi aplicado.

| Escopo/advisories | Triagem, mitigação e aceite |
|---|---|
| Backend `fast-uri` (`GHSA-5jgf-p345-68v8`, `GHSA-f65p-4m7j-42xc`, `GHSA-fph4-wmhf-6fwf`, `GHSA-jqff-g426-hqxp`) e `qs` (`GHSA-x5fp-wj9c-mxmx`, `GHSA-4mjr-xmp4-gh2g`) | Corrigidos pelos overrides de patch e cobertos pela matriz completa de regressão. Owner: Felipe/maintainer; manter no próximo audit. |
| Backend `multer` `2.2.0` e propagação em `@nestjs/core` `11.1.18`, `@nestjs/platform-express` `11.1.28` e `@nestjs/swagger` `11.4.7` (`GHSA-wc9g-mqfw-jrwm`, `GHSA-qfvm-cv95-jqjf`, `GHSA-qvfw-j98x-7q72`, `GHSA-535w-7cp7-47q4`) | O npm sugere downgrade para Nest 7/Swagger 5, incompatível com a stack Nest 11/OpenAPI atual. O backend não expõe endpoint multipart/upload; nenhum fluxo novo deve introduzir upload até upgrade compatível. Aceite temporário, owner Felipe, prazo: antes do primeiro lançamento público ou 2026-10-09. |
| Backend `deepmerge-ts` `7.1.5`, `@prisma/config`/`prisma` `7.10.0` e `mysql2` `3.15.3` (`GHSA-ggr8-5vv4-36mx`, `GHSA-3f6p-5ww8-9rcr`, `GHSA-rgwj-5xj2-c3m3`) | O fix indicado é Prisma 6.19.3, downgrade incompatível com Prisma Client 7.6/stack atual. O datasource do produto é PostgreSQL; `mysql2` é transitivo do tooling Prisma. Inputs de migration/configuração ficam sob controle do repositório. Aceite temporário, owner Felipe, prazo: antes do primeiro lançamento público ou 2026-10-09. |
| Mobile `baseline-browser-mapping` e `browserslist` (`GHSA-w5vr-8v7q-w6rv`, `GHSA-c83g-rgw3-j3cx`, `GHSA-73wf-gq98-2v4g`) | Corrigidos pelos overrides de patch; export e testes passaram. Owner: Felipe/maintainer; revalidar em cada upgrade do Expo. |
| Mobile `js-yaml` (`GHSA-2883-xcg3-v3hh`) | Corrigido somente no consumidor compatível `@expo/xcpretty`; a versão 3.x usada por outra cadeia não foi forçada. Owner: Felipe/maintainer; revalidar em cada upgrade do Expo. |
| Mobile Expo/Router/config (`expo` `57.0.21`, `expo-router` `57.0.20`, `@expo/cli` `57.0.23`, `@expo/config*` e `@expo/prebuild-config`) e `decode-uri-component`/`query-string` (`GHSA-vcc3-ghjq-m6fr`) | O npm sugere Expo 46/Router 5.1.11, downgrade incompatível com SDK 57. A validação de autorização não depende de query/deep-link; nenhum token ou segredo é colocado em URI. Aceite temporário, owner Felipe, prazo: antes do primeiro lançamento público ou 2026-10-09. |
| Mobile `@xmldom/xmldom` `0.8.13`/`0.9.10` (`GHSA-6gmq-8vp8-gcm6`, `GHSA-6mj3-qw4j-hgrw`, `GHSA-g53g-w8rj-fmg7`, `GHSA-w2rr-34g9-rvrj`, `GHSA-4w3w-2rp5-g8jm`, `GHSA-c7q8-3ch8-vqpv`, `GHSA-27p8-2357-5qqv`, `GHSA-3px3-54cx-rmw9`, `GHSA-vr34-hp96-76pp`, `GHSA-6h8r-xr42-gp59`, `GHSA-8344-3jmq-59r6`, `GHSA-x4fp-j954-r2f4`, `GHSA-965w-775f-mr7g`, `GHSA-93r5-fhx6-vmg9`) | Está no caminho de plist/CLI de build; não há XML fornecido por usuário no app. O override 0.9.x seria incompatível sem testar os consumidores 0.8.x. Aceite temporário, owner Felipe, prazo: antes do primeiro lançamento público ou 2026-10-09. |
| Mobile `image-size` `1.2.1`, `metro` `0.84.4/0.84.5`, `metro-config` e `metro-transform-worker` (`GHSA-w3rx-r6r6-pgpr`, `GHSA-5p2g-fcmc-qvqq`) | O fix publicado compatível não estava disponível para o grafo Metro atual; são parsers de assets no build, não entrada de usuário em produção. Assets permanecem sob controle do repositório. Aceite temporário, owner Felipe, prazo: antes do primeiro lançamento público ou 2026-10-09. |
| Mobile `uuid` `7.0.3`/`xcode` `3.0.1` (`GHSA-w5hq-g745-h8pq`) | Pertence à cadeia de prebuild/Xcode, fora do lançamento Android-only; não foi aplicado downgrade do Expo. Aceite temporário, owner Felipe, prazo: quando iOS entrar no escopo ou antes de 2026-10-09, o que ocorrer primeiro. |

O aceite acima é temporário e não elimina o resultado não-zero do audit; ele
registra a decisão de produto, o alcance reduzido e a obrigação de reauditar.

### T073 e T074 — evidência humana disponível

- T073 foi concluída no escopo Android-only. A suíte mobile passou em 29/29
  suítes e 83/83 testes; typecheck, lint, formato, Expo Doctor 21/21 e export
  também passaram. iOS, contraste renderizado, medição física e VoiceOver ficam
  fora desta iteração e continuam `NOT MEASURED`.
- T074 foi concluída como evidência funcional do projeto solo: automação e
  walkthrough Android do responsável. Não foram inventados participantes,
  tempos, abandono ou taxas; SC-002, SC-003 e SC-008 continuam `NOT MEASURED`.

### T075 — revalidação final

Após T071–T074, os gates executados foram:

| Superfície | Resultado |
|---|---|
| Backend Prisma validate/generate/migrate | PASS; 11 migrations, 0 pendentes em `avisa_ai_test` |
| Backend formato/lint/typecheck/build | PASS |
| Backend unitário | PASS; 12 suítes/78 testes; cobertura 71.53% statements, 60.52% branches, 66.41% functions, 71.47% lines |
| Backend integração/contrato/e2e | PASS; 6/46, 1/7 e 3/11 respectivamente |
| Mobile typecheck/lint/format/doctor | PASS; Expo Doctor 21/21 |
| Mobile comportamento/coverage | PASS; 29 suítes/83 testes; 74.07% statements, 72.62% branches, 66.05% functions, 73.26% lines globais |
| Mobile export | PASS; Web, iOS e Android empacotados; isso prova somente bundle, não auditoria humana iOS |
| Commitlint | PASS; 10 commits locais, zero problemas |

Os logs de `act(...)` do RNTL e as mensagens de rollback simulado do backend
foram warnings esperados com exit 0. `npm audit --omit=dev --json` permanece
um gate informativo não-zero pelos advisories aceitos acima. Rulesets/PR
bloqueada e auditoria de migration em cada ambiente alvo continuam evidências
externas/históricas não reexecutadas nesta sessão.

### Disposição final

T071, T073, T074 e T075 estão concluídas em `tasks.md` segundo o escopo
Android-only explicitamente aprovado. A decisão operacional é permitir o
lançamento inicial Android sob aceite dos riscos listados, sem declarar
readiness cross-platform, thresholds estatísticos ou enforcement externo como
`PASS`. O próximo trabalho necessário é reauditar dependências antes do prazo,
e somente depois repetir iOS/participantes se esses recursos entrarem no escopo.
