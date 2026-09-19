# Mobile Interaction Contract: Auth Navigation UX Polish

Este é o contrato de interação da feature 002. Ele descreve o comportamento
observável pelo usuário e pelos testes RNTL; não altera o contrato OpenAPI nem
introduz endpoints.

## 1. Controle visual de voltar

Toda tela secundária deve renderizar exatamente um controle com:

- role de acessibilidade button;
- nome acessível Voltar;
- texto visual ou combinação de ícone e texto que permita reconhecer a ação;
- área mínima de 48 dp no Android, usando os tokens existentes;
- estado não duplicável durante toques consecutivos.

O controle deve permanecer visível na moldura da tela durante loading, erro,
not-found e sucesso. A ação não fecha ou reabre o teclado de forma especial e
não cria confirmação de descarte.

### Algoritmo observável

~~~text
toque em Voltar
  se uma saída visual já estiver em andamento:
    nenhuma transição
  senão:
    bloquear novas ativações imediatamente
    se houver histórico utilizável:
      retornar uma tela com a ação nativa de back
    senão:
      substituir pela rota fallback da matriz
~~~

O botão/gesto nativo do Android continua disponível e não deve disparar o
callback do controle visual nem duas transições. O fallback é uma recuperação
para entrada direta/sem histórico; ele não vence uma tela anterior válida.

## 2. Matriz de rotas

| Tela | Origem normal esperada | Fallback sem histórico | Fallback dinâmico |
|---|---|---|---|
| Cadastro | Login | /login | Não |
| Criar turma | Turmas | /classrooms | Não |
| Detalhe da turma | Home ou Turmas | /classrooms | Não |
| Novo comunicado | Detalhe da turma | /classrooms/:classroomId | classroomId do segmento |
| Detalhe do comunicado | Detalhe da turma ou lista | /classrooms | /classrooms/:classroomId quando identificável |
| Editar comunicado | Detalhe do comunicado | /announcements/:announcementId | announcementId do segmento |
| Editar perfil | Perfil | /profile | Não |

Para cada linha, o teste de histórico deve esperar uma chamada de back e
nenhuma chamada de replace. O teste sem histórico deve esperar exatamente uma
chamada de replace com o fallback e nenhuma chamada de back.

## 3. Estados sem conteúdo

Quando uma tela possui ScreenState de loading, erro ou not-found, o retorno
continua acessível sem depender da query ter sucesso. A ação contextual
existente, como “Tentar novamente” ou “Ver turmas”, permanece disponível e
separada do controle Voltar.

No detalhe de comunicado, se o classroomId ainda não puder ser obtido por causa
de loading, erro ou resposta indisponível, usar /classrooms. Se a resposta
carregada fornecer classroomId, usar a rota da turma no caso sem histórico.

## 4. Cadastro com teclado aberto

O fluxo Responsável deve permitir alcançar e visualizar:

- Nome completo;
- E-mail;
- Senha;
- Confirmar senha;
- mensagens de validação correspondentes;
- botão Cadastrar.

O fluxo Professor deve permitir também alcançar e visualizar Código do
professor, sua mensagem e o botão Cadastrar. A pessoa pode alternar o perfil
com o teclado aberto sem perder os valores que a regra atual mantém. Erros que
aumentem a altura do formulário devem continuar rolando para a área visível.

O comportamento esperado é:

- a viewport é ajustada quando o teclado aparece;
- o formulário continua rolável;
- toques nos campos e no botão continuam tratados pelo ScrollView;
- nenhuma alteração é feita em schema, payload ou mutation;
- o botão de voltar do cadastro permanece fora da área encoberta.

## 5. Login

O Login deve expor exatamente um controle com o nome Criar conta, abaixo ou
associado ao texto Não possui uma conta?. Esse controle deve abrir /register.
Não deve existir um segundo Criar conta abaixo de Entrar.

Campos, validações, feedbacks, mutation e o botão Entrar permanecem com o
comportamento existente. Login é uma tela raiz e não recebe Voltar.

## 6. Telas raiz excluídas

Não renderizar o controle desta feature em:

- Login;
- Home;
- Turmas;
- Perfil.

Essas telas continuam com o comportamento atual do Stack/tabs e com suas ações
existentes.

## 7. Critérios de validação por contrato

| Critério | Prova automatizada | Prova Android |
|---|---|---|
| SC-001 | matriz de sete rotas, histórico e fallback | abrir as rotas a partir das origens e usar Voltar |
| SC-002 | guard e ausência de listener/duplicação nos testes | botão do sistema/gesto após navegação visual |
| SC-003 | contrato estrutural do AuthScreen + testes de ambos os perfis | teclado aberto na menor viewport portrait e com erro |
| SC-004 | contagem exata e push(/register) | observar Login e abrir cadastro |
| SC-005 | role, label e style tokenizado | verificar alvo e descoberta no dispositivo |
| SC-006 | regressão das suites mobile existentes | Login, cadastro Responsável e Professor ponta a ponta |

O estado desta tabela é planejamento; nenhum critério é declarado aprovado antes
da execução descrita em quickstart.md.
