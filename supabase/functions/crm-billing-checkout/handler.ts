import type { Command, JsonObject } from '../_shared/contracts.ts';
import { HttpError } from '../_shared/errors.ts';
import { keys, uuid } from '../_shared/validation.ts';
import type { CheckoutInput, MercadoPago } from '../_shared/mercado-pago.ts';
import { transparentCheckout } from '../_shared/billing-orders.ts';

export function billingCheckout(provider: MercadoPago): Command {
  return async ({ actorId, requestId, body, backend }) => {
    keys(body, ['company_id', 'action', 'mode', 'payment', 'attempt_id', 'payer_email']);
    const companyId = uuid(body.company_id, 'empresa');
    const action = body.action;
    if (
      !['status', 'checkout', 'cancel_subscription', 'create_order', 'order_status'].includes(
        String(action),
      )
    )
      throw new HttpError(400, 'INVALID_INPUT', 'Selecione uma ação válida.');
    const context = await backend.rpc<JsonObject>('crm_edge_billing_context', {
      p_actor: actorId,
      p_company: companyId,
      p_environment: provider.environment,
    });
    if (action === 'status') {
      keys(body, ['company_id', 'action']);
      const pending = provider.transparentConfigured
        ? await backend.rpc<JsonObject | null>('crm_edge_order_context', {
            p_actor: actorId,
            p_company: companyId,
            p_id: null,
            p_environment: provider.environment,
          })
        : null;
      return {
        status: 200,
        data: {
          configured: provider.transparentConfigured === true,
          subscriptions_enabled: provider.subscriptionsEnabled === true,
          environment: provider.environment,
          public_key: provider.publicKey,
          amount_cents: context.amount_cents,
          payer_email: context.email,
          order: pending?.attempt ? { id: (pending.attempt as JsonObject).id } : null,
          ...(context.is_admin ? { webhook_url: provider.webhookUrl } : {}),
          agreement: context.agreement || null,
        },
      };
    }
    if (context.is_admin)
      throw new HttpError(403, 'FORBIDDEN', 'A contratação é realizada pelo gestor da empresa.');
    if (action === 'create_order' || action === 'order_status')
      return transparentCheckout(backend, provider, actorId, companyId, requestId, body);
    if (
      action === 'checkout' &&
      body.mode === 'subscription' &&
      provider.subscriptionsEnabled !== true
    )
      throw new HttpError(
        409,
        'SUBSCRIPTIONS_DISABLED',
        'Use Pix ou cartão para pagar a mensalidade.',
      );
    keys(body, [
      'company_id',
      'action',
      'mode',
      ...(body.action === 'checkout' && provider.environment === 'test' ? ['payer_email'] : []),
    ]);
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
    if (body.mode !== 'subscription')
      throw new HttpError(400, 'INVALID_INPUT', 'Use o pagamento integrado por Pix ou cartão.');
    let testPayer: string | undefined;
    if (provider.environment === 'test') {
      if (typeof body.payer_email !== 'string' || !body.payer_email.trim())
        throw new HttpError(
          422,
          'SUBSCRIPTION_TEST_BUYER_REQUIRED',
          'Informe o e-mail da conta compradora de teste do Mercado Pago.',
        );
      testPayer = body.payer_email.trim();
      if (testPayer.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testPayer))
        throw new HttpError(
          422,
          'SUBSCRIPTION_INPUT_REJECTED',
          'Confira o e-mail da conta compradora de teste.',
        );
    }
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
      email: testPayer || String(prepared.email),
      dueDate: String(prepared.due_date),
      serverDate: String(prepared.server_date),
    };
    // Após timeout, só recuperar pela referência; nunca repetir a criação às cegas.
    let result = await provider.findCheckout(input);
    if (!result) {
      // A consulta não reserva um envio que ainda não foi feito ao provedor.
      const claimed = await backend.rpc<boolean>('crm_edge_claim_checkout', {
        p_actor: actorId,
        p_company: companyId,
        p_id: input.id,
        p_mode: input.mode,
      });
      if (claimed) {
        try {
          result = await provider.createCheckout(input);
        } catch (cause) {
          if (
            cause instanceof HttpError &&
            ['SUBSCRIPTION_INPUT_REJECTED', 'SUBSCRIPTION_TEST_BUYER_REQUIRED'].includes(cause.code)
          ) {
            // Um 400/422 definitivo não criou contrato. Preservar o registro local encerrado.
            await backend.rpc('crm_edge_update_agreement', {
              p_id: input.id,
              p_provider_id: null,
              p_status: 'cancelled',
              p_environment: provider.environment,
            });
          }
          throw cause;
        }
      }
    }
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
