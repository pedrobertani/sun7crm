import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import {
  campaignTotals,
  closeCampaign,
  payCampaign,
  saveReferral,
  refundReferral,
} from './campaigns';
import { saveCard } from './operations';
import type { AmbassadorCampaign, AmbassadorSale, Session } from './types';
const session: Session = { companyId: 'aurora', memberId: 'aurora-manager', role: 'manager' };
function setup() {
  const data = createSeed();
  const c: AmbassadorCampaign = {
    id: 'campaign',
    companyId: 'aurora',
    name: 'Evento',
    start: '2026-10-01',
    end: '2026-10-31',
    status: 'active',
    paymentMode: 'per_point',
    rate: 5000,
  };
  data.ambassadorCampaigns = [c];
  const a = data.ambassadors.find((a) => a.companyId === 'aurora')!;
  data.ambassadorSales = [];
  const sale = (value: number, id = 'sale'): AmbassadorSale => ({
    id,
    companyId: 'aurora',
    ambassadorId: a.id,
    campaignId: c.id,
    customer: 'Teste',
    value,
    date: '2026-10-10',
    paid: true,
    attended: true,
    cancelled: false,
  });
  return { data, c, a, sale };
}
describe('campanhas de embaixadores', () => {
  it.each([
    [90000, 0],
    [100000, 1],
    [150000, 1],
    [200000, 2],
    [290000, 2],
  ])('calcula %i centavos como %i pontos inteiros', (value, points) => {
    const { data, c, a, sale } = setup();
    data.ambassadorSales = [sale(value)];
    expect(campaignTotals(data, c, a.id).points).toBe(points);
  });
  it('soma vendas, exige pagamento e presença e isola campanhas e empresas', () => {
    const { data, c, a, sale } = setup();
    data.ambassadorSales = [
      sale(60000, 'a'),
      sale(40000, 'b'),
      { ...sale(100000, 'c'), paid: false },
      { ...sale(100000, 'd'), attended: false },
      { ...sale(100000, 'e'), companyId: 'casa' },
      { ...sale(100000, 'f'), campaignId: 'other' },
      { ...sale(100000, 'g'), cancelled: true },
    ];
    expect(campaignTotals(data, c, a.id).points).toBe(1);
  });
  it('só quita após fechar, zera saldo, mantém histórico e rejeita pagamento duplicado', () => {
    const { data, c, a, sale } = setup();
    data.ambassadorSales = [sale(150000)];
    expect(() => payCampaign(data, session, c.id, a.id, 'p')).toThrow('Encerre');
    const closed = closeCampaign(data, session, c.id);
    const paid = payCampaign(closed, session, c.id, a.id, 'p');
    expect(campaignTotals(paid, closed.ambassadorCampaigns![0], a.id)).toMatchObject({
      remainingPoints: 0,
      points: 1,
      amount: 5000,
      paid: 5000,
      balance: 0,
    });
    expect(paid.ambassadorSales).toHaveLength(1);
    expect(() => payCampaign(paid, session, c.id, a.id, 'p2')).toThrow('já registrado');
    expect(() => saveReferral(paid, session, sale(100000, 's2'))).toThrow('encerrada');
  });
  it('estorno parcial recalcula e preserva pagamentos já efetuados', () => {
    const { data, c, a, sale } = setup();
    data.ambassadorSales = [sale(200000)];
    const closed = closeCampaign(data, session, c.id);
    const paid = payCampaign(closed, session, c.id, a.id, 'p');
    const refunded = refundReferral(paid, session, 'sale', 60000);
    expect(campaignTotals(refunded, closed.ambassadorCampaigns![0], a.id)).toMatchObject({
      points: 1,
      balance: -5000,
    });
    expect(refunded.ambassadorPayments![0].amount).toBe(10000);
    expect(() => refundReferral(paid, session, 'sale', 300000)).toThrow();
  });
  it('não presume comissão por função e preserva elegibilidade após encerramento', () => {
    const { data, c, a, sale } = setup();
    data.ambassadorSales = [sale(150000)];
    a.category = 'Imã';
    a.commissionEnabled = false;
    expect(campaignTotals(data, c, a.id).amount).toBe(0);
    a.commissionEnabled = true;
    const closed = closeCampaign(data, session, c.id);
    a.commissionEnabled = false;
    expect(campaignTotals(closed, closed.ambassadorCampaigns![0], a.id).amount).toBe(5000);
  });
  it('permite comissão percentual por campanha e bloqueia consultores e outras empresas', () => {
    const { data, c, a, sale } = setup();
    c.paymentMode = 'percentage';
    c.rate = 5;
    data.ambassadorSales = [sale(150000)];
    expect(campaignTotals(data, c, a.id).amount).toBe(7500);
    expect(() => closeCampaign(data, { ...session, role: 'seller' }, c.id)).toThrow();
    expect(() => closeCampaign(data, { ...session, companyId: 'casa' }, c.id)).toThrow();
  });
});
describe('cards independentes do contato', () => {
  it('permite vários cards do mesmo contato e valida limite e empresa das etiquetas', () => {
    const { data } = setup();
    const contact = data.contacts.find((c) => c.companyId === 'aurora')!;
    const board = data.boards.find((b) => b.companyId === 'aurora')!;
    const card = {
      id: 'new',
      companyId: 'aurora',
      contactId: contact.id,
      boardId: board.id,
      stageId: board.stages[0].id,
      value: 10000,
      source: '',
      title: 'Retorno',
      createdAt: '2026-10-24',
      labelIds: data.labels!.filter((l) => l.companyId === 'aurora').map((l) => l.id),
    };
    const next = saveCard(data, session, card);
    expect(next.contacts.length).toBe(data.contacts.length);
    expect(next.opportunities.length).toBe(data.opportunities.length + 1);
    expect(() =>
      saveCard(data, session, { ...card, labelIds: [...card.labelIds, 'fourth'] }),
    ).toThrow('3 etiquetas');
    expect(() =>
      saveCard(data, session, {
        ...card,
        labelIds: [data.labels!.find((l) => l.companyId === 'casa')!.id],
      }),
    ).toThrow('Etiqueta');
  });
  it('consultor não pode criar nem editar cards de outro responsável', () => {
    const { data } = setup();
    const contact = {
      ...data.contacts.find((c) => c.companyId === 'aurora')!,
      ownerId: 'other-seller',
    };
    data.contacts = data.contacts.map((c) => (c.id === contact.id ? contact : c));
    const board = data.boards.find((b) => b.companyId === 'aurora')!;
    expect(() =>
      saveCard(
        data,
        { ...session, role: 'seller', memberId: 'aurora-seller' },
        {
          id: 'x',
          companyId: 'aurora',
          contactId: contact.id,
          boardId: board.id,
          stageId: board.stages[0].id,
          value: 0,
          source: '',
          createdAt: '2026-10-24',
        },
      ),
    ).toThrow('Contato');
  });
});
