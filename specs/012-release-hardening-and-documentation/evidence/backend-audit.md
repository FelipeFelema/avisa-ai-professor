# backend: npm audit atual

Execução automatizada local em worktree sobre HEAD 832626de96c9ad5ef7446d8aba4f759113d1385a; Node v22.14.0, npm 11.10.1. Sem audit fix --force/upgrade major.

Lock SHA-256: `0d1853a6e0a4a314eb09dc3f89667159701618ba9f121a3d0b57e2718ae9e97e`.

| Comando                     | Fim UTC                  | Exit | Findings por pacote: moderate/high/critical/total |
| --------------------------- | ------------------------ | ---- | ------------------------------------------------- |
| npm audit --json            | 2026-10-08T00:51:17.786Z | 1    | 20/3/0/23                                         |
| npm audit --omit=dev --json | 2026-10-08T00:51:15.031Z | 0    | 0/0/0/0                                           |

Um advisory raiz pode afetar muitos parents. Exit 1 foi resultado de advisories residuais, não falha de rede. As contagens não são número de CVEs nem prova de exploração no Android. Backend omit=dev terminou com zero; mobile omit=dev ainda instala CLI/build dependencies do Expo.

[Triagem completa](../dependency-assessment.md), [cadeias/nós/versões e dados sanitizados](backend-audit-details.json). Logs JSON originais e metadados de comando ficam privados em logs/spec012.

## Reexecução vinculada ao export local — 2026-10-08

`npm audit --json`: exit 1, 2026-10-08T14:24:19.996Z UTC; 23 findings herdados/raiz, 0 critical.

`npm audit --omit=dev --json`: exit 0, 2026-10-08T14:24:18.938Z UTC; 0 findings herdados/raiz, 0 critical.

Lock não alterado nesta rodada; inspeção [Android](android-bundle-security.md). PRODUCTION_API_URL = PENDING.

## Render — reexecução no SHA implantado em 2026-10-09

SHA 0381690ac13af7f18da20faeb3001071933c97c1 confirmado pelo proprietário. Snapshot isolado: audit full exit 1, 20 moderate/3 high/1 critical/24 total; omit-dev exit 0, zero. Lock mantém o mesmo SHA-256 anterior. Novo pacote critical handlebars@4.7.9 via ts-jest@29.4.6, dois advisories críticos e um moderate. DEV/TOOLING ONLY; patch 4.7.10 proposto e não aplicado. [Evidência e classificação atuais](render-build-startup-hardening-2026-10-09.md), [JSON](render-build-startup-hardening-2026-10-09.json). Zero critical acima é histórico dessa consulta anterior.

## Após remediação autorizada — 2026-10-09

[Proveniência e gates](render-hardening-remediation-2026-10-09.md): lock com somente Handlebars 4.7.9 → 4.7.10; full exit 1, 23 (20 moderate/3 high/0 critical), omit-dev exit 0, zero. Nenhum advisory de Handlebars no relatório atual; ambos critical corrigidos. Logs/JSON finais distintos do assessment pré-remediação. Candidato local WIP, sem novo SHA de deploy.
