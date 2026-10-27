import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { createMercadoPago } from '../functions/_shared/mercado-pago.ts';
import { orderPaymentInput, orderReference } from '../functions/_shared/mercado-pago-orders.ts';
import { billingCheckout } from '../functions/crm-billing-checkout/handler.ts';
import { billingWebhook } from '../functions/crm-billing-webhook/handler.ts';
const id = '00000000-0000-4000-8000-000000000001';
const orderId = 'ORD' + '0'.repeat(26),
  paymentId = 'PAY' + '1'.repeat(26);
const config = {
  enabled: true,
  accessToken: 'fixture-token',
  webhookSecret: 'fixture-secret',
  collectorId: '123',
  applicationId: '456',
  publicKey: 'APP_USR-00000000-0000-4000-8000-000000000001',
  environment: 'test',
  returnUrl: 'https://fixture.invalid/app/plano',
  webhookUrl: 'https://fixture.invalid/webhook',
};
const paidOrder = {
  id: orderId,
  user_id: '123',
  integration_data: { application_id: '456' },
  type: 'online',
  country_code: 'BRA',
  live_mode: false,
  currency: 'BRL',
  external_reference: orderReference(id),
  total_amount: '189.90',
  total_paid_amount: '189.90',
  status: 'processed',
  status_detail: 'accredited',
  last_updated_date: '2026-10-27T12:00:00Z',
  transactions: {
    payments: [
      {
        id: paymentId,
        amount: '189.90',
        status: 'processed',
        status_detail: 'accredited',
        payment_method: {
          id: 'pix',
          type: 'bank_transfer',
          token: 'must-not-be-returned',
          qr_code: '000201fixture',
        },
      },
    ],
  },
};
const actor = (rpc = async () => null) => ({
  authenticate: async () => id,
  report: async () => {},
  rpc,
});
const context = (body) => ({ actorId: id, requestId: id, body: { company_id: id, ...body } });
test('Orders: preço é do servidor, referência aceita pela API e chave idempotente é estável', async () => {
  const calls = [],
    provider = createMercadoPago(config, async (url, init) => {
      calls.push([url, init]);
      return Response.json(paidOrder);
    });
  const result = await provider.createOrder(id, 18990, {
    method: 'pix',
    email: 'buyer@example.invalid',
  });
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.total_amount, '189.90');
  assert.equal(body.transactions.payments[0].amount, '189.90');
  assert.equal(body.transactions.payments[0].payment_method.id, 'pix');
  assert.equal(body.external_reference, `sun7-order-${id}`);
  assert.equal(body.external_reference.includes(':'), false);
  assert.equal(calls[0][1].headers['X-Idempotency-Key'], id);
  assert.match(String(calls[1][0]), new RegExp('/v1/orders/' + orderId));
  assert.equal(result.paymentStatus, 'approved');
  assert.equal(JSON.stringify(result).includes('must-not-be-returned'), false);
  assert.equal(JSON.stringify(result).includes(config.accessToken), false);
});
test('Orders: resposta aprovada exige recebedor, aplicação, moeda, valor e ambiente corretos', async () => {
  for (const change of [
    { user_id: '999' },
    { integration_data: { application_id: '999' } },
    { live_mode: true },
    { currency: 'USD' },
    { country_code: 'ARG' },
    { total_paid_amount: '1.00' },
    { total_amount: '1.00' },
    { last_updated_date: 'invalid' },
    { id: 'ORD-invalid' },
  ]) {
    const provider = createMercadoPago(config, async () =>
      Response.json({ ...paidOrder, ...change }),
    );
    await assert.rejects(provider.order(orderId), (e) => e.code === 'PAYMENT_MISMATCH');
  }
});
test('Orders: autorização sem crédito e processamento assíncrono não aprovam o recebimento', async () => {
  const provider = createMercadoPago(config, async () =>
    Response.json({
      ...paidOrder,
      status: 'processing',
      status_detail: 'pending',
      total_paid_amount: '0.00',
      transactions: {},
    }),
  );
  const order = await provider.order(orderId);
  assert.equal(order.paymentStatus, 'pending');
  assert.equal(order.paymentId, null);
  assert.equal(order.paidAt, null);
  const onlyAuthorized = createMercadoPago(config, async () =>
    Response.json({
      ...paidOrder,
      status: 'action_required',
      status_detail: 'waiting_payment',
      total_paid_amount: '0.00',
    }),
  );
  assert.equal((await onlyAuthorized.order(orderId)).paymentStatus, 'pending');
});
test('Orders: estorno e contestação prevalecem sobre status anterior de aprovação', async () => {
  for (const [transactions, expected] of [
    [{ ...paidOrder.transactions, refunds: [{ id: 'refund' }] }, 'refunded'],
    [{ ...paidOrder.transactions, chargebacks: [{ id: 'chargeback' }] }, 'charged_back'],
  ]) {
    const provider = createMercadoPago(config, async () =>
      Response.json({ ...paidOrder, transactions }),
    );
    assert.equal((await provider.order(orderId)).paymentStatus, expected);
  }
});
test('Orders: entrada recusa preço, PAN, CVV, parcelas, campos extras e meios não suportados', () => {
  for (const extra of [
    { amount: 1 },
    { card_number: '123' },
    { cvv: '123' },
    { installments: 2 },
    { token: 'secret' },
  ])
    assert.throws(
      () => orderPaymentInput({ method: 'pix', email: 'buyer@example.invalid', ...extra }),
      (e) => e.code === 'INVALID_INPUT',
    );
  assert.throws(() => orderPaymentInput({ method: 'debit_card', email: 'buyer@example.invalid' }));
});
test('Orders: cartão envia somente token e documento, com uma parcela determinada no servidor', async () => {
  let sent;
  const provider = createMercadoPago(config, async (_, init) => {
    if (init.body) sent = JSON.parse(init.body);
    return Response.json({
      ...paidOrder,
      transactions: {
        payments: [
          {
            ...paidOrder.transactions.payments[0],
            payment_method: { id: 'master', type: 'credit_card' },
          },
        ],
      },
    });
  });
  await provider.createOrder(
    id,
    18990,
    orderPaymentInput({
      method: 'credit_card',
      email: 'buyer@example.invalid',
      token: 'fixture-token',
      payment_method_id: 'master',
      identification: { type: 'CPF', number: '12345678909' },
    }),
  );
  assert.equal(sent.transactions.payments[0].payment_method.installments, 1);
  assert.equal(sent.transactions.payments[0].payment_method.token, 'fixture-token');
  assert.equal('card_number' in sent, false);
});
test('Orders: mesma tentativa e outra solicitação enquanto pendente recuperam sem criar nova order', async () => {
  let creates = 0;
  const provider = {
    transparentConfigured: true,
    configured: true,
    environment: 'test',
    createOrder: async () => {
      creates++;
      throw Error('Não deve criar');
    },
    order: async () => ({
      id: orderId,
      attemptId: id,
      amount: 18990,
      method: 'pix',
      status: 'processed',
      paymentStatus: 'approved',
      paymentId,
      paidAt: '2026-10-27T12:00:00Z',
    }),
  };
  const db = actor(async (name) =>
    name === 'crm_edge_billing_context'
      ? { is_admin: false }
      : name === 'crm_edge_prepare_order'
        ? { created: false, amount_cents: 18990, attempt: { id, provider_order_id: orderId } }
        : {},
  );
  const result = await billingCheckout(provider)({
    ...context({
      action: 'create_order',
      payment: { method: 'pix', email: 'buyer@example.invalid' },
    }),
    backend: db,
  });
  assert.equal(result.data.order.status, 'approved');
  assert.equal(creates, 0);
});
test('Orders: somente rejeição definitiva libera a tentativa; timeout continua reservado', async () => {
  for (const [httpStatus, rejects] of [
    [422, true],
    [500, false],
  ]) {
    const provider = createMercadoPago(
      config,
      async () => new Response('{}', { status: httpStatus }),
    );
    const calls = [];
    const db = actor(async (name) => {
      calls.push(name);
      return name === 'crm_edge_billing_context'
        ? { is_admin: false }
        : name === 'crm_edge_prepare_order'
          ? { created: true, amount_cents: 18990, attempt: { id } }
          : {};
    });
    await assert.rejects(
      billingCheckout(provider)({
        ...context({
          action: 'create_order',
          payment: { method: 'pix', email: 'buyer@example.invalid' },
        }),
        backend: db,
      }),
    );
    assert.equal(calls.includes('crm_edge_reject_order_input'), rejects);
  }
});
test('Orders: webhook verifica HMAC e consulta API, ignorando aprovação e valor enviados no corpo', async () => {
  const ts = '1793110000',
    requestId = 'fixture-request';
  const signature = createHmac('sha256', config.webhookSecret)
    .update(`id:${orderId.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  const calls = [],
    provider = createMercadoPago(config, async () => Response.json(paidOrder));
  const handler = billingWebhook(
    actor(async (name, args) => {
      calls.push([name, args]);
      return {};
    }),
    provider,
  );
  const request = (sig) =>
    new Request(`https://fixture.invalid?data.id=${orderId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        'x-signature': `ts=${ts},v1=${sig}`,
      },
      body: JSON.stringify({
        type: 'order',
        data: { id: orderId, status: 'pending', total_amount: '1.00' },
      }),
    });
  assert.equal((await handler(request('bad'))).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await handler(request(signature))).status, 200);
  assert.equal(calls[0][0], 'crm_edge_record_order');
  assert.equal(calls[0][1].p_amount_cents, 18990);
  assert.equal(calls[0][1].p_status, 'approved');
  assert.equal(calls[0][1].p_environment, 'test');
});
test('Orders: produção permanece desativada sem liberação específica', () => {
  assert.equal(createMercadoPago({ ...config, environment: 'production' }).configured, false);
  assert.equal(createMercadoPago(config).transparentConfigured, true);
});

test('Orders: cancelamento e estorno parcial não permanecem pendentes nem aprovam novamente', async () => {
  for (const [change, expected] of [
    [{ status: 'canceled', status_detail: 'expired' }, 'cancelled'],
    [{ status_detail: 'partially_refunded' }, 'refunded'],
  ]) {
    const provider = createMercadoPago(config, async () =>
      Response.json({ ...paidOrder, ...change }),
    );
    assert.equal((await provider.order(orderId)).paymentStatus, expected);
  }
});
test('Orders: falhas do emissor e de saldo não são tratadas como recebimento', async () => {
  for (const detail of ['rejected_by_issuer', 'insufficient_amount', 'failed']) {
    const provider = createMercadoPago(config, async () =>
      Response.json({
        ...paidOrder,
        status: 'failed',
        status_detail: 'failed',
        transactions: {
          payments: [
            { ...paidOrder.transactions.payments[0], status: 'failed', status_detail: detail },
          ],
        },
      }),
    );
    const order = await provider.order(orderId);
    assert.equal(order.paymentStatus, 'rejected');
    assert.equal(order.paidAt, null);
  }
});
