# Evidência US4 — Referência OpenAPI executável

Data da validação: 2026-09-05 (America/Sao_Paulo)

## Comparação do runtime com o contrato

O runtime foi comparado estruturalmente com
`specs/001-app-quality-readiness/contracts/openapi.json`, sem snapshot integral.
O teste verifica a versão OpenAPI, título/versão, inventário exato, `operationId`,
tags, summaries, security, refs de request/response, schemas, `ErrorResponse`,
`RegisterResponse` e `bearerAuth`.

Comando:

```text
npm --prefix backend run test:contract
```

Resultado: PASS — 1 suite e 1 teste aprovados; OpenAPI 3.0.3; 19 operações.

| Método | Caminho | operationId |
|---|---|---|
| GET | `/api/v1/health` | `health.check` |
| POST | `/api/v1/auth/login` | `auth.login` |
| POST | `/api/v1/auth/register` | `auth.register` |
| POST | `/api/v1/auth/refresh` | `auth.refresh` |
| GET | `/api/v1/users/profile` | `users.getProfile` |
| PATCH | `/api/v1/users/profile` | `users.updateProfile` |
| GET | `/api/v1/classrooms` | `classrooms.findAvailable` |
| POST | `/api/v1/classrooms` | `classrooms.create` |
| GET | `/api/v1/classrooms/my` | `classrooms.findMine` |
| POST | `/api/v1/classrooms/{id}/join` | `classrooms.join` |
| POST | `/api/v1/classrooms/{id}/leave` | `classrooms.leave` |
| DELETE | `/api/v1/classrooms/{id}` | `classrooms.delete` |
| GET | `/api/v1/announcements` | `announcements.findAll` |
| POST | `/api/v1/announcements` | `announcements.create` |
| GET | `/api/v1/announcements/classrooms/{classroomId}` | `announcements.findByClassroom` |
| GET | `/api/v1/announcements/{id}` | `announcements.findOne` |
| PATCH | `/api/v1/announcements/{id}` | `announcements.update` |
| DELETE | `/api/v1/announcements/{id}` | `announcements.delete` |
| POST | `/api/v1/invite-codes` | `inviteCodes.create` |

## Ambiente descartável e disponibilidade

- Banco usado no exercício: `avisa_ai_test`; nenhum dado do banco útil `avisa_ai` foi usado.
- `npx prisma migrate deploy` no banco descartável: PASS — 11 migrations encontradas, nenhuma pendente.
- `npm --prefix backend run test:e2e -- --runInBand app.e2e-spec.ts`: PASS — 1 suite, 5 testes.
  A suite cobre health versionado, remoção de `/api`, UI/JSON fora de produção,
  deny em produção mesmo com `API_DOCS_ENABLED=true` e kill switch fora de produção.

## Exercício de onboarding independente

Um revisor em contexto separado da implementação recebeu somente o entry point
`http://localhost:3100/api/v1/docs` e credenciais descartáveis. Nenhum token,
senha, e-mail ou corpo de resposta sensível foi registrado.

| Participante | Início | Fim | Duração | UI | JSON | GET protegido | Mutation protegida | Operações | Resultado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| Revisor independente | 2026-09-05 17:19:48 -03:00 | 2026-09-05 17:20:37 -03:00 | 48,878 s | 200 | 200 | 200 | 200 | 19 | PASS |

O exercício terminou em menos de 15 minutos, com um GET de perfil e um PATCH
de perfil concluídos a partir da referência autenticada.

## Limites

Esta evidência cobre a US4/Phase 6. Auditorias visuais, gates de CI/regras de
branch e polish de documentação pertencem às phases posteriores e não foram
iniciados.
