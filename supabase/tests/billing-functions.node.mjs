import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { createMercadoPago, billingReference } from '../functions/_shared/mercado-pago.ts';
import { billingCheckout } from '../functions/crm-billing-checkout/handler.ts';
import { billingWebhook } from '../functions/crm-billing-webhook/handler.ts';
import { createHttpHandler } from '../functions/_shared/http.ts';
import { HttpError } from '../functions/_shared/errors.ts';
import { safeException } from '../functions/_shared/telemetry.ts';
const id = '00000000-0000-4000-8000-000000000001';
const config = {
  enabled: true,
  accessToken: 'fixture-token',
  webhookSecret: 'fixture-secret',
  collectorId: '123',
  environment: 'test',
  returnUrl: 'https://app.example.invalid/app/plano',
  webhookUrl: 'https://edge.example.invalid/webhook',
};
const payment = {
  id: 555,
  collector_id: 123,
  currency_id: 'BRL',
  live_mode: false,
  external_reference: billingReference('one_time', id),
  transaction_amount: 189.9,
  status: 'approved',
  payment_method_id: 'pix',
  date_approved: '2026-10-27T12:00:00-03:00',
};
function backend(overrides = {}) {
  return {
    authenticate: async () => id,
    rpc: async () => null,
    report: async () => {},
    ...overrides,
  };
}
function signed(type = 'payment', dataId = '555', changes = {}) {
  const ts = '1793110000',
    requestId = 'fixture-request',
    digest = createHmac('sha256', config.webhookSecret)
      .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)
      .digest('hex');
  return new Request(`https://edge.example.invalid/webhook?data.id=${dataId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-signature': `ts=${ts},v1=${digest}`,
      ...(changes.headers || {}),
    },
    body: JSON.stringify({ type, data: { id: dataId }, ...changes.body }),
  });
}
test('Mercado Pago: configuração desativada não cria cobranças nem expõe segredos', async () => {
  let called = false;
  const provider = createMercadoPago({ ...config, enabled: false }, async () => {
    called = true;
    throw Error();
  });
  const handler = billingCheckout(provider),
    result = await handler({
      actorId: id,
      requestId: id,
      body: { company_id: id, action: 'status' },
      backend: backend({ rpc: async () => ({ is_admin: true }) }),
    });
  assert.equal(result.data.configured, false);
  assert.equal(JSON.stringify(result).includes(config.accessToken), false);
  assert.equal((await billingWebhook(backend(), provider)(signed())).status, 503);
  assert.equal(called, false);
});
test('checkout usa preço do banco e URLs controladas; recupera sem criar duas assinaturas', async () => {
  const calls = [],
    provider = {
      configured: true,
      environment: 'test',
      findCheckout: async () => null,
      createCheckout: async (input) => {
        calls.push(input);
        return { id: 'pref', url: 'https://www.mercadopago.com.br/checkout/fixture' };
      },
    };
  let claimed = true;
  const db = backend({
    rpc: async (name) =>
      name === 'crm_edge_billing_context'
        ? { is_admin: false }
        : name === 'crm_edge_begin_checkout'
          ? {
              checkout: { id, amount_cents: 18990 },
              email: 'fixture@example.invalid',
              due_date: '2026-11-01',
              server_date: '2026-10-27',
            }
          : name === 'crm_edge_claim_checkout'
            ? claimed
            : null,
  });
  const context = {
    actorId: id,
    requestId: id,
    body: {
      company_id: id,
      action: 'checkout',
      mode: 'subscription',
      payer_email: 'buyer@testuser.com',
    },
    backend: db,
  };
  assert.ok((await billingCheckout(provider)(context)).data.url);
  assert.equal(calls[0].amount, 18990);
  assert.equal(calls[0].email, 'buyer@testuser.com');
  claimed = false;
  await assert.rejects(
    billingCheckout(provider)(context),
    (e) => e.code === 'CHECKOUT_UNCONFIRMED',
  );
  assert.equal(calls.length, 1);
  await assert.rejects(
    billingCheckout(provider)({ ...context, body: { ...context.body, amount: 1 } }),
    (e) => e.code === 'INVALID_INPUT',
  );
});
test('checkout exige sessão; administrador não contrata em nome da empresa', async () => {
  const provider = { configured: true },
    command = billingCheckout(provider);
  await assert.rejects(
    command({
      actorId: id,
      requestId: id,
      body: { company_id: id, action: 'checkout', mode: 'one_time' },
      backend: backend({ rpc: async () => ({ is_admin: true }) }),
    }),
    (e) => e.code === 'FORBIDDEN',
  );
  const response = await createHttpHandler(
    backend(),
    command,
  )(
    new Request('https://edge.example.invalid', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
  );
  assert.equal(response.status, 401);
});
test('assinatura usa recorrência mensal e o checkout avulso antigo foi removido', async () => {
  const bodies = [],
    provider = createMercadoPago(config, async (_, init) => {
      bodies.push(JSON.parse(init.body));
      return Response.json({
        id: 'resource',
        init_point: 'https://www.mercadopago.com.br/checkout/fixture',
      });
    });
  const input = {
    id,
    mode: 'subscription',
    amount: 18990,
    email: 'fixture@example.invalid',
    dueDate: '2026-11-01',
    serverDate: '2026-10-27',
  };
  await provider.createCheckout(input);
  assert.equal(bodies[0].auto_recurring.frequency_type, 'months');
  assert.equal(bodies[0].auto_recurring.transaction_amount, 189.9);
  assert.equal(bodies[0].auto_recurring.start_date, '2026-11-01T15:00:00.000Z');
  assert.equal(bodies[0].status, 'pending');
  await assert.rejects(
    provider.createCheckout({ ...input, mode: 'one_time' }),
    (e) => e.code === 'INVALID_INPUT',
  );
  assert.equal(bodies.length, 1);
});
test('HMAC e correspondência do ID são obrigatórios antes de consultar recursos', async () => {
  let calls = 0;
  const provider = createMercadoPago(config, async () => {
      calls++;
      return Response.json(payment);
    }),
    handler = billingWebhook(backend(), provider);
  assert.equal(
    (
      await handler(
        signed('payment', '555', { headers: { 'x-signature': 'ts=1793110000,v1=bad' } }),
      )
    ).status,
    401,
  );
  assert.equal(
    (await handler(signed('payment', '555', { body: { data: { id: '556' } } }))).status,
    400,
  );
  assert.equal(calls, 0);
});
test('recibo usa dados consultados na API e ignora valor/status enviados na notificação', async () => {
  const calls = [],
    provider = createMercadoPago(config, async () =>
      Response.json({ ...payment, status: 'pending', date_approved: null }),
    );
  const handler = billingWebhook(
    backend({ rpc: async (name, args) => calls.push([name, args]) }),
    provider,
  );
  assert.equal(
    (
      await handler(
        signed('payment', '555', { body: { status: 'approved', transaction_amount: 1 } }),
      )
    ).status,
    200,
  );
  assert.equal(calls[0][1].p_status, 'pending');
  assert.equal(calls[0][1].p_amount_cents, 18990);
});
test('valida recebedor, moeda e ambiente; URL de retorno nunca confirma recebimento', async () => {
  for (const changes of [{ collector_id: 999 }, { currency_id: 'USD' }, { live_mode: true }]) {
    const provider = createMercadoPago(config, async () =>
      Response.json({ ...payment, ...changes }),
    );
    await assert.rejects(provider.payment('555'), (e) => e.code === 'PAYMENT_MISMATCH');
  }
  const calls = [],
    provider = createMercadoPago(config, async () => Response.json(payment));
  assert.equal(
    (
      await billingWebhook(
        backend({ rpc: async (...args) => calls.push(args) }),
        provider,
      )(new Request('https://edge.example.invalid?status=approved'))
    ).status,
    405,
  );
  assert.equal(calls.length, 0);
});
test('assinatura autorizada atualiza contrato, sem tratar autorização como pagamento', async () => {
  const calls = [],
    provider = createMercadoPago(config, async () =>
      Response.json({
        id: 'agreement',
        external_reference: billingReference('subscription', id),
        status: 'authorized',
      }),
    );
  const response = await billingWebhook(
    backend({ rpc: async (...args) => calls.push(args) }),
    provider,
  )(signed('subscription_preapproval', 'agreement'));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'crm_edge_update_agreement');
});
test('parcela recorrente consulta fatura, assinatura e pagamento antes de registrar', async () => {
  const calls = [],
    provider = createMercadoPago(config, async (url) =>
      Response.json(
        String(url).includes('authorized_payments')
          ? {
              payment: { id: 555 },
              preapproval_id: 'agreement',
              debit_date: '2026-10-27T15:00:00Z',
            }
          : String(url).includes('/preapproval/')
            ? {
                id: 'agreement',
                external_reference: billingReference('subscription', id),
                status: 'authorized',
              }
            : { ...payment, external_reference: billingReference('subscription', id) },
      ),
    );
  const response = await billingWebhook(
    backend({ rpc: async (...args) => calls.push(args) }),
    provider,
  )(signed('subscription_authorized_payment', '777'));
  assert.equal(response.status, 200);
  assert.equal(calls[0][1].p_subscription, true);
  assert.equal(calls[0][1].p_cycle, '2026-10-27');
});
test('falha transitória devolve erro para reenvio e não confirma processamento', async () => {
  const provider = createMercadoPago(config, async () => {
    throw Error('fixture');
  });
  assert.equal((await billingWebhook(backend(), provider)(signed())).status, 503);
});
test('endereços externos são recusados antes do redirecionamento', async () => {
  const provider = createMercadoPago(config, async () =>
    Response.json({ id: 'resource', init_point: 'https://evil.example.invalid/checkout' }),
  );
  await assert.rejects(
    provider.createCheckout({
      id,
      mode: 'subscription',
      amount: 18990,
      email: 'fixture@example.invalid',
      dueDate: '2026-10-27',
      serverDate: '2026-10-27',
    }),
    (e) => e.code === 'PROVIDER_RESPONSE',
  );
});

test('assinatura: falha na consulta anterior não marca um envio que não ocorreu', async () => {
  const calls = [];
  const db = backend({
    rpc: async (name) => {
      calls.push(name);
      if (name === 'crm_edge_billing_context') return { is_admin: false };
      if (name === 'crm_edge_begin_checkout')
        return { checkout: { id, amount_cents: 18990 }, email: 'crm@example.invalid' };
      return true;
    },
  });
  const provider = {
    configured: true,
    environment: 'test',
    findCheckout: async () => {
      throw new HttpError(503, 'PROVIDER_UNCONFIRMED', 'timeout');
    },
  };
  await assert.rejects(
    billingCheckout(provider)({
      actorId: id,
      requestId: id,
      backend: db,
      body: {
        company_id: id,
        action: 'checkout',
        mode: 'subscription',
        payer_email: 'buyer@testuser.com',
      },
    }),
    (e) => e.code === 'PROVIDER_UNCONFIRMED',
  );
  assert.equal(calls.includes('crm_edge_claim_checkout'), false);
});

test('assinatura: teste exige comprador próprio; produção conserva o e-mail do servidor', async () => {
  const run = async (environment, extra = {}) => {
    const inputs = [],
      calls = [];
    const provider = {
      configured: true,
      environment,
      findCheckout: async () => null,
      createCheckout: async (input) => {
        inputs.push(input);
        return { id: 'provider', url: 'https://www.mercadopago.com.br/checkout/fixture' };
      },
    };
    const db = backend({
      rpc: async (name) => {
        calls.push(name);
        if (name === 'crm_edge_billing_context') return { is_admin: false };
        if (name === 'crm_edge_begin_checkout')
          return { checkout: { id, amount_cents: 18990 }, email: 'server@example.invalid' };
        return true;
      },
    });
    const request = billingCheckout(provider)({
      actorId: id,
      requestId: id,
      backend: db,
      body: { company_id: id, action: 'checkout', mode: 'subscription', ...extra },
    });
    return { request, inputs, calls };
  };
  const missing = await run('test');
  await assert.rejects(missing.request, (e) => e.code === 'SUBSCRIPTION_TEST_BUYER_REQUIRED');
  assert.equal(missing.calls.includes('crm_edge_begin_checkout'), false);
  const production = await run('production');
  await production.request;
  assert.equal(production.inputs[0].email, 'server@example.invalid');
  const forged = await run('production', { payer_email: 'untrusted@example.invalid' });
  await assert.rejects(forged.request, (e) => e.code === 'INVALID_INPUT');
});

test('assinatura: recusa definitiva encerra apenas a reserva sem provedor; timeout continua reservado', async () => {
  for (const code of [
    'SUBSCRIPTION_INPUT_REJECTED',
    'SUBSCRIPTION_TEST_BUYER_REQUIRED',
    'PROVIDER_UNCONFIRMED',
  ]) {
    const calls = [];
    const provider = {
      configured: true,
      environment: 'test',
      findCheckout: async () => null,
      createCheckout: async () => {
        throw new HttpError(code === 'PROVIDER_UNCONFIRMED' ? 503 : 422, code, 'fixture');
      },
    };
    const db = backend({
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (name === 'crm_edge_billing_context') return { is_admin: false };
        if (name === 'crm_edge_begin_checkout')
          return { checkout: { id, amount_cents: 18990 }, email: 'crm@example.invalid' };
        return true;
      },
    });
    await assert.rejects(
      billingCheckout(provider)({
        actorId: id,
        requestId: id,
        backend: db,
        body: {
          company_id: id,
          action: 'checkout',
          mode: 'subscription',
          payer_email: 'buyer@testuser.com',
        },
      }),
      (e) => e.code === code,
    );
    const closed = calls.filter((x) => x.name === 'crm_edge_update_agreement');
    assert.equal(closed.length, code === 'PROVIDER_UNCONFIRMED' ? 0 : 1);
    if (closed.length)
      assert.deepEqual(closed[0].args, {
        p_id: id,
        p_provider_id: null,
        p_status: 'cancelled',
        p_environment: 'test',
      });
  }
});

test('assinatura: HTTP 400 de comprador incompatível informa a causa sem expor a resposta privada', async () => {
  const provider = createMercadoPago(config, async () =>
    Response.json(
      { message: 'Both payer and collector must be real or test users - private-must-not-leak' },
      { status: 400 },
    ),
  );
  const error = await provider
    .createCheckout({ id, mode: 'subscription', amount: 18990, email: 'buyer@testuser.com' })
    .catch((e) => e);
  assert.equal(error.code, 'SUBSCRIPTION_TEST_BUYER_REQUIRED');
  assert.equal(error.message.includes('private-must-not-leak'), false);
  const trace = safeException(error);
  assert.match(trace.trace, /provider_operation=SUBSCRIPTION_CREATE;provider_status=400/);
  assert.equal(JSON.stringify(trace).includes('private-must-not-leak'), false);
});

test('assinatura: recuperação consulta o contrato completo quando a busca não inclui o link', async () => {
  const reference = billingReference('subscription', id),
    calls = [];
  const provider = createMercadoPago(config, async (url) => {
    calls.push(String(url));
    return Response.json(
      String(url).includes('/search?')
        ? { results: [{ id: 'provider', external_reference: reference, status: 'pending' }] }
        : {
            id: 'provider',
            external_reference: reference,
            init_point: 'https://www.mercadopago.com.br/checkout/fixture',
          },
    );
  });
  const result = await provider.findCheckout({ id, mode: 'subscription' });
  assert.equal(result.id, 'provider');
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith('/preapproval/provider'));
  const malformed = createMercadoPago(config, async () => Response.json({ message: 'unexpected' }));
  await assert.rejects(
    malformed.findCheckout({ id, mode: 'subscription' }),
    (e) => e.code === 'PROVIDER_RESPONSE',
  );
});
