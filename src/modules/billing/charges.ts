import type { SupabaseClient } from '@supabase/supabase-js';
import { BillingCommandError } from './subscription';

export type ChargeState = 'pending' | 'overdue' | 'paid' | 'cancelled' | 'refunded';
export type ChargeFilter = ChargeState | 'all' | 'review';
export const chargeLabels: Record<ChargeFilter, string> = {
  all: 'Todas as situações',
  pending: 'Em aberto',
  overdue: 'Vencida',
  paid: 'Paga',
  cancelled: 'Cancelada',
  refunded: 'Estornada',
  review: 'Conferência necessária',
};
export const methodLabels = {
  unknown: 'Não informado',
  pix: 'Pix',
  credit_card: 'Cartão',
  other: 'Outro',
};
export type PaymentMethod = keyof typeof methodLabels;
export interface Charge {
  environment?: 'test' | 'production';
  id: string;
  company_id: string;
  company_name: string;
  created_by: string;
  recorded_by: string;
  amount_cents: number;
  due_date: string;
  status: Exclude<ChargeState, 'overdue'>;
  display_status: ChargeState;
  source: 'manual' | 'mercado_pago';
  kind: 'one_time' | 'subscription';
  payment_method: PaymentMethod;
  provider_payment_id: string | null;
  provider_reference: string | null;
  checkout_url: string | null;
  event_id: string | null;
  needs_review: boolean;
  review_reason: string;
  note: string;
  cancelled_reason: string;
  reviewed_at?: string | null;
  review_note?: string;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  next_due_date: string | null;
  grace_days: number | null;
  received_amount_cents?: number | null;
  provider_status?: string | null;
  last_verified_at?: string | null;
}
export interface ChargeHistory {
  server_date: string;
  total: number;
  records: Charge[];
  totals: {
    paid_cents: number;
    pending_cents: number;
    overdue_cents: number;
    review_count: number;
    paid_count: number;
    pending_count: number;
    overdue_count: number;
  };
}
export interface HistoryFilters {
  status: ChargeFilter;
  from: string;
  to: string;
  query: string;
  offset: number;
}
export const defaultHistoryFilters: HistoryFilters = {
  status: 'all',
  from: '',
  to: '',
  query: '',
  offset: 0,
};
export function validHistoryDates(from: string, to: string) {
  return !from || !to || from <= to;
}
export function chargeCanBeManaged(charge: Charge) {
  return charge.source === 'manual' && charge.status === 'pending';
}
export function billingDateTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(value))
    : '—';
}
export async function loadChargeHistory(
  client: SupabaseClient,
  companyId: string | undefined,
  filters: HistoryFilters,
): Promise<ChargeHistory> {
  if (!validHistoryDates(filters.from, filters.to))
    throw Error('A data inicial deve ser anterior ou igual à data final.');
  const result = await client.rpc('crm_billing_history', {
    p_company: companyId || null,
    p_status: filters.status,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_query: filters.query.trim(),
    p_offset: filters.offset,
  });
  if (result.error || !Array.isArray(result.data?.records) || !result.data?.totals)
    throw Error('Não foi possível consultar as cobranças. Tente atualizar.');
  return result.data as ChargeHistory;
}
export async function createCharge(
  client: SupabaseClient,
  companyId: string,
  requestId: string,
  dueDate: string,
  note: string,
) {
  return chargeCommand(client, 'crm_admin_create_subscription_charge', {
    p_company: companyId,
    p_request_id: requestId,
    p_expected_due: dueDate,
    p_note: note.trim(),
  });
}
export async function manageCharge(
  client: SupabaseClient,
  chargeId: string,
  action: 'confirm' | 'cancel' | 'review',
  note: string,
  method: PaymentMethod,
) {
  return chargeCommand(client, 'crm_admin_manage_subscription_charge', {
    p_charge: chargeId,
    p_action: action,
    p_note: note.trim(),
    p_method: method,
  });
}
async function chargeCommand(
  client: SupabaseClient,
  command: string,
  args: Record<string, unknown>,
) {
  let result;
  try {
    result = await client.rpc(command, args);
  } catch {
    throw new BillingCommandError(
      'O resultado não pôde ser confirmado. Repita a mesma operação para conferir, sem duplicar.',
      true,
    );
  }
  if (result.error) {
    const code = result.error.code;
    if (code === '42501')
      throw new BillingCommandError(
        'Seu acesso financeiro precisa ser verificado novamente.',
        false,
      );
    if (code === '40001')
      throw new BillingCommandError(
        'A cobrança ou o plano mudou. Atualize os dados antes de continuar.',
        false,
      );
    if (code === '23505')
      throw new BillingCommandError(
        'Já existe uma cobrança para este vencimento. Atualize e confira o histórico.',
        false,
      );
    if (code === '22023')
      throw new BillingCommandError(
        'Confira os dados. Cobranças online são confirmadas pelo provedor de pagamento.',
        false,
      );
    if (code === 'P0002')
      throw new BillingCommandError('A cobrança não foi encontrada. Atualize o histórico.', false);
    throw new BillingCommandError(
      'Não foi possível confirmar o resultado. Repita a mesma operação para conferir.',
      true,
    );
  }
  if (!result.data?.id)
    throw new BillingCommandError('Confira o resultado repetindo a mesma operação.', true);
  return result.data;
}
