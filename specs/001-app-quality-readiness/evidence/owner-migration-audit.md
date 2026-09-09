# Auditoria da migration histórica de `ownerId` — T064

Data da auditoria: 2026-09-08 (America/Sao_Paulo)

## Status

`PARTIAL — desenvolvimento local verificado; ambientes alvo pendentes`

## Fatos verificados no repositório

- A migration imutável
  `backend/prisma/migrations/20260807202044_add_classroom_owner/migration.sql`
  executa `ALTER TABLE "Classroom" ADD COLUMN "ownerId" TEXT NOT NULL` sem
  valor default ou backfill, e depois cria a FK `Classroom_ownerId_fkey`.
- O próprio SQL documenta que a operação não é possível se `Classroom` já tiver
  linhas. A migration histórica não foi reescrita.
- `backend/prisma/schema.prisma` mantém `Classroom.ownerId` obrigatório e a
  relação `ClassroomOwner`; a feature depende desse campo para autorização.
- O compose local expõe somente o banco de desenvolvimento `avisa_ai`. A
  execução segura disponível neste checkout aplicou as 11 migrations em
  `avisa_ai_test` e encontrou nenhuma pendente; isso não prova o estado de
  staging/produção.

## Checks de ambiente

| Check | Resultado | Limite |
|---|---|---|
| Inspeção da migration e do schema | PASS | Confirma o risco estrutural, não o estado de um servidor alvo. |
| `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/avisa_ai_test'; npm run prisma:migrate:deploy` | PASS | Banco descartável local/teste atualizado. |
| `docker compose ps` | NOT RUN — Docker API recusou acesso ao named pipe | Não há serviço Docker local disponível para uma nova inspeção isolada. |
| Consulta `_prisma_migrations` nos ambientes alvo | NOT RUN | Não há credenciais/endpoint de deployment fornecidos nesta sessão. |
| Contagem e mapeamento de turmas nos ambientes alvo | NOT RUN | Não há acesso verificável a staging/produção. |

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

Esta seção comprova somente o ambiente local de desenvolvimento. Ela não é uma
auditoria de staging/produção e não autoriza marcar T064 como concluída. As
mesmas consultas ainda precisam ser executadas com acesso read-only em cada
ambiente alvo, por um deployment owner, antes do rollout.

## Plano de recuperação se houver dados antes da migration

1. Criar backup/snapshot verificável e registrar janela de mudança.
2. Preparar uma migration nova e revisada que adicione `ownerId` nullable,
   associe cada turma a um professor determinístico de `UserClassroom`, isole
   casos sem professor ou ambíguos para decisão manual e registre a contagem.
3. Verificar ausência de `NULL` e consistência de role/relacionamento antes de
   aplicar `NOT NULL` e a FK `ON DELETE RESTRICT`.
4. Executar uma recuperação em ambiente descartável e registrar procedimento de
   restore antes do rollout do ambiente alvo.

Esse plano ainda não foi aprovado nem executado por um deployment owner para
os ambientes alvo. Por isso T064 permanece pendente.
