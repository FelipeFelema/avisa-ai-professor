# UI Contract: Theme Preferences

**Natureza**: contrato de interface e estado do aplicativo Expo. Nenhum endpoint/API pública, esquema de banco, autorização ou sincronização de conta é criado.

## 1. Controle no Login e no Perfil (US1)

- Depois das informações de identidade e separado das ações de conta, apresentar bloco com nome textual `Aparência` ou `Tema`, finalidade clara e exatamente `Claro` e `Escuro`.
- Cada opção expõe nome acessível, papel de opção apropriado e estado selecionado (`accessibilityState.selected` ou equivalente verificável); o valor atual também aparece em texto/indicação não dependente apenas de cor.
- Selecionar opção atual é idempotente. Selecionar outra atualiza o Perfil e o restante da árvore imediatamente, sem navegação, remount ou perda de scroll/estado.
- Se a escrita local falhar, manter a opção escolhida marcada e mostrar aviso textual/semântico de que pode não persistir após fechar o app. Uma seleção posterior limpa ou atualiza esse aviso de acordo com sua própria gravação.
- `Editar perfil` e `Sair da conta` mantêm rótulos, rotas, estados e handlers existentes; nenhum controle novo de conta é adicionado.
- Refinamento aprovado em 2026-10-02: Login também apresenta o controle sem exigir sessão, em posição secundária junto ao cabeçalho e separada das ações do formulário. Login e Perfil reutilizam seletor compacto de duas opções com sol para Claro e lua para Escuro; cada ícone representa a opção que seleciona, evitando ambiguidade entre tema atual e próxima ação.
- Manter rótulo textual curto do tema atual, nomes acessíveis `Claro`/`Escuro`, grupo/papel/seleção apropriados, indicação de seleção além de cor e alvos mínimos de 48 dp. Ícones são decorativos para a tecnologia assistiva; não anunciam nomes em duplicidade.
- O aviso de falha de gravação aparece também no Login. Trocar tema preserva e-mail, senha, foco/teclado, erro e login pendente, sem navegação, remontagem ou nova tentativa de autenticação. A escolha segue a mesma chave/provider no próximo login, logout e inicialização.

## 2. Restauração e armazenamento (US3)

| Entrada ao iniciar              | Tema aplicado ao primeiro estado React | Navegação                                     |
| ------------------------------- | -------------------------------------- | --------------------------------------------- |
| `light`                         | Claro                                  | Normal.                                       |
| `dark`                          | Escuro                                 | Normal, sem quadro React Claro intermediário. |
| Ausente, inválido ou corrompido | Claro                                  | Normal.                                       |
| Leitura rejeitada               | Claro                                  | Normal, sem bloqueio.                         |

- Durante leitura, não renderizar árvore de rotas, redirect, SplashScreen React ou fundo de navegação em Claro provisório. Após a leitura, o loading de sessão e as rotas entram juntos com a paleta resolvida.
- Escritas seguem ordem de escolha; ao reabrir, a última escolha gravada com sucesso é restaurada. Falha da última escrita mantém o tema atual na sessão e pode restaurar a preferência anteriormente salva depois de reiniciar.
- Logout, expiração de sessão, login e troca de conta não apagam a chave. O Perfil não informa sincronização com conta.
- A transição do launch screen nativo estático para a primeira interface React exige observação em dispositivo. Se necessário, torná-lo neutro para ambas as paletas sem pacote novo.

## 3. Propagação visual (US2)

| Grupo                   | Cobertura obrigatória em Claro e Escuro                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Inicialização/navegação | estado preparatório React, redirects, telas públicas/autenticadas, abas, cabeçalhos/voltar secundários, barra de status |
| Autenticação            | Login, Cadastro, campos, seleção de perfil, validação, rodapé, foco, disabled                                           |
| Principais              | Home, Turmas, Perfil, cards, busca, carregamento, vazio, erro, sucesso                                                  |
| Secundárias             | detalhes e formulários atuais de turma, comunicado e perfil; item ausente                                               |
| Compartilhados          | botões, ícones, `FormField`, `AuthField`, dialogs/backdrop, `ScreenState`, cards e mensagens                            |

- Cada fundo, superfície, texto, borda, ícone e ação dependente de tema usa papel da paleta ativa. Não deixar cor Clara congelada em `StyleSheet.create` no nível do módulo nem literal visual em rotas/componentes em escopo.
- Campos distinguem vazio, preenchido, foco, desabilitado e erro. Ações distinguem primária, secundária, neutra, destrutiva, pressionada, pendente e desabilitada. Estados nunca dependem só de cor.
- Dialog adapta card, backdrop, resumo, consequência, erro e botões mantendo modal e operação no lugar durante troca de tema.
- Abas adaptam fundo, borda, rótulos e ícones ativos/inativos; controles secundários adaptam fundo e contraste. Barra de status usa estilo de texto explícito coerente com o fundo do tema.
- Sem novas consultas, mutations, regras de permissão, validações, destinos de navegação ou capacidade de Perfil. Todo fluxo anterior conserva o mesmo resultado.

## 4. Critérios observáveis

- Contraste de texto normal >= 4,5:1, texto grande >= 3:1, nos pares realmente usados em ambos os temas; limites e ícones essenciais permanecem perceptíveis.
- Texto ampliado e conteúdo longo mantêm leitura/ação; controles expõem nome, papel e estado corretos à acessibilidade.
- Troca com formulário preenchido, teclado aberto, dialog visível, lista rolada ou mutation pendente preserva o estado e não repete ação.
- Testes automatizados validam estado, semântica e pares; walkthrough Android valida aparência e interação real. Resultados sem dispositivo são `NOT MEASURED`.
