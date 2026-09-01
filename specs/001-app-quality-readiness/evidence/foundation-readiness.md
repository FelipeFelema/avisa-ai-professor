# Foundation readiness — Phase 2

Data da validação: 2026-08-31

## Resultado

Phase 2 (T005–T017) foi implementada e validada. A Phase 3 não foi iniciada.

## Evidências

| Área | Comando | Resultado | O que prova / limite |
|---|---|---|---|
| Prisma schema | `npm exec prisma validate` (backend) | PASS | Schema `AuthSession`/`ClassroomDeletionReceipt` válido. |
| Migration | `npm exec prisma migrate deploy` (backend) | PASS | Migration `20260824_add_auth_sessions_and_deletion_receipts` aplicada no PostgreSQL local. |
| Migration status | `npm exec prisma migrate status` (backend) | PASS | Banco local `avisa_ai` está atualizado. Não é banco descartável `*_test`; a execução isolada com fixture legado permanece uma limitação de ambiente. |
| Backend type/build | `npm run typecheck`; `npm run build` | PASS | Compilação TypeScript e emissão Nest concluídas. |
| Backend unit | `npm test -- --runInBand` | PASS — 12 suites, 58 tests | Auth session lifecycle, auth regressions e suites existentes. |
| Backend integration | `npm run test:integration -- --runInBand` | PASS — 5 suites, 22 tests | Registro, login, sid, refresh rotation, rejeição do token anterior e duas sessões. |
| Backend e2e | `npm run test:e2e -- --runInBand` | PASS — 1 suite, 1 test | Harness e bootstrap e2e executam; o cenário `/api` é baseline legado, não valida comportamento de fases futuras. |
| Backend format/lint | `npm run format:check`; `npm run lint` | PASS | Código e testes da Phase 2 conformes. |
| Mobile type/lint/format | `npm run typecheck`; `npm run lint`; `npm run format:check` | PASS | Harness, tokens, primitivas e boundaries compilam e passam qualidade estática. |
| Mobile behavior | `npm run test:ci` | PASS — 7 suites, 12 tests | Primitivas acessíveis, cancelamento, pending, query keys, HTTP mapping e mutation retry. Não é cobertura das user stories futuras. |
| Expo health | `npm run doctor` | WARN — 19/21 | 2 checks falharam por `fetch failed`/`EACCES` ao Expo API e React Native Directory; não houve diagnóstico local de dependência incompatível. Reexecução escalada foi rejeitada por risco de egress de metadados. |
| Runtime versions | `node --version`; `npm --version`; `npm exec prisma --version` | PASS — Node 22.14.0; npm 11.10.1; Prisma 11.10.1 | Versões usadas na validação. |

## Implementação

- T005 criou bootstrap Nest reutilizável, setup dos runners e limpeza destrutiva protegida por URL local com nome contendo `test`.
- T006–T011 criaram o harness Jest Expo/RNTL, tokens semânticos, documentação visual, quatro primitivas acessíveis, factories de query keys, mensagens HTTP em português e `retry: false` para mutations.
- T012–T013 adicionaram fixture/teste de transformação, migration revisável, backfill de pares legados e as duas entidades operacionais.
- T014–T016 cobriram e implementaram criação por dispositivo, `sid` obrigatório, validação de sessão ativa, rotação por sessão e revogação de outras sessões disponível para o fluxo de perfil.

## Limites e riscos

- O Docker daemon não estava disponível. O PostgreSQL local respondeu e recebeu a migration, mas não foi usado para limpeza destrutiva por não ser um banco de teste reconhecido pelo helper.
- A suíte de migration registra a ordem/backfill e a ausência de FK no receipt; rollback e cascatas completas continuam exigindo um banco descartável dedicado.
- `expo-doctor` tem evidência parcial por indisponibilidade de consultas externas.
- O WIP do editor de comunicado foi preservado; nenhum caminho `mobile/app/(app)/announcements` foi alterado nesta phase.
