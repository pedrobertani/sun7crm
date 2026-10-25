import type { Snapshot, Session, AmbassadorCampaign, AmbassadorSale } from './types';
export function campaignTotals(data: Snapshot, campaign: AmbassadorCampaign, ambassadorId: string) {
  const sales = data.ambassadorSales.filter(
    (s) =>
      s.companyId === campaign.companyId &&
      s.campaignId === campaign.id &&
      s.ambassadorId === ambassadorId &&
      !s.cancelled &&
      s.paid === true &&
      s.attended === true &&
      s.date >= campaign.start &&
      s.date <= campaign.end,
  );
  const value = sales.reduce((n, s) => n + Math.max(0, s.value - (s.refunded || 0)), 0);
  const points = Math.floor(value / 100000);
  const eligible = campaign.commissionedAmbassadorIds
    ? campaign.commissionedAmbassadorIds.includes(ambassadorId)
    : data.ambassadors.find((a) => a.id === ambassadorId && a.companyId === campaign.companyId)
        ?.commissionEnabled !== false;
  const amount = !eligible
    ? 0
    : campaign.paymentMode === 'per_point'
      ? points * campaign.rate
      : Math.round((value * campaign.rate) / 100);
  const payments = (data.ambassadorPayments || []).filter(
    (p) =>
      p.companyId === campaign.companyId &&
      p.campaignId === campaign.id &&
      p.ambassadorId === ambassadorId,
  );
  const paid = payments.reduce((n, p) => n + p.amount, 0);
  const paidPoints = payments.reduce((n, p) => n + p.points, 0);
  return {
    value,
    points,
    amount,
    paid,
    balance: amount - paid,
    remainingPoints: Math.max(0, points - paidPoints),
    settled: payments.length > 0,
  };
}
function manager(data: Snapshot, session: Session, campaignId: string) {
  if (session.role !== 'manager') throw Error('Somente o gestor gerencia campanhas.');
  const c = (data.ambassadorCampaigns || []).find(
    (c) => c.id === campaignId && c.companyId === session.companyId,
  );
  if (!c) throw Error('Campanha indisponível.');
  return c;
}
export function closeCampaign(data: Snapshot, session: Session, id: string): Snapshot {
  const c = manager(data, session, id);
  if (c.status !== 'active') throw Error('Campanha já encerrada.');
  return {
    ...data,
    ambassadorCampaigns: (data.ambassadorCampaigns || []).map((x) =>
      x.id === id
        ? {
            ...x,
            status: 'closed',
            closedAt: new Date().toISOString(),
            commissionedAmbassadorIds: data.ambassadors
              .filter((a) => a.companyId === session.companyId && a.commissionEnabled !== false)
              .map((a) => a.id),
          }
        : x,
    ),
  };
}
export function payCampaign(
  data: Snapshot,
  session: Session,
  id: string,
  ambassadorId: string,
  paymentId: string,
): Snapshot {
  const c = manager(data, session, id);
  if (c.status !== 'closed') throw Error('Encerre a campanha antes de confirmar o pagamento.');
  if (!data.ambassadors.some((a) => a.id === ambassadorId && a.companyId === session.companyId))
    throw Error('Embaixador indisponível.');
  const totals = campaignTotals(data, c, ambassadorId);
  if (totals.settled) throw Error('Pagamento já registrado. Consulte o histórico e os ajustes.');
  if (totals.amount <= 0) throw Error('Não há valor a pagar.');
  return {
    ...data,
    ambassadorPayments: [
      ...(data.ambassadorPayments || []),
      {
        id: paymentId,
        companyId: session.companyId,
        campaignId: id,
        ambassadorId,
        points: totals.points,
        amount: totals.amount,
        paidAt: new Date().toISOString(),
      },
    ],
  };
}
export function saveReferral(data: Snapshot, session: Session, sale: AmbassadorSale): Snapshot {
  const c = manager(data, session, sale.campaignId || '');
  if (c.status !== 'active') throw Error('Campanha encerrada não recebe novas indicações.');
  if (
    sale.companyId !== session.companyId ||
    !data.ambassadors.some(
      (a) => a.id === sale.ambassadorId && a.companyId === session.companyId && a.active,
    )
  )
    throw Error('Embaixador indisponível.');
  if (
    !sale.customer.trim() ||
    !Number.isSafeInteger(sale.value) ||
    sale.value <= 0 ||
    sale.date < c.start ||
    sale.date > c.end
  )
    throw Error('Confira cliente, valor e data dentro da campanha.');
  if (data.ambassadorSales.some((s) => s.id === sale.id)) throw Error('Indicação já registrada.');
  return { ...data, ambassadorSales: [...data.ambassadorSales, sale] };
}
export function refundReferral(
  data: Snapshot,
  session: Session,
  id: string,
  refunded: number,
  cancelled = false,
): Snapshot {
  if (session.role !== 'manager') throw Error('Somente o gestor ajusta indicações.');
  const s = data.ambassadorSales.find((s) => s.id === id && s.companyId === session.companyId);
  if (!s) throw Error('Indicação indisponível.');
  if (!Number.isSafeInteger(refunded) || refunded < 0 || refunded > s.value)
    throw Error('Informe estorno entre zero e o valor da venda.');
  return {
    ...data,
    ambassadorSales: data.ambassadorSales.map((x) =>
      x.id === id ? { ...x, refunded, cancelled } : x,
    ),
  };
}
