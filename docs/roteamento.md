# Endereços e acesso direto

O frontend utiliza `BrowserRouter`: `/acessar`, `/admin/empresas`, `/app/funil` e `/demo/painel`, sem `/#/`. Links internos usam a navegação do React Router, inclusive o atalho de indicação para um card.

Antes de montar a aplicação, links antigos como `/#/app/funil?card=...` são convertidos para a mesma rota limpa com `history.replaceState`. A conversão preserva os parâmetros, mantém o destino na mesma origem e não altera âncoras de documentos ou fragmentos de autenticação. Não acrescenta uma entrada ao histórico do navegador.

No Cloudflare Pages, a ausência de `404.html` na raiz ativa o fallback nativo de SPA para `index.html`. Manter esse comportamento permite abrir e atualizar URLs internas diretamente. Os arquivos estáticos continuam sendo servidos pelos seus próprios caminhos. Referência: https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering

O roteamento continua respeitando as permissões existentes. Abrir `/admin/empresas` sem sessão passa pela verificação de acesso e direciona ao login; a alteração da URL não autoriza acesso aos dados.

As fixtures em `tests/fixtures` são exclusivas da conferência local, têm roteamento isolado e não entram no artefato publicado.

Conferir navegação, atualização de páginas internas, filtros e links antigos. Os testes de migração cobrem parâmetros repetidos, prioridade dos filtros, âncoras, preservação de fragmentos de autenticação e recusa de destinos externos.
