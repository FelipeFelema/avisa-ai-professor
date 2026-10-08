# Secrets: artefatos locais e export Android

T033/T034/T035 concluídas para o escopo local autorizado, 2026-10-08. [Export JS Android/source maps](android-bundle-security.md) efetivamente inspecionado. **PRODUCTION_API_URL = PENDING**; URL do artefato é sintética, não production real.

Scan 2026-10-08T14:35:52.611Z: 654 fontes, 1878 blobs históricos alcançáveis, 351 logs/metadados privados, 172 arquivos textuais de artefato (backend dist, export histórico e ambos os exports Android desta rodada). Zero matches reais conhecidos e zero indicadores heurísticos de segredo em artefatos. JWTs/Expo bearer/Firebase private key comparados internamente, sem exibir valores. Nenhum backend canary em JS/map.

Nenhum token de push/JWT/service account/private key/capability real embutido observado. Lógica que consome tokens em runtime e nomes de campos/storage não são valores secretos. Config pública local tem diagnostics false e IDs esperados; nenhum backend-only extra identificado. Logs não apresentaram valores reais no scan.

T034 ramo condicional: nenhuma exposição confirmada, nenhuma ação externa de contenção/rotação/revogação necessária/executada. Não é um teste fictício de rotação. Gitignore mantém credenciais/exports/maps/logs privados; sourcemaps revelam código-fonte e não devem ser publicados inadvertidamente.

Limites: apenas refs/arquivos acessíveis locais e segredos conhecidos/heurísticas; não logs hospedados, refs excluídos externos, obfuscações arbitrárias nem APK/AAB inexistente. Primeiro export tinha API LAN incorreta (SEC-012), corrigida no segundo com --clear e gate; não foi exposição de secret. Prova vale para hashes do export aceito, não candidato Android final ainda inexistente.
