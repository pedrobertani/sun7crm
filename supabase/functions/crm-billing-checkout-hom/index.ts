import { backendRuntime } from '../_shared/runtime.ts';
import { createHttpHandler } from '../_shared/http.ts';
import { paymentProvider } from '../_shared/billing-runtime.ts';
import { billingConfiguration } from '../_shared/billing-config.ts';
import { billingCheckout } from '../crm-billing-checkout/handler.ts';

const { backend } = backendRuntime('crm-billing-checkout-hom');
const config = billingConfiguration((name) => Deno.env.get(name), 'hom');
Deno.serve(
  createHttpHandler(backend, billingCheckout(paymentProvider('hom')), [
    new URL(config.returnUrl).origin,
  ]),
);
