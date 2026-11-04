import { describe,it,expect } from 'vitest';
import { defaultFinanceTerms,financeSelectedTotal,makeFinanceSchedule,
 plusMonths,validateFinanceTerms,financeTotals,financeNetInstallmentPaid,
 financeStatus,toCents,type FinanceSale,type FinanceInstallment,type FinanceMovement } from './model';

describe('financeiro operacional',()=>{
 it('divide parcelas em centavos sem perder resíduos e permite entrada',()=>{
  const terms={...defaultFinanceTerms(120000),kind:'installments' as const,
   cashCents:100000,termCents:120000,entryCents:30000,count:7,firstDue:'2026-12-10'};
  expect(validateFinanceTerms(terms)).toBeNull();
  expect(financeSelectedTotal(terms)).toBe(120000);
  const schedule=makeFinanceSchedule(terms,'2026-11-10');
  expect(schedule).toHaveLength(8);
  expect(schedule[0]).toEqual(expect.objectContaining({entry:true,amount_cents:30000}));
  expect(schedule.slice(1).reduce((s,x)=>s+x.amount_cents,0)).toBe(90000);
  expect(schedule.reduce((s,x)=>s+x.amount_cents,0)).toBe(120000);
  expect(schedule.slice(1).map(s=>s.due_on).at(-1)).toBe('2027-06-10');
 });
 it('aceita parcelas personalizadas, mas nunca total incompatível',()=>{
  const base={...defaultFinanceTerms(100000),kind:'installments' as const,count:3,
   entryCents:10000,firstDue:'2026-12-15',customCents:[20000,25000,45000]};
  expect(validateFinanceTerms(base)).toBeNull();
  expect(makeFinanceSchedule(base).map(x=>x.amount_cents)).toEqual([10000,20000,25000,45000]);
  expect(validateFinanceTerms({...base,customCents:[20000,25000,44000]})).toContain('soma');
  expect(validateFinanceTerms({...base,entryCents:100000})).toContain('entrada');
  expect(validateFinanceTerms({...base,count:40})).toContain('quantidade');
  expect(validateFinanceTerms({...base,customCents:[20000,-1,70001]})).toContain('quantidade');
 });
 it('arredonda datas no último dia do mês',()=>{
  expect(plusMonths('2027-01-31',1)).toBe('2027-02-28');
  expect(plusMonths('2028-01-31',1)).toBe('2028-02-29');
  expect(plusMonths('2026-12-31',1)).toBe('2027-01-31');
 });
 it('não soma receita prevista como receita recebida e contabiliza estornos',()=>{
  const sale={opportunity_id:'card1',confirmed_at:'2026-11-04',total_cents:120000,cancelled_at:null} as FinanceSale;
  const installment={id:'inst1',opportunity_id:'card1',amount_cents:120000,due_on:'2026-12-05'} as FinanceInstallment;
  const movements=[
   {kind:'income',installment_id:'inst1',amount_cents:30000,posted_on:'2026-11-04',voided_at:null},
   {kind:'refund',installment_id:'inst1',amount_cents:10000,posted_on:'2026-11-05',voided_at:null},
   {kind:'expense',installment_id:null,amount_cents:5000,posted_on:'2026-11-05',voided_at:null},
   {kind:'expense',installment_id:null,amount_cents:5000,posted_on:'2026-11-05',voided_at:'2026-11-05'},
  ] as FinanceMovement[];
  expect(financeNetInstallmentPaid('inst1',movements)).toBe(20000);
  expect(financeStatus(installment,movements,'2026-12-06')).toBe('Parcial');
  expect(financeTotals([sale],[installment],movements,'2026-11'))
   .toEqual({sold:120000,pending:100000,received:20000,expenses:5000,cash:15000,projected:115000});
  expect(financeTotals([sale],[installment],movements,'2026-10').received).toBe(0);
 });
 it('valida valores antes de qualquer gravação',()=>{
  expect(toCents('12.50')).toBe(1250);
  expect(toCents('0')).toBeNull();
  expect(toCents('0',true)).toBe(0);
  expect(toCents('-1')).toBeNull();
 });
});
