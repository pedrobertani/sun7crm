import type { Backend, JsonObject } from './contracts.ts';
import type { MercadoPago } from './mercado-pago.ts';
import type { VerifiedOrder } from './mercado-pago-orders.ts';
import { object, orderPaymentInput } from './mercado-pago-orders.ts';
import { HttpError } from './errors.ts';
import { keys, uuid } from './validation.ts';

export async function recordVerifiedOrder(
  backend: Backend,
  provider: MercadoPago,
  order: VerifiedOrder,
) {
  const result = object(
    await backend.rpc('crm_edge_record_order', {
      p_id: order.attemptId,
      p_order_id: order.id,
      p_status: order.paymentStatus,
      p_payment_id: order.paymentId,
      p_amount_cents: order.amount,
      p_method: order.method,
      p_paid_at: order.paidAt,
      p_environment: provider.environment,
    }),
  );
  return {
    id: order.attemptId,
    provider_order_id: order.id,
    amount_cents: order.amount,
    status: order.paymentStatus,
    method: order.method || result.method,
    review: result.review === true,
    ignored: result.ignored === true,
    ...(order.qrCode ? { qr_code: order.qrCode } : {}),
    ...(order.qrImage ? { qr_image: order.qrImage } : {}),
    ...(order.expiresAt ? { expires_at: order.expiresAt } : {}),
    ...(order.authenticationUrl ? { authentication_url: order.authenticationUrl } : {}),
  };
}

export async function transparentCheckout(
  backend: Backend,
  provider: MercadoPago,
  actorId: string,
  companyId: string,
  requestId: string,
  body: JsonObject,
) {
  if (!provider.transparentConfigured)
    throw new HttpError(
      503,
      'PAYMENTS_NOT_CONFIGURED',
      'O pagamento integrado ainda não foi ativado.',
    );
  let prepared: JsonObject;
  let payment: ReturnType<typeof orderPaymentInput> | undefined;
  if (body.action === 'create_order') {
    keys(body, ['company_id', 'action', 'payment']);
    payment = orderPaymentInput(body.payment);
    prepared = await backend.rpc<JsonObject>('crm_edge_prepare_order', {
      p_actor: actorId,
      p_company: companyId,
      p_request_id: requestId,
      p_method: payment.method,
      p_environment: provider.environment,
    });
  } else {
    keys(body, ['company_id', 'action', 'attempt_id']);
    const value = await backend.rpc<JsonObject | null>('crm_edge_order_context', {
      p_actor: actorId,
      p_company: companyId,
      p_id: uuid(body.attempt_id, 'pagamento'),
      p_environment: provider.environment,
    });
    if (!value) throw new HttpError(404, 'NOT_FOUND', 'Pagamento não encontrado.');
    prepared = value;
  }
  const attempt = object(prepared.attempt);
  const attemptId = String(attempt.id);
  if (!attempt.provider_order_id && ['rejected', 'cancelled'].includes(String(attempt.status)))
    return {
      status: 200,
      data: {
        order: {
          id: attemptId,
          status: attempt.status,
          amount_cents: Number(prepared.amount_cents),
          method: attempt.method,
        },
      },
    };
  let order: VerifiedOrder | null;
  if (attempt.provider_order_id) order = await provider.order(String(attempt.provider_order_id));
  else if (prepared.created === true && payment) {
    try {
      order = await provider.createOrder(attemptId, Number(prepared.amount_cents), payment);
    } catch (cause) {
      // Um 400/422 definitivo não criou uma order; timeouts continuam reservados para recuperação.
      if (cause instanceof HttpError && cause.code === 'PAYMENT_INPUT_REJECTED')
        await backend.rpc('crm_edge_reject_order_input', {
          p_actor: actorId,
          p_company: companyId,
          p_id: attemptId,
          p_environment: provider.environment,
        });
      throw cause;
    }
  } else order = await provider.findOrder(attemptId, String(attempt.created_at));
  if (!order)
    return {
      status: 200,
      data: {
        order: {
          id: attemptId,
          status: 'creating',
          amount_cents: Number(prepared.amount_cents),
          method: attempt.method,
        },
      },
    };
  if (order.attemptId !== attemptId)
    throw new HttpError(
      409,
      'PAYMENT_MISMATCH',
      'A confirmação não corresponde a esta solicitação.',
    );
  const result = await recordVerifiedOrder(backend, provider, order);
  if (result.ignored)
    throw new HttpError(409, 'PAYMENT_MISMATCH', 'O pagamento precisa ser conferido.');
  return { status: 200, data: { order: result } };
}
