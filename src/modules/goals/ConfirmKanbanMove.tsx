import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { CurrencyInput } from '../../components/currency-input';
import { currency } from '../../lib/format';
import { numberInputToCents } from './model';

export interface ConfirmedMove {
  confirmed: boolean;
  amountCents: number;
}
export function ConfirmKanbanMove({
  contactName,fromStage,toStage,kind,amountCents,busy=false,onCancel,onConfirm,
}:{
  contactName:string;fromStage:string;toStage:string;kind:'sale'|'other';amountCents:number;
  busy?:boolean;onCancel:()=>void;onConfirm:(result:ConfirmedMove)=>void;
}) {
  const [confirmed,setConfirmed]=useState(false);
  const [amount,setAmount]=useState((amountCents/100).toFixed(2));
  const cents=confirmed?numberInputToCents(amount):amountCents;
  return <Modal open title="Confirmar movimentação" description="Confirme a alteração antes de registrar no histórico do cliente."
    onOpenChange={open=>{if(!open&&!busy)onCancel();}}>
    <div className="goal-move-confirm">
      <p><strong>Cliente:</strong> {contactName}</p>
      <p><strong>De:</strong> {fromStage}</p>
      <p><strong>Para:</strong> {toStage}</p>
      {kind==='sale' ? <>
        <label className="operational-check">
          <input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)} />
          Confirmo que houve uma venda ou procedimento comercial efetivamente realizado
        </label>
        {confirmed && <label className="form-row">Valor confirmado (R$)
          <CurrencyInput value={amount} onValueChange={setAmount}/>
        </label>}
        <p className="small-note">Marcar a confirmação contabiliza uma venda nas metas e pode desbloquear medalhas. Não comprova recebimento do pagamento. Sem marcar, o card apenas muda de etapa.</p>
      </> : <p className="small-note">Essa etapa é importante para o histórico, mas não registra uma venda.</p>}
      <div className="form-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button>
        <Button type="button" disabled={busy||(confirmed&&!cents)} onClick={()=>onConfirm({confirmed,amountCents:cents||0})}>
          {busy?'Salvando...':confirmed?'Confirmar venda e mover':'Confirmar movimentação'}
        </Button>
      </div>
      {kind==='sale' && !confirmed && <small className="small-note">Valor estimado do card: {currency(amountCents)}. Se ainda não concluiu a venda, mantenha a confirmação desmarcada.</small>}
    </div>
  </Modal>;
}
