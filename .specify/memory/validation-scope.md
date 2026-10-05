# Escopo permanente de validação do projeto

**Decisão do usuário**: 2026-10-04. **Vigência**: todas as specs atuais e futuras até
a conclusão do projeto, salvo alteração explícita do usuário.

O projeto é desenvolvido e testado por uma única pessoa. Automação e walkthrough
funcional realizado pelo próprio usuário constituem o escopo de validação aprovado.
Não é necessário recrutar outras pessoas ou disponibilizar laboratórios de teste.

## Retirado do escopo

- Campanhas nativas especializadas em Android/iOS, TalkBack e VoiceOver.
- Auditorias físicas de acessibilidade, contraste, alvos de toque, fonte,
  orientação ou dispositivos como condição adicional de conclusão.
- Testes de usabilidade com participantes independentes, amostragem, denominadores,
  percentuais populacionais e estudos de conclusão sem ajuda.

Esses itens são **DISPENSADOS POR ESCOPO**. Não ficam adiados, não são dívida de
release e não devem reaparecer em novas specs, tasks, análise ou convergência. Não
solicitar ambientes, participantes ou autorização novamente para executá-los.
Conservar registros antigos como história, sem transformá-los em cobrança atual.

## Continua no escopo

- Implementar comportamento funcional, estados, rótulos, feedback, temas e
  usabilidade básica do app; preservar as verificações automatizadas viáveis de UI.
- Executar testes automatizados e gates aplicáveis de código/build/contrato/dados.
- Aceitar que somente o próprio usuário realiza o walkthrough funcional, no
  ambiente que já utiliza. Um relato de sucesso é `PASS (user-reported)`.
- Registrar exatamente o que foi observado; nenhum resultado dispensado é
  convertido em `PASS`, medição realizada ou comprovação cross-platform.
- Tratar os riscos de bibliotecas de terceiros e os gates reais do GitHub. Esta
  decisão não dispensa dependências mobile, CI ou a consolidação dos resultados.

Tempos previstos para tarefas funcionais podem servir de referência no walkthrough
individual. Não exigir pesquisa formal, taxa populacional, cronometragem de outros
participantes ou metadados especializados de dispositivo para aceitar esse relato.

## Reconciliação das tarefas existentes

Na Spec 009: T053, T054, T058–T065, T067, T068, T071 e T072 são dispensadas. As
origens 004:T020/T021, 007:T047 e 008:T064 recebem a mesma disposição. Elas mantêm
seus IDs para rastreabilidade, sem checkbox de execução, e deixam de bloquear o DAG.

T052/T066 passam a ser uma única campanha funcional individual de convites; T070
passa a aceitar relato individual de compreensão/uso da exclusão. T073/T074
consolidam somente o escopo ainda aplicável. T057 (dependências) e T069 (CI) mantêm
seus critérios próprios.

## Governança e adoção

A constituição v2.1.0 registra esta política em
[Validation Scope for This Individual Project](./constitution.md#validation-scope-for-this-individual-project).
A alteração adiciona uma política explícita de validação sem remover os princípios
de segurança, integridade, automação ou semântica básica da interface. O usuário
autorizou diretamente a mudança; não há exceção temporária, prazo ou compromisso
de executar depois os itens excluídos.

[AGENTS.md](../../AGENTS.md) aplica a decisão a todas as sessões futuras. Specs,
plans, tasks e quickstarts existentes apontam para este registro. Templates e
skills leem a constituição em tempo de execução e não precisam ser modificados.
