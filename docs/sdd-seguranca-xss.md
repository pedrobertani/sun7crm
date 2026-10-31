# SDD — Auditoria XSS SUN7CRM

## Escopo e status — 31/10/2026

**RLS:** os testes de isolamento de empresas já foram realizados e aprovados na rodada anterior, conforme confirmação do responsável. Não repetir como parte da rodada XSS; isto não substitui testes de autorização em endpoints privilegiados.

**XSS:** em andamento; não homologado como seguro.

### Evidências de código

- [x] Identificar o teste PostgreSQL `supabase/tests/security.node.mjs` que grava os payloads XSS como texto literal. Esse teste verifica persistência, **não** a renderização do navegador.
- [x] Inspecionar os principais componentes React que exibem contatos, cards, tarefas, históricos, catálogos, metas, configurações e páginas públicas: na amostra inspecionada, não foram observados `dangerouslySetInnerHTML`, atribuição a `innerHTML` ou execução de código por interpolação.
- [x] Adicionar `src/lib/xss-regression.test.tsx`: casos de renderização escapada em `RecordTitle`, `Panel`, `Empty`, escape de atributo em `WhatsAppButton` e recusa de protocolo `javascript:` para telefone.
- [x] Revisar `src/lib/security-policy.ts`: a política gerada restringe `script-src` e `script-src-attr`; ela é inserida por **meta** no HTML do build, e não é equivalente a um cabeçalho CSP HTTP validado no Cloudflare.

### Ainda falta para homologar XSS

- [x] CI #288 aprovado no commit `e80beb0c`: testes React, testes PostgreSQL, funções, typecheck e build aprovados. A aprovação automatizada **não** é homologação de XSS em navegador.
- [ ] Realizar testes seguros em navegador de homologação: gravar dados **fictícios** contendo payloads inertes/marcadores em nome, observações, tarefas, serviços, etiquetas e card; recarregar e percorrer listas, detalhes, histórico, modais, Kanban e relatórios; comprovar que não ocorre execução.
- [ ] Conferir entradas menos comuns: importação Excel, mensagens/personalizações, URLs de autenticação de pagamento e imagens/logo. Links externos e conteúdo de origem externa devem ter esquemas e origens restritos.
- [ ] Verificar CSP por **cabeçalho HTTP** na aplicação publicada, compatibilidade com Mercado Pago e ausência de `unsafe-inline` para scripts.
- [ ] Testar em desktop e Android com pelo menos gestor e consultor, registrar evidências antes de marcar como concluído.


### Correção dos cabeçalhos Cloudflare Pages — 31/10/2026

- [x] A função `cloudflarePagesSecurityHeaders()` reutiliza `contentSecurityPolicy()`, separando a diretiva `frame-ancestors 'none'` (só permitida em HTTP).
- [x] O plugin Vite em `vite.config.ts` emite `dist/_headers` com regra `/*`, CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `X-Frame-Options: DENY`.
- [x] Incluídos testes da sintaxe do `_headers`, proteção contra injeção de origem e variantes com/sem Mercado Pago; o comando `npm run build` agora verifica a existência do arquivo e a consistência entre a CSP do HTML e do cabeçalho.
- [x] Consultada configuração Cloudflare Pages: produção e prévia têm `VITE_ONLINE_BILLING_ENABLED=true`. As origens necessárias ao Mercado Pago continuam na CSP quando o checkout está ativo.
- [ ] Verificar CI e deploy de prévia do commit final (a regra precisa chegar ao Cloudflare).
- [ ] Confirmar **HTTP response** em `https://sun7crm.pages.dev/` e na prévia, usando cabeçalhos reais via ferramenta de rede (a API de configuração Cloudflare usada nesta rodada não fornece os cabeçalhos HTTP da resposta). Garantir que não haja dois cabeçalhos CSP incompatíveis.
- [ ] Exercitar login, navegação do CRM e Pix/cartão em homologação após a CSP HTTP; conferir mensagens CSP no console.
- [ ] Integrar o PR #31 somente após aprovação e homologação.

### Escopo da segurança

A revisão estática e os testes React de renderização são medidas de prevenção e regressão, **não** constituem pentest nem atestam a ausência de XSS DOM/armazenado/refletido em todo o produto. Não alterar dados de clientes reais na auditoria.
