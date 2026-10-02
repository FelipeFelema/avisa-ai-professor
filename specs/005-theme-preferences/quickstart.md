# Quickstart: Theme Preferences

Roteiro para validar a implementação futura da [spec](./spec.md) conforme [contrato de UI](./contracts/theme-preferences.md) e [modelo de estado](./data-model.md). Não é evidência de execução. Execute a partir de `C:\src\avisa-ai-professor`; registre comando, saída, data e ambiente no relatório da feature. Use `PASS`, `WARN`, `FAIL`, `NOT RUN` ou `NOT MEASURED` por cenário.

## Pré-requisitos

- Branch `005-theme-preferences`, dependências de `mobile` instaladas, ambiente mobile configurado conforme README do repositório.
- Para cenários autenticados, backend/contas de teste funcionais; cobrir perfis com e sem ações autorizadas sem alterar regras do servidor.
- Para prova visual/manual, dispositivo ou emulador Android com versão e escala de texto registrados; anotar disponibilidade de TalkBack. Registrar iOS à parte se houver dispositivo.
- A spec 004 tem `T020` e `T021` manuais pendentes nesta branch; não classificar os cenários visuais 005 nem 004 como `PASS` por causa de testes automatizados.

## 1. Checagem dirigida automatizada

Depois de implementar as suítes correspondentes, executar do diretório `mobile`:

```powershell
Set-Location 'C:\src\avisa-ai-professor\mobile'
& .\node_modules\.bin\jest.cmd --runInBand tests/theme tests/storage tests/providers tests/routes/profile.spec.tsx tests/components
```

Cobrir pelo menos:

| Área               | Casos necessários                                                                             | Resultado esperado                                                            |
| ------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Paletas/contraste  | chaves iguais, pares texto/fundo reais, estados de ação/campo, cores literais fora de `theme` | Claro/Escuro íntegros; 4,5:1 e 3:1 conforme a spec                            |
| Storage            | ausente, `light`, `dark`, inválido, rejeição de leitura/escrita, logout                       | fallback Claro e preferência independente da sessão                           |
| Provider/bootstrap | leitura pendente, primeira rota após leitura, falha, mudança de sessão                        | nenhum estado React com paleta provisória; app operável                       |
| Corrida de escrita | Claro→Escuro→Claro rápido; primeira/última gravação falha                                     | escolha final visível; valor persistido em ordem; aviso só da falha relevante |
| Perfil             | opções, papel/seleção acessíveis, feedback, edição e logout                                   | troca imediata sem perda das ações anteriores                                 |
| Componentes/rotas  | auth, home, turmas, detalhes, forms, dialogs, estados e abas                                  | cores atualizadas in-place, handlers e navegação iguais                       |

Os nomes de novas suítes podem variar; os diretórios do comando devem ser ajustados aos testes efetivamente adicionados sem omitir os cenários acima. Os testes existentes que inspecionam o antigo singleton Claro precisam ser atualizados para o contrato de duas paletas.

## 2. Gates mobile e regressão

```powershell
Set-Location 'C:\src\avisa-ai-professor\mobile'
& .\node_modules\.bin\jest.cmd --ci --runInBand --coverage --forceExit
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run export:ci
```

`--forceExit` segue o protocolo já usado nas evidências da spec 004 para handles assíncronos; registrar warnings separadamente. `doctor` pode precisar de acesso à Expo API. Testes, Doctor e export não provam cor/barra de status, contraste visual final nem usabilidade manual. Conferir que backend, OpenAPI, schema Prisma e dependências não mudaram:

```powershell
Set-Location 'C:\src\avisa-ai-professor'
git diff --check
git status --short
git diff --name-only
```

## 3. Matriz manual Android

Registrar modelo, Android/API, build, escala de texto, conta/role, tema, rota, resultado e evidência observada. Repetir em Claro e Escuro, com instalação limpa e preferência salva.

| História / critérios | Sequência                                                                                                                  | Observação exigida                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| US1; SC-001          | Perfil → Escuro → Claro; repetir com Perfil rolado e logout pendente                                                       | Duas opções e seleção textual/semântica; troca imediata; scroll, rota e operação preservados.                                                  |
| US1; FR-011          | Simular falha de escrita local no ambiente de teste                                                                        | Tema continua ativo; aviso de possível perda após fechar; app operável.                                                                        |
| US3; SC-003/004      | Escolher Escuro → fechar/reabrir → logout → login, inclusive outra conta; repetir com valor ausente/inválido/leitura falha | Primeiros estados React no tema salvo ou fallback Claro; nenhuma alegação de sincronização. Observar também transição do launch screen nativo. |
| US2; SC-002          | Percorrer Login, Cadastro, Home, Turmas, Perfil, detalhes e formulários de turma/comunicado/perfil                         | Fundo, cards, textos, ícones, bordas, ações e estados sem fragmento da paleta oposta.                                                          |
| US2; SC-006/007      | Campos vazios/focados/preenchidos/inválidos/desabilitados; botões normais/pressionados/desabilitados/pendentes/destrutivos | Todos distinguíveis por texto, forma e contraste nos dois temas.                                                                               |
| US2; SC-002/008      | Loading, vazio, erro, sucesso, item ausente, dialog neutro/destrutivo; abas, back e barra de status                        | Conteúdo e ações completos; backdrop, fundo e ícones/texto do sistema coerentes durante troca e inicialização.                                 |
| US2; SC-005          | Texto normal/grande, conteúdo longo, escala ampliada e TalkBack se disponível                                              | Pares de cor medidos, sem perda por quebra, nomes/roles/seleção anunciados; registrar ferramenta e método de medição.                          |
| US1/US2; SC-009      | Trocar tema com campo preenchido, teclado aberto, lista rolada, dialog aberto e mutation pendente                          | Nada reinicia, fecha, duplica ou perde posição/valor.                                                                                          |
| Regressão; SC-010    | Login, cadastro, busca, criar/editar/excluir/sair de turma, comunicado, edição de perfil, logout                           | Mesmos resultados, permissões, confirmações, navegação e feedback anteriores.                                                                  |

Para qualquer plataforma, tecnologia assistiva, par de contraste ou cenário não observado, registrar `NOT MEASURED`; para comando não executado, `NOT RUN`. Descrever falhas e evidências em vez de estimar aprovação por cobertura indireta.

## Conclusão da validação

Relacionar cada FR-001–FR-025 e SC-001–SC-010 à evidência automatizada ou manual pertinente. Confirmar ausência de endpoint, migration, dado de conta e pacote novo. Fechar a feature apenas com resultados mensurados ou com limites pendentes explicitamente declarados.

## 4. Refinamento Login/Perfil - T042 e FR-026

Após implementar T042, testar o mesmo seletor compacto sol/Claro e lua/Escuro no Login sem sessão e no Perfil. Conferir nomes/roles/seleção, indicação além de cor, rótulo textual do tema atual, contraste em ambos os temas e alvos de pelo menos 48 dp. Selecionar a opção atual deve ser idempotente.

No Login, preencher e-mail/senha e alternar nos dois sentidos, inclusive durante login pendente e depois de um erro; preservar valores, foco/teclado, estado da operação e uma única requisição. Simular falha de gravação e observar o aviso na superfície atual. Conferir que a mesma preferência chega ao Perfil, permanece após logout e é restaurada ao reabrir quando salva com sucesso.

Executar suítes afetadas e regressão completa, gates mobile aplicáveis e reinspeção visual dirigida do novo controle. Registrar FR-026 e US1/AC6 junto ao restante da auditoria. O walkthrough visual aprovado pelo usuário em 2026-10-02 não comprova o controle futuro nem substitui medições especializadas não relatadas.
