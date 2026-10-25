import type { Company, Strategy, Ambassador, AmbassadorSale } from '../domain/types';
import { today } from '../lib/format';

export function marketingSeed(companies: Pick<Company, 'id'>[]) {
  const date = today();
  const strategies: Strategy[] = companies.flatMap(({ id }) => [
    {
      id: id + '-strategy-paid',
      companyId: id,
      name: 'Novas oportunidades do mês',
      month: date.slice(0, 7),
      channel: 'Tráfego pago',
      status: 'active',
      budget: 150000,
      ownerId: id + '-manager',
      notes: 'Testar duas abordagens e acompanhar a origem dos contatos.',
    },
    {
      id: id + '-strategy-referral',
      companyId: id,
      name: 'Indique e participe',
      month: date.slice(0, 7),
      channel: 'Embaixadores',
      status: 'planned',
      budget: 30000,
      ownerId: id + '-seller',
      notes:
        'Premiação de exemplo: experiência especial para o destaque do período. Regras para validação.',
    },
  ]);
  const ambassadors: Ambassador[] = companies.flatMap(({ id }) => [
    {
      id: id + '-ambassador-1',
      companyId: id,
      name: 'Juliana Martins',
      commissionRate: 5,
      active: true,
      reward: 'Experiência especial — exemplo',
    },
    {
      id: id + '-ambassador-2',
      companyId: id,
      name: 'Fernanda Souza',
      commissionRate: 5,
      active: true,
      reward: '',
    },
    {
      id: id + '-ambassador-3',
      companyId: id,
      name: 'Patrícia Santos',
      commissionRate: 3,
      active: false,
      reward: '',
    },
  ]);
  const ambassadorSales: AmbassadorSale[] = companies.flatMap(({ id }) => [
    {
      id: id + '-referral-1',
      companyId: id,
      ambassadorId: id + '-ambassador-1',
      customer: 'Marina Alves',
      value: 180000,
      date,
      cancelled: false,
    },
    {
      id: id + '-referral-2',
      companyId: id,
      ambassadorId: id + '-ambassador-1',
      customer: 'Renata Lima',
      value: 70000,
      date,
      cancelled: false,
    },
    {
      id: id + '-referral-3',
      companyId: id,
      ambassadorId: id + '-ambassador-2',
      customer: 'Ana Ferreira',
      value: 120000,
      date,
      cancelled: false,
    },
  ]);
  return { strategies, ambassadors, ambassadorSales };
}
