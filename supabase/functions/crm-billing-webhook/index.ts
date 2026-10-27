import { backendRuntime } from '../_shared/runtime.ts';
import { paymentProvider } from '../_shared/billing-runtime.ts';
import { billingWebhook } from './handler.ts';
const { backend } = backendRuntime('crm-billing-webhook');
Deno.serve(billingWebhook(backend, paymentProvider()));
