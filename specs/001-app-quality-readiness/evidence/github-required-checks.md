# Evidência de required checks do GitHub — T063

Data do registro: 2026-09-08 (America/Sao_Paulo)

## Status

`PARTIAL — configuração informada pelo usuário; prova de enforcement pendente`

## Checks que devem ser obrigatórios

Os workflows implementados definem estes nomes estáveis:

- `Backend CI / Run backend checks`
- `Mobile CI / Run mobile checks`
- `Commit Conventions / Validate commits`

Para `develop` e `main`, o usuário informou em 2026-09-08 que os rulesets agora
exigem os três checks. A expressão usada sobre bypass ficou ambígua: se significa
"sem bypass", essa ausência ainda precisa ser confirmada na configuração/export
do ruleset; se significa "com bypass", T063 continua bloqueada até que o bypass
seja removido ou restrito aos administradores autorizados.

## O que foi validado localmente

- Os nomes de workflow/job foram inspecionados nos três arquivos em
  `.github/workflows/`.
- O histórico local recente passou pelo Commitlint.
- Uma mensagem `not conventional` foi rejeitada por exit 1 com diagnósticos
  `subject-empty` e `type-empty`.
- O usuário informou que os rulesets de `main` e `develop` exigem os três checks:
  Backend, Mobile e Commit Conventions. Essa informação ainda não foi
  verificável remotamente nesta sessão.

Isso valida a definição do gate, não o enforcement do repositório remoto.

## O que falta para fechar T063

Para fechar T063, falta a prova operacional no GitHub:

1. Fazer o commit e push da Phase 8 na branch de trabalho.
2. Criar uma branch descartável a partir desse commit.
3. Introduzir somente nessa branch uma falha temporária que faça um dos três
   checks falhar.
4. Abrir uma PR descartável para `main` ou `develop` e registrar o check
   falho, a indicação de merge bloqueado e a URL da PR (ou captura/export).
5. Fechar a PR, remover a branch descartável e retirar o fixture de falha.

Também é necessário confirmar no ruleset a política de bypass. Se houver bypass
ativo para atores que não deveriam poder ignorar os checks, essa configuração
precisa ser corrigida antes do fechamento.

Nesta sessão `gh` não está instalado, o Browser não está disponível, não há
conector GitHub autenticado e não foi autorizada uma alteração remota. Portanto,
nenhuma configuração remota ou PR bloqueada é afirmada como verificada; o
commit/push e o teste descartável permanecem ações do usuário.
