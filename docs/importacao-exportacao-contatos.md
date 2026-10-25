# Contatos por Excel

Disponível na demo e em Contatos do ambiente autenticado. Importação por gestor e vendedor; recepção consulta e exporta somente os registros permitidos. Novos contatos pertencem à empresa selecionada e ao usuário que importa. A demo permanece local, sem conexão com o banco real.

## Arquivo e validação

- Excel `.xlsx`, primeira aba, primeira linha com títulos `Nome` e `Contato` (ordem livre).
- Modelo vazio disponível na própria janela. Até 1.000 linhas e 2 MB por importação.
- Nome obrigatório, até 100 caracteres. Telefone brasileiro completo com DDD válido: fixo com 10 dígitos ou celular com 11; máscara e prefixo +55 opcionais. Não inferir DDD.
- Fórmulas, links, erros e datas não viram contatos; linhas completamente vazias são ignoradas.
- Prévia mostra linha, nome, telefone e resultado: válido, duplicado ou erro. Somente válidos entram após confirmação explícita.
- Duplicação usa telefone normalizado, não nome. Mesmo telefone com outro nome nunca substitui cadastro. Repetições dentro do arquivo são ignoradas; a primeira linha válida prevalece.
- Nova consulta antes da confirmação. Banco tem índice único por empresa/telefone normalizado e RPC de INSERT com `ON CONFLICT DO NOTHING`, protegendo repetição e concorrência. Nenhum UPDATE ou exclusão é feito.
- A prévia do vendedor compara apenas registros visíveis. Duplicados de contatos não visíveis são ignorados pelo banco na confirmação, sem revelar seus dados; a mensagem informa a quantidade adicional ignorada.

## Exportação

Colunas Nome e Contato, telefone formatado e preservado como texto. Todos os contatos acessíveis do usuário na empresa selecionada, percorrendo páginas do servidor; nunca somente a página atual. Na demo, opção adicional pelos filtros ativos. No ambiente autenticado, opção pelo registro selecionado quando houver. Células exportadas como texto, sem criar fórmulas ou links.

## Operação e limites

A demo inclui o novo contato na primeira etapa do funil de leads. O ambiente autenticado importa para `crm_contacts`; a operação real de oportunidades ainda está em evolução e não cria oportunidades automaticamente. A importação não dispara mensagens, cadências ou vendas. Ambiente real segue em homologação interna, exclusivamente com dados fictícios.

O Excel é lido no navegador; somente os nomes e telefones válidos confirmados são enviados ao Supabase com a sessão do usuário. O arquivo original não é armazenado. RLS, aceite individual, troca de senha e habilitação da empresa permanecem aplicáveis. Não são usadas chaves secretas no cliente.

A RPC é `SECURITY INVOKER`, com EXECUTE somente para authenticated, e usa as políticas existentes. A migração não modifica nem apaga registros; se encontrar duplicação histórica, a criação do índice falha em transação, exigindo análise antes de aplicar.
