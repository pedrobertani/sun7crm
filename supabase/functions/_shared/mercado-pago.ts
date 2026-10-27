import { HttpError } from './errors.ts';
import type { JsonObject } from './contracts.ts';

export interface MercadoPagoConfig {
  accessToken: string;
  webhookSecret: string;
  collectorId: string;
  environment: 'test' | 'production';
  returnUrl: string;
  webhookUrl: string;
  enabled: boolean;
}
export interface CheckoutInput {
  id: string;
  mode: 'one_time' | 'subscription';
  amount: number;
  email: string;
  dueDate: string;
  serverDate: string;
}
export interface ProviderCheckout {
  id: string;
  url: string;
}
export interface VerifiedPayment {
  id: string;
  reference: string;
  amount: number;
  status: string;
  method: string;
  paidAt: string | null;
}
export interface MercadoPago {
  configured: boolean;
  environment: 'test' | 'production';
  webhookUrl: string;
  findCheckout(input: CheckoutInput): Promise<ProviderCheckout | null>;
  createCheckout(input: CheckoutInput): Promise<ProviderCheckout>;
  payment(id: string): Promise<VerifiedPayment>;
  agreement(id: string): Promise<{ id: string; reference: string; status: string }>;
  invoice(id: string): Promise<{ paymentId: string; agreementId: string; cycle: string | null }>;
  cancelAgreement(id: string): Promise<void>;
  verify(request: Request, dataId: string): Promise<boolean>;
}
export function billingReference(mode: 'one_time' | 'subscription', id: string) {
  return `sun7:${mode === 'one_time' ? 'charge' : 'subscription'}:${id}`;
}
export function parseBillingReference(value: string) {
  const match =
    /^sun7:(charge|subscription):([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
      value,
    );
  return match ? { id: match[2].toLowerCase(), subscription: match[1] === 'subscription' } : null;
}
export function safeCheckoutUrl(value: unknown): string {
  if (typeof value !== 'string')
    throw new HttpError(502, 'PROVIDER_RESPONSE', 'O endereço de pagamento precisa ser conferido.');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !['www.mercadopago.com.br', 'mercadopago.com.br'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new HttpError(502, 'PROVIDER_RESPONSE', 'O endereço de pagamento precisa ser conferido.');
  return url.href;
}
function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}
function resourceId(value: unknown): string {
  const result = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(result))
    throw new HttpError(502, 'PROVIDER_RESPONSE', 'O retorno do pagamento precisa ser conferido.');
  return result;
}
export function createMercadoPago(
  config: MercadoPagoConfig,
  transport: typeof fetch = fetch,
): MercadoPago {
  const configured =
    config.enabled &&
    !!config.accessToken &&
    !!config.webhookSecret &&
    /^\d+$/.test(config.collectorId) &&
    /^https:\/\//.test(config.returnUrl) &&
    /^https:\/\//.test(config.webhookUrl);
  async function api(
    path: string,
    method = 'GET',
    body?: JsonObject,
    idempotency?: string,
  ): Promise<JsonObject> {
    if (!configured)
      throw new HttpError(
        503,
        'PAYMENTS_NOT_CONFIGURED',
        'O pagamento online ainda não foi ativado.',
      );
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    };
    if (idempotency) headers['X-Idempotency-Key'] = idempotency;
    let response: Response;
    try {
      response = await transport(`https://api.mercadopago.com${path}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new HttpError(
        503,
        'PROVIDER_UNCONFIRMED',
        'O Mercado Pago não confirmou o resultado. Tente recuperar esta mesma solicitação.',
      );
    }
    if (!response.ok)
      throw new HttpError(
        502,
        'PROVIDER_UNAVAILABLE',
        'Não foi possível confirmar a operação no Mercado Pago.',
      );
    try {
      return object(await response.json());
    } catch {
      throw new HttpError(
        502,
        'PROVIDER_RESPONSE',
        'O retorno do Mercado Pago precisa ser conferido.',
      );
    }
  }
  const checkout = (row: JsonObject): ProviderCheckout => ({
    id: resourceId(row.id),
    url: safeCheckoutUrl(row.init_point),
  });
  return {
    configured,
    environment: config.environment,
    webhookUrl: config.webhookUrl,
    async findCheckout(input) {
      const reference = billingReference(input.mode, input.id);
      const result = await api(
        `${input.mode === 'subscription' ? '/preapproval/search' : '/checkout/preferences/search'}?external_reference=${encodeURIComponent(reference)}`,
      );
      const candidates = result.results || result.elements || [];
      const rows = Array.isArray(candidates)
        ? candidates
            .map(object)
            .filter((row) => row.external_reference === reference && row.status !== 'cancelled')
        : [];
      if (rows.length > 1)
        throw new HttpError(
          409,
          'CHECKOUT_REVIEW',
          'Há mais de um cadastro no Mercado Pago para esta solicitação. A administração precisa conferir.',
        );
      return rows.length ? checkout(rows[0]) : null;
    },
    async createCheckout(input) {
      const reference = billingReference(input.mode, input.id);
      const body: JsonObject =
        input.mode === 'subscription'
          ? {
              reason: 'SUN7CRM Mensal',
              external_reference: reference,
              payer_email: input.email,
              auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: input.amount / 100,
                currency_id: 'BRL',
                ...(input.dueDate > input.serverDate
                  ? { start_date: `${input.dueDate}T15:00:00.000Z` }
                  : {}),
              },
              back_url: config.returnUrl,
              status: 'pending',
            }
          : {
              items: [
                {
                  id: input.id,
                  title: 'SUN7CRM Mensal',
                  currency_id: 'BRL',
                  quantity: 1,
                  unit_price: input.amount / 100,
                },
              ],
              payer: { email: input.email },
              external_reference: reference,
              notification_url: config.webhookUrl,
              auto_return: 'approved',
              back_urls: {
                success: config.returnUrl,
                pending: config.returnUrl,
                failure: config.returnUrl,
              },
              payment_methods: {
                installments: 1,
                excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
              },
            };
      return checkout(
        await api(
          input.mode === 'subscription' ? '/preapproval' : '/checkout/preferences',
          'POST',
          body,
          input.id,
        ),
      );
    },
    async payment(id) {
      if (!/^\d{1,30}$/.test(id))
        throw new HttpError(400, 'INVALID_PAYMENT', 'Pagamento inválido.');
      const data = await api(`/v1/payments/${id}`);
      if (
        String(data.id) !== id ||
        String(data.collector_id) !== config.collectorId ||
        data.currency_id !== 'BRL' ||
        data.live_mode !== (config.environment === 'production')
      )
        throw new HttpError(
          403,
          'PAYMENT_MISMATCH',
          'A confirmação não corresponde à conta ou ao ambiente configurado.',
        );
      const amount = Number(data.transaction_amount),
        cents = Math.round(amount * 100);
      if (
        !Number.isFinite(amount) ||
        !Number.isSafeInteger(cents) ||
        cents < 0 ||
        Math.abs(amount * 100 - cents) > 0.0001
      )
        throw new HttpError(502, 'INVALID_AMOUNT', 'O valor retornado precisa ser conferido.');
      return {
        id,
        reference: typeof data.external_reference === 'string' ? data.external_reference : '',
        amount: cents,
        status: Number(data.transaction_amount_refunded) > 0 ? 'refunded' : String(data.status),
        method:
          data.payment_method_id === 'pix'
            ? 'pix'
            : data.payment_type_id === 'credit_card'
              ? 'credit_card'
              : 'other',
        paidAt: typeof data.date_approved === 'string' ? data.date_approved : null,
      };
    },
    async agreement(id) {
      const data = await api(`/preapproval/${resourceId(id)}`);
      if (String(data.id) !== id || typeof data.external_reference !== 'string')
        throw new HttpError(502, 'PROVIDER_RESPONSE', 'A assinatura precisa ser conferida.');
      return { id, reference: data.external_reference, status: String(data.status) };
    },
    async invoice(id) {
      const data = await api(`/authorized_payments/${resourceId(id)}`);
      return {
        paymentId: resourceId(object(data.payment).id),
        agreementId: resourceId(data.preapproval_id),
        cycle: typeof data.debit_date === 'string' ? data.debit_date.slice(0, 10) : null,
      };
    },
    async cancelAgreement(id) {
      await api(`/preapproval/${resourceId(id)}`, 'PUT', { status: 'cancelled' });
    },
    async verify(request, dataId) {
      if (!configured) return false;
      const parts = (request.headers.get('x-signature') || '')
        .split(',')
        .map((part) => part.trim().split('='));
      const ts = parts.find(([key]) => key === 'ts')?.[1],
        signature = parts.find(([key]) => key === 'v1')?.[1];
      const requestId = request.headers.get('x-request-id');
      if (
        !ts ||
        !/^\d{10,16}$/.test(ts) ||
        !signature ||
        !/^[a-f0-9]{64}$/i.test(signature) ||
        !requestId ||
        requestId.length > 160 ||
        !/^[a-zA-Z0-9_-]{1,160}$/.test(dataId)
      )
        return false;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(config.webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
      );
      const bytes = Uint8Array.from(signature.match(/../g)!, (value) => Number.parseInt(value, 16));
      return crypto.subtle.verify(
        'HMAC',
        key,
        bytes,
        new TextEncoder().encode(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`),
      );
    },
  };
}
