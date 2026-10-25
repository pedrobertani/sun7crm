# Interface administrativa

Revisão de 25/10/2026 solicitada por Pedro, após a primeira publicação no Cloudflare Pages.

- O painel da plataforma utiliza preto, superfícies em cinza escuro e detalhes dourados. Os temas das empresas continuam independentes.
- O quadro completo ocupa até 1.760 px e permanece centralizado sobre fundo preto em monitores amplos. O conteúdo tem limite próprio de 1.440 px e largura fluida em telas menores.
- O logo original é apresentado inteiro com `object-fit: contain`, inclusive no menu recolhido. O arquivo da marca não é alterado.
- Navegação lateral vira gaveta em até 800 px; esse mesmo limite controla o botão do menu, evitando uma faixa vazia entre 760 e 800 px. Tabelas rolam na própria área e os cards se reorganizam conforme a largura disponível.
- Modais recebem a paleta por contexto e um atributo de esquema de cores. Cabeçalho, campos, rodapé fixo, botões, avisos e notificações acompanham o tema escuro.
- Gráficos administrativos usam a paleta dourada; as telas de empresa e a demonstração preservam suas paletas.

Verificação visual local: `tests/fixtures/admin.html`, com dados fictícios e rede bloqueada. Exercita a interface real com respostas de leitura simuladas, sem criar usuários, aceites, empresas ou pagamentos no backend. A fixture não integra o build de produção. Conferir menu aberto/recolhido, lista de empresas, Planos, modais e larguras de 390, 780, 1.200 e 2.560 px.

Publicação: projeto Cloudflare Pages `sun7crm`, repositório `pedrobertani/sun7crm`, branch `main`, diretório `dist`. O build do Pages executa testes, tipos e compilação antes da publicação, usando Node 24. O workflow do GitHub permanece independente; a indisponibilidade do runner observada nesta data não é tratada como aprovação dos testes remotos do GitHub.
