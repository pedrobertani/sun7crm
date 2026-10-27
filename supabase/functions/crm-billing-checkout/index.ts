import { serve } from '../_shared/runtime.ts';
import { paymentProvider } from '../_shared/billing-runtime.ts';
import { billingCheckout } from './handler.ts';
serve(billingCheckout(paymentProvider()), 'crm-billing-checkout');
