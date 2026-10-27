import type { Backend } from '../_shared/contracts.ts';
import { HttpError } from '../_shared/errors.ts';
import { readBody } from '../_shared/http.ts';
import { reportSafely } from '../_shared/telemetry.ts';
import { parseBillingReference, type MercadoPago } from '../_shared/mercado-pago.ts';
import { recordVerifiedOrder } from '../_shared/billing-orders.ts';

export function billingWebhook(backend: Backend, provider: MercadoPago) {
  return async (request: Request): Promise<Response> => {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      if (request.method !== 'POST')
        return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } });
      if (!provider.configured)
        throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Integração não ativada.');
      const id = new URL(request.url).searchParams.get('data.id') || '';
      if (!(await provider.verify(request, id)))
        throw new HttpError(401, 'INVALID_SIGNATURE', 'Notificação inválida.');
      const body = await readBody(request),
        data = body.data as { id?: unknown } | undefined;
      if (String(data?.id).toLowerCase() !== id.toLowerCase())
        throw new HttpError(400, 'INVALID_NOTIFICATION', 'Notificação inconsistente.');
      if (body.type === 'order') {
        if (!provider.transparentConfigured)
          throw new HttpError(503, 'PAYMENTS_NOT_CONFIGURED', 'Integração não ativada.');
        await recordVerifiedOrder(backend, provider, await provider.order(id));
      } else if (body.type === 'subscription_preapproval') {
        const agreement = await provider.agreement(id),
          reference = parseBillingReference(agreement.reference);
        if (reference?.subscription)
          await backend.rpc('crm_edge_update_agreement', {
            p_id: reference.id,
            p_provider_id: agreement.id,
            p_status: agreement.status,
            p_environment: provider.environment,
          });
      } else if (body.type === 'payment' || body.type === 'subscription_authorized_payment') {
        let paymentId = id,
          forcedReference: string | undefined,
          cycle: string | null = null;
        if (body.type === 'subscription_authorized_payment') {
          const invoice = await provider.invoice(id),
            agreement = await provider.agreement(invoice.agreementId);
          paymentId = invoice.paymentId;
          forcedReference = agreement.reference;
          cycle = invoice.cycle;
        }
        const payment = await provider.payment(paymentId);
        if (forcedReference && payment.reference && payment.reference !== forcedReference)
          throw new HttpError(409, 'PAYMENT_MISMATCH', 'Referência de pagamento inconsistente.');
        const reference = parseBillingReference(forcedReference || payment.reference);
        if (reference)
          await backend.rpc('crm_edge_apply_provider_payment', {
            p_reference: reference.id,
            p_subscription: reference.subscription,
            p_payment_id: payment.id,
            p_amount_cents: payment.amount,
            p_status: payment.status,
            p_method: payment.method,
            p_paid_at: payment.paidAt,
            p_cycle: cycle,
            p_environment: provider.environment,
          });
      }
      return Response.json({ received: true }, { status: 200, headers });
    } catch (cause) {
      const error =
        cause instanceof HttpError
          ? cause
          : new HttpError(503, 'WEBHOOK_RETRY', 'A notificação deve ser reenviada.');
      // Não registrar corpo, referências financeiras, credenciais ou dados do pagador.
      if (error.status >= 500)
        await reportSafely(backend, error.code, crypto.randomUUID(), {
          status: error.status,
          message: error.message,
        });
      return Response.json({ error: { code: error.code } }, { status: error.status, headers });
    }
  };
}
