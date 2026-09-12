# Auditoria da migration histórica de `ownerId` — T064

Data da auditoria: 2026-09-09 (America/Sao_Paulo)

## Status

`PASS — ambientes alvo formais auditados e aprovados pelo deployment owner`

## Fatos verificados no repositório

- A migration imutável
  `backend/prisma/migrations/20260807202044_add_classroom_owner/migration.sql`
  executa `ALTER TABLE "Classroom" ADD COLUMN "ownerId" TEXT NOT NULL` sem
  valor default ou backfill, e depois cria a FK `Classroom_ownerId_fkey`.
- O próprio SQL documenta que a operação não é possível se `Classroom` já tiver
  linhas. A migration histórica não foi reescrita.
- `backend/prisma/schema.prisma` mantém `Classroom.ownerId` obrigatório e a
  relação `ClassroomOwner`; a feature depende desse campo para autorização.
- O escopo formal desta release contém somente o banco de desenvolvimento
  `avisa_ai` e o ambiente de validação de migration `avisa_ai_audit` em
  PostgreSQL 15. Não existem ambientes staging ou production provisionados
  nesta release.

## Checks de ambiente

| Check | Resultado | Limite |
|---|---|---|
| Inspeção da migration e do schema | PASS | Confirma o risco estrutural, não o estado de um servidor alvo. |
| `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/avisa_ai_test'; npm run prisma:migrate:deploy` | PASS | Banco descartável local/teste atualizado. |
| Consulta read-only de `ownerId` em `avisa_ai` | PASS | Coluna existe e é `NOT NULL`. |
| Consulta read-only de `ownerId` em `avisa_ai_audit` | PASS | Coluna existe e é `NOT NULL`. |
| Consulta `_prisma_migrations` nos ambientes alvo formais | PASS | Migration concluída e sem rollback nos dois bancos. |
| Staging/production | NOT APPLICABLE | Não estão provisionados nesta release; ficam sujeitos a nova auditoria antes de rollout. |

## Verificação exigida pelo deployment owner

Em cada ambiente alvo, registrar o resultado das consultas equivalentes abaixo,
usando somente acesso de leitura antes de qualquer rollout:

```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'Classroom' AND column_name = 'ownerId';

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20260807202044_add_classroom_owner';
```

Se `ownerId` não existir ou a migration não estiver concluída, o ambiente não é
compatível com os endpoints de ownership. Se a tabela tiver dados e a migration
estiver pendente, não executar o SQL histórico diretamente.

## T064 — Classroom ownership deployment verification

### Environment: local development

**Database:** PostgreSQL `avisa_ai`
**Host:** `localhost:5432`
**Verification type:** read-only, before rollout

#### Schema verification

Query:

```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'Classroom'
  AND column_name = 'ownerId';
```

Result:

```text
column_name | is_nullable
------------+------------
ownerId     | NO
```

Status: PASS. `Classroom.ownerId` exists and is configured as `NOT NULL`.

#### Migration verification

Query:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name = '20260807202044_add_classroom_owner';
```

Result:

```text
migration_name                       | finished_at                       | rolled_back_at
-------------------------------------+-----------------------------------+---------------
20260807202044_add_classroom_owner   | 2026-08-07 17:20:44.081172-03    | NULL
```

Status: PASS. A migration de ownership está registrada como concluída e não
foi revertida.

#### Compatibility decision

O ambiente local de desenvolvimento é compatível com os endpoints de
ownership. A recuperação para dados anteriores à migration não é necessária
neste ambiente porque a migration obrigatória já foi aplicada.

**Deployment owner review**

- Environment: local development
- Decision: APPROVED
- Verification date: 2026-09-08
- Verified using read-only queries: YES

#### Environment note

Existe uma segunda instância PostgreSQL no container Docker local
`avisa-ai-db`. Ela está vazia e não é o banco usado pelo backend nesta
verificação. O backend conecta-se à instância PostgreSQL nativa do Windows em
`localhost:5432`.

Esta seção, combinada com o escopo formal abaixo e a aprovação do deployment
owner, cobre todos os ambientes alvo desta release. Ambientes staging ou
production futuros deverão repetir as mesmas consultas antes do rollout.

## Plano de recuperação se houver dados antes da migration

1. Criar backup/snapshot verificável e registrar janela de mudança.
2. Preparar uma migration nova e revisada que adicione `ownerId` nullable,
   associe cada turma a um professor determinístico de `UserClassroom`, isole
   casos sem professor ou ambíguos para decisão manual e registre a contagem.
3. Verificar ausência de `NULL` e consistência de role/relacionamento antes de
   aplicar `NOT NULL` e a FK `ON DELETE RESTRICT`.
4. Executar uma recuperação em ambiente descartável e registrar procedimento de
   restore antes do rollout do ambiente alvo.

Esse plano fica reservado para ambientes futuros que contenham dados anteriores
à migration. Para os ambientes alvo desta release, a migration já está aplicada
e nenhum backfill foi necessário; o deployment owner aprovou o resultado.


## T064 — Classroom owner migration audit

### Local development environment

Database: `avisa_ai`
Host: `localhost:5432`

Read-only verification confirmed:

- `Classroom.ownerId` exists: PASS
- `ownerId` is `NOT NULL`: PASS
- Migration `20260807202044_add_classroom_owner` exists: PASS
- `finished_at` is populated: PASS
- `rolled_back_at` is `NULL`: PASS

Result: PASS

### Disposable deployment verification environment

Environment: PostgreSQL 15 Docker
Database: `avisa_ai_audit`
Host: `localhost:5433`

The environment started from an empty PostgreSQL database.

`npx prisma migrate deploy` successfully applied all 11 historical migrations.

`npx prisma migrate status` reported:

`Database schema is up to date!`

Schema verification:

- `Classroom.ownerId` exists: PASS
- `ownerId` is `NOT NULL`: PASS

Migration verification:

- Migration: `20260807202044_add_classroom_owner`
- `finished_at`: `2026-09-09 15:51:20.468446+00`
- `rolled_back_at`: `NULL`

Result: PASS

### Recovery / backfill applicability

No backfill was required in the audited environments:

- Local development already contained the completed ownership migration.
- The disposable deployment environment started with no legacy data.

For any future environment containing `Classroom` records before the ownership
migration, the documented recovery procedure must be used instead of executing
the historical migration SQL manually.

### Final result

Local ownership audit: PASS
Disposable migration deployment audit: PASS
Historical ownership migration chain: PASS
Recovery procedure: DOCUMENTED

## Reavaliação da evidência — 2026-09-09

O deployment owner definiu formalmente `avisa_ai` e `avisa_ai_audit` como os
únicos ambientes alvo da release 001 e aprovou a auditoria. Não há staging ou
production provisionados nesta release.

As consultas read-only foram repetidas nesta revisão:

- `avisa_ai` em `localhost:5432`: PASS — `ownerId` é `NOT NULL`; a migration
  está concluída (`finished_at = 2026-08-07 17:20:44.081172-03`) e
  `rolled_back_at` está vazio.
- `avisa_ai_audit` em `localhost:5433`: PASS — `ownerId` é `NOT NULL`; a
  migration está concluída (`finished_at = 2026-09-09 16:28:42.632624+00`) e
  `rolled_back_at` está vazio.

Conclusão: a migration histórica está aplicada em todos os ambientes alvo
formais desta release, não há backfill pendente e a recuperação para ambientes
futuros está documentada. T064 pode ser concluída.

## Target environment scope for release 001

At the time of the Phase 8 verification, the project has no provisioned
staging or production environment.

The deployment owner defines the following environments as the official
verification targets for release 001:

- Local development database: `avisa_ai`
- Release migration validation environment: `avisa_ai_audit`
  running on PostgreSQL 15 via Docker

The Docker environment is maintained during the Phase 8 verification and is
used to validate the complete production-style Prisma migration chain from an
empty PostgreSQL database.

Future staging or production environments must repeat the same read-only
ownership audit before rollout.

## Deployment owner decision

Decision: APPROVED

The deployment owner reviewed the local development environment and the
release migration validation environment.

Both environments satisfy the ownership requirements:

- `Classroom.ownerId` exists
- `ownerId` is `NOT NULL`
- `20260807202044_add_classroom_owner` completed successfully
- `rolled_back_at` is `NULL`

No legacy backfill was required in the audited environments.

Future environments containing pre-migration Classroom data must follow the
documented recovery procedure before rollout.
