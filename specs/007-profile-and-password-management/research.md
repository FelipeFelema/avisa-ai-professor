# Research: Profile and Password Management

**Date**: 2026-10-02 | **Scope**: pesquisa para design, sem implementação ou execução de suites.

## 1. Perfil existente e limites de mudança

**Decision**: preservar GET/PATCH profile, normalizadores, payload diferencial e confirmação; remover Perfil do editor, conservar papel na tela principal. Complementar pending/teclado e provas de rollback/sessão, sem reescrever domínio.

**Rationale**: `backend/src/users/users.service.ts` já rejeita extras, devolve perfil público em no-op e transaciona atualização/revogação no e-mail. `update-profile.dto.ts` aceita nome 3–100 com padrão existente e e-mail normalizado até 255. `mobile/src/validations/updateProfile.schema.ts`, `useUpdateProfile.ts` e `AuthProvider.tsx` já atualizam identidade pública; `profile/edit.tsx` contém o campo Perfil read-only a remover. Existe diferença entre regex de nomes mobile/backend; preservar as regras atuais, sem expandir caracteres nesta feature.

**Alternatives considered**: DTO de perfil com senha/role ou redesign do editor. Rejeitados pelo escopo/segurança e por duplicar comportamento já entregue.

## 2. Contrato da troca e confirmação

**Decision**: POST `/api/v1/auth/change-password`, `auth.changePassword`, 204, corpo fechado de `currentPassword`, `newPassword`, `confirmNewPassword`. JWT determina usuário/sid; RateLimitGuard existente limita tentativas. Cada propriedade write-only.

**Rationale**: `auth.controller.ts` concentra operações de credenciais; `AuthSessionService` e `JwtStrategy` já possuem sid e checagem de sessão ativa. FR-016 determina revalidação de confirmação no servidor e prevalece, neste design, sobre a afirmação contraditória de confirmação exclusivamente cliente nas entidades/assumptions. A confirmação continua transitória, não é armazenada/devolvida. Escolha apresentada ao usuário como recomendação, adotada sem alegar resposta/aprovação.

**Alternatives considered**: apenas duas propriedades (simplifica payload, mas deixa FR-016 descoberto); PATCH profile (viola separação); resposta com tokens (desnecessária e contrária à preservação).

## 3. Unicode e representação segura de credencial

**Decision**: nova validação usa 6–72 pontos de código e comparação integral sem transformação. Utilitário de credenciais lê bcrypt legado e scrypt v1; novas escritas de cadastro/troca usam scrypt assíncrono nativo. Formato interno proposto `$scrypt$v=1$N=32768,r=8,p=3$<salt-base64url>$<key-base64url>`, salt aleatório de 16 bytes, chave 32 bytes e maxmem 64 MiB. Parser fechado aceita somente versões/custos conhecidos; nunca executar custo arbitrário vindo do banco. Comparação constante de buffers de mesmo tamanho; formato malformado falha fechado e não vira bcrypt fallback.

**Rationale**: bcrypt trunca a entrada efetiva em 72 bytes, enquanto a spec define caracteres. Scrypt cobre a senha inteira usando `node:crypto` já disponível no baseline Node 22, sem pacote/coluna/migration. Login precisa ler os dois formatos para preservar contas existentes. Não rehash em login nem alterar representação de refresh tokens. Valores Unicode legados já truncados não podem ser reconstruídos; a compatibilidade conserva a verificação legada até uma troca efetiva. Cadastro backend possui 6–72; mobile atualmente só min6 e Zod mede UTF-16 por padrão. O novo fluxo explicita contagem alinhada, sem ampliar a política de cadastro ou reescrever seu formulário.

**Alternatives considered**: limite novo de 72 bytes (mudaria a spec/política); bcrypt direto (não considera senha inteira); pré-hash ad hoc (complexidade criptográfica e riscos desnecessários); Argon2 via pacote (dependência nova). Nenhuma mudança silenciosa de tamanho/composição/normalização.

Fontes primárias: [bcrypt: entrada efetiva em bytes](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns), [Node 22 crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), [OWASP Password Storage: parâmetros scrypt](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt). A configuração proposta usa uma das combinações publicadas pelo OWASP; o custo real no ambiente do projeto ainda será medido.

## 4. Atomicidade, sessão iniciadora e concorrência

**Decision**: verificação/hash fora da transação, seguida de lock parametrizado de User dentro da transação, releitura/revalidação de sid e hash snapshot, atualização e revogação pelo mesmo tx. Lock por usuário, mesma ordem User→sessions em operações sensíveis. Coordenar emissão de sessão de login com esse lock e rechecagem de snapshot; perfil sensível revalida sid antes de confirmar escrita. Nenhuma senha/hash aparece em SQL/log/evidência.

**Rationale**: `AuthSessionService.revokeOthersInTransaction` já existe; Prisma suporta transação interativa. `AuthService.login` atualmente verifica senha e cria sessão em passos separados, permitindo login iniciado com senha antiga terminar depois da revogação. Só lock na troca não elimina essa corrida: emissão precisa participar do protocolo. Duas trocas sobre o mesmo snapshot devem ter no máximo uma vencedora. Guard autenticado antes do hashing não prova sid ainda ativo no commit. `rotate` não limpa revokedAt; refresh concorrente não ressuscita uma sessão revogada, mesmo que emita tokens inutilizáveis nas próximas tentativas.

**Alternatives considered**: update/revoke separados (sem rollback); confiar apenas no guard inicial (race); transação Serializable + compare-and-swap/retry limitado (viável, mas exige reiniciar a validação nos conflitos). Lock por conta com snapshot e ordem única torna a dependência entre troca e criação de sessão explícita sem alterar lifetime geral dos tokens. Implementação deve provar protocolo real, não somente mocks.

Fontes: [Prisma 7 transactions](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions), [PostgreSQL 15 row locks](https://www.postgresql.org/docs/15/explicit-locking.html#LOCKING-ROWS). A coordenação proposta é uma inferência de design a partir desses mecanismos e do fluxo observado no repositório.

## 5. Fronteira estrita e erros recuperáveis

**Decision**: DTO novo sem trim/coerção; 400 com mensagens estáveis `CURRENT_PASSWORD_INVALID`, `PASSWORD_CONFIRMATION_MISMATCH`, `PASSWORD_UNCHANGED` e validações de campo sem valores secretos. 401 exclusivamente sessão inválida, 409 `CREDENTIAL_CHANGED` se snapshot vencido, 429 guard existente. Manter envelope `statusCode/message/error`.

**Rationale**: `configure-app.ts` habilita conversão implícita. Tipagem TS e IsString sozinhos podem aceitar número convertido; testar HTTP com `createTestApp`/pipe de produção e preservar tipo bruto no DTO. Suites auth/users existentes montam pipe distinto. `mobile/src/lib/api.ts` faz refresh/retry no 401; senha incorreta não deve acionar esse caminho. `http-error.ts` global trata 409 como e-mail em uso: o serviço de senha precisa mapear mensagens permitidas localmente, sem alterar o significado em outros fluxos.

**Alternatives considered**: 401 para senha incorreta (confunde autenticação da sessão); novo campo global code (amplia contrato compartilhado); exibir mensagem arbitrária da API (pode vazar informação).

## 6. Memória transitória e navegação

**Decision**: serviço/hook imperativo para senha, estados sanitizados, sem useMutation. Ref imediata evita double tap; bloquear saídas voluntárias durante pending; permitir expiração/redirecionamento. Limpar form em sucesso/blur/abandono e nova entrada vazia. Aplicar padrão KeyboardAvoidingView/ScrollView do AuthScreen aos dois formulários, palette em render e campos protegidos.

**Rationale**: TanStack mutation conserva variables/erros e AxiosError pode guardar body em config.data. Padrão de updateProfile é adequado para identidade pública, não para credenciais. SecondaryScreen não tem opção pending; BackButton sobrescreve disabled/accessibilityState recebidos. É necessário suporte opt-in real e guarda da rota para hardware/gestos, com regressão dos defaults.

**Alternatives considered**: mutation com gcTime baixo (ainda retém segredo enquanto existe); apenas desabilitar Salvar (Voltar continua disponível); guardar senha no AuthProvider/rota (violação de isolamento); modal com resumo da senha (exposição desnecessária).

## 7. Contratos e prova de rollback

**Decision**: atualizar Swagger, OpenAPI canônico da 001 e teste de inventário na implementação. Testar falha após write e após revoke dentro da transação, hash/timestamps/sessões integralmente restaurados, e races com barreiras determinísticas.

**Rationale**: `openapi.contract.spec.ts` lê exclusivamente `specs/001-app-quality-readiness/contracts/openapi.json` e compara operações/schemas exatos. O teste existente de perfil que rejeita `$transaction` antes do callback não prova rollback intermediário de SC-006. Evidência manual Android separada; ausência de dispositivo/AT/iOS = NOT MEASURED.

**Alternatives considered**: contrato apenas na 007 (quebra canônico); spy de revoke/mocks de transação (não demonstra atomicidade); export/Doctor como prova visual (não mede dispositivo).

## Research Closure

Decisões de design resolvidas e registradas com suas interpretações. Nenhum teste/gate/manual foi executado nesta pesquisa. Fonte de verdade das tarefas de implementação será o futuro `tasks.md`, gerado por `speckit-tasks` após estes artefatos.
