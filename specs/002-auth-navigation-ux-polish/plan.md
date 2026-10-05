# Implementation Plan: Auth Navigation UX Polish

**Escopo de validação vigente — decisão de 2026-10-04:** [política permanente](../../.specify/memory/validation-scope.md). Automação e walkthrough funcional pelo próprio usuário são suficientes para o escopo manual. Campanhas nativas especializadas Android/iOS, TalkBack/VoiceOver e participantes independentes estão dispensados; exigências antigas desses itens abaixo são históricas e não bloqueiam conclusão nem geram follow-ups. Semântica básica de UI e gates automatizados permanecem aplicáveis.

**Branch**: 002-auth-navigation-ux-polish | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from specs/002-auth-navigation-ux-polish/spec.md

## Summary

A feature ajustará a navegação visual das sete telas secundárias do aplicativo
mobile, manterá o voltar nativo da plataforma e eliminará o CTA duplicado de
cadastro no Login. O cadastro continuará usando o mesmo formulário, validação,
seleção de perfil e envio; a mudança técnica será tornar o AuthScreen resiliente
ao teclado com os componentes nativos KeyboardAvoidingView e ScrollView.

O retorno visual será uma primitiva compartilhada, usada por um shell de tela
secundária que permanece montado também nos estados de carregamento, erro e
conteúdo indisponível. Ao tocar uma vez, a primitiva consultará
router.canGoBack() no histórico no momento da ação: usará router.back() quando
houver histórico e router.replace() com o pai seguro quando não houver. Um guard
síncrono impedirá dupla transição durante toques rápidos.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.2.3, React Native 0.86.3,
Expo SDK 57, Node.js 22+

**Primary Dependencies**: Expo Router ~57.0.21, @expo/vector-icons,
react-hook-form, Zod, TanStack React Query, Jest Expo e React Native Testing
Library. Nenhuma dependência nova será introduzida.

**Storage**: N/A para esta feature. Expo Secure Store, autenticação, API,
PostgreSQL, Prisma, migrações e dados persistidos não serão alterados.

**Testing**: Jest Expo/RNTL para componentes, rotas, acessibilidade e regressão;
npm run typecheck, npm run lint, npm run format:check, npm run doctor e
npm run export:ci; walkthrough funcional em Android para teclado, voltar
nativo e matriz de rotas.

**Target Platform**: Android como plataforma da versão inicial. O código
continuará compatível com os componentes compartilhados de iOS, mas não serão
inventadas evidências manuais de iOS nesta feature.

**Project Type**: Aplicativo mobile Expo/React Native dentro de um monorepo com
backend NestJS; somente a camada mobile e os artefatos da spec serão afetados.

**Performance Goals**: Uma ativação do controle de voltar deve produzir no máximo
uma chamada de navegação e nenhuma requisição de rede. O ajuste de teclado deve
preservar a rolagem existente e não adicionar trabalho de rede, persistência ou
dependência em runtime.

**Constraints**: Exatamente sete rotas secundárias recebem o controle; Login,
Home, Turmas e Perfil permanecem sem esse controle. A prioridade é Android,
idioma visível em português, alvos de toque de pelo menos 48 dp no Android,
preservação do gesto/botão nativo e de dados não salvos, nenhuma mudança de
autenticação, autorização, contrato externo, regra de cadastro ou backend.

**Scale/Scope**: Uma primitiva de retorno e um shell compartilhado; sete rotas
secundárias; duas variações do cadastro (Responsável e Professor); uma remoção
de CTA no Login; testes unitários/de rota e uma matriz funcional Android.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio/gate                                | Resultado | Aplicação ao plano                                                                                                                                                                                                          |
| --------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Domain-Modular Architecture                | PASS      | O desenho permanece na separação Expo Router → components → hooks/providers. A navegação visual fica em mobile/src/components/ui; rotas continuam responsáveis por composição, sem acoplamento com backend ou persistência. |
| II. Secure, Explicit API Contracts            | PASS      | Não há endpoint, DTO, regra de acesso, token ou validação de API nova. Os formulários continuam no Zod/RHF existente e nenhuma credencial será introduzida.                                                                 |
| III. Testable Delivery                        | PASS      | Serão adicionados testes de BackButton, shell/estados, cadastro/Login e matriz de rotas; os gates mobile existentes continuam obrigatórios.                                                                                 |
| IV. Data Integrity and Safe Evolution         | PASS      | Não há modelo, banco ou migração envolvidos.                                                                                                                                                                                |
| V. Predictable and Accessible User Experience | PASS      | O controle terá nome acessível “Voltar”, role de botão e alvo mínimo; loading/erro/not-found manterão uma saída; texto e feedback continuarão em português.                                                                 |
| Restrições de produto e plataforma            | PASS      | A implementação usa componentes já instalados, preserva as telas raiz e valida primeiro Android; iOS ausente será reportado como não medido.                                                                                |

Nenhuma violação constitucional ou decisão de complexidade excepcional foi
identificada. A fase de pesquisa pode prosseguir.

## Research and Design Decisions

A pesquisa e as decisões completas estão em [research.md](./research.md).

1. **Retorno compartilhado**: criar BackButton em
   mobile/src/components/ui e SecondaryScreen para manter o botão fora da área
   rolável e envolver todos os retornos de loading, erro, not-found e sucesso.
   O componente usará router.canGoBack() apenas no callback; histórico
   utilizável tem prioridade sobre o pai seguro.
2. **Fallback sem histórico**: usar replace, não push, para não acrescentar uma
   rota de recuperação ao histórico. O detalhe do comunicado usará
   /classrooms enquanto o pai não for identificável e
   /classrooms/:classroomId quando a resposta carregada fornecer esse contexto.
3. **Voltar nativo**: não instalar BackHandler, listener ou interceptador. O
   botão/gesto nativo continua sendo responsabilidade do Stack/React Navigation
   e não será duplicado pelo controle visual.
4. **Teclado**: evoluir AuthScreen com KeyboardAvoidingView e manter o
   ScrollView com flexGrow, keyboardShouldPersistTaps="handled" e espaço
   inferior suficiente. O comportamento será selecionado por plataforma, usando
   height no Android e padding no iOS para compatibilidade.
5. **Login**: manter o CTA do rodapé associado a “Não possui uma conta?”,
   remover o botão inline abaixo de “Entrar” e retirar somente o estilo que ficar
   sem uso. A mutation e os campos permanecem intocados.

## Design Details

### Shell e controle de retorno

BackButton será uma primitiva de UI com ícone de seta já disponível em
@expo/vector-icons, texto visual “Voltar”, accessibilityRole="button",
accessibilityLabel="Voltar", estado desabilitado durante a janela de navegação e
alvo baseado em theme.targets.android. O guard será um useRef para bloquear
toques consecutivos antes do próximo render.

SecondaryScreen fornecerá o SafeAreaView, a faixa superior do botão e uma área
de conteúdo. Cada retorno antecipado de estado será colocado dentro desse shell,
para que a saída não desapareça enquanto a query carrega ou falha. O header
nativo continuará oculto, como na configuração atual, evitando dois controles de
retorno com a mesma finalidade.

### Política de fallback por rota

| Rota                  | Fallback sem histórico utilizável | Contexto dinâmico                                                          |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Cadastro              | /login                            | Nenhum                                                                     |
| Criar turma           | /classrooms                       | Nenhum                                                                     |
| Detalhe da turma      | /classrooms                       | Nenhum                                                                     |
| Novo comunicado       | /classrooms/:id                   | id da rota                                                                 |
| Detalhe do comunicado | /classrooms                       | /classrooms/:classroomId quando o comunicado carregado identificar a turma |
| Editar comunicado     | /announcements/:id                | id da rota                                                                 |
| Editar perfil         | /profile                          | Nenhum                                                                     |

No caminho normal, a tela anterior sempre vence o fallback. As telas raiz
/login, /, /classrooms e /profile não renderizarão BackButton.

### Cadastro e teclado

O AuthScreen receberá uma opção explícita para renderizar o botão de retorno
somente no cadastro, com fallback /login. O botão ficará na área segura acima
do ScrollView; o Login não ativará essa opção. O KeyboardAvoidingView ocupará o
restante da tela e reduzirá a viewport disponível sem desmontar os campos.

O ScrollView conservará o comportamento de toques tratado e receberá a
configuração de rolagem/inset necessária para que os campos inferiores e as
mensagens de erro possam ser alcançados com o teclado aberto. A troca de perfil
continuará usando shouldUnregister, clearErrors e resetField já existentes; não
haverá mudança de payload ou validação.

### Cobertura planejada

- BackButton.spec.tsx: sem histórico, com histórico, duplo toque, role, label,
  alvo e ausência de requisição.
- AuthScreen.spec.tsx: shell de teclado, persistência de toques/rolagem e botão
  opcional de retorno.
- auth-navigation-ux.spec.tsx: exatamente um CTA de cadastro no Login, abertura
  do cadastro, Responsável/Professor, campos e botão alcançáveis, preservação de
  valores/validações e back do cadastro.
- secondary-navigation.spec.tsx: as sete rotas, fallback de cada uma, fallback
  dinâmico do detalhe de comunicado, estados loading/error/not-found e ausência
  de botão nas quatro telas raiz.
- Testes existentes: ajustar apenas mocks de useRouter para o novo método
  canGoBack quando a tela compartilhada for renderizada; preservar expectativas
  de mutation, cache e navegação pós-sucesso.

## Phase 0: Research Output

O resultado da pesquisa está em [research.md](./research.md). Todos os pontos
técnicos que poderiam ficar indefinidos foram resolvidos com base na árvore real
do projeto, nos tipos instalados do Expo Router e na documentação oficial dos
componentes de navegação/teclado. Não há esclarecimentos técnicos pendentes.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): registra que não há entidade persistente e
  formaliza a política lógica de retorno e preservação do estado de formulário.
- [contracts/mobile-interactions.md](./contracts/mobile-interactions.md):
  contrato de UI, matriz de rotas, acessibilidade, teclado e compatibilidade com
  o voltar nativo.
- [quickstart.md](./quickstart.md): comandos de gates e roteiro Android para
  provar os critérios de sucesso.

Não será criado contrato OpenAPI nem alteração em backend, pois FR-016 exclui
mudanças de contratos externos e dados persistidos.

## Project Structure

### Documentation (this feature)

```text
specs/002-auth-navigation-ux-polish/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mobile-interactions.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── classrooms/
│       │   ├── new.tsx
│       │   ├── [id].tsx
│       │   └── [id]/new-announcement.tsx
│       ├── announcements/
│       │   ├── [id].tsx
│       │   └── [id]/edit.tsx
│       └── profile/edit.tsx
├── src/
│   ├── components/
│   │   ├── auth/AuthScreen.tsx
│   │   └── ui/
│   │       ├── BackButton.tsx
│   │       ├── SecondaryScreen.tsx
│   │       └── index.ts
│   └── ...
└── tests/
    ├── components/
    │   ├── AuthScreen.spec.tsx
    │   └── BackButton.spec.tsx
    ├── routes/
    │   ├── auth-navigation-ux.spec.tsx
    │   └── secondary-navigation.spec.tsx
    └── setup.ts
```

**Structure Decision**: manter a arquitetura existente do monorepo. A feature é
exclusivamente uma evolução de componentes e telas Expo Router no diretório
mobile, com testes fora de app e sem criar camada, pacote ou dependência
paralela. O backend e seus testes não participam da mudança.

## Validation and Handoff

A implementação futura deverá executar primeiro os testes direcionados da
feature, depois os gates completos do mobile. A validação manual será Android:
menor altura portrait suportada, teclado aberto, texto ampliado quando
disponível, mensagens de validação, toques rápidos, rotas abertas a partir de
cada origem e botão/gesto nativo. A evidência de iOS, VoiceOver e métricas de
participantes permanecerá explicitamente não medida.

## Post-Design Constitution Check

| Gate                    | Resultado | Evidência de design                                                                                                         |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| Arquitetura e limites   | PASS      | Componentes compartilhados concentram somente apresentação/navegação; queries, mutations e validações existentes não mudam. |
| Segurança e contratos   | PASS      | Nenhuma chamada de API, payload, token, regra de acesso ou segredo é introduzido.                                           |
| Testabilidade e gates   | PASS      | O contrato aponta testes RNTL/Jest, typecheck, lint, Prettier, Doctor e export; a matriz cobre os seis SC aplicáveis.       |
| Dados e evolução        | PASS      | Nenhuma entidade, persistência ou migração é necessária.                                                                    |
| UX previsível/acessível | PASS      | Retorno presente em todos os estados, label/role/tamanho definidos, teclado tratável e idioma preservado.                   |

Resultado pós-design: PASS. O plano está pronto para a geração de tasks.md;
esta execução encerra antes da implementação.

## Complexity Tracking

Não aplicável: não há violação constitucional nem componente arquitetural
extraordinário a justificar.
