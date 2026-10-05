# Avisa AI Professor — instruções persistentes

## Escopo de validação aprovado em 2026-10-04

Leia a seção `Validation Scope for This Individual Project` de
[constitution.md](.specify/memory/constitution.md) antes de planejar, gerar tasks,
implementar, analisar ou executar convergência. A decisão vale para todas as specs
atuais e futuras até a conclusão do projeto, salvo mudança explícita do usuário.

- Não exigir, sugerir como pendência nem recriar tasks de campanhas nativas
  especializadas Android/iOS, TalkBack, VoiceOver ou auditorias físicas de
  acessibilidade/dispositivos.
- Não exigir testes com participantes independentes, amostra, percentuais
  populacionais ou pesquisa de usabilidade sem ajuda. O próprio usuário pode ser o
  único executor do walkthrough funcional do aplicativo.
- Usar testes automatizados e walkthrough individual viável. Registrar relatos do
  usuário como `PASS (user-reported)`; não inventar medições ou cenários observados.
- Tasks retiradas do escopo são `DISPENSADA POR ESCOPO`, sem checkbox de execução e
  sem classificá-las como `PASS`. Elas não bloqueiam dependências, conclusão ou
  release e não devem ser transferidas para specs posteriores.
- Registros históricos sobre ausência de leitores de tela, dispositivos ou
  participantes não são pendências atuais. A política vigente prevalece sobre essas
  exigências antigas em specs, plans, tasks, quickstarts, skills e notas históricas.
- Preservar semântica básica de UI, estados, temas, validação funcional, testes
  automatizados, segurança/integridade de dados e gates aplicáveis. O usuário não
  dispensou pendências de dependências de terceiros ou de CI com esta decisão.

## Preservação do trabalho

Preserve o WIP existente. Planejamento e ajustes de documentação não autorizam
staging, commits, push, PR ou publicação. Validações destrutivas usam somente o
PostgreSQL local isolado `avisa_ai_test`, com as guardas existentes ativas.
