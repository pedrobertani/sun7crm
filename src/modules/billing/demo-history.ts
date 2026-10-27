import type { Charge, ChargeHistory } from './charges';
import { shiftDate } from '../../lib/format';

// Exemplos da demonstração pública. Nenhuma cobrança ou integração bancária é executada.
export function demoChargeHistory(
  companyId: string,
  companyName: string,
  dueDate: string,
  date: string,
): ChargeHistory {
  const base: Charge = {
    id: 'demo-charge-open',
    company_id: companyId,
    company_name: companyName,
    created_by: 'demo-admin',
    recorded_by: 'Administração SUN7CRM',
    amount_cents: 18990,
    due_date: dueDate,
    status: 'pending',
    display_status: dueDate < date ? 'overdue' : 'pending',
    source: 'manual',
    kind: 'one_time',
    payment_method: 'unknown',
    provider_payment_id: null,
    provider_reference: null,
    checkout_url: null,
    event_id: null,
    needs_review: false,
    review_reason: '',
    note: 'Exemplo fictício de mensalidade em aberto.',
    cancelled_reason: '',
    paid_at: null,
    cancelled_at: null,
    created_at: `${shiftDate(date, -2)}T15:00:00Z`,
    updated_at: `${shiftDate(date, -2)}T15:00:00Z`,
    next_due_date: null,
    grace_days: null,
  };
  return {
    server_date: date,
    total: 3,
    records: [
      base,
      {
        ...base,
        id: 'demo-charge-paid',
        status: 'paid',
        display_status: 'paid',
        due_date: shiftDate(date, -30),
        payment_method: 'pix',
        note: 'Pagamento fictício, apenas para demonstração.',
        paid_at: `${shiftDate(date, -30)}T15:00:00Z`,
        event_id: 'demo-event',
        next_due_date: dueDate,
        created_at: `${shiftDate(date, -31)}T15:00:00Z`,
      },
      {
        ...base,
        id: 'demo-charge-cancelled',
        status: 'cancelled',
        display_status: 'cancelled',
        due_date: shiftDate(date, -60),
        note: '',
        cancelled_reason: 'Exemplo de cancelamento administrativo.',
        cancelled_at: `${shiftDate(date, -60)}T15:00:00Z`,
        created_at: `${shiftDate(date, -61)}T15:00:00Z`,
      },
    ],
    totals: {
      paid_cents: 18990,
      pending_cents: 18990,
      overdue_cents: dueDate < date ? 18990 : 0,
      review_count: 0,
      paid_count: 1,
      pending_count: 1,
      overdue_count: dueDate < date ? 1 : 0,
    },
  };
}
