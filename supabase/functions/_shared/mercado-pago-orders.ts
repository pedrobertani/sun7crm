import type { JsonObject } from './contracts.ts';
import { HttpError } from './errors.ts';
import { keys, text } from './validation.ts';

export interface OrderPaymentInput {
  method: 'pix' | 'credit_card';
  email: string;
  token?: string;
  paymentMethodId?: string;
  identification?: { type: 'CPF' | 'CNPJ'; number: string };
}
export interface VerifiedOrder {
  id: string;
  attemptId: string;
  amount: number;
  status: string;
  paymentId: string | null;
  paymentStatus: string;
  method: 'pix' | 'credit_card' | null;
  paidAt: string | null;
  qrCode?: string;
  qrImage?: string;
  expiresAt?: string;
  authenticationUrl?: string;
}
export type MpApi = (
  path: string,
  method?: string,
  body?: JsonObject,
  idempotency?: string,
) => Promise<JsonObject>;
const orderIdPattern = /^ORD[A-Z0-9]{26}$/;
const paymentIdPattern = /^PAY[A-Z0-9]{26}$/;
const referencePattern =
  /^sun7-order-([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
export const orderReference = (id: string) => `sun7-order-${id}`;
export function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
export function orderPaymentInput(value: unknown): OrderPaymentInput {
  const input = object(value);
  keys(input, ['method', 'email', 'token', 'payment_method_id', 'identification']);
  if (input.method !== 'pix' && input.method !== 'credit_card')
    throw new HttpError(400, 'INVALID_INPUT', 'Escolha Pix ou cartão de crédito.');
  const email = text(input.email, 'e-mail do pagador', 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new HttpError(400, 'INVALID_INPUT', 'Confira o e-mail do pagador.');
  if (input.method === 'pix') {
    keys(input, ['method', 'email']);
    return { method: 'pix', email };
  }
  const token = text(input.token, 'token do cartão', 200);
  const paymentMethodId = text(input.payment_method_id, 'bandeira do cartão', 40);
  const identification = object(input.identification);
  keys(identification, ['type', 'number']);
  if (
    !/^[a-zA-Z0-9_-]+$/.test(token) ||
    !/^[a-z0-9_]+$/.test(paymentMethodId) ||
    !['CPF', 'CNPJ'].includes(String(identification.type)) ||
    typeof identification.number !== 'string' ||
    !(identification.type === 'CPF' ? /^\d{11}$/ : /^\d{14}$/).test(identification.number)
  )
    throw new HttpError(
      400,
      'INVALID_INPUT',
      'Confira os dados do pagamento no formulário seguro.',
    );
  return {
    method: 'credit_card',
    email,
    token,
    paymentMethodId,
    identification: { type: identification.type as 'CPF' | 'CNPJ', number: identification.number },
  };
}
function cents(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new HttpError(502, 'PROVIDER_RESPONSE', 'O valor do pagamento precisa ser conferido.');
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result))
    throw new HttpError(502, 'PROVIDER_RESPONSE', 'Valor inválido.');
  return result;
}
function providerResponse(): never {
  throw new HttpError(502, 'PAYMENT_MISMATCH', 'A confirmação do pagamento precisa ser conferida.');
}
function authenticationUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !['www.mercadopago.com', 'www.mercadopago.com.br'].includes(url.hostname) ||
    !url.pathname.startsWith('/auth/card/validation/') ||
    url.username ||
    url.password ||
    url.port
  )
    return providerResponse();
  return url.href;
}
export function createOrderGateway(
  config: { collectorId: string; applicationId: string; environment: 'test' | 'production' },
  api: MpApi,
) {
  function verified(data: JsonObject, expectedId?: string): VerifiedOrder {
    const id = String(data.id),
      reference = typeof data.external_reference === 'string' ? data.external_reference : '';
    const match = referencePattern.exec(reference);
    if (
      !orderIdPattern.test(id) ||
      (expectedId && id !== expectedId) ||
      !match ||
      String(data.user_id) !== config.collectorId ||
      String(object(data.integration_data).application_id) !== config.applicationId ||
      data.type !== 'online' ||
      data.country_code !== 'BRA' ||
      (data.currency !== undefined && data.currency !== 'BRL') ||
      (data.currency_id !== undefined && data.currency_id !== 'BRL') ||
      (data.live_mode !== undefined && data.live_mode !== (config.environment === 'production'))
    )
      return providerResponse();
    const transactions = object(data.transactions);
    const payments = transactions.payments === undefined ? [] : transactions.payments;
    if (!Array.isArray(payments) || payments.length > 1) return providerResponse();
    const payment = object(payments[0]);
    const method = object(payment.payment_method);
    const amount = cents(data.total_amount);
    if (payment.amount !== undefined && cents(payment.amount) !== amount) return providerResponse();
    const status = String(data.status);
    if (
      ![
        'created',
        'processing',
        'action_required',
        'processed',
        'failed',
        'canceled',
        'cancelled',
        'expired',
        'refunded',
        'charged_back',
      ].includes(status)
    )
      return providerResponse();
    const paymentId = payment.id === undefined ? null : String(payment.id);
    if (paymentId && !paymentIdPattern.test(paymentId)) return providerResponse();
    const chargedBack =
      Array.isArray(transactions.chargebacks) && transactions.chargebacks.length > 0;
    const refunded =
      status === 'refunded' ||
      payment.status === 'refunded' ||
      data.status_detail === 'partially_refunded' ||
      payment.status_detail === 'partially_refunded' ||
      (Array.isArray(transactions.refunds) && transactions.refunds.length > 0);
    const approved =
      status === 'processed' &&
      payment.status === 'processed' &&
      data.status_detail === 'accredited' &&
      payment.status_detail === 'accredited';
    if (approved && (!paymentId || cents(data.total_paid_amount) !== amount))
      return providerResponse();
    const mapped =
      chargedBack || status === 'charged_back'
        ? 'charged_back'
        : refunded
          ? 'refunded'
          : approved
            ? 'approved'
            : status === 'failed'
              ? 'rejected'
              : ['canceled', 'cancelled', 'expired'].includes(status)
                ? 'cancelled'
                : 'pending';
    const paidAt =
      approved &&
      typeof data.last_updated_date === 'string' &&
      Number.isFinite(Date.parse(data.last_updated_date))
        ? data.last_updated_date
        : null;
    if (approved && !paidAt) return providerResponse();
    const paymentMethod =
      method.id === 'pix' ? 'pix' : method.type === 'credit_card' ? 'credit_card' : null;
    if (paymentId && !paymentMethod) return providerResponse();
    const qrCode =
      typeof method.qr_code === 'string' && method.qr_code.length <= 4096
        ? method.qr_code
        : undefined;
    const qrImage =
      typeof method.qr_code_base64 === 'string' &&
      method.qr_code_base64.length <= 1_000_000 &&
      /^iVBORw0KGgo[A-Za-z0-9+/=\r\n]+$/.test(method.qr_code_base64)
        ? method.qr_code_base64
        : undefined;
    return {
      id,
      attemptId: match[1].toLowerCase(),
      amount,
      status: chargedBack ? 'charged_back' : refunded ? 'refunded' : status,
      paymentId,
      paymentStatus: mapped,
      method: paymentMethod,
      paidAt,
      ...(qrCode ? { qrCode } : {}),
      ...(qrImage ? { qrImage } : {}),
      ...(typeof payment.date_of_expiration === 'string'
        ? { expiresAt: payment.date_of_expiration }
        : {}),
      ...(object(method.transaction_security).url
        ? { authenticationUrl: authenticationUrl(object(method.transaction_security).url) }
        : {}),
    };
  }
  async function order(id: string): Promise<VerifiedOrder> {
    if (!orderIdPattern.test(id)) throw new HttpError(400, 'INVALID_INPUT', 'Pagamento inválido.');
    return verified(await api(`/v1/orders/${id}`), id);
  }
  return {
    order,
    async findOrder(attemptId: string, createdAt: string): Promise<VerifiedOrder | null> {
      const begin = new Date(Date.parse(createdAt) - 60_000).toISOString();
      const query = new URLSearchParams({
        external_reference: orderReference(attemptId),
        begin_date: begin,
        end_date: new Date().toISOString(),
        type: 'online',
        page_size: '2',
      });
      const data = await api(`/v1/orders?${query}`);
      if (!Array.isArray(data.data)) return providerResponse();
      const matches = data.data
        .map(object)
        .filter((row) => row.external_reference === orderReference(attemptId));
      if (matches.length > 1)
        throw new HttpError(
          409,
          'CHECKOUT_REVIEW',
          'O pagamento precisa ser conferido pela administração.',
        );
      return matches.length ? order(String(matches[0].id)) : null;
    },
    async createOrder(
      attemptId: string,
      amount: number,
      payment: OrderPaymentInput,
    ): Promise<VerifiedOrder> {
      const price = (amount / 100).toFixed(2);
      const result = await api(
        '/v1/orders',
        'POST',
        {
          type: 'online',
          processing_mode: 'automatic',
          total_amount: price,
          external_reference: orderReference(attemptId),
          description: 'SUN7CRM Mensal',
          payer: {
            email: payment.email,
            ...(payment.identification ? { identification: payment.identification } : {}),
          },
          transactions: {
            payments: [
              {
                amount: price,
                payment_method:
                  payment.method === 'pix'
                    ? { id: 'pix', type: 'bank_transfer' }
                    : {
                        id: payment.paymentMethodId,
                        type: 'credit_card',
                        token: payment.token,
                        installments: 1,
                      },
                ...(payment.method === 'pix' ? { expiration_time: 'PT30M' } : {}),
              },
            ],
          },
        },
        attemptId,
      );
      if (!orderIdPattern.test(String(result.id))) return providerResponse();
      // GET confirma recebedor/aplicação e evita confiar no resumo da criação.
      const confirmed = await order(String(result.id));
      if (
        confirmed.attemptId !== attemptId ||
        confirmed.amount !== amount ||
        (confirmed.method && confirmed.method !== payment.method)
      )
        return providerResponse();
      return confirmed;
    },
  };
}
