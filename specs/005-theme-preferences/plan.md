# Implementation Plan: Theme Preferences

**Branch**: `005-theme-preferences` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-theme-preferences/spec.md`

## Summary

Adicionar Claro e Escuro ao Login e ao Perfil com um seletor compacto compartilhado de sol/lua e aplicar a escolha imediatamente em todas as superfícies Expo, preservando rota, formulários, dialogs, consultas e operações em curso. Uma preferência da instalação será lida antes das rotas, salva com o AsyncStorage já instalado e mantida após logout. A paleta Clara atual será a referência; uma paleta Escura explícita terá os mesmos papéis semânticos. Escopo exclusivamente mobile: sem API, migration, dado de conta ou pacote novo.

## Technical Context

**Language/Version**: TypeScript 6.0.3, React 19.2.3, React Native 0.86.3, Node.js 22+ como baseline

**Primary Dependencies**: Expo SDK 57, Expo Router, `@react-native-async-storage/async-storage` 2.2.0, `expo-status-bar` 57, TanStack React Query, React Hook Form, Jest e React Native Testing Library; todas presentes em `mobile/package.json`

**Storage**: uma chave AsyncStorage local à instalação; tokens continuam separados em `expo-secure-store`; PostgreSQL/Prisma sem alteração

**Testing**: Jest/RNTL para preferência, bootstrap, corrida de gravações, Perfil e propagação; testes de contraste e varredura de cores literais; regressão de rotas/ações; gates mobile; walkthrough Android em ambos os temas

**Target Platform**: Android como alvo manual inicial; componentes React Native mantêm compatibilidade com iOS, cuja experiência manual depende de evidência própria

**Project Type**: monorepo NestJS/Prisma + Expo/React Native; alteração só no mobile e nos artefatos 005

**Performance Goals**: restauração única antes da primeira tela React utilizável; troca síncrona da paleta em memória, sem consulta de rede, remontagem da navegação ou gravação bloqueante para a UI

**Constraints**: exatamente duas opções, Claro como fallback, preferência compartilhada no dispositivo, sem seguir sistema, sem nova dependência, endpoint, migration ou mudança de domínio; contraste mínimo 4,5:1 para texto normal e 3:1 para texto grande; comportamento existente preservado

**Scale/Scope**: layouts raiz/público/autenticado e abas, Login/Cadastro, Home/Turmas/Perfil, detalhes/formulários atuais, componentes compartilhados e todos os estados visuais enumerados na spec

## Constitution Check

_GATE: aprovado antes da pesquisa; reavaliado após o design._

| Princípio/gate                                | Resultado | Aplicação                                                                                                                                          |
| --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Domain-Modular Architecture                | PASS      | Contexto e hook em `providers`/`hooks`, paletas em `theme`, persistência em `storage`; rotas apenas consomem o tema. `AuthProvider` mantém sessão. |
| II. Secure, Explicit API Contracts            | PASS      | Nenhum contrato HTTP ou autorização muda. O tema não entra no perfil de usuário.                                                                   |
| III. Testable Delivery                        | PASS      | Leitura, gravação, fallback, alternância, corrida, feedback e propagação testáveis; gates mobile e validação manual separados.                     |
| IV. Data Integrity and Safe Evolution         | PASS      | Sem migration ou dado servidor; preferência local independente dos tokens e do logout.                                                             |
| V. Predictable and Accessible User Experience | PASS      | Controle textual/semântico; estados de armazenamento, formulários, dialogs, navegação e contraste definidos para ambas as paletas.                 |
| Restrições de produto                         | PASS      | Dependências existentes, português e paleta Clara preservados; sem conta sincronizada ou opção automática.                                         |

Não há violação constitucional ou `NEEDS CLARIFICATION` de arquitetura. O launch screen nativo é anterior ao JavaScript e não lê a preferência local. O desenho resolve a restauração antes de qualquer estado React; a transição nativa exige observação em build Android. Uma aparência neutra só pode ser prevista se for viável com a configuração já disponível. Se o launch screen parecer Claro antes de Escuro, SC-003 não pode receber `PASS` integral sem rever essa restrição.

## Research and Design Decisions

As observações, alternativas e fontes estão em [research.md](./research.md).

1. **Paletas**: transformar `tokens.ts` em pares Claro/Escuro com os mesmos papéis e métricas. Preservar os valores Claros aprovados, com correção pontual exigida por contraste. `AUTH_THEME` deriva da paleta ativa e deixa de ser um valor global fixo.
2. **Ciclo de vida**: `ThemeProvider` estável acima de `AuthProvider` e do Expo Router. Lê uma chave AsyncStorage uma vez, valida `light`/`dark`, usa Claro para ausência, corrupção ou falha e só libera estados React de navegação após a leitura. O loading React usa a paleta resolvida.
3. **Escolha e escrita**: Login e Perfil reutilizam `mobile/src/components/ui/ThemeSelector.tsx`, com duas opções compactas sol/Claro e lua/Escuro, grupo/seleção acessíveis, rótulo visível do tema atual e alvos de 48 dp. No Perfil permanece no bloco Aparência; no Login ocupa posição secundária junto ao cabeçalho, fora das ações do formulário, usando um slot opcional em `AuthScreen` se necessário. `setTheme` atualiza memória imediatamente; gravações serializadas garantem que a última escolha prevaleça. Falha não reverte a aparência e produz aviso textual relevante na superfície atual, inclusive antes da autenticação. Testar valores/foco/estado pendente do Login preservados, sem repetir a requisição, e a mesma preferência após login/logout/reinício.
4. **Propagação**: substituir leituras estáticas de `theme.colors`/`AUTH_THEME.colors` por hook e estilos derivados durante render, sem `key` que remonte provider, rota, `ScrollView`, formulário ou dialog. Dimensões e tipografia independentes de cor continuam estáticas.
5. **Sistema e navegação**: `expo-status-bar` recebe estilo explícito da preferência; abas e cabeçalhos recebem fundo e tinta da paleta. `userInterfaceStyle: light` não é fonte da preferência nem garante aparência nativa Android sem `expo-system-ui`; verificar elementos nativos em dispositivo. Não introduzir “seguir o sistema”.
6. **Validação**: testes automáticos conferem contrato de estado e pares de cor; matriz Android mede superfície, contraste, texto ampliado, foco, teclado, dialog, barra de status e persistência. Resultados não observados permanecem `NOT MEASURED`.

## Phase 0: Research Output

[research.md](./research.md) documenta baseline, integração, decisões e alternativas. A spec 004 fornece a base visual implementada, mas `T020` e `T021` de sua verificação manual continuam abertos nesta branch; não herdar essa evidência para a 005.

## Phase 1: Design Outputs

- [data-model.md](./data-model.md): valor persistido, estado em memória, transições, regras de validação e papéis da paleta.
- [contracts/theme-preferences.md](./contracts/theme-preferences.md): interface de Perfil, bootstrap, armazenamento, componentes e barra de status; sem API externa.
- [quickstart.md](./quickstart.md): comandos e matriz verificável para as três histórias e regressão funcional.

## Project Structure

### Documentation (this feature)

```text
specs/005-theme-preferences/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/theme-preferences.md
└── quickstart.md

# tasks.md pertence ao fluxo posterior speckit-tasks.
```

### Source Code (repository root)

```text
mobile/
├── app.json
├── app/_layout.tsx
├── app/(auth)/{_layout,login,register}.tsx
├── app/(app)/(tabs)/{_layout,index,classrooms,profile}.tsx
├── app/(app)/{_layout,classrooms,announcements,profile}/...tsx
├── src/theme/{tokens,auth,index}.ts
├── src/contexts/ThemeContext.tsx                    # novo
├── src/providers/{AppProvider,ThemeProvider}.tsx    # ThemeProvider novo
├── src/hooks/useTheme.ts                            # novo
├── src/storage/theme.storage.ts                     # novo, AsyncStorage
├── src/components/{SplashScreen,auth,home,announcements,ui}/...
└── tests/{theme,storage,providers,routes,components,accessibility}/...
```

**Structure Decision**: adicionar só a camada transversal de preferência visual; manter roteamento, separação storage/provider e componentes existentes. Rotas migram estilos dependentes de cor sem mover lógica de domínio. Backend, OpenAPI e banco fora do diff.

## Validation and Handoff

A decomposição futura em `tasks.md` segue: (1) contrato/testes da paleta e persistência; (2) provider e bootstrap; (3) escolha no Perfil e feedback; (4) componentes compartilhados, autenticação, abas e status bar; (5) rotas e estados restantes; (6) contraste, regressão, gates e matriz Android. US1, US2 e US3 conservam testes independentes, mas US2 depende da paleta e US3 da persistência/bootstrap.

O [quickstart.md](./quickstart.md) distingue `PASS`, `WARN`, `FAIL`, `NOT RUN` e `NOT MEASURED`. Evidência manual pendente da 004 e avaliação iOS permanecem limites explícitos.

## Post-Design Constitution Check

| Gate                    | Resultado | Evidência de design                                                                          |
| ----------------------- | --------- | -------------------------------------------------------------------------------------------- |
| Arquitetura e limites   | PASS      | Provider/hook, paletas e storage em camadas próprias; `AuthProvider` preservado.             |
| Segurança e contratos   | PASS      | Preferência local desvinculada da conta, sem API, autorização ou mudança de tokens.          |
| Testabilidade e gates   | PASS      | Contrato e quickstart incluem corrida, falhas, contraste, estados, regressão e gates mobile. |
| Dados e evolução        | PASS      | Valor local validado e fallback seguro; sem schema/migration.                                |
| UX previsível/acessível | PASS      | Seleção semântica, feedback, cobertura integral, preservação de estado e avaliação manual.   |

Resultado pós-design: **PASS**.

## Complexity Tracking

Não aplicável: nenhuma violação constitucional ou nova dependência.
