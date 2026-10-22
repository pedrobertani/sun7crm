import type { Company } from './types';
import { shiftDate } from '../lib/format';
export function filterCompanies(companies: Company[], filter: string, from: string, date: string) {
  return companies.filter((c) => {
    switch (filter) {
      case 'active':
        return c.enabled;
      case 'inactive':
        return !c.enabled;
      case 'upcoming':
        return c.enabled && c.dueDate >= date && c.dueDate <= shiftDate(date, 7);
      case 'new':
        return c.createdAt >= from && c.createdAt <= date;
      case 'overdue':
        return c.enabled && c.dueDate < date;
      default:
        return true;
    }
  });
}
export const companyFilterLabels: Record<string, string> = {
  all: 'Todas as empresas',
  active: 'Ativas',
  inactive: 'Desativadas',
  upcoming: 'Vencem em até 7 dias',
  new: 'Novas no período',
  overdue: 'Com vencimento passado',
};
export function readPeriod(params: URLSearchParams) {
  const valid = (value: string | null) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T12:00:00Z'))
      ? value
      : '';
  return { from: valid(params.get('de')), to: valid(params.get('ate')) };
}
export function inPeriod(date: string, period: ReturnType<typeof readPeriod>) {
  return (!period.from || date >= period.from) && (!period.to || date <= period.to);
}
