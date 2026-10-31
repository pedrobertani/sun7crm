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

- [ ] Confirmar CI/testes dos novos casos de renderização no commit exato da branch.
- [ ] Realizar testes seguros em navegador de homologação: gravar dados **fictícios** contendo payloads inertes/marcadores em nome, observações, tarefas, serviços, etiquetas e card; recarregar e percorrer listas, detalhes, histórico, modais, Kanban e relatórios; comprovar que não ocorre execução.
- [ ] Conferir entradas menos comuns: importação Excel, mensagens/personalizações, URLs de autenticação de pagamento e imagens/logo. Links externos e conteúdo de origem externa devem ter esquemas e origens restritos.
- [ ] Verificar CSP por **cabeçalho HTTP** na aplicação publicada, compatibilidade com Mercado Pago e ausência de `unsafe-inline` para scripts.
- [ ] Testar em desktop e Android com pelo menos gestor e consultor, registrar evidências antes de marcar como concluído.

### Escopo da segurança

A revisão estática e os testes React de renderização são medidas de prevenção e regressão, **não** constituem pentest nem atestam a ausência de XSS DOM/armazenado/refletido em todo o produto. Não alterar dados de clientes reais na auditoria.
