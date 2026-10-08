# Export JS Android local: inspeção concluída

T028/T029/T033/T035. Autorização explícita do proprietário em 2026-10-08 somente para export JS Android local/source maps. Restrição EAS/APK/AAB/deploy/Git mantida.

**PRODUCTION_API_URL = PENDING**. O proprietário confirmou que a API ainda não foi publicada e não existe URL HTTPS real confirmada. URL sintética usada apenas localmente: `https://release-audit.example.com/api/v1`. Não houve request a esse endpoint, nem teste de conectividade/contrato/produção real.

Comando aceito: `node node_modules/expo/bin/cli export --platform android --no-bytecode --source-maps --output-dir .expo-release-security-export/cleared --clear`, executado de mobile, profile production, NODE_ENV=production, **DEV** false, exit 0, 2026-10-08T14:27:35.106Z → 2026-10-08T14:27:54.132Z UTC (2026-10-08 America/Sao_Paulo). Artefato não commitado sobre HEAD 832626de96c9ad5ef7446d8aba4f759113d1385a. JS SHA-256 `733fabad83e0193de426e88d2235f7a168e7e7f5310eb9776f88126a598688fe`; map SHA-256 `a9f0793ce25b2674f9d14b2fcf953acf287f91e706732b04614eea5e6d84eac6`. 1714 sources e 1714 sourcesContent. [Envelope sanitizado](android-export-inspection.json).

## Presença por pacote/instância

| Pacote/instância                   | Resultado neste export                                           | Classificação                                                          |
| ---------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| decode-uri-component 0.5.0-avisa.1 | Presente em /vendor/decode-uri-component/index.js; 0.2.2 ausente | MITIGADO / NÃO EXPLORÁVEL para o advisory corrigido                    |
| shell-quote 1.12.0                 | Ausente dos módulos Android                                      | Corrigido; DEV/TOOLING ONLY                                            |
| braces 3.0.3                       | Ausente                                                          | DEV/TOOLING ONLY                                                       |
| image-size 1.2.1                   | Ausente                                                          | DEV/TOOLING ONLY                                                       |
| node-forge 1.4.0                   | Ausente                                                          | DEV/TOOLING ONLY                                                       |
| sprintf-js 1.0.3                   | Ausente                                                          | DEV/TOOLING ONLY                                                       |
| uuid npm 7.0.3 via xcode           | Ausente de /node_modules/uuid/ (incluindo resolução nested)      | DEV/TOOLING ONLY                                                       |
| Expo modules core /src/uuid/*      | Presente: implementação distinta, delega a native UUID           | Não é a instância npm 7.0.3 nem o advisory de buffer dessa dependência |

Módulos identificados pelo inventário completo dos source maps, paths normalizados, instancia/versão do lock e sourceContent. Não pesquisar apenas a palavra uuid para classificar presença. Não extrapolar o inventário JS para bibliotecas nativas do futuro APK/AAB.

## Patch no código executável

SourceContent do decoder idêntico byte a byte ao vendor revisado, hash `ad329c7f73483942111e75dcdc53fef4567e1262d39a0c52e02c87e460551499`; CommonJS/plus-to-space e algoritmo iterativo preservados, decodeComponents recursivo antigo ausente. O Metro dependencyMap do query-string 7.1.3 referencia esse módulo corrigido. Gate executou **a factory do decoder extraída do JS minificado**, em VM isolada, com timeout 1500 ms; valid UTF-8/emoji/plus e %C1 repetido 512/2048/16384 PASS (~0.93/1.47/7.90 ms). Não é apenas prova de arquivo presente no map.

## SEC-012: cache reteve configuração da API

Primeiro export sem --clear tinha IP LAN HTTP em /src/config/env.ts apesar do processo/config receber HTTPS sintético. O valor antigo foi materializado na transformação Metro cacheada; sourceContent bruto do map e app.config isolados não detectariam isso. Gate persistente **rejeitou** esse JS com EXPORT_API_MISMATCH (exit 1). Primeiro artefato preservado em diretório ignorado, não aceito como candidato.

Reexport com --clear recompilou a transformação; API candidata exata presente no módulo executável, zero IP LAN nas referências do novo JS, zero localhost/IP de rede em módulos próprios src/app. Gate PASS exit 0. Correção mínima: export:ci agora usa --clear; novo npm check:android-export aceita path JS/URL pública esperada e verifica config compilada/source maps/decoder/minified runtime. Aplicar inspeção novamente a qualquer candidato final; --clear sozinho não substitui verificação do valor compilado. Nenhuma mudança de contrato/SDK/arquitetura.

## Localhost/HTTP remanescentes e contexto

Não há ausência literal universal de localhost/HTTP: permanecem RN getDevServer fallback, Axios browser-origin fallback, parser WHATWG para normalização file://localhost e comentário sourceMappingURL gerado pelo Expo apontando ao packager localhost. Outros HTTP são base fictícia para resolução de path no Router, validação IPv6 e identificadores JSON Schema do Zod. Paths/linhas de origem no JSON sanitizado.

Esses casos não são baseURL da API. Expo DOM em production resolve asset local e buildUrlForBundle em production recusa fallback de dev server; Axios API usa baseURL explícito HTTPS do módulo validado. sourceMappingURL é comentário de ferramentas, não fetch da API. Mantivemos evidência desses literals; não editamos bundle/dependências para apagar strings. Sem AndroidManifest nativo gerado/inspecionado; cleartext policy futura precisa revalidação no candidato T043.

## Secrets e configuração

Nenhum valor real conhecido JWT/Expo/Firebase private key encontrado no bundle/maps/config/logs. Zero indicadores PEM/JWT/Expo push token nos artefatos escaneados. Seis canaries sintéticos backend-only (JWT access/refresh, DB URL, Expo bearer, FCM key, capability) injetados no ambiente do export estão ausentes em JS e map. Valores não publicados. Config pública local: Android package esperado, projectId esperado, pushDiagnosticsEnabled=false; Google Services/service account não embedados como extra/env. Campo capability e lógica auth presentes no código do cliente não são credenciais reais embedadas.

Sem exposição confirmada: T034 encerrada pelo ramo condicional, sem rotação/revogação externa. Artefatos/source maps permanecem ignorados e locais; não foram publicados. [Secrets](secrets-artifacts.md), [dependencies](../dependency-assessment.md).

## Gates e limites

Quatro npm audits reexecutados nesta inspeção: backend full 23/omit-dev 0, mobile full 62/omit-dev 58, zero critical. Residual tooling continua vulnerável nos vetores documentados; ausência no Android não é correção desses pacotes nem aceite de risco implícito. Lint/formatação do checker PASS. Nenhum código de negócio alterado, suites de negócio do checkpoint anterior preservadas. API real, hosting/TLS remoto, FCM delivery, build nativo, smoke e CI final continuam sem prova. T041/T043 mantidas abertas.
