# Fundação visual mobile

A identidade verde/neutra existente foi preservada e organizada em tokens semânticos em
`src/theme/tokens.ts`. Telas e componentes devem consumir os tokens, não valores hexadecimais
locais.

## Regras

- Texto normal usa contraste WCAG 2.2 AA de pelo menos 4,5:1; texto grande e limites de UI
  significativos usam pelo menos 3:1.
- Tipografia sempre informa tamanho, line-height e peso; o layout deve aceitar texto ampliado e
  mensagens em português sem truncar a ação.
- Espaçamento usa a escala de 4 a 40, radius usa a escala compartilhada e elevação é discreta.
- Alvos interativos têm no mínimo 44×44 pt no iOS, 48×48 dp no Android e 44×44 unidades na web.
- Estados de botão são primary, secondary, ghost e destructive, com default, pressed, disabled e
  busy. Campos expõem foco, erro, disabled e helper text.
- Loading, empty, error, success e not-found devem informar o estado e, quando aplicável, uma
  próxima ação acessível.
- Ações destrutivas são identificadas por texto e ícone/posicionamento; nunca dependem apenas da
  cor.
