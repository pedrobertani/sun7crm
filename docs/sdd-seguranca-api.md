# SUN7CRM — Auditoria das bordas HTTP e autenticação das APIs (31/10/2026)

## Escopo e evidências

Auditoria **sem tocar no Supabase remoto**: o conector Supabase desta sessão lista apenas o projeto `studiopro`. Não executar operações do SUN7CRM no projeto de outro aplicativo. O código e os testes são realizados somente em branch GitHub, com backend fictício.

### Controles confirmados no código e em suítes locais

- As rotas de **sessão** (`crm-create-company`, `crm-create-user`, `crm-reset-password`, `crm-first-access`, `crm-update-company`, `crm-billing-checkout` e sua variante de homologação) passam por `createHttpHandler`; ele exige token Bearer, impede uso de `sb_publishable_*` e `sb_secret_*` como sessão, valida a identidade via `auth.getUser(token)` e rejeita usuário anônimo.
- `verify_jwt=false` é configuração **existente** no projeto. A proteção da sessão depende, portanto, da validação explícita em cada handler. **Não trocar este modo automaticamente**, pois os webhooks exigem autenticação por assinatura e a integração de chaves modernas demanda revisão.
- Webhooks do Mercado Pago são rotas separadas e exigem assinatura, checagem de identificador e consulta autenticada ao provedor.
- Campos JSON, método, idempotência UUID, tamanho máximo do corpo (16 KiB) e resposta sem informações sensíveis já são verificados nas suítes `functions.node.mjs`, `first-access.node.mjs` e `api-route-security.node.mjs`.
- As RPCs administrativas privilegiadas já são testadas no PostgreSQL simulado (PGlite) contra chamadas `anon` e `authenticated`; RLS multiempresa foi previamente homologado em auditoria separada.

### Ajuste de compatibilidade e testes desta rodada

- [x] A origem padrão CORS do servidor foi atualizada de `sun7crm-base.dreamygull10.chatgpt.site` para `https://sun7crm.pages.dev`, domínio de produção presente no Cloudflare Pages.
- [x] Origem aceita deve coincidir **exatamente** com a URL autorizada; subdomínio falso, outra origem, `Origin: null` e origem antiga são negados antes da autenticação, tanto em POST quanto em OPTIONS.
- [x] Tokens ausentes, não-Bearer, malformados, `sb_publishable_*`, `sb_secret_*`, muito longos e JWT simulado inválido não executam comandos.
- [x] Métodos não suportados e idempotência inválida não alcançam os comandos.
- [x] Falha do serviço Auth retorna HTTP 503 sem execução de operações e sem expor corpo ou credenciais.
- [ ] Confirmar com **o projeto Supabase SUN7CRM** qual é o `CRM_ALLOWED_ORIGINS` efetivamente configurado. Se definido, ele substitui a origem padrão, incluindo previews explicitamente autorizadas. O merge não altera automaticamente secrets do Supabase.
- [ ] Executar HTTP real com token inválido e com perfil de homologação legítimo, verificando 401/403 e ausência de efeito no banco.
- [ ] Confirmar o modo `verify_jwt` publicado e a classificação de todos os endpoints no ambiente remoto.

### Controles de abuso separados

- Limites de contas e redefinição possuem migrações e testes locais: 6 criações/hora, 5 redefinições/hora por destino e 30/hora por solicitante.
- **Bloqueio de login após cinco falhas por 15 minutos não está confirmado como ativo no Supabase remoto.** A documentação `docs/security-account-limits.md` o trata como não implementado/ativado; existe teste local de Password Verification Hook preparado, mas isso não comprova habilitação em produção. Tratar como pendência até verificar no projeto correto.
- Rate limiting e controles por IP/conta devem ser reavaliados sem bloquear usuários legítimos nem criar mecanismo de negação de serviço por terceiros.

**Critério de encerramento:** CI aprovado, verificação do projeto Supabase correto e checagens HTTP autenticadas em homologação; não marcar segurança de APIs como homologada apenas pelos testes locais.
