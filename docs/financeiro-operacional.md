# Financeiro operacional do SUN7CRM

## Limites e terminologia

O Financeiro é **por empresa**, separado de `crm_company_billing` / cobrança da plataforma.
O valor da oportunidade **aberta** é pipeline, não receita ou conta a receber.
A confirmação explícita no Kanban cria **venda fechada** e **recebível**, mas nenhum pagamento.
O Financeiro nunca recebe dinheiro automaticamente: somente registra a informação enviada por usuários autorizados.

- **Vendas fechadas**: confirmação comercial efetiva, com cliente, responsável e snapshot dos itens vinculados.
- **A receber**: soma dos vencimentos ativos menos recebimentos líquidos de estorno.
- **Recebido**: recebimentos do período menos estornos reais do período.
- **Saídas**: despesas pagas que foram registradas manualmente no período.
- **Caixa líquido**: recebido menos despesas pagas; não chamar de lucro contábil.
- **Projeção simplificada**: caixa líquido somado a saldos pendentes conhecidos, sem estimar tributos, CMV, perdas ou despesas futuras.

## Fluxo de confirmação

1. Um usuário com `cards.edit` arrasta um card a uma etapa de venda e marca a confirmação.
2. Quem possui adicionalmente `finance.terms` pode definir:
   - preço à vista e preço a prazo,
   - modalidade à vista ou a prazo,
   - entrada opcional, vencimento, quantidade e valor de cada parcela,
   - método esperado de pagamento.
   O total selecionado deve corresponder ao valor comercial confirmado.
3. O RPC atômico `crm_confirm_card_sale_finance` confirma a venda e salva o cronograma; sem `finance.terms`, continua disponível o RPC antigo `crm_confirm_card_sale`, gerando um recebível único com condição padrão.
4. O usuário autorizado por `finance.receive` abre a venda no Financeiro, escolhe a parcela e registra um recebimento parcial ou total, com forma de pagamento e data. O saldo não pode ficar negativo.
5. Para um pagamento **devolvido**, `finance.void` registra estorno separado, com motivo; para um registro digitado incorretamente, anulação preserva o evento original e trilha de auditoria. É proibido reabrir um card com recebimento líquido ainda positivo.

Cada tentativa de registro recebe UUID para idempotência; inclusive retries validam as permissões e o conteúdo. Alterações em despesas usam `row_version` otimista.

## Permissões

`finance.view`: acessar dados financeiros autorizados; `finance.company`: abrangência financeira da empresa, independentemente do escopo de contatos.
`finance.terms`: negociar condições; `finance.receive`: dar baixa em pagamentos; `finance.expense`: registrar despesas;
`finance.edit`: editar despesas com auditoria; `finance.void`: estornar ou anular; `finance.export`: Excel autorizado.

Todas dependem de autenticação, vínculo ativo, aceite e RLS do tenant. Gestores recebem acesso por padrão; vendedores e recepção começam sem `finance.view`. O administrador da plataforma não recebe acesso comercial automaticamente. O controle visual de componentes não substitui as permissões do banco.

## Detalhes vinculados

Snapshot do cliente e vendedor é preservado mesmo se seus nomes forem alterados depois. O relacionamento de itens `crm_card_catalog` é congelado no instante da confirmação, com o nome/preço de referência. **O modelo atual de associação entre card e catálogo não registra quantidade nem preço unitário efetivamente negociado de cada item**; por isso não se deve presumir que a soma dos itens seja igual ao valor total da venda. O total confirmado é a fonte de verdade financeira. A expansão futura do catálogo pode adicionar itens com quantidade e preços negociados.

Despesas podem ser gerais ou associadas a uma venda e responsável. Lançamentos da plataforma e das empresas nunca devem ser somados.

## Apresentação

Menu lateral: **Gestão → Financeiro** (quando `finance.view`).
Abas: Visão geral, Contas a receber, Despesas, Movimentações.
Cards com filtros por mês, vendedor, produto/serviço e forma; gráficos por barras, linhas e pizza;
tabelas paginadas e ações de detalhe/edição conforme direito.
A demo usa apenas o armazenamento fictício do navegador, sem acesso à tabela de produção.

## Publicação e testes

Executar `npm run typecheck`, `npm test`, `npm run test:db`, `npm run typecheck:functions`, `npm run test:functions`, `npm run build`.
A migração `20261104230000_crm_finance_ledger.sql` deve ser aplicada **antes** do merge que ativa a interface na `main`, após CI aprovado no PR.
Validar no Supabase:
- RLS das quatro tabelas, limites por empresa e carteira, grants somente de leitura direta;
- vendas legadas backfilled como recebíveis **não pagos**;
- criação de recibos e despesas via RPC autenticado, anulação/estorno e trilha;
- nenhum valor somado automaticamente como caixa ao confirmar uma venda.

Limitações desta primeira versão: sem conciliação bancária, emissão de notas fiscais, Pix gerado pelo sistema, cálculo contábil completo de impostos/CMV ou cobrança automática do cliente.
