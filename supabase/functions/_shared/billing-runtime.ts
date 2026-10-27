import { createMercadoPago } from './mercado-pago.ts';

export function paymentProvider() {
  const origin = Deno.env.get('CRM_PUBLIC_URL') || 'https://sun7crm.pages.dev';
  return createMercadoPago({
    accessToken: Deno.env.get('MP_ACCESS_TOKEN') || '',
    webhookSecret: Deno.env.get('MP_WEBHOOK_SECRET') || '',
    collectorId: Deno.env.get('MP_COLLECTOR_ID') || '',
    environment: Deno.env.get('MP_ENVIRONMENT') === 'production' ? 'production' : 'test',
    enabled: Deno.env.get('MP_PAYMENTS_ENABLED') === 'true',
    returnUrl: `${origin.replace(/\/$/, '')}/app/plano`,
    webhookUrl: `${Deno.env.get('SUPABASE_URL') || ''}/functions/v1/crm-billing-webhook`,
  });
}
