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
- [x] CI #298 aprovou a geração e validação de `dist/_headers`; a prévia do commit `6b5c96fe` foi publicada com sucesso. Conferir novamente o deploy final após limpeza dos testes temporários.
- [x] **Prévia — cabeçalhos HTTP reais comprovados:** job GitHub Actions `41164956101` aprovado para `/`, `/acessar`, `/demo` no alias `security-xss-regression-2026.sun7crm.pages.dev`. Confirmados CSP com `frame-ancestors 'none'`, `script-src` sem `unsafe-inline`/`unsafe-eval`, URLs Mercado Pago, `nosniff`, `DENY` e `Referrer-Policy`. Em navegador remoto do Cloudflare, leitura same-origin via `fetch('/')` retornou status 200 e os quatro cabeçalhos; manipulador de evento inline foi bloqueado (`inlineEventHandlerExecuted=false`).
- [ ] **Produção — checagem após merge:** repetir GET e leitura dos cabeçalhos em `https://sun7crm.pages.dev/` após a implantação do PR #31. Antes do merge, a produção ainda utiliza a versão anterior.
- [ ] Exercitar login, navegação do CRM e Pix/cartão em homologação após a CSP HTTP; conferir mensagens CSP no console. Navegador remoto carregou a home da prévia, porém consulta posterior à tela de login atingiu limite 429 do serviço Browser Rendering; nenhum pagamento ou autenticação foi executado.
- [ ] Integrar o PR #31 somente após aprovação e homologação. O job HTTP e o script de navegador foram criados apenas para auditoria e devem ser retirados da branch antes do merge.

### Testes XSS no navegador real — demo isolada (31/10/2026)

- [x] GitHub Actions [execução #41166622518](https://github.com/pedrobertani/sun7crm/actions/runs/41166622518) aprovada no Chrome headless.
- [x] Contatos: nome e observações com payload HTML/JavaScript, criados pelo formulário, gravados em `localStorage`, reabertos depois de atualizar a página.
- [x] Tarefas: título com tentativa de fechamento de elemento e `<script>`, salvo e reaberto após atualizar a página.
- [x] Catálogo: nome e descrição com `<img onerror>` e `<svg onload>`, persistidos.
- [x] Etiquetas: nome com `<svg onload>`, persistido.
- [x] Kanban: card fictício gravado no armazenamento **exclusivo da demo** e visualizado no quadro e na modal de detalhes junto às observações do contato.
- [x] Em cada tela foram verificados: nenhum `alert` executado, nenhum elemento HTML de payload inserido no DOM e nenhuma exceção não tratada.
- [ ] Validar o mesmo cenário com sessões autenticadas e banco real em **homologação**, cobrindo fluxo de inserção, listagem, histórico, relatórios e importação Excel. **Os testes na demo não comprovam essa etapa**, pois a demo usa apenas armazenamento local.

**Privacidade:** os dados criados pela auditoria permaneceram no armazenamento isolado do navegador do runner; nenhum cliente, pagamento ou banco real foi modificado.

### Escopo da segurança

A revisão estática e os testes React de renderização são medidas de prevenção e regressão, **não** constituem pentest nem atestam a ausência de XSS DOM/armazenado/refletido em todo o produto. Não alterar dados de clientes reais na auditoria.
