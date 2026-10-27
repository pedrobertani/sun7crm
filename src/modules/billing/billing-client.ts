import { getSupabaseClient } from '../../lib/supabase';
export async function invokeBilling(
  companyId: string,
  action: string,
  operation: string,
  mode?: string,
  extra: Record<string, unknown> = {},
) {
  const client = getSupabaseClient(),
    session = await client.auth.getSession();
  if (session.error || !session.data.session)
    throw Error('Entre novamente para consultar o pagamento.');
  const result = await client.functions.invoke('crm-billing-checkout', {
    body: { company_id: companyId, action, ...(mode ? { mode } : {}), ...extra },
    headers: {
      Authorization: `Bearer ${session.data.session.access_token}`,
      'Idempotency-Key': operation,
    },
  });
  if (result.error) {
    const response = result.error.context;
    let code = '';
    if (response instanceof Response) {
      try {
        code = (await response.clone().json()).error?.code || '';
      } catch {
        /* Envelope indisponível. */
      }
    }
    const failure = (message: string) => Object.assign(new Error(message), { code });
    if (code === 'PAYMENT_INPUT_REJECTED')
      throw failure(
        'O Mercado Pago não aceitou os dados. Recupere a solicitação e confira o formulário antes de tentar novamente.',
      );
    if (code === 'PAYMENTS_NOT_CONFIGURED')
      throw failure('O pagamento online ainda não foi ativado.');
    if (['CHECKOUT_UNCONFIRMED', 'PROVIDER_UNCONFIRMED'].includes(code))
      throw failure(
        'Aguarde e use Recuperar solicitação. O resultado anterior será conferido antes de continuar.',
      );
    if (['CONFLICT', 'CHECKOUT_REVIEW'].includes(code))
      throw failure(
        'Já existe uma cobrança ou assinatura em andamento. Atualize os dados e confira com a administração.',
      );
    if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED')
      throw failure('Seu acesso precisa ser verificado novamente.');
    throw failure(
      'Não foi possível confirmar a operação no Mercado Pago. Tente novamente em instantes.',
    );
  }
  if (!result.data?.data) throw Error('O resultado precisa ser conferido. Atualize os dados.');
  return result.data.data;
}
