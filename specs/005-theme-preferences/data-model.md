# Data Model: Theme Preferences

**Escopo**: estado e persistência somente do cliente mobile. Nenhuma tabela, migration, DTO, resposta HTTP ou campo de `AuthUser` muda.

## Preferência local de tema

| Campo lógico           | Tipo                                                  | Regra                                                                 |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| `themePreference`      | `'light' \| 'dark'`                                   | Únicos valores válidos; rótulos visíveis `Claro` e `Escuro`.          |
| Chave de armazenamento | string constante em `mobile/src/constants/storage.ts` | Namespace próprio, independente de `accessToken` e `refreshToken`.    |
| Valor salvo            | string AsyncStorage                                   | `light` ou `dark` sem JSON/objeto de conta; não é removido em logout. |

Leitura ausente, desconhecida, corrompida ou com exceção retorna `light`. Escrita falha não altera o valor em memória da sessão e informa que uma nova inicialização pode restaurar o último valor válido salvo. Pessoas diferentes no mesmo dispositivo leem a mesma chave.

## Estado do tema em memória

| Campo lógico         | Tipo                       | Significado                                                                                                        |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `phase`              | `'restoring' \| 'ready'`   | `restoring` impede montar rotas/estados React; `ready` permite navegar. Erro de leitura também termina em `ready`. |
| `preference`         | `'light' \| 'dark'`        | Escolha ativa, inicializada em Claro apenas internamente até a restauração terminar.                               |
| `palette`            | `Theme`                    | `lightTheme` ou `darkTheme` correspondente a `preference`.                                                         |
| `persistenceWarning` | string ou `null`           | Feedback legível após falha da gravação da escolha atual.                                                          |
| `selectionVersion`   | inteiro monotônico interno | Identifica a escolha mais recente para suprimir aviso obsoleto e garantir ordem de escrita.                        |

### Transições

```text
mount -> restoring
restoring + valor válido -> ready(preference = valor)
restoring + ausente/inválido/erro -> ready(preference = light)
ready + selecionar valor -> ready(preference = valor, aviso limpo), escrita enfileirada
escrita atual bem-sucedida -> ready(preference mantida, sem aviso)
escrita atual falha -> ready(preference mantida, aviso de possível não persistência)
logout / expiração / novo login -> ready(preference mantida)
nova inicialização -> restoring -> leitura da última gravação válida ou fallback
```

A fila de escrita segue a ordem das seleções. Se uma falha anterior ocorrer após uma seleção mais nova, o aviso antigo não aparece. Se a gravação final falhar, a sessão usa a seleção final, enquanto o valor salvo pode continuar anterior.

## Paleta semântica

`lightTheme` e `darkTheme` compartilham a mesma estrutura. As métricas `spacing`, `radius`, `typography`, `targets` e `elevation` continuam comuns. Valores de cor são imutáveis por paleta e acessados pelo tema ativo.

| Grupo            | Papéis atuais a preservar ou especializar                                                              | Uso                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Base             | `background`, `surface`, `surfaceMuted`, `border`, `borderStrong`                                      | Tela, card, campo, separação e foco.                    |
| Texto            | `text`, `textMuted`                                                                                    | Título, valor, apoio, placeholder e estado vazio.       |
| Ação             | `primary`, `onPrimary`, `primaryPressed`, `primarySubtle`                                              | Ação primária, texto sobre ação, pressionado e seleção. |
| Semântica        | `info`, `onInfo`, `success`, `onSuccess`, `warning`, `onWarning`, `danger`, `onDanger`, `dangerSubtle` | Mensagens, badges, erro e ação destrutiva.              |
| Navegação/dialog | `tabBarActive`, `tabBarInactive`, `backdrop` e papel de superfície/borda quando necessário             | Barra de abas, navegação secundária e modal.            |

Aliases em `AUTH_THEME` são projeções da paleta ativa (`surfaceSoft`, `primaryDark`, `primarySoft`, `primaryBorder`, `muted`, `error`, `errorSoft`), sem segunda fonte de cores. Se o alias atual deixar de expressar bem a semântica em Escuro, substituí-lo por papel direto, documentando o uso; não duplicar cores literais nas telas.

## Invariantes

- Um único `ThemeProvider` fornece a mesma preferência para rotas públicas e autenticadas.
- Alterar o tema não modifica identidade do usuário, cache de consultas, rota, scroll, valores, teclado, dialog ou mutation pendente.
- A opção marcada no Perfil sempre corresponde à paleta em memória, mesmo quando a escrita local falha.
- `lightTheme` e `darkTheme` têm exatamente o mesmo conjunto de papéis; cada par texto/fundo usado atende aos limites de contraste da spec.
