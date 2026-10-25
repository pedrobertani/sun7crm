import { describe, expect, it } from 'vitest';
import {
  addMonth,
  applyBillingCommand,
  paymentPreview,
  subscriptionState,
  type Subscription,
} from './subscription';
import { fakeSupabase, fixtureUserId } from '../../test/supabase';
describe('Plano mensal', () => {
  it('apresenta os limites de carência e fim da cortesia sem conceder dias extras', () => {
    expect(subscriptionState('2026-10-10', 'monthly', '2026-10-17')).toBe('grace');
    expect(subscriptionState('2026-10-10', 'monthly', '2026-10-18')).toBe('blocked');
    expect(subscriptionState('2026-10-10', 'complimentary', '2026-10-10')).toBe('blocked');
    expect(subscriptionState('2026-10-30', 'awaiting_payment', '2026-10-01')).toBe(
      'awaiting_payment',
    );
  });
  it('prevê meses civis e desconta somente dias utilizados da carência', () => {
    expect(addMonth('2026-01-31')).toBe('2026-02-28');
    expect(addMonth('2028-01-31')).toBe('2028-02-29');
    expect(
      paymentPreview({
        due_date: '2026-10-10',
        server_date: '2026-10-25',
        grace_days_used: 7,
      } as Subscription),
    ).toBe('2026-11-18');
    expect(
      paymentPreview({
        due_date: '2026-11-10',
        server_date: '2026-10-25',
        grace_days_used: 0,
      } as Subscription),
    ).toBe('2026-12-10');
  });
  it('recusa comando antes de consultar a cobrança se o papel administrativo foi revogado', async () => {
    const fake = fakeSupabase();
    fake.state.admin = false;
    await expect(
      applyBillingCommand(fake.client, fixtureUserId, {
        id: 'op',
        companyId: 'company',
        dueDate: '2026-10-10',
        amount: 18990,
        kind: 'payment',
        days: 0,
        note: '',
      }),
    ).rejects.toThrow();
    expect(
      fake.rpc.mock.calls.some(([name]) => name === 'crm_admin_record_subscription_payment'),
    ).toBe(false);
  });
});
