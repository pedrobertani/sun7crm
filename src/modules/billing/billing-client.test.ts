import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeBilling } from './billing-client';

const mocks = vi.hoisted(() => ({ session: vi.fn(), invoke: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: mocks.session },
    functions: { invoke: mocks.invoke },
  }),
}));

describe('Resposta segura do pagamento online', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mocks.session.mockResolvedValue({ data: { session: { access_token: 'fixture-session' } } });
  });
  it.each([
    ['hom', 'crm-billing-checkout-hom'],
    ['production', 'crm-billing-checkout'],
    ['', 'crm-billing-checkout'],
  ])(
    'seleciona a função do build %s sem enviar o ambiente no corpo',
    async (environment, endpoint) => {
      vi.stubEnv('VITE_BILLING_ENVIRONMENT', environment);
      mocks.invoke.mockResolvedValue({ data: { data: { environment: 'test' } } });
      await invokeBilling('fixture-company', 'status', 'fixture-operation');
      expect(mocks.invoke.mock.calls[0][0]).toBe(endpoint);
      expect(mocks.invoke.mock.calls[0][1].body).toEqual({
        company_id: 'fixture-company',
        action: 'status',
      });
    },
  );
  it.each(['PROVIDER_CREDENTIALS', 'PROVIDER_FORBIDDEN', 'PAYMENT_MISMATCH'])(
    'orienta o gestor sem revelar o retorno privado: %s',
    async (code) => {
      mocks.invoke.mockResolvedValue({
        error: {
          context: Response.json(
            { error: { code, message: 'provider-payload-must-not-leak' } },
            { status: 502 },
          ),
        },
      });
      const failure = await invokeBilling(
        'fixture-company',
        'order_status',
        'fixture-operation',
        undefined,
        { attempt_id: 'fixture-attempt' },
      ).catch((error) => error);
      expect(failure.code).toBe(code);
      expect(failure.message).toMatch(/administração/);
      expect(failure.message).not.toContain('provider-payload-must-not-leak');
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
      expect(mocks.invoke.mock.calls[0][1].body.attempt_id).toBe('fixture-attempt');
    },
  );
});
