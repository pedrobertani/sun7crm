import type { SupabaseClient } from '@supabase/supabase-js';
import { shiftDate } from '../../lib/format';
import { requireReadyAdmin } from '../auth/access';

export const MONTHLY_PRICE_CENTS = 18990;
export type CycleKind = 'monthly' | 'complimentary' | 'awaiting_payment';
export type SubscriptionState =
  'active' | 'complimentary' | 'grace' | 'blocked' | 'awaiting_payment';
export const stateLabels: Record<SubscriptionState, string> = {
  active: 'Em dia',
  complimentary: 'Período gratuito',
  grace: 'Em carência',
  blocked: 'Acesso bloqueado',
  awaiting_payment: 'Aguardando liberação',
};
export interface SubscriptionEvent {
  id: string;
  kind: 'payment' | 'complimentary';
  amount_cents: number;
  free_days: number;
  grace_days: number;
  previous_due_date: string;
  next_due_date: string;
  note: string;
  created_at: string;
}
export interface Subscription {
  company_id: string;
  plan_name: string;
  monthly_amount_cents: number;
  due_date: string;
  cycle_kind: CycleKind;
  status: SubscriptionState;
  server_date: string;
  access_allowed: boolean;
  grace_days_used: number;
  grace_ends_on: string | null;
  events: SubscriptionEvent[];
}
// Somente apresentação da demo/carteira. O acesso real é decidido pelo banco.
export function subscriptionState(due: string, kind: CycleKind, date: string): SubscriptionState {
  if (kind === 'awaiting_payment') return 'awaiting_payment';
  if (kind === 'complimentary') return date < due ? 'complimentary' : 'blocked';
  if (date <= due) return 'active';
  return date <= shiftDate(due, 7) ? 'grace' : 'blocked';
}
export function addMonth(date: string) {
  const value = new Date(date + 'T12:00:00Z');
  const day = value.getUTCDate();
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + 1);
  const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
  value.setUTCDate(Math.min(day, last));
  return value.toISOString().slice(0, 10);
}
export function paymentPreview(plan: Subscription) {
  return shiftDate(
    addMonth(plan.due_date > plan.server_date ? plan.due_date : plan.server_date),
    -plan.grace_days_used,
  );
}
export async function loadSubscription(
  client: SupabaseClient,
  companyId: string,
): Promise<Subscription> {
  const result = await client.rpc('crm_subscription_summary', { p_company: companyId });
  if (result.error || !result.data || !stateLabels[result.data.status as SubscriptionState])
    throw Error('Não foi possível consultar o plano. Tente atualizar.');
  return result.data as Subscription;
}
export interface BillingAttempt {
  id: string;
  companyId: string;
  dueDate: string;
  amount: number;
  kind: 'payment' | 'complimentary';
  days: number;
  note: string;
}
export class BillingCommandError extends Error {
  constructor(
    message: string,
    public retrySame: boolean,
  ) {
    super(message);
  }
}
export async function applyBillingCommand(
  client: SupabaseClient,
  userId: string,
  attempt: BillingAttempt,
) {
  await requireReadyAdmin(client, userId);
  const args = {
    p_company: attempt.companyId,
    p_request_id: attempt.id,
    p_expected_due: attempt.dueDate,
    p_note: attempt.note,
  };
  let result;
  try {
    result = await client.rpc(
      attempt.kind === 'payment'
        ? 'crm_admin_record_subscription_payment'
        : 'crm_admin_grant_subscription_days',
      attempt.kind === 'payment'
        ? { ...args, p_amount_cents: attempt.amount }
        : { ...args, p_days: attempt.days },
    );
  } catch {
    throw new BillingCommandError(
      'Não foi possível confirmar o resultado. Repita a mesma solicitação para conferir, sem duplicar o lançamento.',
      true,
    );
  }
  if (result.error) {
    const code = result.error.code;
    if (code === '40001')
      throw new BillingCommandError(
        'O plano mudou enquanto esta janela estava aberta. Atualize o plano antes de tentar novamente.',
        false,
      );
    if (code === '23505')
      throw new BillingCommandError(
        'Esta solicitação já foi utilizada. Atualize o plano e confira o histórico.',
        false,
      );
    if (code === '42501')
      throw new BillingCommandError(
        'Seu acesso administrativo precisa ser verificado novamente.',
        false,
      );
    if (code === '22023')
      throw new BillingCommandError(
        'Confira o valor e os dias selecionados. Atualize o plano se o valor mudou.',
        false,
      );
    if (code === 'P0002')
      throw new BillingCommandError('A cobrança desta empresa não foi encontrada.', false);
    throw new BillingCommandError(
      'Não foi possível confirmar o resultado. Repita a mesma solicitação para conferir o histórico.',
      true,
    );
  }
  if (!result.data?.id)
    throw new BillingCommandError(
      'O resultado precisa ser confirmado. Repita a mesma solicitação.',
      true,
    );
  return result.data as SubscriptionEvent;
}
