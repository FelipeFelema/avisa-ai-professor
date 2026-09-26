# Data Model: Auth Navigation UX Polish

## Resultado

Esta feature não cria nem altera entidades persistentes. Não há mudança em
Prisma, PostgreSQL, migrações, Secure Store, tokens, sessões ou contratos de
API. O arquivo formaliza somente os dados transitórios necessários para
desenhar e testar a interação de retorno e a preservação do formulário.

## Política lógica de retorno

| Campo conceitual | Tipo | Origem | Regra |
|---|---|---|---|
| route | caminho da rota | Expo Router | Deve ser uma das sete rotas secundárias da spec. |
| fallbackHref | caminho interno | inventário da feature | É usado somente quando canGoBack() for falso. |
| historyAvailable | booleano momentâneo | estado do Router no toque | Deve ser consultado no callback, não usado como estado visual pré-calculado. |
| navigationLocked | booleano transitório | guard do controle visual | Começa falso, torna-se verdadeiro antes da primeira chamada e impede toques concorrentes. |
| parentContext | identificador opcional | parâmetro ou resposta carregada | Só é necessário para construir o fallback do detalhe de comunicado. |

### Regras de precedência

1. navigationLocked = true encerra a ativação sem qualquer chamada.
2. Com historyAvailable = true, a saída é router.back() e o fallbackHref é
   ignorado.
3. Com historyAvailable = false, a saída é router.replace(fallbackHref).
4. A ativação não altera autenticação, queries, mutations ou dados de formulário.
5. O botão/gesto nativo não compartilha nem altera navigationLocked; ele
   continua sob controle do Stack/React Navigation.

## Registro das sete políticas de rota

| Rota conceitual | Contexto necessário | Fallback estático ou base |
|---|---|---|
| Cadastro | Nenhum | /login |
| Criar turma | Nenhum | /classrooms |
| Detalhe da turma | classroomId para conteúdo, não para o fallback | /classrooms |
| Novo comunicado | classroomId da rota | /classrooms/:classroomId |
| Detalhe do comunicado | classroomId opcional da resposta | /classrooms/:classroomId se identificável; senão /classrooms |
| Editar comunicado | announcementId da rota | /announcements/:announcementId |
| Editar perfil | Nenhum | /profile |

/:id representa o segmento real do Expo Router, não uma URL literal. Os
identificadores não são persistidos por esta feature; são apenas parâmetros
existentes da navegação ou dados já carregados.

## Estado transitório do cadastro

O cadastro mantém o modelo já existente:

- role: responsible ou teacher;
- name, email, password, confirmPassword;
- teacherCode, presente somente para Professor;
- errors e registerError, geridos pelo formulário/mutation atuais.

O ajuste de teclado não deve resetar, serializar, normalizar novamente ou
enviar esses campos. A troca de perfil continua podendo remover teacherCode
conforme a regra atual; a feature somente garante que os campos visíveis, erros
e o botão possam ser alcançados.

## Estados visuais

SecondaryScreen é uma moldura transitória para todos os estados da tela:

- loading: botão de retorno disponível enquanto a query carrega;
- error: botão de retorno disponível junto da ação de tentar novamente;
- not-found/conteúdo indisponível: botão de retorno disponível junto do destino
  seguro;
- success: botão de retorno disponível junto do conteúdo ou formulário.

Nenhum desses estados é salvo localmente ou enviado ao backend.
