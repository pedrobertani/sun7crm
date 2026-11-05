# Auditoria de filtros · SUN7CRM · 05/11/2026

## Padrão global adotado
- **Busca** visível quando útil, botão de filtros com contador, painel lateral no desktop e tela inteira no celular, chips removíveis, limpar tudo e aplicar.
- Campos personalizados por módulo, incluindo seleção múltipla para etiquetas e serviços/produtos.
- Busca e filtros operacionais **antes da paginação e da contagem** sempre que houver dados reais de grande volume.
- RLS e permissões no banco: filtro não concede acesso à carteira de outros profissionais.
- Tamanho finito em tabelas/funis (10, 25, 50 ou 100); jamais acrescentar “Todos” ao Kanban.
- Seletores de configuração (escolher campanha, plano, profissional ou aba) **não são filtros** e permanecem nos respectivos formulários.

## Módulos inspecionados
| Área | Padrão de interface | Aplicação dos critérios | Observação |
|---|---|---|---|
| Kanban real | Global + dia/mês/ano/intervalo + etapa/etiquetas/itens/responsável/temperatura/situação | RPC SQL invoker, RLS, busca por cliente/título/telefone, count e LIMIT/OFFSET antes da renderização | Feito no PR #46 |
| Kanban demo | Mesmo painel e critérios | Dados fictícios filtrados localmente por etapa, com paginação | Feito no PR #46 |
| Contatos reais | Busca, temperatura e acesso por carteira | API `list('contacts')` parametrizada, count/range | Existente |
| Contatos demo | Busca, temperatura, datas | Estado fictício local | Existente |
| Catálogo real | Busca + serviço/produto | API `list('catalog')` parametrizada, count/range | Existente |
| Estratégias reais | Busca + status | API `list('strategies')` parametrizada, count/range | Existente |
| Tarefas reais | Busca + status | API `list('tasks')` parametrizada, count/range | Existente |
| Dashboard real | Período via global | Indicadores obtidos pelo backend por período | Existente |
| Dashboard demo/admin | Período/carteira via global | Simulação local ou dados administrativos | Existente |
| Empresas admin/demo | Busca, situação/carteira e período via global | Respeita URL e permissões | Existente |
| Cobranças | Busca, situação e vencimentos via global | Fonte de cobranças com filtros próprios | Existente |
| Financeiro real | Busca, período, vendedor, serviço/produto, forma, situação + atalhos clicáveis | **Parte dos critérios ainda é aplicada após carregar lotes**, com limite de até 10 mil; deve migrar para paginação SQL numa alteração própria | Acompanhamento de desempenho prioritário |
| Financeiro demo | Mesmo painel, abas e atalhos clicáveis | Dados locais fictícios | Feito no PR #46 |
| Relatório de atividades real | Busca, proprietário e tempo sem atividade via componente de relatório | **Parte dos critérios ainda é aplicada após carregar lotes**; deve migrar para query paginada no backend | Acompanhamento prioritário |
| Embaixadores | Seleção de campanha para operação e edição | Seleção de contexto, não filtro global; mantém UI separada | Sem duplicação desnecessária |
| Metas/Medalhas | Competência e configurações | Competência é recorte temporal, não deve virar formulário de filtros complexos | Manter compacto |

## Regras de qualidade e regressão
1. Filtros combinados funcionam com AND entre grupos e OR entre opções da mesma lista (etiquetas, itens).
2. Busca nominal e etapas só retornam registros do tenant e da carteira autorizada.
3. A contagem de resultados representa o universo filtrado, não apenas a página carregada.
4. Mudança de filtro redefine a página para zero e não apaga filtros não relacionados vindos de atalhos.
5. Limpar tudo volta aos valores padrão; remover chip muda apenas o critério selecionado.
6. Financeiro: cartões de vendas fechadas, a receber, recebido e saídas abrem as abas correspondentes.
7. Ausência de resultados é apresentada sem exibir dados de outras empresas.
8. Múltipla escolha é pesquisável e possui nome acessível e região rolável em telas pequenas.

## Próximas otimizações isoladas
- Financeiro: adicionar consultas SQL agregadas para KPIs e resultados paginados para recebíveis, despesas e movimentações; preservar RLS financeiro e histórico.
- Relatórios de atividades: mover seleção de proprietário, pesquisa e inatividade para SQL antes do limite; definir uma estratégia de exportação paginada distinta da tela.
- Continuar revisões visuais mobile/desktop sem transformar campos de edição em filtros globais.
