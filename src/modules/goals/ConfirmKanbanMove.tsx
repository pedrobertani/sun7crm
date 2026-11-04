import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { CurrencyInput } from '../../components/currency-input';
import { currency } from '../../lib/format';
import { numberInputToCents } from './model';
import { FinanceTermsEditor } from '../finance/FinanceTermsEditor';
import { defaultFinanceTerms, financeSelectedTotal, makeFinanceSchedule,
  validateFinanceTerms, type FinancePaymentKind, type FinanceScheduleRow } from '../finance/model';

export interface ConfirmedMove {
  confirmed: boolean;
  amountCents: number;
  finance?: {
    cashCents: number;
    termCents: number;
    kind: FinancePaymentKind;
    schedule: FinanceScheduleRow[];
  };
}
export function ConfirmKanbanMove({
  contactName,fromStage,toStage,kind,amountCents,busy=false,
  canConfigureFinance=false,onCancel,onConfirm,
}: {
  contactName:string;fromStage:string;toStage:string;kind:'sale'|'other';amountCents:number;
  busy?:boolean;canConfigureFinance?:boolean;onCancel:()=>void;onConfirm:(result:ConfirmedMove)=>void;
}) {
  const [confirmed,setConfirmed]=useState(false);
  const [amount,setAmount]=useState((amountCents/100).toFixed(2));
  const [terms,setTerms]=useState(()=>defaultFinanceTerms(amountCents));
  const cents=confirmed && canConfigureFinance ? financeSelectedTotal(terms)
    : confirmed ? numberInputToCents(amount) : amountCents;
  const termsError=confirmed&&canConfigureFinance ? validateFinanceTerms(terms) : null;
  return <Modal open title="Confirmar movimentação" description="A confirmação comercial e as condições financeiras são registros distintos."
    size={canConfigureFinance&&confirmed?'wide':'default'}
    onOpenChange={open=>{if(!open&&!busy)onCancel();}}>
    <div className="goal-move-confirm finance-confirm-sale">
      <p><strong>Cliente:</strong> {contactName}</p>
      <p><strong>De:</strong> {fromStage}</p>
      <p><strong>Para:</strong> {toStage}</p>
      {kind==='sale' ? <>
        <label className="operational-check">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} />
          Confirmo que houve uma venda ou procedimento comercial efetivamente realizado
        </label>
        {confirmed && canConfigureFinance ? (
          <FinanceTermsEditor value={terms} onChange={setTerms} disabled={busy} />
        ) : confirmed ? (
          <label className="form-row">Valor confirmado (R$)
            <CurrencyInput value={amount} onValueChange={setAmount} disabled={busy}/>
          </label>
        ) : null}
        <p className="small-note">
          Confirmar a venda contabiliza o resultado nas metas, mas <strong>não confirma pagamento</strong>.
          {confirmed ? ' O Financeiro registra o valor a receber; a entrada de caixa só ocorre após uma baixa explícita.' :
            ' Sem marcar a confirmação, o card apenas muda de etapa.'}
        </p>
      </> : <p className="small-note">Essa etapa é importante para o histórico, mas não registra uma venda.</p>}
      <div className="form-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button type="button" disabled={busy||(confirmed&&(!cents||!!termsError))}
          onClick={()=>onConfirm({
            confirmed, amountCents:cents||0,
            finance:confirmed&&canConfigureFinance?{
              cashCents:terms.cashCents,
              termCents:terms.termCents,
              kind:terms.kind,
              schedule:makeFinanceSchedule(terms),
            }:undefined,
          })}>
          {busy?'Salvando...':confirmed?'Confirmar venda e mover':'Confirmar movimentação'}
        </Button>
      </div>
      {kind==='sale' && !confirmed && <small className="small-note">
        Valor estimado do card: {currency(amountCents)}. Se ainda não concluiu a venda, mantenha a confirmação desmarcada.
      </small>}
    </div>
  </Modal>;
}
