import type { MercadoPagoConfig } from './mercado-pago.ts';

export type BillingProfile = 'main' | 'hom';

export function billingConfiguration(
  get: (name: string) => string | undefined,
  profile: BillingProfile = 'main',
): MercadoPagoConfig {
  const hom = profile === 'hom';
  const prefix = hom ? 'MP_HOM_' : 'MP_';
  const origin =
    get(hom ? 'CRM_HOM_PUBLIC_URL' : 'CRM_PUBLIC_URL') ||
    (hom ? 'https://hom.sun7crm.pages.dev' : 'https://sun7crm.pages.dev');
  return {
    accessToken: get(`${prefix}ACCESS_TOKEN`) || '',
    webhookSecret: get(`${prefix}WEBHOOK_SECRET`) || '',
    collectorId: get(`${prefix}COLLECTOR_ID`) || '',
    publicKey: get(`${prefix}PUBLIC_KEY`) || '',
    applicationId: get(`${prefix}APPLICATION_ID`) || '',
    productionEnabled: !hom && get('MP_PRODUCTION_ENABLED') === 'true',
    environment: !hom && get('MP_ENVIRONMENT') === 'production' ? 'production' : 'test',
    enabled: get(`${prefix}PAYMENTS_ENABLED`) === 'true',
    returnUrl: `${origin.replace(/\/$/, '')}/app/plano`,
    webhookUrl: `${get('SUPABASE_URL') || ''}/functions/v1/crm-billing-webhook${hom ? '-hom' : ''}`,
  };
}
