# Baseline do WIP do editor de comunicado

**Registrado em**: 2026-08-27  
**Escopo**: estado anterior à implementação funcional de `001-app-quality-readiness`

## Estado observado

```text
 M mobile/app/(app)/announcements/[id].tsx
?? mobile/app/(app)/announcements/[id]/edit.tsx
```

O detalhe de comunicado possui uma alteração rastreada de uma linha, corrigindo a
navegação do editor:

```diff
- onPress={() => router.push(`/classrooms/${announcement.id}/edit`)}
+ onPress={() => router.push(`/announcements/${announcement.id}/edit`)}
```

O editor correto é um arquivo novo ainda não rastreado; por isso, não aparece no
`git diff` comum. Seu conteúdo integral foi preservado no worktree e identificado
abaixo.

| Caminho | Estado | Bytes | Linhas | SHA-256 |
|---|---|---:|---:|---|
| `mobile/app/(app)/announcements/[id].tsx` | modificado | 4278 | 170 | `E781FB8B27884C57504AC5CC6EB0C01E889D2814A08B5AC2141F8CFA089B65FE` |
| `mobile/app/(app)/announcements/[id]/edit.tsx` | não rastreado | 7886 | 274 | `9AF7C2DD27ABAA2F8EEEDDE0939675CCE5023502962EF9BCB7753371B04F4103` |
| `mobile/app/(app)/classrooms/[id]/edit.tsx` | rota duplicada rastreada | 7612 | 275 | `C14D0BE8A1240B524352FD20B7DBDBA9F3B8BAEE142576DD9221213D36F79521` |

## Invariantes de preservação

1. O tooling de Setup e a fundação não podem editar, formatar, mover ou excluir os
   dois caminhos com WIP de comunicado.
2. A navegação corrigida para `/announcements/${announcement.id}/edit` deve ser
   preservada durante a consolidação.
3. O editor novo deve permanecer na rota correta
   `announcements/[id]/edit.tsx`, com formulário, duração e mutation existentes
   preservados como ponto de partida.
4. A rota duplicada `classrooms/[id]/edit.tsx` só pode ser removida por T042 depois
   da consolidação e dos testes do editor correto; T039 e T056 precedem essa remoção
   no DAG.
5. Antes de integrar trabalho nesses caminhos, comparar o diff e os hashes atuais
   com este registro. Qualquer diferença deve ser inspecionada e reconciliada; nunca
   restaurada ou descartada automaticamente.

## Comandos de conferência

```powershell
git status --short -- "mobile/app/(app)/announcements/[id].tsx" "mobile/app/(app)/announcements/[id]/edit.tsx"
git diff -- "mobile/app/(app)/announcements/[id].tsx" "mobile/app/(app)/announcements/[id]/edit.tsx"
Get-FileHash -Algorithm SHA256 -LiteralPath "mobile/app/(app)/announcements/[id].tsx", "mobile/app/(app)/announcements/[id]/edit.tsx"
```
