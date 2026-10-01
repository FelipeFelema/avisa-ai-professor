# Evidência de validação — Primary Surfaces Visual Polish

**Data da execução:** 2026-09-30  
**Escopo:** Spec 003, Phase 6, T023–T027  
**Alvo manual principal:** Android  
**Branch:** `003-primary-surfaces-visual-polish`

## Legenda

- `PASS`: evidência executada e compatível com o critério.
- `WARN`: evidência executada, mas com limitação ou aviso separado.
- `FAIL`: evidência executada e o critério não foi atendido.
- `NOT RUN`: comando ou cenário aplicável ainda não foi executado.
- `NOT MEASURED`: não há ambiente, dispositivo, participante ou ferramenta para medir o cenário.

## Matriz de cenários

| Área          | Cenário                                   | Evidência esperada                                                             | Status       | Observação                                                                        |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------- |
| Home          | Perfil `PROFESSOR`                        | Saudação, título e cards em ordem compreensível                                | WARN         | Cobertura de rota automatizada é role-independent; walkthrough Android não medido |
| Home          | Perfil `PARENT`                           | Saudação, título e cards em ordem compreensível                                | WARN         | Rota automatizada usa fixture `PARENT`; walkthrough Android não medido            |
| Home          | Loading                                   | Estado de carregamento distinto do vazio                                       | PASS         | `home.spec.tsx` cobriu loading sem empty state                                    |
| Home          | Erro com retry                            | Erro acionável sem ser apresentado como vazio                                  | PASS         | `home.spec.tsx` cobriu erro, retry e não-conflation com vazio                     |
| Home          | Sucesso vazio                             | Mensagem de ausência e CTA contextual                                          | PASS         | `home.spec.tsx` cobriu resposta vazia bem-sucedida                                |
| Home          | Sucesso populado                          | Cards e ações visíveis sem perda de contexto                                   | PASS         | `home.spec.tsx` cobriu cards, ordem e dados ausentes                              |
| Home          | Expiração hoje                            | `Expira hoje`                                                                  | PASS         | Unitário e rota cobriram o rótulo exato                                           |
| Home          | Expiração em 1 dia                        | `Expira em 1 dia`                                                              | PASS         | Unitário e rota cobriram o rótulo exato                                           |
| Home          | Expiração em vários dias                  | `Expira em X dias`                                                             | PASS         | Unitário e rota cobriram o rótulo plural                                          |
| Home          | Sem comunicado ou prazo inválido/expirado | Sem indicador enganoso ou valor negativo                                       | PASS         | Unitário/rota cobriram `null`, ausência e ausência de valor negativo              |
| Turmas        | Perfil `PROFESSOR`                        | Introdução → busca → Minhas turmas → Turmas disponíveis; `Criar turma` visível | WARN         | Rota automatizada cobriu a ramificação; walkthrough Android não medido            |
| Turmas        | Perfil `PARENT`                           | Mesma hierarquia, sem `Criar turma` e sem espaço reservado                     | WARN         | Rota automatizada cobriu a ramificação; walkthrough Android não medido            |
| Turmas        | Regressão de busca                        | Valor, callback e parâmetro `search` preservados                               | PASS         | Rota e serviço dirigidos passaram com o parâmetro preservado                      |
| Turmas        | Listas vazias/loading/erro                | Estados independentes por seção, com retry quando aplicável                    | PASS         | `primary-states.spec.tsx` cobriu estados independentes                            |
| Turmas        | Ações de turma                            | Abrir, `Entrar`, `Sair` e `Excluir turma` permanecem distintos                 | PASS         | Rota cobriu navegação, mutations e confirmação/cancelamento                       |
| Compartilhado | Conteúdo longo/sem professor              | Quebra natural, sem truncamento essencial ou sobreposição                      | WARN         | Testes confirmam texto/ordem; sobreposição visual manual não medida               |
| Compartilhado | Largura estreita                          | Conteúdo e ação continuam legíveis/operáveis                                   | WARN         | Testes usam conteúdo longo; largura real do dispositivo não medida                |
| Compartilhado | Texto ampliado                            | Conteúdo e ações continuam acessíveis                                          | NOT MEASURED | Escala manual não disponível nesta execução                                       |
| Plataforma    | iOS/VoiceOver/TalkBack/participantes      | Evidência manual complementar                                                  | NOT MEASURED | Fora do alvo Android desta fase e sem sessão/participantes disponíveis            |

## Gates automatizados

Os resultados dos comandos direcionados da `quickstart.md` estão registrados abaixo. Testes automatizados, export e Expo Doctor não substituem a leitura manual da interface.

### Backend — T024

| Comando                                                             | Status | Resultado                                                                                        |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `npm test -- --runInBand src/classrooms/classrooms.service.spec.ts` | PASS   | 1 suíte, 17 testes; npm emitiu aviso sobre `--runInBand` e a execução suplementar in-band passou |
| `npm run test:integration -- test/classrooms.integration.spec.ts`   | PASS   | 1 suíte, 9 testes; log de exceção simulada esperado, processo 0                                  |
| `npm run test:contract`                                             | PASS   | 1 suíte, 7 testes                                                                                |
| `npm run typecheck`                                                 | PASS   | `tsc --noEmit` terminou com processo 0                                                           |
| `npm run lint`                                                      | PASS   | ESLint terminou com processo 0                                                                   |
| `npm run format:check`                                              | PASS   | Todos os arquivos backend passaram no Prettier                                                   |
| `npm run build`                                                     | PASS   | `nest build` terminou com processo 0                                                             |

### Mobile — T025

| Comando                                                                                                                                                                                                                                                    | Status | Resultado                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand tests/lib/classroom-expiration.spec.ts tests/routes/home.spec.tsx tests/routes/classrooms-list.spec.tsx tests/routes/primary-states.spec.tsx tests/accessibility/touch-targets.spec.tsx tests/services/classroom.service.spec.ts` | PASS   | 6 suítes, 30 testes; npm emitiu aviso sobre `--runInBand` e a execução suplementar in-band passou |
| `npm run typecheck`                                                                                                                                                                                                                                        | PASS   | `tsc --noEmit` terminou com processo 0                                                            |
| `npm run lint`                                                                                                                                                                                                                                             | PASS   | Expo lint terminou com processo 0                                                                 |
| `npm run format:check`                                                                                                                                                                                                                                     | PASS   | Todos os arquivos mobile passaram no Prettier                                                     |
| `npm run doctor`                                                                                                                                                                                                                                           | PASS   | Reexecutado com acesso à API: 21/21 checks passaram                                               |
| `npm run export:ci`                                                                                                                                                                                                                                        | PASS   | Bundles Android, web e iOS gerados; `.expo-ci-export` removido após a verificação                 |

## Walkthrough Android — T026

**Status:** NOT MEASURED.  
**Verificação de disponibilidade:** `adb` não está instalado (`__ADB_NOT_FOUND__`); não havia dispositivo/emulador conectado para executar `npm run android`.  
**Limite:** os cenários de Home/Turmas, largura estreita, escala de texto e ações continuam sem evidência manual. Export, Doctor e Jest não substituem essa leitura.

## Audit final — T027

| Verificação                                                                              | Status | Evidência                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Escopo restrito a Home, Turmas, cards/estados compartilhados e `expiresAt` aditivo       | PASS   | Caminhos de feature alterados são `classrooms.tsx`, `ClassroomCard`, `EmptyClassroomState`, `FormField` e testes/artefatos da Spec 003 |
| Sem migration/schema Prisma ou endpoint novo                                             | PASS   | `git diff` não contém `backend/prisma/schema.prisma`, migrations, package/lockfile ou controller/rota nova                             |
| Sem alteração de Detail/Profile, tema, semântica funcional de busca ou regras de domínio | PASS   | Nenhum caminho desses domínios foi alterado; busca/mutations permanecem nos hooks e parâmetros existentes                              |
| Contrato `LastAnnouncementSummary.expiresAt` consistente                                 | PASS   | DTO/service, tipo mobile, `primary-surfaces.md` e OpenAPI canônico expõem o campo aditivo `date-time`; contract test passou 7/7        |
| Evidências indisponíveis classificadas como `NOT MEASURED`                               | PASS   | Android, escala manual, iOS, tecnologias assistivas e participantes foram mantidos como `NOT MEASURED`                                 |
| Integridade do diff                                                                      | PASS   | `git diff --check` sem erro                                                                                                            |

## Limitações

- A ausência de evidência manual não foi convertida em `PASS` por testes, export ou Doctor.
- O aviso de `connect EACCES` do primeiro Expo Doctor foi classificado como restrição de rede; a repetição com acesso permitido passou 21/21.
- O aviso do npm sobre `--runInBand` foi separado da evidência; a execução suplementar direta com Jest in-band passou.
- Falhas globais/preexistentes serão separadas dos checks dirigidos e não serão corrigidas incidentalmente nesta fase.
