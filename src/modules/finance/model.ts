import { shiftDate, today } from '../../lib/format';

export const financeMethods = [
  { value:'pix', label:'Pix' }, { value:'cash',label:'Dinheiro' },
  { value:'credit_card',label:'Cartão de crédito' }, { value:'debit_card',label:'Cartão de débito' },
  { value:'bank_transfer',label:'Transferência' }, { value:'other',label:'Outro' },
] as const;
export type FinanceMethod = (typeof financeMethods)[number]['value'];
export type FinancePaymentKind = 'cash' | 'installments';
export interface FinanceScheduleRow {
  amount_cents: number;
  due_on: string;
  method: FinanceMethod;
  entry?: boolean;
}
export interface FinanceTerms {
  cashCents: number;
  termCents: number;
  kind: FinancePaymentKind;
  entryCents: number;
  count: number;
  firstDue: string;
  method: FinanceMethod;
  customCents?: number[];
  customDates?: string[];
}
export interface FinanceSale {
  company_id: string;
  opportunity_id: string;
  contact_id: string;
  membership_id: string;
  total_cents: number;
  cash_price_cents: number;
  term_price_cents: number;
  payment_kind: FinancePaymentKind;
  items_snapshot: { id: string; name: string; kind: 'product' | 'service'; unit_price_cents: number; quantity: number }[];
  contact_name_snapshot: string;
  seller_name_snapshot: string;
  confirmed_at: string;
  cancelled_at: string | null;
  row_version: number;
}
export interface FinanceInstallment {
  id: string;
  company_id: string;
  opportunity_id: string;
  installment_number: number;
  kind: 'entry' | 'installment';
  amount_cents: number;
  due_on: string;
  expected_method: FinanceMethod;
}
export interface FinanceMovement {
  id: string;
  company_id: string;
  opportunity_id: string | null;
  installment_id: string | null;
  owner_membership_id: string;
  kind: 'income' | 'expense' | 'refund';
  amount_cents: number;
  method: FinanceMethod;
  posted_on: string;
  category: string;
  description: string;
  origin_id: string | null;
  created_at: string;
  row_version: number;
  voided_at: string | null;
}
export interface FinanceAudit {
  id: string;
  company_id: string;
  movement_id: string | null;
  opportunity_id: string | null;
  action: string;
  reason: string;
  occurred_at: string;
}
export const moneyString = (cents: number) => (cents / 100).toFixed(2);
export function toCents(value: string, allowZero = false): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount > 1000000000000 || amount < (allowZero ? 0 : 1)) return null;
  return amount;
}
export function plusMonths(day: string, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const parsed = new Date(day + 'T12:00:00Z');
  if (Number.isNaN(parsed.getTime())) return '';
  const date = parsed.getUTCDate();
  const next = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + months + 1, 0, 12));
  next.setUTCDate(Math.min(date, next.getUTCDate()));
  return next.toISOString().slice(0, 10);
}
export function defaultFinanceTerms(amountCents: number): FinanceTerms {
  return {
    cashCents: amountCents,
    termCents: amountCents,
    kind: 'cash',
    entryCents: 0,
    count: 1,
    firstDue: shiftDate(today(),30),
    method: 'pix',
  };
}
export function financeSelectedTotal(terms: FinanceTerms) {
  return terms.kind === 'cash' ? terms.cashCents : terms.termCents;
}
export function makeFinanceSchedule(terms: FinanceTerms, todayDate = today()): FinanceScheduleRow[] {
  if (!Number.isSafeInteger(terms.cashCents) || terms.cashCents < 1
      || !Number.isSafeInteger(terms.termCents) || terms.termCents < 1
      || !financeMethods.some(m => m.value === terms.method)) return [];
  if (terms.kind === 'cash') return [{amount_cents:terms.cashCents,due_on:todayDate,method:terms.method}];
  const count = terms.count;
  if (!Number.isSafeInteger(count) || count < 1 || count > 36
    || !Number.isSafeInteger(terms.entryCents) || terms.entryCents < 0
    || terms.entryCents >= terms.termCents
    || !/^\d{4}-\d{2}-\d{2}$/.test(terms.firstDue)
  ) return [];
  const rest = terms.termCents - terms.entryCents;
  const base = Math.floor(rest/count);
  const spare = rest%count;
  const values = terms.customCents && terms.customCents.length===count
    ? terms.customCents : Array.from({length:count},(_,index)=>base+(index<spare?1:0));
  if (values.some(v => !Number.isSafeInteger(v) || v < 1) || values.reduce((a,b)=>a+b,0)!==rest) return [];
  const schedule: FinanceScheduleRow[] = [];
  if (terms.entryCents) schedule.push({
    entry:true,amount_cents:terms.entryCents,due_on:todayDate,method:terms.method,
  });
  for(let i=0;i<count;i++) {
    const due_on = terms.customDates?.[i] || plusMonths(terms.firstDue,i);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due_on)) return [];
    schedule.push({amount_cents:values[i],due_on,method:terms.method});
  }
  return schedule;
}
export function validateFinanceTerms(terms: FinanceTerms): string | null {
  if (!Number.isSafeInteger(terms.cashCents) || terms.cashCents < 1
    || !Number.isSafeInteger(terms.termCents) || terms.termCents < 1
    || financeSelectedTotal(terms)>2147483647)
    return 'Informe preços válidos. O limite por venda é R$ 21.474.836,47.';
  if (terms.kind==='installments' && terms.entryCents >= terms.termCents)
    return 'A entrada precisa ser menor do que o valor total a prazo.';
  if (!makeFinanceSchedule(terms).length)
    return 'Confira a quantidade, os vencimentos e a soma das parcelas: o total deve ser exato.';
  return null;
}
export function financeNetInstallmentPaid(
  installmentId: string, movements: FinanceMovement[],
): number {
  return movements.filter(x=>x.installment_id===installmentId&&!x.voided_at)
    .reduce((sum,m)=>sum+(m.kind==='income'?m.amount_cents:m.kind==='refund'?-m.amount_cents:0),0);
}
export function financeStatus(installment: FinanceInstallment, movements: FinanceMovement[], current = today()) {
  const paid = financeNetInstallmentPaid(installment.id,movements);
  if (paid>=installment.amount_cents) return 'Recebido';
  if (paid>0) return 'Parcial';
  return installment.due_on<current?'Vencido':'Pendente';
}
export interface FinanceTotals {
  sold: number;
  pending: number;
  received: number;
  expenses: number;
  cash: number;
  projected: number;
}
export function financeTotals(
  sales: FinanceSale[], installments: FinanceInstallment[], movements: FinanceMovement[],
  month: string,
): FinanceTotals {
  const active = sales.filter(s=>!s.cancelled_at);
  const activeIds = new Set(active.map(s=>s.opportunity_id));
  const sold=active.filter(s=>s.confirmed_at.slice(0,7)===month).reduce((x,s)=>x+s.total_cents,0);
  const pending=installments.filter(i=>activeIds.has(i.opportunity_id))
    .reduce((sum,i)=>sum+Math.max(0,i.amount_cents-financeNetInstallmentPaid(i.id,movements)),0);
  const period=movements.filter(m=>!m.voided_at&&m.posted_on.startsWith(month));
  const received=period.reduce((s,m)=>s+(m.kind==='income'?m.amount_cents:m.kind==='refund'?-m.amount_cents:0),0);
  const expenses=period.filter(m=>m.kind==='expense').reduce((s,m)=>s+m.amount_cents,0);
  return {sold,pending,received,expenses,cash:received-expenses,
    projected:received-expenses+pending};
}
export const financeMethodLabel=(method:FinanceMethod)=>financeMethods.find(x=>x.value===method)?.label||'Outro';
