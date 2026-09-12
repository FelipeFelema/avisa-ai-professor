# Evidência de required checks do GitHub — T063

Data do registro: 2026-09-09 (America/Sao_Paulo)

## Status

`PASS — os três checks required bloquearam uma PR descartável com falhas reais`

## Checks que devem ser obrigatórios

Os workflows implementados definem estes nomes estáveis:

- `Backend CI / Run backend checks`
- `Mobile CI / Run mobile checks`
- `Commit Conventions / Validate commits`

O usuário confirmou que os rulesets de `develop` e `main` exigem os três checks
e não permitem bypass indevido. Essa configuração é uma evidência administrativa
fornecida pelo usuário; a captura abaixo comprova o enforcement prático no PR
descartável direcionado a `develop`.

## O que foi validado localmente

- Os nomes de workflow/job foram inspecionados nos três arquivos em
  `.github/workflows/`.
- O histórico local recente passou pelo Commitlint.
- Uma mensagem `not conventional` foi rejeitada por exit 1 com diagnósticos
  `subject-empty` e `type-empty`.
- O usuário informou que os rulesets de `main` e `develop` exigem os três checks:
  Backend, Mobile e Commit Conventions, sem bypass indevido.

Isso valida a definição do gate. O enforcement remoto está registrado na prova
operacional abaixo, fornecida pelo usuário.

## Resultado de T063

- `develop`: ruleset configurado e enforcement comprovado por PR falha bloqueada.
- `main`: três checks required e ausência de bypass indevido informadas pelo
  usuário na configuração do ruleset.

T063 está concluída. Se a PR ou a branch descartável ainda estiverem abertas,
o usuário deve fechá-las e removê-las após preservar a evidência.

Nesta sessão `gh` não está instalado, o Browser não está disponível e não há
conector GitHub autenticado; nenhuma alteração remota foi realizada pelo agente.

## Disposable PR enforcement verification

Target branch: `develop`
Disposable branch: `test/verify-required-checks`
Commit visible in the capture: `f401cf5`
Evidence source: screenshot supplied by the user in this review.

A disposable pull request was opened against `develop` using the current
US6 CI configuration.

Observed required checks:

- `Backend CI / Run backend checks (pull_request)` — PASS — Required
- `Mobile CI / Run mobile checks (pull_request)` — FAIL — Required
- `Commit Conventions / Validate commits (pull_request)` — FAIL — Required

The Mobile CI failed because Expo Doctor detected package version mismatches.

The Commit Conventions check rejected an existing non-Conventional Commit:

`Update README with corrected Prisma commands order`

With required checks failing, GitHub disabled the pull request merge action.

Result: PASS

This verifies that the configured required status checks are actively enforced
on `develop`: a real required-check failure prevents merge rather than merely
reporting a failed workflow.

develop:
- ruleset configurado ✅
- required checks configurados ✅
- falha comprovada na prática ✅

main:
- ruleset configurado ✅
- required checks configurados ✅
- sem bypass indevido ✅
