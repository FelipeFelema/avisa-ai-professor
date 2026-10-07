> Historical runtime/build preparation before final product adjustments. Owner subsequently reported P0/P1 walkthrough PASS (user-reported); T060 is now closed after final new/reminder copy PASS (user-reported) and acceptance of automated/configurational production hiding. Production-artifact smoke is reserved for the final release gate; T061 completed after actual successful PR #54 CI on c57b0a4; final closure commit also receives checks before merge readiness. Current expected notification copy and diagnostic visibility are in [quickstart.md](quickstart.md); earlier generic-copy expectations below are superseded.

# Preparação do walkthrough — Spec 011 — 2026-10-07

Preparação operacional autorizada pelo proprietário. Nenhuma lógica de produção, endpoint, relógio, intervalo ou dependência foi alterada. Este registro não declara recebimento físico, handoff externo ou navegação como PASS. A implementação permanece em WIP na branch 011-release-critical-notifications, sem staging, commit, push ou PR.

## T060 e T061

- **T060:** walkthrough individual P0/P1 do quickstart: abertura normal, publicação, recebimento neutro por destinatário elegível, zero para outra turma, foreground/background quando viável, toque no detalhe autorizado, indisponibilidade após perda de acesso/exclusão, logout/troca de conta e regressão do opt-out/teste neutro da 010. P1 inclui recebimento/toque, ausência de duplicação em ciclos/restart e exclusão antes da janela. Registrar apenas observações realmente relatadas como PASS (user-reported), separando submissão, handoff e exibição. O caso sem expiresAt não existe na API e permanece evidência automatizada defensiva.
- **T061:** consolidar FR-001–019/SC-001–008, testes, migrations/recuperação, evidência do proprietário e gates locais/remotos da revisão final, com 010 validada como base. A consolidação local já existe. Depende do walkthrough T060 e do CI remoto real para a revisão final da 011.
- Backend CI, Mobile CI e Commit Conventions têm workflow_dispatch e gatilhos de PR para develop/main ou push nessas bases. Checks da base develop não validam o WIP da 011. Publicar apenas a branch de feature não dispara automaticamente esses gatilhos de push. Não é possível fechar a evidência remota da 011 antes de existir uma revisão commitada e disponibilizada ao GitHub com autorização separada. Nenhuma execução/publicação remota foi feita nesta preparação.

## Ambiente verificado

| Item | Evidência operacional local |
| --- | --- |
| Banco real | localhost:5432/avisa_ai; não avisa_ai_test |
| Backup | Dump custom criado antes do deploy, 35.605 bytes, em .codex/spec011-runtime/avisa_ai-before-011.dump; arquivo privado ignorado pelo Git |
| Migration P0 | 20261006190000_release_critical_notifications aplicada, finished_at presente |
| Migration P1 | 20261007120000_announcement_expiration_occurrences aplicada, finished_at presente |
| Integridade básica | Antes/depois: 4 usuários, 2 turmas, 3 comunicados; nenhum fixture, reset ou exclusão |
| Prisma | validate, generate e migrate deploy: exit 0 |
| Backend | Build atual da branch: exit 0; processo padrão node -r dotenv/config dist/src/main.js iniciado na porta 3000; startup confirmado; stderr vazio no checkpoint |
| Push | Configuração existente retorna enabled=true, portanto available=true pela regra do serviço; token existente presente, nunca exibido. Resposta autenticada da instalação no celular ainda não observada |
| Flags privados | EXPO_PUSH_ENABLED=true, ANNOUNCEMENT_PUSH_ENABLED=true, ANNOUNCEMENT_PUSH_REMINDERS_ENABLED=true |
| Workers | Consultas normais do dispatcher e do scanner de reminders observadas em pg_stat_activity, sem forçar tick; startup + ciclos de 30s/60s |
| API na LAN | GET http://192.168.0.100:3000/api/v1/health retorna 200 / status=ok a partir do computador; escuta em todas as interfaces |
| Autenticação | GET de comunicados sem JWT retorna 401; não foi criada sessão artificial |
| Firewall | Regras existentes para Node permitem TCP na rede Public atual; nenhuma regra modificada |
| Registros no checkpoint | 4 REVOKED, 0 elegíveis; devem ser reativados pelas contas reais antes da publicação |
| Ledger no checkpoint | Zero eventos da 011; nenhum comunicado histórico foi marcado/backfilled |
| Segredos | .env de backend/mobile, backup e logs permanecem ignorados; nenhuma credencial reproduzida neste documento |

**Ainda depende do celular:** abrir a rota health na mesma rede e confirmar status=ok; confirmar um artifact que contenha o mobile da 011; autenticar e ativar notificações nas instalações utilizadas. O APK preview da 010 contém o JavaScript da 010 e não valida a navegação da 011. Este perfil preview é release, sem developmentClient; iniciar Metro não troca o código desse APK. Expo Go não substitui uma build com suporte ao push remoto. Nenhuma nova build EAS foi iniciada nesta preparação.

## P0 — ordem de execução

1. No celular, abra http://192.168.0.100:3000/api/v1/health na mesma rede. Depois confirme a build da 011, faça login como responsável A, ative notificações e valide o teste neutro da 010. Faça abertura normal do comunicado/turma para referência.
2. Prepare uma conta B que pertença apenas à turma B, com notificações também ativas. Para observar A e B na mesma publicação, use duas instalações ativas; troca de conta na mesma instalação revoga o vínculo anterior. Com uma só instalação, faça publicações separadas, mantenha o controle B ativo durante a publicação de controle e registre essa limitação.
3. Professor publica na turma A com duração **3 dias**, depois de A estar elegível. Registre horário de publicação, estado do app e número de avisos recebidos. Autor não é destinatário desse evento.
4. A observa exatamente um aviso: título **Novo comunicado**; corpo **Há um novo comunicado disponível. Abra o aplicativo para consultar.** Não deve aparecer título/conteúdo do comunicado, turma ou conta. B observa zero avisos daquele comunicado durante a janela registrada.
5. Toque abre o comunicado correto pela autorização normal do GET. Em outro cenário, após perda de acesso ou exclusão, um toque anterior mostra indisponibilidade. Após logout/troca para conta sem acesso, não deve reaparecer conteúdo da conta antiga. Registre foreground/background/cold start somente se executados.

## P1 — elegível hoje pela edição normal

A API pública aceita durationInDays em **1, 3, 7, 15 ou 30**; não recebe um expiresAt absoluto. O valor é calculado pelo backend a partir do momento da criação/edição. Não existe opção de dois dias.

1. Use o comunicado NOVO publicado com **3 dias** e com o flag da 011 já habilitado. Após observar o P0, espere um ou dois minutos.
2. Pelo professor autor, abra a edição normal e selecione **1 dia**, confirmando o salvamento. Não altere diretamente o banco ou o relógio.
3. Se a edição for salva em **07/10/2026 às 12:15 BRT**, a expiração será **08/10/2026 às 12:15 BRT** (15:15Z). Esse horário é exemplo: use o horário real do salvamento. Você seleciona a duração de um dia, não digita data/hora.
4. A criação anterior permanece intacta; expiresAt atual menos 24h fica no momento da edição, posterior a createdAt. A regra exata é createdAt <= expiresAt−24h, now >= expiresAt−24h, now < expiresAt e marcador da 011 não nulo. Apenas criar já com um dia pode falhar na guarda por diferenças de milissegundos entre o cálculo de expiresAt e o createdAt persistido; use a sequência 3 → 1.
5. AnnouncementRemindersWorker detecta no startup/a cada 60s. AnnouncementPushWorker envia no startup/a cada 30s. Com pouco volume, aguarde aproximadamente **0–90s para submissão**, usando até dois minutos como janela prática inicial. Entrega/exibição no aparelho têm o tempo adicional do provider e não são garantidas por esse intervalo.
6. Esperado: **Comunicado próximo da expiração** / **Um comunicado da sua turma expira em breve.** Toque deve abrir o mesmo detalhe com autorização atual. Dados fechados do payload: version, type=announcement-expiring, announcementId, dispatchId; nenhum conteúdo escolar sensível.

## Um reminder e restart

Sem salvar novamente a edição, aguarde outros 2–3 minutos/ciclos e registre a quantidade de reminders exibidos por instalação. Múltiplos dispositivos elegíveis podem receber um cada. Um novo expiresAt representa outra ocorrência e pode legitimamente gerar outro reminder; para o teste de restart, mantenha **o mesmo valor**.

Consulta operacional somente leitura, preparada e verificada em arquivo privado ignorado:

```powershell
Set-Location C:\src\avisa-ai-professor
node .codex/spec011-runtime/audit-ledger.cjs '<announcementId>'
```

Obtenha announcementId da rota/resposta normal do comunicado; não envie JWT, capability, tokens de push ou credenciais. A consulta mostra datas UTC/BRT, occurrenceKey, contagens de eventos/dispatches/estados e o máximo de linhas por evento/instalação; não imprime identidades dos destinatários ou IDs do provider.

Compare antes/depois de novos ciclos e de um restart controlado do processo deste walkthrough: um evento EXPIRING para a mesma expiration:<milliseconds>, no máximo uma linha por instalação e nenhuma nova submissão comprometida em sendStartedAt. A consulta mede ledger/boundary local, não recebimento físico ou contagem de chamadas HTTP externas. Ao relatar o primeiro reminder, o agente pode executar o restart autorizado do backend, preservar expiresAt e comparar os checkpoints; depois o proprietário observa novamente o aparelho.

Para exclusão, crie outro comunicado com 3 dias e exclua **antes de qualquer edição que o torne elegível**; observe os ciclos seguintes. Sem expiresAt não é cenário físico disponível nesta API. Não force null nem crie endpoint/debug flag para esse teste.

## Registro posterior

T060/T061 continuam abertas, 59/61. Relate build, contas/instalações usadas por função (sem credenciais), horários medidos, publicação/recebimento separados, texto exibido, destino do toque, controle de outra turma, P1/restart, exclusão, isolamento e opt-out/teste 010. Apenas os cenários observados serão marcados PASS (user-reported); parciais/falhas/NOT RUN serão preservados. Agrupamento de commits está em commit-plan.md, ainda sujeito à revisão e sem execução. Spec 012 não iniciada.
