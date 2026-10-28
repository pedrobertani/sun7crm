import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { OnlineBilling } from './OnlineBilling';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../hooks/useLiveQuery', () => ({ useLiveQuery: () => mocks.query() }));

const status = {
  configured: true,
  environment: 'test',
  amount_cents: 18990,
  agreement: null,
  subscriptions_enabled: false,
};
function page(changes = {}) {
  mocks.query.mockReturnValue({ data: { ...status, ...changes }, refresh: vi.fn(), error: '' });
  return renderToString(<OnlineBilling companyId="fixture-company" amount={18990} />);
}

describe('Mensalidade por Pix e cartão', () => {
  beforeEach(() => vi.clearAllMocks());
  it('oferece pagamento avulso e não oferece nova assinatura durante a pausa', () => {
    const html = page();
    expect(html).toContain('Pagar mensalidade');
    expect(html).toContain('Pagamento por Pix ou cartão, uma mensalidade por vez.');
    expect(html).not.toContain('Assinar mensalmente');
    expect(html).not.toContain('E-mail do comprador de teste');
  });
  it('só oferece nova assinatura após liberação explícita do servidor', () => {
    expect(page({ subscriptions_enabled: true })).toContain('Assinar mensalmente');
  });
  it('mantém cancelamento de contrato anterior disponível durante a pausa', () => {
    const html = page({
      agreement: {
        id: 'fixture',
        provider_id: 'provider',
        status: 'authorized',
        amount_cents: 18990,
      },
    });
    expect(html).toContain('Cancelar assinatura');
    expect(html).not.toContain('Assinar mensalmente');
  });
});
