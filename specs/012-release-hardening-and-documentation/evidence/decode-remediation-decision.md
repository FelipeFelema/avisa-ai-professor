# Decisão aprovada: decoder de URLs Android

SEC-009: decode-uri-component 0.2.2, via expo-router 57 → query-string 7.1.3. [GHSA-vcc3-ghjq-m6fr / CVE-2026-45822](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), moderate. Parsing de URLs recebidas é superfície cliente, não autorização backend. Reprodução isolada com query-string.parse: 128 sequências malformadas (384 bytes de valor) ~490 ms; 512/2048 sequências excederam 1500 ms e o child foi encerrado pelo timeout. Sem payload injetado em aplicativo/aparelho real; inclusão do bundle final ainda depende de T028.

Fix oficial: 0.5.0, ESM-only, Node >=14.16. Parent atual pede ^0.2.2 e chama require como função CommonJS. Override direto fica fora do range e altera interoperabilidade; upgrade Expo/Router recomendado por audit é major/downgrade inadequado e não foi aplicado. Fontes locais: query-string/index.js, expo-router/build/react-navigation/core/getStateFromPath.js. Registry consultado nesta execução.

Recomendação para decisão do proprietário: autorizar patch de compatibilidade CommonJS, limitado ao algoritmo de decode, baseado na correção oficial, mantendo API/string/default behavior e licença; patch persistente reproduzido por npm ci, testes diferenciais para URLs válidas/malformadas, timeout negativo e export Android. Isso passa a manter uma correção local transitiva, portanto não foi implementado sem decisão. Alternativa: planejar atualização de SDK/Router com análise de interoperabilidade e escopo próprio. Nenhum risco aceito implicitamente. Classificação provisória REMEDIAR AGORA; deve bloquear candidato até resolver reachability/correção ou decisão explícita de risco com evidência.

T028 export local pendente de autorização específica após rejeição automática; nenhuma prova de artefato production inferida.

## Aprovação e retestes

Proprietário respondeu **Autorizar patch compatível** em 2026-10-07. Implementado mobile/vendor/decode-uri-component 0.5.0-avisa.1, MIT/fonte SHA-256 documentados. Algoritmo oficial iterativo preservado; export CommonJS e plus-to-space mantêm API 0.2.x. Dependência direta file + override npm `$decode-uri-component` evita erro de resolução relativa de override local.

npm ci --no-audit PASS; require pelo parent query-string retorna função; 17 casos comportamento/type errors e timeout pela cadeia real PASS após instalação limpa. Entrada problemática 512/2048 passou ~1/1.6 ms; 16384 ~7 ms. Regressores mobile/Doctor/config/tipos/lint PASS. Não mais reportado no audit; isso é complementado por reteste, não usado sozinho como prova. Estado: REMEDIAR AGORA → MITIGADO / CORRIGIDO no source e runtime Node testado. Confirmação do patch no bundle Android atual permanece pendente T028; candidato não liberado por esta decisão.

## Confirmação no export autorizado — 2026-10-08

[Source map e factory minificada](android-bundle-security.md) confirmam o vendor 0.5.0-avisa.1, ligação query-string e execução com timeout PASS. Prova Android JS anteriormente pendente concluída; PRODUCTION_API_URL = PENDING e candidato EAS/native continuam não executados.
