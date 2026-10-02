# Contract: Classroom Search

**Data**: 2026-10-02 | **Spec**: [spec.md](../spec.md)

Contrato para implementação futura. O contrato HTTP canônico continua em `specs/001-app-quality-readiness/contracts/openapi.json`; esta feature descreve sua alteração de validação/documentação sem copiar um segundo inventário OpenAPI.

## HTTP

**Operação**: `GET /api/v1/classrooms` / `classrooms.findAvailable`.

**Autenticação**: bearer JWT existente. PARENT, PROFESSOR e ADMIN autenticados seguem acesso atual; ausência ou sessão inválida produz 401 pelo fluxo existente. Sem autorização nova.

| Entrada                                                                     | Regra                         | Resultado                                                            |
| --------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| search ausente                                                              | Sem filtro                    | 200, turmas disponíveis da pessoa.                                   |
| search único vazio ou só espaços                                            | trim resulta vazio            | Mesmo critério sem filtro.                                           |
| search único textual                                                        | trim, até 80 pontos de código | Substring literal de name, case-insensitive, acentos significativos. |
| Mais de 80 após trim                                                        | Inválido                      | 400, sem executar listagem inválida.                                 |
| search repetido, array/objeto ou tipo não textual                           | Inválido                      | 400, sem coerção/junção de valores.                                  |
| Query desconhecida, inclusive notação search com colchetes no parser simple | Inválido                      | 400 pelo contrato fechado de entrada.                                |

Vazio é permitido, portanto não declarar `minLength: 1` para a representação bruta. Manter schema textual com `maxLength: 80` e descrição explícita de que o limite é aplicado após trim; exemplos com espaços externos demonstram a transformação. Um validador que aplique esse keyword ao texto bruto não substitui a validação runtime normalizada. Documentar valor escalar único/serialização e que duplicações são rejeitadas.

Não transformar search em uppercase/lowercase ou remover acentos. Espaços internos, números, pontuação e demais caracteres são preservados; `%`, `_` e barra invertida são caracteres literais do termo, não operadores de busca. URL encoding é responsabilidade do transporte existente. Ausência de filtro no mobile omite search, sem enviar strings `undefined`/`null`.

**Resposta 200**: array `ClassroomSummary[]` existente, inclusive `[]` quando não há resultados. Mantém id, name, ownerId, teacher e lastAnnouncement, com a nulabilidade e datas atuais. Sem wrapper, total, campo novo ou regra de ordenação adicional. Toda linha deve satisfazer ausência de UserClassroom para userId autenticado. `GET /api/v1/classrooms/my` permanece sem filtro.

**Resposta 400**: envelope existente ErrorResponse/ValidationError, com statusCode 400 e message no formato atual. Mensagens de validação em português. **401** continua o mecanismo existente; não criar erro customizado de sessão para a busca.

## Exemplos verificáveis

Fixtures para uma pessoa não participante, além de uma turma correspondente já associada:

| search                                | Correspondência esperada                                |
| ------------------------------------- | ------------------------------------------------------- |
| `matemática`                          | Matemática 6º A e Matemática 7º B; não Português 6º A.  |
| `MATEMÁTICA` ou `  Matemática  `      | Mesmo conjunto elegível.                                |
| vazio, espaços ou ausente             | Todas as disponíveis; nunca a turma já associada.       |
| `matematica`                          | Não corresponde a Matemática por remover acento.        |
| `6º A`                                | Números/pontuação/espaço interno tratados literalmente. |
| `%` ou `_`                            | Apenas nomes contendo o respectivo caractere literal.   |
| 80 / 81 pontos de código normalizados | 200 / 400.                                              |
| `?search=mat&search=hist`             | 400; nenhum fallback para o primeiro/último valor.      |

O Prisma mantém a projeção existente e o filtro de membership. Testar o caso de escape e sensibilidade a acento em PostgreSQL, sem inferir comportamento exclusivamente de mock do service.

## Interface mobile

- Campo “Buscar turma pelo nome” dentro de “Turmas disponíveis”, com finalidade explícita e ícone decorativo acessível conforme FormField existente.
- Digitação imediata; estabilização em 300 ms. Nenhuma consulta por valor intermediário, entrada inválida ou intervalo anterior à pausa. Busca inicial sem filtro não é uma edição.
- Validação acima do limite preserva texto e mostra “Use até 80 caracteres na pesquisa”; correção/limpeza remove feedback antigo.
- Espera e loading são diferentes de lista vazia/erro; somente a seção de disponíveis responde à busca.
- Busca sem correspondência: mensagem “Nenhuma turma encontrada para «termo»”, usando o termo normalizado atual, e “Limpar pesquisa”. Sem filtro: conservar empty state geral.
- “Limpar pesquisa” possui nome/papel/alvo acessíveis e remove feedback antigo imediatamente; a consulta sem filtro segue a pausa de edição.
- Erro preserva texto; “Tentar novamente” repete apenas o termo atual válido e estabilizado. Durante edição, não oferecer retry associado ao termo anterior.
- Cards antigos não ficam visíveis/acionáveis em espera, invalidação ou refresh de participação. Sem placeholder de termo anterior; resposta tardia não substitui loading, erro ou dados atuais.
- Claro/Escuro usam tokens da paleta ativa; troca de tema preserva texto, timer, query, confirmações e navegação. Controles reutilizam alvo de toque do projeto; layout/foco/leitura nativos exigem evidência própria.
- “Minhas turmas” continua com conteúdo, ações e estados próprios. Criar/abrir/entrar/sair/excluir mantêm permissões, confirmações, destinos e feedbacks atuais.

## Sucesso e falha de participação

| Ação    | Sucesso do servidor                                                                       | Falha/cancel/pending                                  |
| ------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Entrar  | Invalidar my e todas as disponíveis; turma passa a my e sai das disponíveis.              | Sem confirmação antecipada de membership.             |
| Sair    | Invalidar my e variantes; turma elegível reaparece quando corresponde ao termo.           | Conteúdo não simula saída concluída.                  |
| Excluir | Invalidar my e variantes, mantendo refresh de comunicados existente; turma não reaparece. | Sem remoção como se exclusão tivesse sido confirmada. |

Cancelar requests de listas anteriores ao sucesso antes da invalidação; aguardar refresh ativo. Variantes inativas ficam stale e não exibem cards antes de refresh ao reuso. Não refazer todas as pesquisas inativas desnecessariamente. Cancelamento de consulta é controle de atualidade, não erro visual da busca. Se o servidor concluiu a mutation e o refetch falhou, mostrar erro de listagem/retry, sem afirmar que a mutation falhou ou reverter sua confirmação.

## Limites

Sem novo endpoint, resposta, schema Prisma, migration, dependência, ordenação, pesquisa em my, autocomplete, equivalência de acentos, nova permissão ou persistência do termo. Alterações em Swagger/OpenAPI devem refletir exatamente o runtime e preservar o inventário de operações.
