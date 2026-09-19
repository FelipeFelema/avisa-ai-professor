# Quickstart Validation Guide

Use este roteiro depois da implementação para validar a feature 002. Os
comandos abaixo não foram executados durante o planejamento.

## Pré-requisitos

- Node.js 22+ e npm;
- dependências do diretório mobile sincronizadas com o lockfile;
- emulador ou dispositivo Android conectado;
- backend local disponível para os fluxos reais de Login/cadastro;
- conta de teste e, para as rotas autenticadas, dados descartáveis de turma e
  comunicado.

## 1. Validação automatizada direcionada

No diretório mobile:

~~~powershell
npm test -- --runInBand tests/components/BackButton.spec.tsx tests/components/AuthScreen.spec.tsx tests/routes/auth-navigation-ux.spec.tsx tests/routes/secondary-navigation.spec.tsx
~~~

Esperado:

- o controle usa label/role corretos, alvo mínimo e uma única transição;
- histórico chama back, ausência de histórico chama o fallback com replace;
- o Login tem exatamente um Criar conta;
- as sete rotas montam o controle nos estados relevantes;
- Responsável e Professor mantêm campos, mensagens e valores enquanto o
  formulário é rolado.

## 2. Gates completos do mobile

~~~powershell
npm run typecheck
npm run lint
npm run format:check
npm run doctor
npm run test:ci
npm run export:ci
~~~

Classifique resultados como PASS, WARN, FAIL, NOT RUN ou NOT MEASURED. Um
problema de rede ao consultar o Expo Doctor deve ser separado de falha de
comportamento do aplicativo. Export comprova empacotamento, não usabilidade
manual nem teste de iOS.

## 3. Walkthrough Android do Login e cadastro

Inicie o app:

~~~powershell
npm run android
~~~

1. Abra Login e conte as ações visíveis Criar conta; deve existir exatamente uma,
   associada a Não possui uma conta?.
2. Toque nessa ação e confirme que o cadastro abre.
3. No cadastro, confirme que Voltar está visível e que retorna ao Login.
4. Volte ao cadastro e selecione Responsável.
5. Com o teclado aberto, percorra Nome completo, E-mail, Senha e Confirmar
   senha. Em cada campo, confirme que o controle focado e a mensagem de erro
   ficam alcançáveis; role até Cadastrar.
6. Provoque erros de validação e confirme que a mensagem abaixo do campo também
   pode ser visualizada com o teclado aberto.
7. Repita para Professor, incluindo Código do professor; alterne o perfil com o
   teclado aberto e confirme que a seleção e os valores mantidos pela regra
   atual não são perdidos.
8. Toque rapidamente duas vezes em Voltar e confirme uma única transição.
9. Use o botão/gesto nativo do Android em uma execução separada. O teclado pode
   fechar primeiro conforme a plataforma; a ação nativa seguinte deve retornar
   normalmente, sem transição duplicada.

## 4. Walkthrough Android das sete telas secundárias

Monte uma matriz de evidência com uma linha para cada rota:

| Tela | Abrir a partir de | Verificações |
|---|---|---|
| Cadastro | Login | Voltar visual, fallback Login e voltar nativo |
| Criar turma | Turmas como Professor | Voltar para Turmas, inclusive durante erro de envio |
| Detalhe da turma | Home e Turmas | retorno à origem imediata e fallback Turmas em entrada direta |
| Novo comunicado | Detalhe da turma | retorno à turma, durante envio/erro e sem duplicação |
| Detalhe do comunicado | lista da turma | retorno à origem, fallback da turma quando classroomId for conhecido |
| Editar comunicado | detalhe do comunicado | retorno ao detalhe, inclusive conteúdo indisponível |
| Editar perfil | Perfil | retorno ao Perfil, preservando o formulário ao sair conforme o comportamento atual |

Para cada linha:

1. confirme um único controle visual Voltar, com área de toque adequada;
2. acione-o uma vez e registre a rota de destino;
3. repita a abertura e use o botão/gesto nativo;
4. simule ou provoque loading/erro/not-found quando a rota permitir e confirme
   que a saída visual permanece;
5. repita um toque rápido para comprovar que não há duas transições;
6. quando possível, abra a rota diretamente/sem histórico e registre o pai
   seguro usado.

Não altere formulários para produzir evidência de descarte: esta feature não
adiciona confirmação de dados não salvos.

## 5. Evidência e limitações

Registre no review da feature:

- dispositivo Android, versão e tamanho/orientação usados;
- rotas exercitadas, origem, destino, estado da tela e resultado;
- evidência do teclado aberto nos dois perfis;
- resultado do botão/gesto nativo e do teste de toques rápidos;
- logs dos gates automatizados.

O planejamento não comprova execução. Como a versão inicial é Android-only,
evidência de iOS, VoiceOver, métricas de participantes e outras plataformas
deve permanecer NOT MEASURED se não estiver disponível.
