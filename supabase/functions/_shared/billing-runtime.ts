import { createMercadoPago } from './mercado-pago.ts';
import { billingConfiguration, type BillingProfile } from './billing-config.ts';

export function paymentProvider(profile: BillingProfile = 'main') {
  return createMercadoPago(billingConfiguration((name) => Deno.env.get(name), profile));
}
