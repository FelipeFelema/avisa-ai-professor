# Release, dados e recovery — Android MVP

Este runbook não autoriza deploy, acesso a banco real, rotação de credentials ou restore. Operador: proprietário. Requer decisão explícita para ações externas ou transformação/perda de dados. Guardar dumps e logs em storage privado, com acesso limitado; contêm sessões, PII e tokens de push. Não anexar a Git, PR ou documentação pública. Testes destrutivos somente PostgreSQL loopback **avisa_ai_test**.

## Preparar o deploy

1. Identificar revisão imutável da aplicação, schema/migrations esperados, configuração privada e revisão anterior compatível. `NODE_ENV=production`, JWTs fortes/distintos, `DATABASE_URL` privada, CORS com origins HTTPS explícitas. Não usar docker-compose de desenvolvimento como configuração production. O backend mantém trust proxy false por padrão; TRUST_PROXY_CIDRS permite somente IPs/CIDRs de ingresso verificados, não booleanos/hop counts/aliases/ranges universais. Limitar a uma instância no MVP. Rate limits são locais a cada processo; não ativar trust proxy genérico/`true` para corrigir IPs. Confirmar topologia e isolamento entre clientes antes de liberar tráfego regular; IPs de saída Render não são ranges de ingresso. [Procedimento Render](render-backend-deploy.md).
2. Confirmar HTTPS/TLS na API pública, acesso restrito ao banco e TLS de transporte do banco conforme hosting. Hosting real ainda não verificado na Spec 012. Confirmar secrets e flags no ambiente de destino; não copiar `.env` dev.
3. Parar workers de push em todas as réplicas com `EXPO_PUSH_ENABLED=false`, `ANNOUNCEMENT_PUSH_ENABLED=false`, `ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=false` e redeploy/restart. Variáveis são lidas pelo processo; editar o painel sem restart não prova kill switch. Esperar desligamento/drain. Não apagar events, dispatches, registrations, receipts ou tombstones.
4. Fazer backup consistente e verificar restauração em destino isolado antes de migrations. Usar credenciais por ambiente/arquivo privado de cliente PostgreSQL (PGPASSFILE protegido), nunca URL/senha literal em argumentos públicos. Registrar hash/timestamp/versões/backup ID sem dados. Se o backup falhar, não prosseguir.
5. `npm ci`, `npm run prisma:validate`, `npm run prisma:generate`, `npm run prisma:migrate:deploy` e `npm run build` na revisão aprovada. Migrations separadas do startup da API; startup não executa `reset`, `db push` ou migrations automaticamente. Examinar `prisma migrate status`, checksums (LF/CRLF equivalentes), `_prisma_migrations` e schema antes de servir.

```powershell
# Ambiente privado e destino real já aprovados; não exibir variáveis.
pg_dump --format=custom --no-owner --no-acl --file $releaseBackupPath
if ($LASTEXITCODE -ne 0) { throw 'BACKUP_FAILED' }
Get-FileHash -LiteralPath $releaseBackupPath -Algorithm SHA256
npm run prisma:migrate:deploy
if ($LASTEXITCODE -ne 0) { throw 'MIGRATION_FAILED_STOP_DEPLOY' }
```

A cadeia atual contém 14 migrations. As antigas migrações de `classroomId` e `ownerId` adicionam NOT NULL sem backfill; a migração de `_ClassroomToUser` elimina a associação antiga. Banco anterior a essas migrações com dados exige inventário/backfill/mapeamento aprovado antes de deploy; não executar a cadeia cegamente. O upgrade representativo ensaiado pela 012 começa no schema anterior à 010, com owners/associações já válidos. Instalação vazia também é ensaiada. Nenhuma migration aplicada foi editada.

## Falha durante/depois da migration

Suspender rollout e manter push desligado. Não retry cego: verificar locks, erro sanitizado, histórico e SQL efetivamente aplicado. Preservar snapshot/backup da situação atual. O campo `logs` de `_prisma_migrations` é privado. Não publicar erro SQL/raw stack.

`prisma migrate resolve --rolled-back <migration>` apenas altera o ledger; não desfaz SQL. Usar somente após decisão e verificação dos efeitos parciais, com plano de retry compatível. `--applied` só após provar que todos os efeitos esperados já estão presentes. Não marcar migration falha como aplicada para fazer o deploy ficar verde. `migrate diff` produz proposta a revisar; nunca aplicar output automaticamente. Preferir migration nova corretiva aprovada; não editar migration já aplicada para esconder drift.

Se a migration terminou e a app falhou, redeploy da mesma revisão corrigida ou rollback da app para revisão comprovadamente compatível com o schema atual. Não apagar colunas/tabelas/constraints para acomodar binário antigo. Respeitar migration de refresh legado, sid e revogação: um binário anterior ao hardening 012 não é fallback seguro para sessões. A versão anterior precisa preservar fix de logout e as regras 010/011, occurrenceKey e no-resubmit. Registrar SHA exato aprovado; nesta execução não existe binário production anterior aprovado.

## Restore seguro e preservação de dados

Restaurar primeiro em clone isolado; conferir esquema, histórico de migrations, counts/FKs, ausência de órfãos, conta/turma/exclusão e ledger de push. `pg_restore --list` valida leitura do archive, não substitui restore real. Não usar `--clean`, DROP/reset ou restore sobre banco real sem plano específico de cutover, preservação de writes posteriores e decisão do proprietário. Testes desta spec usam somente avisa_ai_test; não extrapolar seu reset de schema para produção.

Restore de backup antigo pode ressuscitar usuários/sessões excluídos e retirar tombstones de envio já submetido. Manter autenticação/push desligados enquanto reconcilia exclusões/revogações/ledger posterior ao backup. Não reativar registros REVOKED/INVALID, reenfileirar SENDING/UNKNOWN, zerar occurrenceKeys ou apagar events para “reenviar”. Sem reconciliação verificável, não reabilitar envio. Os dados pós-backup precisam ser preservados por plano aprovado; restore não garante perda zero de writes.

## Kill switch, redeploy e verificação

O kill switch total é EXPO_PUSH_ENABLED=false + restart de todas as instâncias. Desligar só reminders mantém NEW; desligar ANNOUNCEMENT_PUSH_ENABLED impede NEW/reminders, mas preserva o teste neutro se Expo permanecer ligado. Publicações criadas com anúncio push desligado têm marker null e não são backfilled; pending previamente solicitado pode ser retomado após reativação. UNKNOWN nunca é reenviado; consultas de receipts podem ser retomadas sem nova submissão.

Antes de reativar: health 200 mínimo, endpoints privados protegidos, docs UI/JSON 404, CORS correto, flags coerentes, ausência de logs privados, migrations OK e revisão Android/API coerentes. Reativar um grupo de flags por decisão explícita, com observação de erros sanitizados/receipts. Aceitação Expo é handoff; não prova receipt no aparelho.

## Ensaio e limites atuais

[Ensaio isolado](../specs/012-release-hardening-and-documentation/evidence/recovery-rehearsal.md), [integridade](../specs/012-release-hardening-and-documentation/evidence/database-integrity.md) e [checkpoint](../specs/012-release-hardening-and-documentation/security-assessment.md). Não há restore/deploy/rollback production executado. Read-only de EAS confirma metadados/FCM/Enhanced Push Security; não substitui candidato/smoke/CI. Fontes: [Prisma recovery](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing), [Expo envio](https://docs.expo.dev/push-notifications/sending-notifications/).

## Checkpoint de API e artefato — 2026-10-08

PRODUCTION_API_URL = PENDING; API ainda não publicada. Export JS local com URL sintética foi auditado; não serve como candidato EAS nem teste de produção real. Sempre limpar cache de transformação ao mudar configuração pública e validar a API inlined no JS; o primeiro export desta inspeção reteve URL LAN antiga e foi rejeitado. `export:ci` limpa cache; `npm run check:android-export -- <android.js> <expected-public-api>` confirma source map, API, modo production e decoder corrigido. Candidato final exige novo gate com a URL real após publicação/autorização.
