# Quickstart: Detail Surfaces Visual Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Data**: 2026-10-01

Este é o roteiro de validação para a implementação futura da spec 004. O contrato de interface está em [contracts/detail-surfaces.md](./contracts/detail-surfaces.md), e os dados/estados estão em [data-model.md](./data-model.md). Nenhuma migration, endpoint ou dependência nova é necessária.

## Pré-requisitos

- Node.js 22+, npm e dependências já instaladas em `mobile`.
- Para o walkthrough: API existente disponível, `mobile/.env` com `EXPO_PUBLIC_API_URL` de desenvolvimento, conta `PROFESSOR` proprietária, conta membro não proprietária e dados de comunicado adequados à matriz.
- Emulador ou aparelho Android conectado para medir layout e ações; registrar modelo, versão, escala de texto e tecnologia assistiva quando conhecidos.

## Validação automatizada dirigida

Da raiz do repositório, depois da implementação:

```text
cd mobile
npm test -- --runInBand tests/lib/classroom-expiration.spec.ts tests/routes/classroom-details.spec.tsx tests/routes/profile.spec.tsx tests/routes/confirmation-matrix.spec.tsx tests/routes/secondary-navigation.spec.tsx tests/accessibility/touch-targets.spec.tsx
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run export:ci
```

Incluir na execução Jest qualquer nova suite de `AnnouncementCard` ou das três superfícies criada em `tasks.md`. Rodar `npm run test:ci` como gate mobile completo quando a implementação estiver pronta. Não há testes backend específicos da feature, pois o contrato e o comportamento da API não mudam.

**Resultados esperados**:

1. Turma: nome → `Comunicados`/`+ Novo` aplicável → lista ou vazio → ação contextual, com owner/membro corretos; loading, erro e ausência não se confundem.
2. Card: os três rótulos exatos de expiração, sem prazo negativo, dados essenciais preservados e abertura do detalhe.
3. Comunicado: título, autoria, duas datas e corpo completo em ordem; somente o autor recebe ações; edição/exclusão mantêm os destinos e feedback.
4. Perfil: Nome, E-mail, Perfil e duas ações atuais; loading, ausência e processamento de logout preservados.
5. Testes semânticos, TypeScript, lint, formatação, Doctor e export passam; falhas preexistentes são registradas separadamente.

## Walkthrough Android

Com API e emulador/aparelho disponíveis:

```text
cd mobile
npm run android
```

Registrar os cenários em `specs/004-detail-surfaces-visual-polish/evidence/detail-surfaces-validation.md` com status `PASS`, `WARN`, `FAIL`, `NOT RUN` ou `NOT MEASURED`. Anotar a configuração testada e observações visuais reais.

### Turma — US1

1. Como proprietário, abrir turma com comunicados; conferir contexto, seção, card, prazo hoje/1/X dias e `Excluir turma` depois da lista. Exercitar cancelamento, pending, toque repetido, falha e sucesso.
2. Como membro não proprietário, conferir `Sair da turma` depois da lista, tratamento destrutivo e confirmação; repetir com lista vazia.
3. Como `PROFESSOR` na condição já permitida, conferir `+ Novo` associado à seção e mesmo destino. Não presumir ownership como autorização nova.
4. Observar carregamento da turma, erro de turma com retry, turma ausente, carregamento/erro/404 da lista, lista vazia e preenchida; conferir ações válidas e retorno seguro.
5. Conferir título/professor/prévia longos, nome de turma longo, largura estreita, texto ampliado e ordem de leitura.

### Comunicado — US2

1. Ler comunicado curto e outro com título, professor, conteúdo e quebras de linha longos; conferir título principal, autoria, `Publicado em`, `Expira em` e corpo integral sem corte.
2. Como autor, exercitar `Editar` e `Excluir` com confirmação, cancelamento, pending, toque repetido, falha e sucesso. Como não autor, confirmar ausência das duas ações e composição sem lacuna.
3. Verificar loading, erro com retry, 404 e item ausente, inclusive o botão de voltar/fallback.

### Perfil — US3

1. Confirmar avatar, Nome, E-mail, Perfil, `Editar perfil` e `Sair da conta` para usuário autenticado; exercer edição e logout com estado de processamento.
2. Usar nome/e-mail extensos em largura estreita e texto ampliado; conferir ausência de colisão com ícones e ações.
3. Conferir loading e usuário indisponível com ação `Entrar`.

### Acessibilidade e limite da evidência

Conferir nomes/papéis de controles, foco, ordem de leitura, contraste e alvo de toque. Se TalkBack, iOS/VoiceOver, dispositivo, versão ou participante não estiverem disponíveis, registrar cada lacuna como `NOT MEASURED`. Jest, Expo Doctor e export comprovam somente os aspectos que de fato executam; não substituem inspeção visual, escala de fonte ou tecnologia assistiva.

## Auditoria final

Conferir o diff contra `spec.md` e `contracts/detail-surfaces.md`: nenhum backend, OpenAPI, Prisma, pacote/lockfile, pesquisa, criação/edição fora dos caminhos preservados, tema, senha ou exclusão de conta. Confirmar que a implementação e a evidência cobrem FR-001–FR-023 e SC-001–SC-010 antes de encerrar a feature.
