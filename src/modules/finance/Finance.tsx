import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Plus, Wallet,
  CheckCircle2, Clock3, ArrowUpRight, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, CartesianGrid,
  Tooltip as ChartTooltip, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '../../components/ui/button';
import { Pagination, paginatedRows, usePagination } from '../../components/ui/pagination';
import { ViewSwitcher } from '../../components/ui/view-switcher';
import { Empty, Kpi, Panel, SearchInput } from '../../components/shared';
import { currency, dateLabel, today } from '../../lib/format';
import { getSupabaseClient } from '../../lib/supabase';
import { useOperational, QueryState, useQuery } from '../workspace/operational';
import { FinanceRepository } from './api';
import { FinanceCorrectionDialog, FinanceExpenseDialog, FinanceSaleDialog } from './FinanceDialogs';
import { financeMethodLabel, financeMethods, financeNetInstallmentPaid, financeStatus, financeTotals,
  type FinanceMovement, type FinanceSale } from './model';
import './finance.css';

type Tab = 'overview' | 'receivables' | 'expenses' | 'movements';
type Graph = 'bars' | 'line' | 'pie';
const tabs:{value:Tab;label:string}[]=[
  {value:'overview',label:'Visão geral'},{value:'receivables',label:'Contas a receber'},
  {value:'expenses',label:'Despesas'},{value:'movements',label:'Movimentações'},
];
function shiftMonth(month:string,offset:number) {
  const [year,number]=month.split('-').map(Number);
  return new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7);
}
const valueString=(n:number)=>currency(n);
function FinanceGraph({graph,rows}:{graph:Graph;rows:{month:string;income:number;expenses:number;refunds:number}[]}) {
  const data=rows.map(x=>({
    name:new Intl.DateTimeFormat('pt-BR',{month:'short',timeZone:'UTC'}).format(new Date(x.month+'-01T12:00:00Z')),
    Receita:x.income/100,Despesas:x.expenses/100,Estornos:x.refunds/100,
  }));
  if(graph==='pie') {
    const last=rows.at(-1);
    const points=[
      {name:'Entradas',value:(last?.income||0)/100},
      {name:'Saídas',value:(last?.expenses||0)/100},
      {name:'Estornos',value:(last?.refunds||0)/100},
    ].filter(x=>x.value>0);
    return <div className="finance-chart">
      {points.length ? <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={points} dataKey="value" nameKey="name" outerRadius={92}
          label={({name})=>name}>
          {points.map((_,i)=><Cell key={i} fill={['#c8a24b','#64748b','#b45353'][i]}/>)}
        </Pie><ChartTooltip formatter={(n)=>valueString(Math.round(Number(n)*100))}/><Legend/></PieChart>
      </ResponsiveContainer> : <p className="small-note">Nenhuma movimentação neste período.</p>}
    </div>;
  }
  return <div className="finance-chart">
    <ResponsiveContainer width="100%" height="100%">
      {graph==='bars'?
        <BarChart data={data} margin={{top:10,right:10,bottom:10,left:0}}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.25}/>
          <XAxis dataKey="name"/><YAxis width={70} tickFormatter={n=>valueString(Number(n)*100)}/>
          <ChartTooltip formatter={n=>valueString(Math.round(Number(n)*100))}/><Legend/>
          <Bar dataKey="Receita" fill="#c8a24b" radius={[3,3,0,0]}/>
          <Bar dataKey="Despesas" fill="#64748b" radius={[3,3,0,0]}/>
          <Bar dataKey="Estornos" fill="#b45353" radius={[3,3,0,0]}/>
        </BarChart> :
        <LineChart data={data} margin={{top:10,right:10,bottom:10,left:0}}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.25}/>
          <XAxis dataKey="name"/><YAxis width={70} tickFormatter={n=>valueString(Number(n)*100)}/>
          <ChartTooltip formatter={n=>valueString(Math.round(Number(n)*100))}/><Legend/>
          <Line dataKey="Receita" stroke="#c8a24b" strokeWidth={2} dot/>
          <Line dataKey="Despesas" stroke="#64748b" strokeWidth={2} dot/>
          <Line dataKey="Estornos" stroke="#b45353" strokeWidth={2} dot/>
        </LineChart>}
    </ResponsiveContainer>
  </div>;
}
async function exportFinanceXlsx(movements:FinanceMovement[],sales:FinanceSale[]) {
  const {Workbook}=await import('exceljs');
  const book=new Workbook();
  const sheet=book.addWorksheet('Movimentações');
  sheet.columns=[
    {header:'Data',key:'date',width:16},{header:'Tipo',key:'kind',width:16},
    {header:'Cliente',key:'client',width:28},{header:'Categoria',key:'category',width:23},
    {header:'Forma',key:'method',width:23},{header:'Valor',key:'value',width:17},
    {header:'Descrição',key:'description',width:45},
  ];
  const names=new Map(sales.map(x=>[x.opportunity_id,x.contact_name_snapshot]));
  // Evita que conteúdo inserido por terceiros seja interpretado como fórmula.
  const safe=(text:string)=>/^[=+\-@]/.test(text)?'\''+text:text;
  for(const movement of movements) sheet.addRow({
    date:movement.posted_on,
    kind:movement.kind==='income'?'Recebimento':movement.kind==='refund'?'Estorno':'Despesa',
    client:safe(names.get(movement.opportunity_id||'')||''),
    category:safe(movement.category),
    method:financeMethodLabel(movement.method),
    value:(movement.kind==='refund'||movement.kind==='expense'?-1:1)*movement.amount_cents/100,
    description:safe(movement.description),
  });
  sheet.getColumn('value').numFmt='"R$" #,##0.00;[Red]("R$" #,##0.00)';
  sheet.getRow(1).font={bold:true};
  sheet.views=[{state:'frozen',ySplit:1}];
  const buffer=await book.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([new Uint8Array(buffer)],
    {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const link=document.createElement('a');
  link.href=url;link.download='sun7crm-financeiro.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function RealFinance() {
  const {company,can,refresh,notice}=useOperational();
  const [params,setParams]=useSearchParams();
  const active=(params.get('aba')||'overview') as Tab;
  const tab=tabs.some(x=>x.value===active)?active:'overview';
  const changeTab=(value:Tab)=>{setParams(value==='overview'?{}:{aba:value});pages.setPage(0);};
  const [month,setMonth]=useState(today().slice(0,7));
  const [search,setSearch]=useState('');
  const [seller,setSeller]=useState('all');
  const [product,setProduct]=useState('all');
  const [method,setMethod]=useState('all');
  const [status,setStatus]=useState('all');
  const [graph,setGraph]=useState<Graph>('bars');
  const [saleDetail,setSaleDetail]=useState<FinanceSale|null>(null);
  const [expenseEdit,setExpenseEdit]=useState<FinanceMovement|'new'|null>(null);
  const [correction,setCorrection]=useState<FinanceMovement|null>(null);
  const [exportError,setExportError]=useState('');
  const [exporting,setExporting]=useState(false);
  const pages=usePagination();
  const repo=useMemo(()=>new FinanceRepository(getSupabaseClient(),company.id),[company.id]);
  const query=useQuery(()=>repo.load(),[repo]);
  const data=query.data;
  const sales=data?.sales||[];
  const installments=data?.installments||[];
  const movements=data?.movements||[];
  const labels=[...new Set(sales.map(s=>s.seller_name_snapshot).filter(Boolean))].sort();
  const products=[...new Set(sales.flatMap(s=>s.items_snapshot?.map(p=>p.name)||[]))].sort();
  const q=search.trim().toLocaleLowerCase('pt-BR');
  const matchingSales=sales.filter(s=>
    (seller==='all'||s.seller_name_snapshot===seller)
    &&(product==='all'||s.items_snapshot?.some(p=>p.name===product))
    &&(!q||[s.contact_name_snapshot,s.seller_name_snapshot,...(s.items_snapshot||[]).map(p=>p.name)]
      .join(' ').toLocaleLowerCase('pt-BR').includes(q))
  );
  const saleIds=new Set(matchingSales.map(s=>s.opportunity_id));
  const visibleSales=matchingSales.filter(s=>!s.cancelled_at);
  const hasSalesScope=seller!=='all'||product!=='all'||!!q;
  const filteredInstallments=installments.filter(i=>saleIds.has(i.opportunity_id)&&
    i.due_on.startsWith(month)&&(method==='all'||i.expected_method===method)&&
    (status==='all'||financeStatus(i,movements).toLocaleLowerCase('pt-BR')===status));
  const filteredMovements=movements.filter(m=>
    !m.voided_at && m.posted_on.startsWith(month)&&
    (method==='all'||m.method===method)&&
    (m.kind==='expense' ? (!hasSalesScope||!!m.opportunity_id&&saleIds.has(m.opportunity_id))
      : !!m.opportunity_id&&saleIds.has(m.opportunity_id))&&
    (m.kind!=='expense'||!q||
      [m.category,m.description].join(' ').toLocaleLowerCase('pt-BR').includes(q)
      ||!!m.opportunity_id&&saleIds.has(m.opportunity_id))
  );
  const filteredExpenses=filteredMovements.filter(m=>m.kind==='expense');
  const baseTotals=financeTotals(matchingSales,installments,movements,month);
  const received=filteredMovements.reduce((sum,m)=>
    sum+(m.kind==='income'?m.amount_cents:m.kind==='refund'?-m.amount_cents:0),0);
  const expenses=filteredMovements.filter(m=>m.kind==='expense')
    .reduce((sum,m)=>sum+m.amount_cents,0);
  const totals={...baseTotals,received,expenses,
    cash:received-expenses,projected:received-expenses+baseTotals.pending};
  // Escopo do período: fechamento da venda neste mês, pagamentos realizados neste mês,
  // e recebíveis ativos acumulados (nunca caixa recebido).
  const periodClosed=visibleSales.filter(s=>s.confirmed_at.slice(0,7)===month)
    .reduce((sum,s)=>sum+s.total_cents,0);
  const months=Array.from({length:6},(_,i)=>shiftMonth(month,i-5));
  const chartRows=months.map(m=>{
    const selected=movements.filter(x=>!x.voided_at&&x.posted_on.startsWith(m)
      &&(method==='all'||x.method===method)
      &&(!hasSalesScope||!!x.opportunity_id&&saleIds.has(x.opportunity_id)));
    return {month:m,
      income:selected.filter(x=>x.kind==='income').reduce((s,x)=>s+x.amount_cents,0),
      refunds:selected.filter(x=>x.kind==='refund').reduce((s,x)=>s+x.amount_cents,0),
      expenses:selected.filter(x=>x.kind==='expense').reduce((s,x)=>s+x.amount_cents,0)};
  });
  const sortedInstallments=[...filteredInstallments].sort((a,b)=>a.due_on.localeCompare(b.due_on));
  const sortedMovements=[...filteredMovements].sort((a,b)=>b.posted_on.localeCompare(a.posted_on));
  const saleById=new Map(sales.map(s=>[s.opportunity_id,s]));
  const selectedSalesForExpense=can('finance.company')?sales:sales.filter(s=>s.membership_id===company.membershipId);
  const reload=()=>{
    setSaleDetail(null);setExpenseEdit(null);setCorrection(null);
    refresh();query.retry();notice('Financeiro atualizado.');
  };
  return <div className="finance-page">
    <div className="finance-toolbar">
      <div className="actions">
        <label className="form-row">Mês de referência
          <input type="month" value={month} onChange={e=>{setMonth(e.target.value);pages.setPage(0);}}/>
        </label>
        <label className="form-row">Vendedor
          <select aria-label="Filtrar vendedor" value={seller} onChange={e=>{setSeller(e.target.value);pages.setPage(0);}}>
            <option value="all">Todos os permitidos</option>
            {labels.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="form-row">Produto ou serviço
          <select value={product} onChange={e=>{setProduct(e.target.value);pages.setPage(0);}}>
            <option value="all">Todos</option>
            {products.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="form-row">Forma de pagamento
          <select value={method} onChange={e=>{setMethod(e.target.value);pages.setPage(0);}}>
            <option value="all">Todas</option>
            {financeMethods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <div className="actions">
        {can('finance.expense')&&<Button onClick={()=>setExpenseEdit('new')}><Plus size={16}/>Nova despesa</Button>}
        {can('finance.export')&&<Button variant="outline" disabled={exporting} onClick={()=>{
          if(exporting)return;
          setExporting(true);setExportError('');
          void exportFinanceXlsx(sortedMovements,sales).catch(()=>setExportError('Falha ao gerar o Excel.'))
            .finally(()=>setExporting(false));
        }}><Download size={16}/>Exportar Excel</Button>}
      </div>
    </div>
    <QueryState query={query}/>
    {exportError&&<p role="alert" className="form-error">{exportError}</p>}
    <SearchInput value={search} onChange={v=>{setSearch(v);pages.setPage(0);}}
      placeholder="Buscar cliente, vendedor, item ou lançamento..."/>
    <div className="kpis">
      <Kpi label="Vendas fechadas" value={currency(periodClosed)}
        foot="Vendas confirmadas no mês · não são recebimentos" icon={<CheckCircle2 size={19}/>}/>
      <Kpi label="A receber" value={currency(totals.pending)}
        foot="Saldo pendente acumulado das vendas autorizadas" icon={<Clock3 size={19}/>}/>
      <Kpi label="Recebido" value={currency(totals.received)}
        foot="Recebimentos líquidos de estornos no mês" icon={<Wallet size={19}/>}/>
      <Kpi label="Saídas" value={currency(totals.expenses)}
        foot="Despesas pagas no mês" icon={<ArrowUpRight size={19}/>}/>
    </div>
    <p className="finance-summary-note">
      Resultado de caixa neste mês: <strong>{currency(totals.cash)}</strong>.
      {' '}Projeção simplificada (saldo pendente + caixa líquido): <strong>{currency(totals.projected)}</strong>.
      {' '}Não equivale a lucro contábil: custos de mercadorias, impostos e outras despesas não cadastradas não são presumidos.
    </p>
    <ViewSwitcher label="Áreas do Financeiro" value={tab} onValueChange={changeTab} items={tabs}/>
    {tab==='overview'&&<>
      <Panel title="Movimentações e tendências" description="Entradas efetivas, despesas e estornos — sem misturar o pipeline estimado.">
        <div className="finance-actions" role="group" aria-label="Tipo de gráfico">
          {([
            ['bars','Barras',BarChart3],['line','Linhas',LineChartIcon],['pie','Pizza',PieChartIcon],
          ] as const).map(([key,label,Icon])=>
            <Button key={key} size="icon" variant={graph===key?'default':'outline'}
              aria-label={'Gráfico de '+label.toLowerCase()}
              aria-pressed={graph===key} tooltip={'Gráfico de '+label.toLowerCase()}
              onClick={()=>setGraph(key)}><Icon size={17}/></Button>
          )}
        </div>
        <FinanceGraph graph={graph} rows={chartRows}/>
        <p className="small-note">Barras e linhas: últimos seis meses até o selecionado. Pizza: distribuição das movimentações do mês.</p>
      </Panel>
      <Panel title="Últimas movimentações" description="Clique no registro para conferir seu vínculo, detalhes e possíveis correções.">
        <FinanceMovementsTable rows={paginatedRows(sortedMovements,pages.page,pages.size)}
          saleById={saleById} canEdit={can('finance.edit')} canVoid={can('finance.void')}
          onExpense={setExpenseEdit} onCorrection={setCorrection} onSale={setSaleDetail}/>
        <Pagination page={pages.page} size={pages.size} total={sortedMovements.length}
          onChange={pages.setPage} onSizeChange={pages.setSize} label="movimentações"/>
      </Panel>
    </>}
    {tab==='receivables'&&<Panel title="Contas a receber" description="Vencimentos e pagamentos parciais; não se confunde com receita recebida.">
      <div className="finance-actions">
        <label className="form-row">Situação
          <select value={status} onChange={e=>{setStatus(e.target.value);pages.setPage(0);}}>
            <option value="all">Todas</option>
            <option value="pendente">Pendente</option>
            <option value="parcial">Parcial</option>
            <option value="recebido">Recebido</option>
            <option value="vencido">Vencido</option>
          </select>
        </label>
      </div>
      <div className="table-wrap"><table className="finance-table"><thead><tr>
        <th>Vencimento</th><th>Cliente / vendedor</th><th>Parcela</th>
        <th>Valor</th><th>Recebido</th><th>Saldo</th><th>Situação</th>
      </tr></thead><tbody>
        {paginatedRows(sortedInstallments,pages.page,pages.size).map(ins=>{
          const sale=saleById.get(ins.opportunity_id);
          const paid=financeNetInstallmentPaid(ins.id,movements);
          return <tr key={ins.id}><td>{dateLabel(ins.due_on)}</td>
            <td>{sale?<button className="finance-link" onClick={()=>setSaleDetail(sale)}>
              {sale.contact_name_snapshot}</button>:'Venda'}
              <small className="operational-cell-note">{sale?.seller_name_snapshot}</small>
            </td>
            <td>{ins.kind==='entry'?'Entrada':ins.installment_number+'ª parcela'}</td>
            <td>{currency(ins.amount_cents)}</td><td>{currency(paid)}</td>
            <td>{currency(Math.max(0,ins.amount_cents-paid))}</td>
            <td><span className="finance-status">{financeStatus(ins,movements)}</span></td>
          </tr>;
        })}
      </tbody></table></div>
      {!sortedInstallments.length&&<Empty title="Nenhuma parcela encontrada" description="Ajuste os filtros ou confirme uma venda no funil."/>}
      <Pagination page={pages.page} size={pages.size} total={sortedInstallments.length}
        onChange={pages.setPage} onSizeChange={pages.setSize} label="parcelas"/>
    </Panel>}
    {tab==='expenses'&&<Panel title="Despesas" description="Saídas efetivas cadastradas no período, com edição e histórico.">
      <FinanceMovementsTable rows={paginatedRows(filteredExpenses,pages.page,pages.size)}
        saleById={saleById} canEdit={can('finance.edit')} canVoid={can('finance.void')}
        onExpense={setExpenseEdit} onCorrection={setCorrection} onSale={setSaleDetail}/>
      <Pagination page={pages.page} size={pages.size} total={filteredExpenses.length}
        onChange={pages.setPage} onSizeChange={pages.setSize} label="despesas"/>
    </Panel>}
    {tab==='movements'&&<Panel title="Histórico financeiro" description="Entradas, saídas e estornos reais vinculados ao usuário e à venda.">
      <FinanceMovementsTable rows={paginatedRows(sortedMovements,pages.page,pages.size)}
        saleById={saleById} canEdit={can('finance.edit')} canVoid={can('finance.void')}
        onExpense={setExpenseEdit} onCorrection={setCorrection} onSale={setSaleDetail}/>
      <Pagination page={pages.page} size={pages.size} total={sortedMovements.length}
        onChange={pages.setPage} onSizeChange={pages.setSize} label="movimentações"/>
    </Panel>}
    {saleDetail&&<FinanceSaleDialog sale={saleDetail} installments={installments}
      movements={movements} repo={repo} onClose={()=>setSaleDetail(null)} onSaved={reload}/>}
    {expenseEdit&&<FinanceExpenseDialog
      initial={expenseEdit==='new'?undefined:expenseEdit}
      sales={selectedSalesForExpense} repo={repo} ownerId={company.membershipId}
      onClose={()=>setExpenseEdit(null)} onSaved={reload}/>}
    {correction&&<FinanceCorrectionDialog
      movement={correction} repo={repo} onClose={()=>setCorrection(null)} onSaved={reload}/>}
  </div>;
}
function FinanceMovementsTable({
  rows,saleById,canEdit,canVoid,onExpense,onCorrection,onSale,
}:{
  rows:FinanceMovement[];saleById:Map<string,FinanceSale>;canEdit:boolean;canVoid:boolean;
  onExpense:(value:FinanceMovement)=>void;onCorrection:(value:FinanceMovement)=>void;
  onSale:(value:FinanceSale)=>void;
}) {
  if(!rows.length)return <Empty title="Nenhuma movimentação" description="Registre um recebimento ou despesa para começar o histórico financeiro."/>;
  return <div className="table-wrap"><table className="finance-table"><thead><tr>
    <th>Data</th><th>Movimento</th><th>Cliente / categoria</th><th>Forma</th><th>Valor</th><th>Ações</th>
  </tr></thead><tbody>{rows.map(m=>{
    const sale=m.opportunity_id?saleById.get(m.opportunity_id):undefined;
    return <tr key={m.id}>
      <td>{dateLabel(m.posted_on)}</td>
      <td>{m.kind==='income'?'Entrada':m.kind==='refund'?'Estorno':'Saída'}</td>
      <td>{sale?
        <button className="finance-link" onClick={()=>onSale(sale)}>{sale.contact_name_snapshot}</button>:
        m.category||'Despesa geral'}
        <small className="operational-cell-note">{m.description}</small>
      </td>
      <td>{financeMethodLabel(m.method)}</td>
      <td>{m.kind==='income'?currency(m.amount_cents):'-'+currency(m.amount_cents)}</td>
      <td><div className="finance-actions">
        {m.kind==='expense'&&canEdit&&<Button size="sm" variant="outline" onClick={()=>onExpense(m)}>
          Editar</Button>}
        {m.kind!=='refund'&&canVoid&&<Button size="sm" variant="ghost"
          onClick={()=>onCorrection(m)}>Corrigir</Button>}
      </div></td>
    </tr>;
  })}</tbody></table></div>;
}
