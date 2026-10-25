# Integração operacional — 25/10/2026

As telas da área autenticada passam a usar o backend Supabase existente. A API de pagamentos permanece como última etapa. Esta entrega não muda as migrações, as permissões de banco ou os endpoints administrativos publicados.

## Rotas

| Rota | Operações |
| --- | --- |
| `/app/funil` | Funis Leads/Clientes/custom, cards paginados, movimentos por alça ou seletor, até dez etapas, revisão das transferências ao excluir e alertas fixos. |
| `/app/contatos` | Busca por nome/telefone, cadastro/edição, interesses, responsável, importação/exportação, histórico e atalho do WhatsApp. |
| `/app/tarefas` | Criação/edição, prazos, situação, responsável e vínculo coerente a contato/card. |
| `/app/catalogo`, `/app/etiquetas` | Consulta, cadastro/edição pelo gestor e desativação preservando os vínculos anteriores. |
| `/app/estrategias` | Origem, mês, canal, orçamento, responsável, situação e notas. |
| `/app/embaixadores` | Contato existente/novo, função, código, benefícios, campanhas, indicações, comparecimento/pagamento declarado, apuração, encerramento, quitações e ajustes. Métricas manuais em aba própria. |
| `/app/equipe` | Consulta, cadastro de consultor/recepção por endpoint autorizado, edição com versão, redistribuição na desativação e redefinição de senha inicial. |
| `/app/configuracoes` | Nome exibido, tema e logo privado; não altera habilitação, cobrança ou perfis. |
| `/app` | KPIs, entrada de contatos, cards por etapa e origem das oportunidades. O período se aplica aos cadastros/origens; cards abertos e tarefas mostram o estoque atual. |
| `/app/relatorios` | Acompanhamento por card, clientes e atuação da equipe; exclusivo do gestor. |
| `/app/plano` | Mantém o plano de R$ 189,90, gratuidade, carência e bloqueio já implementados. |

O menu prioriza Funil, Contatos, Tarefas e Dashboard, seguido de crescimento, cadastros, gestão e preferências. As rotas administrativas mantêm as verificações de perfil. O consultor administra sua carteira; recepção consulta o funil e mantém suas tarefas. As políticas do banco continuam sendo a autorização final de cada operação.

## Dados e conflitos

`OperationalBackend.list` filtra empresa, aplica os filtros permitidos e busca/paginação no servidor. IDs da demo são recusados. Contatos relacionados são consultados em lotes de cem IDs. Cadastros de referência usam todas as páginas; o Kanban mostra cinquenta cards por página e informa os totais sem fingir que a página contém todo o funil.

Os formulários usam `row_version` nos comandos existentes. A edição de campanha compara a versão no filtro do UPDATE e trata ausência de linha como conflito. Não há movimentação otimista que simule um sucesso antes do servidor. Falhas preservam os dados digitados; mutações de resultado incerto exigem conferência antes de iniciar outra solicitação.

Indicação, encerramento, quitação e estorno capturam uma cópia da solicitação e sua chave. Após uma tentativa, os campos ficam congelados; o botão de conferência repete a mesma solicitação. Não há repetição automática. Quitação confirma administrativamente um pagamento realizado fora do CRM; não inicia transferência. Cancelamentos/estornos mantêm a quitação anterior e mostram eventual saldo negativo para revisão.

## Histórico e alertas

O gestor consulta o histórico da empresa. O histórico aberto pelo card filtra aquela oportunidade e vincula a ela as novas notas e os cliques no WhatsApp. O histórico aberto pelo contato reúne a pessoa; notas gerais não reiniciam os avisos de todos os seus cards.

Os prazos são fixos: 24 horas sem primeiro acompanhamento, três dias sem atividade para o responsável e sete para o gestor. Cards encerrados e retornos futuros seguem as exclusões existentes no servidor. O aviso do sininho abre o card no funil correto. Nenhum formulário de configuração desses prazos foi adicionado.

## Verificação e limites

- 118 testes da aplicação, 117 de PostgreSQL/PGlite e 28 das funções passaram; tipagem da aplicação e das funções conferida.
- Os testes novos cobrem escopo/paginação/busca, versão de campanha, consultas em lotes, erros de criação de integrantes, cópia de solicitação financeira, conversão de centavos/horário e destino de exclusão de etapa.
- A fixture `tests/fixtures/operational.html` serve somente ao QA local via Vite. Não é importada pela aplicação nem incluída no build de produção. Seus dados e comandos ficam em memória, sem sessão ou banco conectado.
- No navegador: formulário de card, seleção/cadastro de catálogo, limite de etiquetas, exclusão/limite de etapas, controles por perfil, vínculo de tarefa e falhas simuladas após encerramento/quitação. A conferência repetiu a mesma chave sem duplicar o resultado. Layout da modal conferido em desktop e iframe de 390px.
- Conferência remota de leitura: os treze RPCs operacionais usados estão disponíveis ao autenticado e negados ao anônimo. Não foram inseridas empresas, contas, clientes, campanhas, pagamentos ou aceites no ambiente remoto.
- A homologação de ponta a ponta em contas reais de gestor/consultor, com acesso pessoal e documentos definitivos, continua necessária antes do uso comercial. O QA isolado não substitui esse teste.

Pendências externas: escolher/integrar o provedor de pagamentos por último; retomar a conexão Cloudflare quando Pedro solicitar; aprovar as regras comerciais do PDF ainda não definidas.
