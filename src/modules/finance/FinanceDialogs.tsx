import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { CurrencyInput } from '../../components/currency-input';
import { FormError } from '../../components/shared';
import { currency, dateLabel, today, uid } from '../../lib/format';
import { useOperational, useSave } from '../workspace/operational';
import { FinanceTermsEditor } from './FinanceTermsEditor';
import { financeMethodLabel, financeMethods, financeNetInstallmentPaid, financeStatus,
  makeFinanceSchedule, moneyString, toCents, validateFinanceTerms,
  type FinanceInstallment, type FinanceMethod, type FinanceMovement, type FinanceSale,
  type FinanceTerms } from './model';
import { FinanceRepository } from './api';

const methods = financeMethods.map(m=><option key={m.value} value={m.value}>{m.label}</option>);
export function FinanceSaleDialog({
  sale, installments, movements, repo, onClose, onSaved,
}: {
  sale:FinanceSale;installments:FinanceInstallment[];movements:FinanceMovement[];
  repo:FinanceRepository;onClose:()=>void;onSaved:()=>void;
}) {
  const { can } = useOperational();
  const save = useSave();
  const [editingTerms,setEditingTerms]=useState(false);
  const [receipt,setReceipt]=useState<FinanceInstallment|null>(null);
  const [requestId,setRequestId]=useState(uid);
  const [amount,setAmount]=useState('');
  const [method,setMethod]=useState<FinanceMethod>('pix');
  const [date,setDate]=useState(today);
  const [note,setNote]=useState('');
  const rows=installments.filter(x=>x.opportunity_id===sale.opportunity_id)
    .sort((a,b)=>a.installment_number-b.installment_number);
  const hasMovements=movements.some(x=>x.opportunity_id===sale.opportunity_id);
  const entry=rows.find(x=>x.kind==='entry');
  const recurring=rows.filter(x=>x.kind==='installment');
  const [terms,setTerms]=useState<FinanceTerms>(()=>({
    cashCents:sale.cash_price_cents,termCents:sale.term_price_cents,
    kind:sale.payment_kind,entryCents:entry?.amount_cents||0,
    count:Math.max(1,recurring.length),
    firstDue:recurring[0]?.due_on||today(),
    method:recurring[0]?.expected_method||entry?.expected_method||'pix',
    customCents:recurring.map(x=>x.amount_cents),
    customDates:recurring.map(x=>x.due_on),
  }));
  const selectReceipt=(x:FinanceInstallment)=>{
    setReceipt(x);
    setRequestId(uid());
    const due=Math.max(0,x.amount_cents-financeNetInstallmentPaid(x.id,movements));
    setAmount(moneyString(due));
    setMethod(x.expected_method);
    setDate(today());
    setNote('');
  };
  const totalPaid=rows.reduce((s,x)=>s+financeNetInstallmentPaid(x.id,movements),0);
  return <Modal open title={'Venda · '+sale.contact_name_snapshot} size="wide"
      description="Cliente, vendedor, itens e recebíveis vinculados à venda."
      onOpenChange={v=>{if(!v&&!save.busy)onClose();}}>
    <div className="finance-sale-detail">
      <dl>
        <dt>Cliente</dt><dd>{can('contacts.view')
          ? <Link to={'/app/contatos?registro='+sale.contact_id} onClick={onClose}>{sale.contact_name_snapshot}</Link>
          : sale.contact_name_snapshot}</dd>
        <dt>Vendedor</dt><dd>{sale.seller_name_snapshot||'Não informado'}</dd>
        <dt>Venda fechada</dt><dd>{dateLabel(sale.confirmed_at.slice(0,10))}</dd>
        <dt>Valor confirmado</dt><dd><strong>{currency(sale.total_cents)}</strong></dd>
        <dt>Preço à vista</dt><dd>{currency(sale.cash_price_cents)}</dd>
        <dt>Preço a prazo</dt><dd>{currency(sale.term_price_cents)}</dd>
        <dt>Já recebido</dt><dd>{currency(totalPaid)}</dd>
        <dt>Saldo a receber</dt><dd>{currency(Math.max(0,sale.total_cents-totalPaid))}</dd>
        <dt>Situação</dt><dd>{sale.cancelled_at?'Venda cancelada':'Venda confirmada'}</dd>
      </dl>
      <section className="finance-detail-item">
        <div className="finance-item-head"><strong>Produtos e serviços vinculados</strong></div>
        {sale.items_snapshot?.length ?
          <ul>{sale.items_snapshot.map((item,i)=><li key={item.id||i}>
            {item.kind==='service'?'Serviço':'Produto'} · {item.name} · {currency(item.unit_price_cents)}
          </li>)}</ul> :
          <p className="small-note">Esta venda não tem itens individuais vinculados ao card.</p>}
      </section>
      <div className="finance-item-head">
        <strong>Recebíveis e parcelas</strong>
        {can('finance.terms')&&!sale.cancelled_at&&!hasMovements && (
          <Button size="sm" variant="outline" onClick={()=>setEditingTerms(!editingTerms)}>
            {editingTerms?'Cancelar ajuste':'Editar condições'}
          </Button>
        )}
      </div>
      {editingTerms && (
        <form className="finance-form" onSubmit={e=>{
          e.preventDefault();
          void save.run(async()=>{
            const schedule=makeFinanceSchedule(terms);
            if(validateFinanceTerms(terms)||terms.kind==='cash'&&terms.cashCents!==sale.total_cents
              ||terms.kind==='installments'&&terms.termCents!==sale.total_cents) {
                throw Error('O valor negociado deve fechar exatamente o total da venda. Para mudar esse total, faça a correção comercial.');
            }
            await repo.saveTerms(sale,terms.kind,terms.cashCents,terms.termCents,schedule);
            onSaved();
          });
        }}>
          <FinanceTermsEditor value={terms} onChange={setTerms} disabled={save.busy}/>
          <FormError message={save.error}/>
          <Button type="submit" disabled={save.busy||!!validateFinanceTerms(terms)}>
            Salvar condições
          </Button>
        </form>
      )}
      <div className="finance-detail-list">
        {rows.map(ins=>{
          const received=financeNetInstallmentPaid(ins.id,movements);
          const open=Math.max(0,ins.amount_cents-received);
          return <div key={ins.id} className="finance-detail-item">
            <div className="finance-item-head">
              <strong>{ins.kind==='entry'?'Entrada':ins.installment_number+'ª parcela'}</strong>
              <span className="finance-status">{financeStatus(ins,movements)}</span>
            </div>
            <div className="finance-item-head">
              <span>Vencimento: {dateLabel(ins.due_on)}</span>
              <strong>{currency(ins.amount_cents)}</strong>
            </div>
            <p className="small-note">
              {financeMethodLabel(ins.expected_method)} · Recebido: {currency(received)}
              {' '}· Em aberto: {currency(open)}
            </p>
            {can('finance.receive')&&!sale.cancelled_at&&open>0 && (
              <Button size="sm" variant="outline" onClick={()=>selectReceipt(ins)}>
                Registrar recebimento
              </Button>
            )}
            {receipt?.id===ins.id && (
              <form className="finance-form" onSubmit={e=>{
                e.preventDefault();
                void save.run(async()=>{
                  const cents=toCents(amount);
                  if(!cents||cents>open) throw Error('O valor deve ser maior que zero e não ultrapassar o saldo da parcela.');
                  await repo.recordReceipt(ins,cents,method,date,note,requestId);
                  onSaved();
                },true);
              }}>
                <div className="finance-fields-grid">
                  <label className="form-row">Valor recebido (R$)
                    <CurrencyInput value={amount} onValueChange={setAmount}/>
                  </label>
                  <label className="form-row">Forma de pagamento
                    <select value={method} onChange={e=>setMethod(e.target.value as FinanceMethod)}>{methods}</select>
                  </label>
                  <label className="form-row">Data do recebimento
                    <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
                  </label>
                  <label className="form-row">Observação
                    <input value={note} maxLength={500} onChange={e=>setNote(e.target.value)}/>
                  </label>
                </div>
                <FormError message={save.error}/>
                <div className="finance-actions">
                  <Button type="button" variant="outline" onClick={()=>setReceipt(null)}>Cancelar</Button>
                  <Button type="submit" disabled={save.busy}>{save.busy?'Salvando...':'Confirmar recebimento'}</Button>
                </div>
              </form>
            )}
          </div>;
        })}
      </div>
      {rows.length===0 && <p className="small-note">Sem parcelas registradas.</p>}
      <p className="small-note">Os pagamentos são lançados manualmente. O CRM não movimenta contas bancárias nem faz cobrança automática.</p>
    </div>
  </Modal>;
}

export function FinanceExpenseDialog({
  initial, sales, repo, ownerId, onClose, onSaved,
}:{
  initial?:FinanceMovement;sales:FinanceSale[];repo:FinanceRepository;ownerId:string;
  onClose:()=>void;onSaved:()=>void;
}) {
  const save=useSave();
  const [id]=useState(()=>initial?.id||uid());
  const [amount,setAmount]=useState(()=>moneyString(initial?.amount_cents||0));
  const [method,setMethod]=useState<FinanceMethod>(initial?.method||'pix');
  const [day,setDay]=useState(initial?.posted_on||today());
  const [category,setCategory]=useState(initial?.category||'');
  const [description,setDescription]=useState(initial?.description||'');
  const [opportunity,setOpportunity]=useState(initial?.opportunity_id||'');
  return <Modal open title={initial?'Editar despesa':'Nova despesa'}
    description="Lançamento financeiro manual com histórico de alterações."
    onOpenChange={v=>{if(!v&&!save.busy)onClose();}}>
    <form className="finance-form" onSubmit={e=>{
      e.preventDefault();
      void save.run(async()=>{
        const cents=toCents(amount);
        if(!cents||!category.trim()||!day) throw Error('Informe valor, categoria e data válidos.');
        await repo.saveExpense({id,amount:cents,method,day,category,description,
          owner:initial?.owner_membership_id||ownerId,opportunity:opportunity||null,
          version:initial?.row_version});
        onSaved();
      },true);
    }}>
      <div className="finance-fields-grid">
        <label className="form-row">Valor (R$)
          <CurrencyInput value={amount} onValueChange={setAmount} required/>
        </label>
        <label className="form-row">Forma de pagamento
          <select value={method} onChange={e=>setMethod(e.target.value as FinanceMethod)}>{methods}</select>
        </label>
        <label className="form-row">Data da saída
          <input type="date" value={day} onChange={e=>setDay(e.target.value)} required/>
        </label>
        <label className="form-row">Categoria
          <input value={category} onChange={e=>setCategory(e.target.value)} maxLength={100} required
            placeholder="Ex.: Aluguel, insumos, marketing"/>
        </label>
      </div>
      <label className="form-row">Vincular à venda (opcional)
        <select value={opportunity} onChange={e=>setOpportunity(e.target.value)}>
          <option value="">Despesa geral da empresa</option>
          {sales.filter(x=>!x.cancelled_at).map(x=>
            <option key={x.opportunity_id} value={x.opportunity_id}>
              {x.contact_name_snapshot} · {currency(x.total_cents)}
            </option>
          )}
        </select>
      </label>
      <label className="form-row">Descrição
        <textarea value={description} onChange={e=>setDescription(e.target.value)}
          maxLength={500} rows={3} placeholder="Detalhe da despesa"/>
      </label>
      <FormError message={save.error}/>
      <div className="finance-actions">
        <Button type="button" variant="outline" disabled={save.busy} onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={save.busy}>{save.busy?'Salvando...':initial?'Salvar alterações':'Registrar despesa'}</Button>
      </div>
    </form>
  </Modal>;
}

export function FinanceCorrectionDialog({
  movement, repo, onClose, onSaved,
}:{
  movement:FinanceMovement;repo:FinanceRepository;onClose:()=>void;onSaved:()=>void;
}) {
  const save=useSave();
  const [requestId]=useState(uid);
  const [action,setAction]=useState<'refund'|'void'>(movement.kind==='income'?'refund':'void');
  const [amount,setAmount]=useState(moneyString(movement.amount_cents));
  const [method,setMethod]=useState<FinanceMethod>(movement.method);
  const [date,setDate]=useState(today);
  const [reason,setReason]=useState('');
  return <Modal open title="Corrigir lançamento financeiro"
    description="Estornos e anulações preservam o registro e o histórico." onOpenChange={v=>{if(!v&&!save.busy)onClose();}}>
    <form className="finance-form" onSubmit={e=>{
      e.preventDefault();
      void save.run(async()=>{
        if(reason.trim().length<5) throw Error('Informe um motivo com pelo menos 5 caracteres.');
        if(action==='refund'&&movement.kind==='income') {
          const cents=toCents(amount);
          if(!cents||cents>movement.amount_cents) throw Error('Confira o valor do estorno.');
          await repo.refund(movement,cents,method,date,reason,requestId);
        } else {
          await repo.voidMovement(movement,reason);
        }
        onSaved();
      },true);
    }}>
      <p><strong>Registro:</strong> {currency(movement.amount_cents)} · {dateLabel(movement.posted_on)}</p>
      {movement.kind==='income' && (
        <label className="form-row">Tipo de correção
          <select value={action} onChange={e=>setAction(e.target.value as 'refund'|'void')}>
            <option value="refund">Estorno real (saída no dia do estorno)</option>
            <option value="void">Anular lançamento incorreto (sem saída de caixa)</option>
          </select>
        </label>
      )}
      {action==='refund' && movement.kind==='income' && (
        <div className="finance-fields-grid">
          <label className="form-row">Valor estornado
            <CurrencyInput value={amount} onValueChange={setAmount}/>
          </label>
          <label className="form-row">Forma do estorno
            <select value={method} onChange={e=>setMethod(e.target.value as FinanceMethod)}>{methods}</select>
          </label>
          <label className="form-row">Data
            <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          </label>
        </div>
      )}
      <label className="form-row">Motivo obrigatório
        <textarea required minLength={5} maxLength={500} value={reason}
          onChange={e=>setReason(e.target.value)} placeholder="Descreva por que está corrigindo este lançamento"/>
      </label>
      <FormError message={save.error}/>
      <div className="finance-actions">
        <Button variant="outline" type="button" onClick={onClose} disabled={save.busy}>Cancelar</Button>
        <Button type="submit" disabled={save.busy||reason.trim().length<5}>
          {save.busy?'Salvando...':action==='refund'?'Registrar estorno':'Anular lançamento'}
        </Button>
      </div>
    </form>
  </Modal>;
}
