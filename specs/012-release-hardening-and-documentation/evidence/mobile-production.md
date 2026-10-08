# Android: profile e configuração production

T040 concluída; T041 parcial. eas.json define production: distribution store, environment production, autoIncrement true, Android app-bundle, cleartext false. Package exigido com.avisa.aiprofessor; projectId exigido 70c1f8a0-48dc-4ef4-bbc0-1a1fa56da0b9 (metadado público verificado remotamente). API precisa HTTPS, /api/v1, sem credenciais/query/hash/IP/local/.test. EXPO_PUBLIC permite somente API e identificadores públicos conhecidos; backend secrets públicos falham. EAS_BUILD production exige GOOGLE_SERVICES_FILE.

Production oculta pushDiagnosticsEnabled; botão depende também de `__DEV__`/config existente. Preview continua APK internal e cleartext opt-in somente nesse profile. Plugin nativo força usesCleartextTraffic=false em production e retira networkSecurityConfig herdada; sem alteração de backup/SecureStore. Testes config/push-config finais 26/26; casos negativos URL, inherited cleartext, projeto/package diferente, secret público e Firebase ausente PASS. Não foi gerado AndroidManifest/APK/AAB candidato nesta execução.

URL HTTPS real de produção ainda não informada. URL api.example.com nos fixtures é sintética e comprova formato, não disponibilidade real. GOOGLE_SERVICES_FILE para build deverá ser EAS secret file de configuração cliente; service account privada não deve ser esse arquivo nem entrar no bundle. Ambiente EAS production de variáveis não foi criado/modificado nem assumido configurado. T043 aguarda US5 e autorização externa. [Provider](push-production-provider.md); [bundle JS local auditado](android-bundle-security.md).

Executor: Codex, automatizado local, 2026-10-07 America/Sao_Paulo (alguns metadados UTC já 2026-10-08). Worktree sobre HEAD `832626de96c9ad5ef7446d8aba4f759113d1385a`; não é candidato commitado. Comandos/exit/horários nos [gates](phase4-6-gates.md), hashes em [proveniência](phase4-6-provenance.json). Sem commit/push/PR/build EAS/envio externo. Banco destrutivo somente loopback avisa_ai_test, guardas ativas.

## Estado após export local autorizado — 2026-10-08

**PRODUCTION_API_URL = PENDING**. API ainda não publicada; fixtures/export HTTPS são sintéticos. Profile/guards/config local/export auditados; T041 aberta para configuração real do ambiente com endpoint confirmado. T043 aberto para candidato final com API real/US5/autorização externa. Não existe API real avaliada, APK/AAB, AndroidManifest candidato nem smoke.
