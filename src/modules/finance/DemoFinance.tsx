import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, Plus, Wallet, Clock3, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useCrm } from '../../app/context';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { ViewSwitcher } from '../../components/ui/view-switcher';
import { GlobalFilters, type FilterField } from '../../components/ui/global-filters';
import { Pagination, paginatedRows, usePagination } from '../../components/ui/pagination';
import { CurrencyInput } from '../../components/currency-input';
import { Heading, Panel, Kpi, Empty, FormError } from '../../components/shared';
import { currency, dateLabel, today, uid } from '../../lib/format';
import { legacyPermissions } from '../permissions/model';
import { FinanceTermsEditor } from './FinanceTermsEditor';
import { FinanceGraph } from './Finance';
import { defaultFinanceTerms, financeSelectedTotal, financeMethods, financeNetInstallmentPaid,
  financeStatus, financeTotals, makeFinanceSchedule, moneyString, toCents, validateFinanceTerms,
  type FinanceInstallment, type FinanceMethod, type FinanceMovement,
  type FinanceSale, type FinanceTerms } from './model';
import './finance.css';

type DemoTab='overview'|'sales'|'receivables'|'expenses'|'movements';
const demoTabs:{value:DemoTab;label:string}[]=[
 {value:'overview',label:'Visão geral'}, {value:'sales',label:'Vendas fechadas'},
 {value:'receivables',label:'Contas a receber'},
 {value:'expenses',label:'Despesas'}, {value:'movements',label:'Movimentações'},
];
export function DemoFinance() {
  const {data,session,update,notice}=useCrm();
  const member=data.members.find(m=>m.id===session.memberId);
  const permissions=member?.permissions||legacyPermissions(session.role);
  const can=(key:string)=>session.role==='manager'||permissions.keys.includes(key);
  const [params,setParams]=useSearchParams();
  const tab:DemoTab=demoTabs.some(t=>t.value===params.get('aba'))
    ?params.get('aba') as DemoTab:'overview';
  const setTab=(value:DemoTab)=>setParams(value==='overview'?{}:{aba:value});
  const movementType=params.get('tipo')==='income'?'income':'all';
  const [month,setMonth]=useState(today().slice(0,7));
  const [seller,setSeller]=useState('all');
  const [method,setMethod]=useState('all');
  const [product,setProduct]=useState('all');
  const [status,setStatus]=useState('all');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<FinanceSale|null>(null);
  const [editingTerms,setEditingTerms]=useState(false);
  const [receipt,setReceipt]=useState<FinanceInstallment|null>(null);
  const [expense,setExpense]=useState<FinanceMovement|'new'|null>(null);
  const [refund,setRefund]=useState<FinanceMovement|null>(null);
  const [amount,setAmount]=useState('');
  const [category,setCategory]=useState('Insumos');
  const [note,setNote]=useState('');
  const [day,setDay]=useState(today());
  const [payMethod,setPayMethod]=useState<FinanceMethod>('pix');
  const [error,setError]=useState('');
  const [graph,setGraph]=useState<'bars'|'line'|'pie'>('bars');
  const pages=usePagination();
  useEffect(()=>pages.setPage(0),[tab,movementType]);
  const termsMap=data.demoFinance?.terms||{};
  const moves=data.demoFinance?.movements||[];
  const sales:FinanceSale[]=data.opportunities.filter(o=>
    o.companyId===session.companyId&&o.confirmedSaleAt&&
    (session.role==='manager'||can('finance.company')||o.confirmedSaleOwnerId===session.memberId)
  ).map(o=>{
    const contact=data.contacts.find(c=>c.id===o.contactId);
    const owner=data.members.find(m=>m.id===o.confirmedSaleOwnerId);
    const catalog=(data.catalog||[]).filter(x=>o.catalogIds?.includes(x.id));
    const total=o.confirmedSaleCents||o.value;
    const terms=termsMap[o.id]||defaultFinanceTerms(total);
    return {
      company_id:o.companyId,opportunity_id:o.id,contact_id:o.contactId,
      membership_id:o.confirmedSaleOwnerId||contact?.ownerId||'',
      total_cents:total,cash_price_cents:terms.cashCents,
      term_price_cents:terms.termCents,payment_kind:terms.kind,
      items_snapshot:catalog.map(c=>({id:c.id,name:c.name,kind:c.kind,
        unit_price_cents:c.value,quantity:1})),
      contact_name_snapshot:contact?.name||'Contato',seller_name_snapshot:owner?.name||'Consultor',
      confirmed_at:o.confirmedSaleAt!,cancelled_at:null,row_version:1,
    };
  });
  const installments:FinanceInstallment[]=sales.flatMap(s=>{
    const terms=termsMap[s.opportunity_id]||defaultFinanceTerms(s.total_cents);
    return makeFinanceSchedule(terms,s.confirmed_at.slice(0,10)).map((row,i)=>({
      company_id:s.company_id,opportunity_id:s.opportunity_id,
      id:s.opportunity_id+'-parcela-'+i,kind:row.entry?'entry' as const:'installment' as const,
      installment_number:row.entry?0:i+(terms.entryCents?0:1),
      amount_cents:row.amount_cents,due_on:row.due_on,expected_method:row.method,
    }));
  });
  const filteredMovements=moves.filter(m=>
    m.company_id===session.companyId&&!m.voided_at&&
    (session.role==='manager'||can('finance.company')||m.owner_membership_id===session.memberId)
  );
  const query=search.trim().toLocaleLowerCase('pt-BR');
  const salesFiltered=sales.filter(s=>
    (seller==='all'||s.seller_name_snapshot===seller)
    && (product==='all'||s.items_snapshot.some(item=>item.name===product))
    && (!query||[s.contact_name_snapshot,s.seller_name_snapshot,...s.items_snapshot.map(x=>x.name)]
      .join(' ').toLocaleLowerCase('pt-BR').includes(query)));
  const ids=new Set(salesFiltered.map(s=>s.opportunity_id));
  const movements=filteredMovements.filter(m=>(method==='all'||m.method===method)&&
    (seller==='all'||!!m.opportunity_id&&ids.has(m.opportunity_id)));
  const period=movements.filter(m=>m.posted_on.startsWith(month));
  const results=financeTotals(salesFiltered,installments,movements,month);
  const receivables=installments.filter(i=>ids.has(i.opportunity_id)&&i.due_on.startsWith(month)
    && (method==='all'||i.expected_method===method)
    && (status==='all'||financeStatus(i,movements).toLocaleLowerCase('pt-BR')===status));
  const closed=salesFiltered.filter(s=>s.confirmed_at.slice(0,7)===month).reduce((sum,s)=>sum+s.total_cents,0);
  const charts=Array.from({length:6},(_,i)=>{
    const date=new Date(month+'-01T12:00:00Z');
    date.setUTCMonth(date.getUTCMonth()+i-5);
    const key=date.toISOString().slice(0,7);
    const items=movements.filter(m=>m.posted_on.startsWith(key));
    return {month:key,
      income:items.filter(m=>m.kind==='income').reduce((a,b)=>a+b.amount_cents,0),
      refunds:items.filter(m=>m.kind==='refund').reduce((a,b)=>a+b.amount_cents,0),
      expenses:items.filter(m=>m.kind==='expense').reduce((a,b)=>a+b.amount_cents,0)};
  });
  const saveMovement=(next:FinanceMovement,old?:FinanceMovement)=>{
    const ok=update(d=>{
      const current=d.demoFinance?.movements||[];
      return {...d,demoFinance:{terms:d.demoFinance?.terms||{},
        movements:old?current.map(m=>m.id===old.id?next:m):[...current,next]}};
    });
    if(ok) {
      setReceipt(null);setExpense(null);setRefund(null);setSelected(null);
      notice('Simulação financeira salva somente nesta demo.');
    }
  };
  const [terms,setTerms]=useState<FinanceTerms>(defaultFinanceTerms(100000));
  const openSale=(sale:FinanceSale)=>{
    setSelected(sale);setEditingTerms(false);setReceipt(null);setError('');
    setTerms(termsMap[sale.opportunity_id]||defaultFinanceTerms(sale.total_cents));
  };
  const selectReceipt=(ins:FinanceInstallment)=>{
    setReceipt(ins);
    const pending=Math.max(0,ins.amount_cents-financeNetInstallmentPaid(ins.id,movements));
    setAmount(moneyString(pending));setDay(today());setPayMethod(ins.expected_method);setNote('');setError('');
  };
  const openExpense=(record:FinanceMovement|'new')=>{
    setExpense(record);setError('');
    setAmount(record==='new'?'':moneyString(record.amount_cents));
    setCategory(record==='new'?'Insumos':record.category);
    setPayMethod(record==='new'?'pix':record.method);
    setDay(record==='new'?today():record.posted_on);
    setNote(record==='new'?'':record.description);
  };
  if(!can('finance.view'))return <Heading title="Financeiro"
    description="Acesso exclusivo para usuários autorizados pelo gestor."/>;
  const methodOptions=financeMethods.map(x=><option key={x.value} value={x.value}>{x.label}</option>);
  const filterFields:FilterField[]=[
    {key:'month',label:'Mês de referência',type:'month',defaultValue:today().slice(0,7),pin:true},
    {key:'seller',label:'Vendedor',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todos os autorizados'},
        ...[...new Set(sales.map(x=>x.seller_name_snapshot))].map(label=>({value:label,label}))]},
    {key:'product',label:'Produto ou serviço',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todos'},...[...new Set(sales.flatMap(x=>x.items_snapshot.map(i=>i.name)))]
        .map(label=>({value:label,label}))]},
    {key:'method',label:'Forma de pagamento',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todas'},...financeMethods.map(x=>({value:x.value,label:x.label}))]},
    {key:'status',label:'Situação do recebível',type:'select',defaultValue:'all',
      visible:tab==='receivables',
      options:[{value:'all',label:'Todas'},{value:'pendente',label:'Pendente'},
        {value:'parcial',label:'Parcial'},{value:'recebido',label:'Recebido'},
        {value:'vencido',label:'Vencido'}]},
  ];
  const movementRows=period.filter(m=>(tab!=='expenses'||m.kind==='expense')
    &&(tab!=='movements'||movementType!=='income'||m.kind==='income'||m.kind==='refund'));
  return <div className="finance-page">
    <Heading eyebrow="DEMONSTRAÇÃO · DADOS FICTÍCIOS" title="Financeiro"
      description="Vendas confirmadas geram recebíveis. Registre entradas e saídas separadamente."/>
    <GlobalFilters fields={filterFields}
      values={{month,seller,product,method,status}}
      onApply={v=>{
        setMonth(v.month);setSeller(v.seller);setProduct(v.product);
        setMethod(v.method);setStatus(v.status);pages.setPage(0);
      }}
      search={{value:search,onChange:v=>{setSearch(v);pages.setPage(0);},
        placeholder:'Buscar cliente, vendedor ou produto...'}}
      actions={can('finance.expense')&&<Button onClick={()=>openExpense('new')}>
        <Plus size={16}/>Nova despesa
      </Button>}
    />
    <div className="kpis">
      <Kpi label="Vendas fechadas" value={currency(closed)} foot="Confirmadas no mês"
        icon={<CheckCircle2 size={19}/>} to="/demo/financeiro?aba=sales"/>
      <Kpi label="A receber" value={currency(results.pending)} foot="Saldo em aberto acumulado"
        icon={<Clock3 size={19}/>} to="/demo/financeiro?aba=receivables"/>
      <Kpi label="Recebido" value={currency(results.received)} foot="Entradas menos estornos no mês"
        icon={<Wallet size={19}/>} to="/demo/financeiro?aba=movements&tipo=income"/>
      <Kpi label="Saídas" value={currency(results.expenses)} foot="Despesas registradas no mês"
        icon={<ArrowUpRight size={19}/>} to="/demo/financeiro?aba=expenses"/>
    </div>
    <p className="finance-summary-note">Saldo de caixa simulado: <strong>{currency(results.cash)}</strong>.
      Nenhum desses lançamentos movimenta dinheiro real.</p>
    <ViewSwitcher label="Abas do Financeiro" items={demoTabs} value={tab}
      onValueChange={x=>{setTab(x);pages.setPage(0);}}/>
    {tab==='overview'&&
      <Panel title="Evolução financeira" description="Entradas e saídas fictícias dos seis meses até o mês selecionado.">
        <div className="finance-actions">
          {(['bars','line','pie'] as const).map((x)=><Button key={x} size="sm"
            variant={graph===x?'default':'outline'} aria-pressed={graph===x}
            onClick={()=>setGraph(x)}>
            <BarChart3 size={16}/>{x==='bars'?'Barras':x==='line'?'Linhas':'Pizza'}
          </Button>)}
        </div>
        <FinanceGraph graph={graph} rows={charts}/>
      </Panel>}
    {tab==='sales'&&<Panel title="Vendas fechadas" description="Negociações comercialmente confirmadas.">
      <div className="table-wrap"><table className="finance-table">
        <thead><tr><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Itens vinculados</th><th>Valor</th></tr></thead>
        <tbody>{paginatedRows(salesFiltered.filter(s=>s.confirmed_at.startsWith(month)),
          pages.page,pages.size).map(sale=><tr key={sale.opportunity_id}>
          <td>{dateLabel(sale.confirmed_at.slice(0,10))}</td>
          <td><button className="finance-link" onClick={()=>openSale(sale)}>{sale.contact_name_snapshot}</button></td>
          <td>{sale.seller_name_snapshot}</td>
          <td>{sale.items_snapshot.map(i=>i.name).join(', ')||'Sem itens'}</td>
          <td>{currency(sale.total_cents)}</td>
        </tr>)}</tbody>
      </table></div>
      <Pagination page={pages.page} size={pages.size}
        total={salesFiltered.filter(s=>s.confirmed_at.startsWith(month)).length}
        onChange={pages.setPage} onSizeChange={pages.setSize} label="vendas"/>
    </Panel>}
    {tab==='receivables'&&<Panel title="Contas a receber" description="Abra uma venda para consultar as parcelas e registrar um pagamento fictício.">
      <div className="table-wrap"><table className="finance-table"><thead><tr>
        <th>Cliente</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Em aberto</th><th>Situação</th>
      </tr></thead><tbody>
        {paginatedRows(receivables,pages.page,pages.size).map(i=>{
          const sale=sales.find(x=>x.opportunity_id===i.opportunity_id);
          const paid=financeNetInstallmentPaid(i.id,movements);
          return <tr key={i.id}><td><button className="finance-link"
            onClick={()=>sale&&openSale(sale)}>{sale?.contact_name_snapshot}</button></td>
            <td>{i.kind==='entry'?'Entrada':i.installment_number+'ª parcela'}</td>
            <td>{dateLabel(i.due_on)}</td><td>{currency(i.amount_cents)}</td>
            <td>{currency(Math.max(0,i.amount_cents-paid))}</td>
            <td>{financeStatus(i,movements)}</td>
          </tr>;
        })}
      </tbody></table></div>
      {!receivables.length&&<Empty title="Sem parcelas no mês" description="Confirme uma venda no Kanban ou escolha outro período."/>}
      <Pagination page={pages.page} size={pages.size} total={receivables.length}
        onChange={pages.setPage} onSizeChange={pages.setSize} label="parcelas"/>
    </Panel>}
    {(tab==='expenses'||tab==='movements'||tab==='overview')&&
      <Panel title={tab==='expenses'?'Despesas':'Movimentações'} description="Dados de simulação; selecione registros para conferir.">
        {movementRows.length?
          <div className="table-wrap"><table className="finance-table"><thead><tr>
            <th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Ação</th>
          </tr></thead><tbody>
            {paginatedRows(movementRows,pages.page,pages.size).map(m=>
              <tr key={m.id}><td>{dateLabel(m.posted_on)}</td>
                <td>{m.kind==='income'?'Entrada':m.kind==='refund'?'Estorno':'Despesa'}</td>
                <td>{m.category||m.description}</td>
                <td>{m.kind==='income'?currency(m.amount_cents):'-'+currency(m.amount_cents)}</td>
                <td><div className="finance-actions">
                  {m.kind==='expense'&&can('finance.edit')&&<Button size="sm"
                    variant="outline" onClick={()=>openExpense(m)}>Editar</Button>}
                  {m.kind==='income'&&can('finance.void')&&<Button size="sm"
                    variant="outline" onClick={()=>{setRefund(m);setAmount(moneyString(m.amount_cents));
                      setNote('');setError('');}}>Estornar</Button>}
                </div></td>
              </tr>)}
          </tbody></table></div>:<Empty title="Sem movimentações" description="Cadastre uma despesa ou registre uma entrada fictícia."/>}
        <Pagination page={pages.page} size={pages.size} total={movementRows.length}
          onChange={pages.setPage} onSizeChange={pages.setSize} label="lançamentos"/>
      </Panel>}
    {selected&&<Modal open title={'Venda · '+selected.contact_name_snapshot} size="wide"
      description="Detalhes da venda fictícia" onOpenChange={v=>!v&&setSelected(null)}>
      <div className="finance-sale-detail">
        <p><strong>Vendedor:</strong> {selected.seller_name_snapshot}</p>
        <p><strong>Valor fechado:</strong> {currency(selected.total_cents)}</p>
        {selected.items_snapshot.length>0&&<p className="small-note">
          Itens: {selected.items_snapshot.map(x=>x.name).join(', ')}</p>}
        {can('finance.terms')&&!installments.some(i=>i.opportunity_id===selected.opportunity_id
          &&movements.some(m=>m.installment_id===i.id))&&
          <Button variant="outline" size="sm" onClick={()=>setEditingTerms(x=>!x)}>
            {editingTerms?'Cancelar edição':'Editar condições'}
          </Button>}
        {editingTerms&&<form className="finance-form" onSubmit={e=>{
          e.preventDefault();
          const issue=validateFinanceTerms(terms);
          if(issue||financeSelectedTotal(terms)!==selected.total_cents) {
            setError(issue||'O valor total precisa continuar igual ao da venda confirmada.');
            return;
          }
          update(d=>({...d,demoFinance:{
            terms:{...(d.demoFinance?.terms||{}),[selected.opportunity_id]:terms},
            movements:d.demoFinance?.movements||[],
          }}));
          setEditingTerms(false);setSelected(null);notice('Condições da simulação atualizadas.');
        }}>
          <FinanceTermsEditor value={terms} onChange={setTerms}/>
          <FormError message={error}/>
          <Button>Salvar condições</Button>
        </form>}
        {installments.filter(i=>i.opportunity_id===selected.opportunity_id).map(i=>
          <div className="finance-detail-item" key={i.id}>
            <div className="finance-item-head"><strong>{i.kind==='entry'?'Entrada':i.installment_number+'ª parcela'}</strong>
              <span>{currency(i.amount_cents)}</span></div>
            <p className="small-note">Vence {dateLabel(i.due_on)} · {financeStatus(i,movements)}.</p>
            {can('finance.receive')&&i.amount_cents>financeNetInstallmentPaid(i.id,movements)&&
              <Button variant="outline" size="sm" onClick={()=>selectReceipt(i)}>Registrar recebimento</Button>}
            {receipt?.id===i.id&&<form className="finance-form" onSubmit={e=>{
              e.preventDefault();const cents=toCents(amount);
              const remaining=i.amount_cents-financeNetInstallmentPaid(i.id,movements);
              if(!cents||cents>remaining){setError('Valor inválido ou maior que o saldo.');return;}
              saveMovement({id:uid(),company_id:session.companyId,opportunity_id:selected.opportunity_id,
                installment_id:i.id,owner_membership_id:selected.membership_id,kind:'income',
                amount_cents:cents,method:payMethod,posted_on:day,category:'',
                description:note,origin_id:null,created_at:new Date().toISOString(),
                row_version:1,voided_at:null});
            }}>
              <label className="form-row">Valor recebido
                <CurrencyInput value={amount} onValueChange={setAmount}/>
              </label>
              <label className="form-row">Forma
                <select value={payMethod} onChange={e=>setPayMethod(e.target.value as FinanceMethod)}>{methodOptions}</select>
              </label>
              <label className="form-row">Data
                <input type="date" value={day} onChange={e=>setDay(e.target.value)}/>
              </label>
              <FormError message={error}/>
              <Button>Confirmar recebimento fictício</Button>
            </form>}
          </div>
        )}
      </div>
    </Modal>}
    {expense&&<Modal open title={expense==='new'?'Nova despesa fictícia':'Editar despesa fictícia'}
      onOpenChange={v=>!v&&setExpense(null)}>
      <form className="finance-form" onSubmit={e=>{
        e.preventDefault();const cents=toCents(amount);
        if(!cents){setError('Valor inválido.');return;}
        const existing=expense==='new'?undefined:expense;
        saveMovement({
          id:existing?.id||uid(),company_id:session.companyId,opportunity_id:existing?.opportunity_id||null,
          installment_id:null,owner_membership_id:existing?.owner_membership_id||session.memberId,
          kind:'expense',amount_cents:cents,method:payMethod,posted_on:day,
          category,description:note,origin_id:null,
          created_at:existing?.created_at||new Date().toISOString(),
          row_version:(existing?.row_version||0)+1,voided_at:null,
        },existing);
      }}>
        <label className="form-row">Valor (R$)
          <CurrencyInput value={amount} onValueChange={setAmount}/></label>
        <label className="form-row">Categoria
          <input value={category} onChange={e=>setCategory(e.target.value)} required/></label>
        <label className="form-row">Data
          <input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>
        <label className="form-row">Forma de pagamento
          <select value={payMethod} onChange={e=>setPayMethod(e.target.value as FinanceMethod)}>{methodOptions}</select>
        </label>
        <label className="form-row">Descrição
          <textarea value={note} onChange={e=>setNote(e.target.value)}/></label>
        <FormError message={error}/>
        <Button>Salvar despesa fictícia</Button>
      </form>
    </Modal>}
    {refund&&<Modal open title="Estornar recebimento fictício"
      onOpenChange={v=>!v&&setRefund(null)}>
      <form className="finance-form" onSubmit={e=>{
        e.preventDefault();
        const cents=toCents(amount);
        const used=movements.filter(m=>m.origin_id===refund.id&&m.kind==='refund')
          .reduce((s,m)=>s+m.amount_cents,0);
        if(!cents||cents>refund.amount_cents-used||note.trim().length<5) {
          setError('Informe o valor disponível e um motivo de pelo menos 5 caracteres.');return;
        }
        saveMovement({
          id:uid(),company_id:session.companyId,opportunity_id:refund.opportunity_id,
          installment_id:refund.installment_id,owner_membership_id:refund.owner_membership_id,
          kind:'refund',amount_cents:cents,method:refund.method,posted_on:today(),category:'',
          description:note,origin_id:refund.id,created_at:new Date().toISOString(),
          row_version:1,voided_at:null,
        });
      }}>
        <p>Recebimento original: {currency(refund.amount_cents)}</p>
        <label className="form-row">Valor estornado
          <CurrencyInput value={amount} onValueChange={setAmount}/></label>
        <label className="form-row">Motivo
          <textarea minLength={5} required value={note} onChange={e=>setNote(e.target.value)}/></label>
        <FormError message={error}/>
        <Button>Registrar estorno fictício</Button>
      </form>
    </Modal>}
  </div>;
}
