# Evidência da US2 — Atualizar Meu Nome ou E-mail

Data da validação: 2026-09-02  
Escopo: Phase 4, T026–T036 somente; a execução foi encerrada antes da Phase 5.

## Resultado

PASS para a implementação self-service de perfil no backend e no mobile.

- O backend aceita somente `name` e `email`, normaliza nome com `trim` e e-mail com `trim` + lowercase, preserva caracteres Unicode válidos e não expõe `password`.
- O PATCH usa `sub`/`sid` do JWT, não grava quando o valor efetivo não mudou e revoga transacionalmente as demais sessões somente quando o e-mail muda.
- O conflito de e-mail normalizado retorna `409` sem alterar o perfil.
- O mobile envia somente campos efetivamente alterados, mostra confirmação com o diff, preserva o formulário ao cancelar, aplica o perfil retornado no contexto/query cache e limpa tokens, cache e contexto após expiração `401`.
- Perfil, avatar, nome na tela de perfil e saudação da home consomem a mesma identidade do contexto; os testes de rota observam a atualização no mesmo fluxo, dentro do timeout padrão de `waitFor` (< 1 s, portanto abaixo do requisito de 2 s no ambiente de teste).

## Cenário independente executado

| Cenário | Evidência | Resultado |
| --- | --- | --- |
| `PARENT`, `PROFESSOR` e `ADMIN` alteram nome e e-mail | `backend/test/users.integration.spec.ts` | PASS |
| Nome com espaços externos e e-mail com espaços/maiúsculas | integração, E2E e schema mobile | PASS; valores persistidos canonicamente |
| Nome, e-mail e ambos os campos; limites e caracteres Unicode | testes unitários/schema | PASS |
| No-op normalizado sem `updatedAt`, write ou revogação | integração + schema mobile | PASS |
| `password`, `role`, `id` e campos desconhecidos | integração + E2E | PASS; `400` |
| E-mail já existente após normalização | integração | PASS; `409`, perfil inalterado |
| Duas sessões: sessão A atual permanece ativa; sessão B perde access/refresh | integração + E2E | PASS; login antigo falha e login com e-mail novo normalizado funciona |
| Falha transacional | integração | PASS; atualização e revogação são revertidas |
| Confirmação, cancelamento, diff, atualização de perfil/home e expiração de sessão | testes mobile de rotas, hook, provider e interceptor | PASS |

## Comandos e resultados

- Backend unitário: `npx jest --ci --runInBand` — 12 suítes, 71 testes PASS.
- Backend integração: `npx prisma migrate deploy` + `npx jest --config ./test/jest-integration.json --runInBand` — 5 suítes, 38 testes PASS.
- Backend E2E: `npx prisma migrate deploy` + `npx jest --config ./test/jest-e2e.json --runInBand` — 3 suítes, 5 testes PASS.
- Backend: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npx prisma validate` e `npx prisma generate` — PASS.
- Mobile unitário/rotas: `npm run test:ci` — 19 suítes, 42 testes PASS. As oito suítes específicas da US2 também passaram e encerraram normalmente.
- Mobile: `npm run format:check`, `npm run lint` e `npm run typecheck` — PASS.
- `git diff --check` — PASS.

Os testes de banco usaram o PostgreSQL local `avisa_ai_test`, com as migrações existentes aplicadas; Docker não estava disponível neste ambiente. Os logs de erro de transação são falhas simuladas esperadas pelos testes que verificam rollback. A suíte mobile completa ainda emite um aviso de `act` no teste histórico de exclusão de classroom; as suítes da US2 passaram sem esse aviso e sem handles abertos.

## Notas de escopo

- `backend/src/auth/dto/login.dto.ts` também foi normalizado porque o cenário de login com e-mail canônico exige que espaços e maiúsculas sejam aceitos antes da validação.
- `mobile/app/(app)/(tabs)/index.tsx` e `mobile/src/components/home/HomeHeader.tsx` já liam `user` do `AuthContext`; por isso não precisaram de alteração, e a cobertura de home valida a convergência.
- Nenhum arquivo da Phase 5 ou posterior foi iniciado. O WIP protegido de announcements permaneceu sem alterações.
