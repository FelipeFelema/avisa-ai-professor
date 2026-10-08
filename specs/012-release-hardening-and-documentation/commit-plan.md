# Commits locais da Spec 012 para preparação do Render

Autorização do proprietário em 2026-10-08: revisar/corrigir proxy e rate limit, testar/gates e organizar commits para a branch ficar pronta para push. Push, PR, deploy, EAS/APK/AAB continuam não executados/não autorizados. Não iniciar Fases 7–8. PRODUCTION_API_URL = PENDING.

## Agrupamento

1. `fix(backend): harden sessions and production proxy handling`
   - Backend completo do checkpoint 012: capability de logout/sid, isolamento/privacidade/fixtures/negativos, limite de retenção do limiter, configuração/fail-fast/startup production, correções compatíveis no lock e nova allowlist TRUST_PROXY_CIDRS com testes.
   - Inclui manifest, lock, `.env.example`, scripts, source e testes necessários. Não modifica migrations nem copia `.env`, logs ou artifacts.
2. `fix(mobile): harden sessions and patch URI decoding`
   - WIP mobile 012 aprovado: revogação persistente e proteção de callbacks/sessões, secrets/config production, persistência protegida, patch CommonJS autorizado e gates do export.
   - Inclui vendor/LICENSE/README, manifest/lock, scripts e testes; profile/API real ainda pendente, sem build externo.
3. `docs(release): record Spec 012 hardening and Render preparation`
   - Spec, plano, tasks/checklists/contratos, assessments/evidência sanitizada, runbooks de recovery/Render e ignores de dados privados.
   - Registros anteriores permanecem históricos; o checkpoint atual distingue prova local e remota.

## Verificação

[Gates pré-Render](evidence/render-proxy-readiness.md): backend unit/integration/E2E/contract, lint/format/typecheck/Prisma/build e instalação limpa; mobile unit/quality/Doctor/decoder; audits atualizados e secrets. Commitlint e diff/index revisados antes de finalizar os commits. Gates locais não substituem CI remoto no SHA publicado.

O conjunto inclui o WIP da Spec 012 já existente, preservado em commits por componente. Não incluir arquivos privados ignorados ou mudanças de outra spec. Após os commits, verificar branch, log, worktree limpo e diff contra `832626de96c9ad5ef7446d8aba4f759113d1385a`.

## Antes de publicar/operar

Commits de source confirmados após a queda de energia relatada: backend `3dec7df`, mobile `f67d504`. Evidência/ignores/runbooks compõem o terceiro commit; SHA final consultar no git log, sem referência circular no próprio documento.

Push requer autorização própria. Render deve usar a revisão completa, root `backend` e comandos/ambiente do [checklist](../../docs/render-backend-deploy.md). TRUST_PROXY_CIDRS precisa de ranges de ingresso reais verificados antes de liberar tráfego regular; sem isso, a defesa conservadora pode agrupar clientes do proxy. T041/T043 continuam abertas. Não declarar release Android READY ou CI final executado.
