import type { Command, JsonObject } from '../_shared/contracts.ts';
import { HttpError } from '../_shared/errors.ts';
import { keys, uuid } from '../_shared/validation.ts';
import type { CheckoutInput, MercadoPago } from '../_shared/mercado-pago.ts';

export function billingCheckout(provider: MercadoPago): Command {
  return async ({ actorId, requestId, body, backend }) => {
    keys(body, ['company_id', 'action', 'mode']);
    const companyId = uuid(body.company_id, 'empresa');
    const action = body.action;
    if (!['status', 'checkout', 'cancel_subscription'].includes(String(action)))
      throw new HttpError(400, 'INVALID_INPUT', 'Selecione uma ação válida.');
    const context = await backend.rpc<JsonObject>('crm_edge_billing_context', {
      p_actor: actorId,
      p_company: companyId,
      p_environment: provider.environment,
    });
    if (action === 'status')
      return {
        status: 200,
        data: {
          configured: provider.configured,
          environment: provider.environment,
          ...(context.is_admin ? { webhook_url: provider.webhookUrl } : {}),
          agreement: context.agreement || null,
        },
      };
    if (context.is_admin)
      throw new HttpError(403, 'FORBIDDEN', 'A contratação é realizada pelo gestor da empresa.');
    if (!provider.configured)
      throw new HttpError(
        503,
        'PAYMENTS_NOT_CONFIGURED',
        'O pagamento online ainda não foi ativado.',
      );
    if (action === 'cancel_subscription') {
      const agreement = context.agreement as JsonObject | null;
      if (!agreement?.provider_id)
        throw new HttpError(409, 'NO_SUBSCRIPTION', 'Não há assinatura confirmada para cancelar.');
      const current = await provider.agreement(String(agreement.provider_id));
      if (current.reference !== `sun7:subscription:${agreement.id}`)
        throw new HttpError(
          409,
          'CHECKOUT_REVIEW',
          'A assinatura precisa ser conferida pela administração.',
        );
      if (current.status !== 'cancelled') await provider.cancelAgreement(current.id);
      const cancelled = await provider.agreement(current.id);
      if (cancelled.status !== 'cancelled')
        throw new HttpError(503, 'PROVIDER_UNCONFIRMED', 'Aguarde a confirmação do cancelamento.');
      await backend.rpc('crm_edge_update_agreement', {
        p_id: agreement.id,
        p_provider_id: current.id,
        p_status: 'cancelled',
        p_environment: provider.environment,
      });
      return { status: 200, data: { cancelled: true } };
    }
    if (body.mode !== 'one_time' && body.mode !== 'subscription')
      throw new HttpError(400, 'INVALID_INPUT', 'Selecione pagamento ou assinatura.');
    const prepared = await backend.rpc<JsonObject>('crm_edge_begin_checkout', {
      p_actor: actorId,
      p_company: companyId,
      p_request_id: requestId,
      p_mode: body.mode,
      p_environment: provider.environment,
    });
    const checkout = prepared.checkout as JsonObject;
    if (checkout.checkout_url) return { status: 200, data: { url: checkout.checkout_url } };
    const input: CheckoutInput = {
      id: String(checkout.id),
      mode: body.mode,
      amount: Number(checkout.amount_cents),
      email: String(prepared.email),
      dueDate: String(prepared.due_date),
      serverDate: String(prepared.server_date),
    };
    const claimed = await backend.rpc<boolean>('crm_edge_claim_checkout', {
      p_actor: actorId,
      p_company: companyId,
      p_id: input.id,
      p_mode: input.mode,
    });
    // Após timeout, só recuperar pela referência; nunca repetir a criação às cegas.
    let result = await provider.findCheckout(input);
    if (!result && claimed) result = await provider.createCheckout(input);
    if (!result)
      throw new HttpError(
        503,
        'CHECKOUT_UNCONFIRMED',
        'A criação está sendo conferida. Aguarde e tente recuperar esta mesma solicitação.',
      );
    await backend.rpc('crm_edge_finish_checkout', {
      p_actor: actorId,
      p_company: companyId,
      p_id: input.id,
      p_mode: input.mode,
      p_provider_id: result.id,
      p_url: result.url,
    });
    return { status: 200, data: { url: result.url } };
  };
}
