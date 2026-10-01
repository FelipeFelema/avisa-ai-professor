# Contract: Primary Surfaces

**Data**: 2026-09-26

Este contrato descreve a resposta consumida pelas superfícies primárias e os
comportamentos de interface que a implementação deve preservar. O contrato
OpenAPI canônico continua em
`specs/001-app-quality-readiness/contracts/openapi.json` e deverá receber a
mesma adição de campo durante a implementação.

## API: resumos de turma

Endpoints existentes, autenticados e versionados:

- `GET /api/v1/classrooms/my`
- `GET /api/v1/classrooms?search={texto}`

Ambos retornam uma lista de `ClassroomSummary`:

```json
{
  "id": "uuid",
  "name": "1º ANO A",
  "ownerId": "uuid",
  "teacher": {
    "id": "uuid",
    "name": "Professora Ana"
  },
  "lastAnnouncement": {
    "id": "uuid",
    "title": "Avaliação na próxima semana",
    "createdAt": "2026-09-26T12:00:00.000Z",
    "expiresAt": "2026-09-29T23:59:59.000Z"
  }
}
```

`teacher` e `lastAnnouncement` continuam podendo ser `null`. Quando o último
comunicado não existe, `expiresAt` não aparece isoladamente. Quando existe,
`expiresAt` é obrigatório, ISO `date-time` e pertence ao mesmo comunicado
ativo já selecionado pelo backend.

O contrato não autoriza o cliente a inferir acesso a partir de `ownerId` nem a
alterar `search`. O servidor continua validando autenticação, membership,
ownership e validade do comunicado.

## UI: Home

1. `HomeHeader` exibe `Olá, [nome] 👋` antes do título principal
   `Bem-vindo ao Avisa Aí Professor`; o cumprimento é menor e o título é o
   maior elemento textual do cabeçalho.
2. Loading, erro, vazio e sucesso são estados distintos e acessíveis.
3. Um card preserva, nesta ordem básica, nome da turma, professor, último
   comunicado e o indicador secundário de expiração quando houver comunicado
   ativo.
4. O indicador usa exatamente `Expira hoje`, `Expira em 1 dia` ou
   `Expira em X dias`. Não há indicador com comunicado ausente ou expirado.
5. O toque para abrir a turma é diferente de qualquer ação destrutiva ou de
   participação.

## UI: Turmas

1. A ordem visual é introdução, busca, `Minhas turmas` e `Turmas disponíveis`.
2. `Criar turma` aparece somente para `PROFESSOR`, associado ao cabeçalho e
   sem criar espaço reservado para outros perfis.
3. O campo mantém label, placeholder, valor, callback, loading, resultados,
   erro e parâmetro de busca atuais. Exibe exatamente um `search-outline`
   decorativo, sem role ou ação própria.
4. As duas listas, seus loading/error/empty states e seus cards permanecem
   visualmente associados à respectiva seção.
5. `Entrar`, `Sair` e `Excluir turma` mantêm labels, mutations, confirmações,
   bloqueios e navegação atuais. O card não absorve o toque dessas ações.

## Acessibilidade e conteúdo variável

- Cabeçalhos de Home, Turmas e seções usam `accessibilityRole="header"` onde
  a tela os apresenta.
- O campo de busca mantém `accessibilityLabel="Buscar turmas"`; o ícone é
  decorativo e não cria uma segunda leitura.
- Controles interativos novos ou alterados mantêm role, nome, estado e alvo
  mínimo de 48 dp no Android e 44 pt no iOS.
- Nomes, títulos e descrições podem quebrar linha; nenhuma informação
  essencial é removida por truncamento sem alternativa.
- Cor não é o único sinal de prazo ou ação destrutiva; o texto/label continua
  explícito.

## Compatibilidade e não-escopo

Este contrato não inclui detalhe da turma/comunicado, Perfil, tema escuro,
correção da semântica da busca, novos filtros, debounce, novas actions ou
mudança de regras de domínio. O único campo novo é o `expiresAt` do resumo.
