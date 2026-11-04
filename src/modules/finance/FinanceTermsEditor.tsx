import { CurrencyInput } from '../../components/currency-input';
import { currency, today } from '../../lib/format';
import { financeMethods, financeSelectedTotal, makeFinanceSchedule, moneyString,
  toCents, validateFinanceTerms, type FinanceTerms, type FinanceMethod } from './model';
import './finance.css';

export function FinanceTermsEditor({
  value, onChange, disabled = false,
}: {
  value: FinanceTerms;
  onChange: (next: FinanceTerms) => void;
  disabled?: boolean;
}) {
  const set = (change: Partial<FinanceTerms>) => onChange({ ...value, ...change });
  const schedule = makeFinanceSchedule(value);
  const issue = validateFinanceTerms(value);
  const total = financeSelectedTotal(value);
  const remaining = value.kind === 'installments' ? Math.max(0,total-value.entryCents) : 0;
  const auto = value.kind === 'installments' && !value.customCents;
  const toggleCustomized = (custom: boolean) => {
    if (!custom) return set({ customCents: undefined });
    const automatic = makeFinanceSchedule({ ...value, customCents: undefined })
      .filter(x=>!x.entry).map(x=>x.amount_cents);
    set({ customCents: automatic });
  };
  return (
    <fieldset className="finance-terms" disabled={disabled}>
      <legend>Condições negociadas</legend>
      <div className="finance-fields-grid">
        <label className="form-row">
          Valor à vista (R$)
          <CurrencyInput
            aria-label="Valor à vista"
            value={moneyString(value.cashCents)}
            onValueChange={s => set({ cashCents: toCents(s,true) ?? 0 })}
          />
        </label>
        <label className="form-row">
          Valor a prazo (R$)
          <CurrencyInput
            aria-label="Valor a prazo"
            value={moneyString(value.termCents)}
            onValueChange={s => set({ termCents: toCents(s,true) ?? 0, customCents: undefined })}
          />
        </label>
        <label className="form-row">
          Condição de pagamento
          <select value={value.kind} onChange={e=>set({kind:e.target.value as FinanceTerms['kind']})}>
            <option value="cash">À vista</option>
            <option value="installments">A prazo / parcelado</option>
          </select>
        </label>
        <label className="form-row">
          Forma prevista
          <select value={value.method} onChange={e=>set({method:e.target.value as FinanceMethod})}>
            {financeMethods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </label>
        {value.kind==='installments' && (
          <>
            <label className="form-row">
              Entrada negociada (R$)
              <CurrencyInput
                aria-label="Entrada negociada"
                value={moneyString(value.entryCents)}
                onValueChange={s=>set({entryCents:toCents(s,true)??0,customCents:undefined})}
              />
            </label>
            <label className="form-row">
              Quantidade de parcelas
              <input type="number" min="1" max="36" step="1" value={value.count}
                onChange={e=>set({count:Number(e.target.value),customCents:undefined,customDates:undefined})}/>
            </label>
            <label className="form-row">
              Vencimento da 1ª parcela
              <input type="date" value={value.firstDue} min={today()}
                onChange={e=>set({firstDue:e.target.value,customDates:undefined})}/>
            </label>
          </>
        )}
      </div>
      {value.kind==='installments' && (
        <>
          <p className="small-note">
            Total: <strong>{currency(total)}</strong> · Entrada: <strong>{currency(value.entryCents)}</strong>
            {' '}· Saldo parcelado: <strong>{currency(remaining)}</strong>.
          </p>
          <label className="operational-check">
            <input type="checkbox" checked={!auto} onChange={e=>toggleCustomized(e.target.checked)}/>
            Definir o valor de cada parcela manualmente
          </label>
          {value.entryCents>0 && (
            <p className="small-note">Entrada programada para {today()}. Só entra em caixa quando o recebimento for registrado.</p>
          )}
          <div className="finance-installment-grid">
            {Array.from({length:Math.max(0,Math.min(36,Number.isSafeInteger(value.count)?value.count:0))},(_,i)=>{
              const row=schedule.filter(x=>!x.entry)[i];
              const amount = value.customCents?.[i] ?? row?.amount_cents ?? 0;
              return <div className="finance-installment-row" key={i}>
                <strong>{i+1}ª parcela</strong>
                <label className="form-row">
                  Valor (R$)
                  <CurrencyInput
                    aria-label={'Valor da parcela '+(i+1)}
                    disabled={auto}
                    value={moneyString(amount)}
                    onValueChange={s=>{
                      const values=value.customCents?.slice()||[];
                      values[i]=toCents(s,true)??0;
                      set({customCents:values});
                    }}
                  />
                </label>
                <label className="form-row">
                  Vencimento
                  <input type="date" value={value.customDates?.[i]||row?.due_on||value.firstDue}
                    onChange={e=>{
                      const dates=Array.from({length:value.count},(_,j)=>value.customDates?.[j]||schedule.filter(x=>!x.entry)[j]?.due_on||value.firstDue);
                      dates[i]=e.target.value;
                      set({customDates:dates});
                    }}
                  />
                </label>
              </div>;
            })}
          </div>
        </>
      )}
      {issue && <p className="form-error" role="alert">{issue}</p>}
      {!issue && <p className="small-note">
        {value.kind==='cash' ? 'Pagamento à vista' : schedule.length+' vencimento(s)'}
        {' '}totalizando <strong>{currency(total)}</strong>.
        Nenhum recebimento é confirmado automaticamente.
      </p>}
    </fieldset>
  );
}
