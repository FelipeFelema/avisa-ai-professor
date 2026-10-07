# EAS Android preview — Spec 011 — 2026-10-07

Build autorizada explicitamente pelo proprietário para o walkthrough individual P0/P1. Sem staging, commit, push ou PR; sem alteração de lógica, dependências ou configuração versionada. T060/T061 permanecem abertas em 59/61.

## API e snapshot antes do envio

- Branch: 011-release-critical-notifications; backend atual iniciado no processo 19376. Health na LAN http://192.168.0.100:3000/api/v1/health respondeu 200 / status=ok imediatamente antes da build. Essa checagem partiu do computador e não substitui a observação no celular.
- Ambiente EAS **preview**: EXPO_PUBLIC_API_URL=http://192.168.0.100:3000/api/v1; EXPO_PUBLIC_ANDROID_APPLICATION_ID=com.avisa.aiprofessor. Configuração resolvida: distribution=internal, buildType=apk, projeto EAS esperado e plugins existentes de notifications/storage; AVISA_PREVIEW_ALLOW_CLEARTEXT_TRAFFIC=true.
- FCM V1: consulta autenticada apenas de metadados pelo cliente oficial EAS confirmou o projeto/aplicação e a associação ao Firebase **avisa-ai-professor**. Arquivo google-services local privado corresponde ao mesmo projeto e package. Nenhuma chave foi baixada ou mostrada pela consulta.
- GOOGLE_SERVICES_FILE existe no EAS preview como **SECRET / file**, configurado na fundação 010. O .env local do mobile não fornece esse campo; a avaliação local não consegue ler o arquivo secreto remoto. Sua metadata/presença e a associação Firebase foram verificadas; o conteúdo remoto não foi baixado nem declarado byte a byte idêntico ao arquivo local. A build usa a injeção segura do EAS; não foi criada credencial substituta.
- EAS CLI atual: **24.11.0**, obtido por npx eas-cli@latest, sem instalar dependência no projeto.
- build:inspect --stage archive gerou o snapshot real antes do envio: **627 arquivos**, incluindo **238 arquivos do mobile**, todos idênticos byte a byte ao checkout. Provider de push/auth, hook de detalhe, parser criado/expirando, navegação, apresentação e feedback da 011 presentes, inclusive arquivos ainda não commitados.
- Inspeção: **zero** caminhos de ambientes privados/credentials/chaves; **zero** marcadores de chave privada; **zero** correspondências com valores privados locais. .env.example públicos permanecem permitidos. Backup, credenciais, logs e arquivos .codex não estavam no archive.
- package.json/package-lock.json, app.config.ts, eas.json, plugins e .gitignore sem diferenças contra develop. Nenhuma atualização de dependência/configuração foi necessária.

## Submissão e interrupção do acompanhamento

Comando autorizado, com opções para preservar as credenciais e encerrar após a submissão:

```powershell
Set-Location C:\src\avisa-ai-professor\mobile
npx.cmd --yes eas-cli@latest build --profile preview --platform android --non-interactive --freeze-credentials --no-wait --json
```

- Submissão: exit 0; Android / preview.
- Build: [f4a1ee31-1b9c-439c-95da-0d3474ff4e47](https://expo.dev/accounts/kratinhos/projects/mobile/builds/f4a1ee31-1b9c-439c-95da-0d3474ff4e47).
- Estado retornado na submissão: NEW; única confirmação inicial posterior: **IN_QUEUE**. Nenhum polling contínuo ou espera pela conclusão da build foi mantido. Nenhum cancelamento.
- Metadata gitCommitHash: 416256032a645e7335229a42bb2a825d174c85c0, a base develop, pois o WIP não foi commitado. O SHA exibido não descreve sozinho o conteúdo do upload; a inspeção byte a byte confirma o mobile atual da 011 no archive.
- Instalação, resultado final da build, Expo/FCM handoff, display, toque e ausência física de duplicação **ainda não observados**. EAS preview build não é Backend CI / Mobile CI / Commit Conventions da revisão final.
- Logs completos, inspeção, hashes do snapshot e resumos seguros ficam em .codex/spec011-eas/, ignorado pelo Git. Não versionar arquivos privados nem URLs de download assinadas.

## Próxima etapa — após instalação

O proprietário executará T060 por etapas: ativação do responsável; professor publica com 3 dias; um push neutro; toque no detalhe correto; controle de outra turma com zero recebimentos. Para P1, confirmar o push inicial, aguardar um ou dois minutos e editar pelo autor para 1 dia; esperar até 90s para submissão mais provider, observar um reminder, preservar expiresAt e executar restart controlado com comparação somente leitura do ledger. Relatar recebimentos/toques/ausências e horários efetivamente observados. Registros seguem PASS (user-reported) apenas depois do relato. Sem expiresAt permanece caso automatizado defensivo, pois a API não permite esse recurso.

Veja o [roteiro operacional](walkthrough-preparation-2026-10-07.md) e o [quickstart](quickstart.md). Nenhuma tarefa física/CI foi antecipadamente fechada. Spec 012 não iniciada.
