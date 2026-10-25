import type { Ambassador, AmbassadorSale } from './types';

export type AmbassadorPeriod = 'month' | 'quarter' | 'semester';
export function inAmbassadorPeriod(date: string, month: string, period: AmbassadorPeriod) {
  const [year, chosen] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(chosen) || chosen < 1 || chosen > 12)
    return false;
  const length = period === 'quarter' ? 3 : period === 'semester' ? 6 : 1;
  const start = Math.floor((chosen - 1) / length) * length + 1;
  const [y, m] = date.split('-').map(Number);
  return y === year && m >= start && m < start + length;
}
export function ambassadorTotals(
  person: Ambassador,
  sales: AmbassadorSale[],
  month: string,
  period: AmbassadorPeriod,
) {
  const included = sales.filter((s) => {
    return (
      s.companyId === person.companyId &&
      s.ambassadorId === person.id &&
      !s.cancelled &&
      Number.isSafeInteger(s.value) &&
      s.value > 0 &&
      inAmbassadorPeriod(s.date, month, period)
    );
  });
  const value = included.reduce((sum, s) => sum + s.value, 0);
  return {
    value,
    points: Math.floor(value / 100000),
    commission: Math.round((value * person.commissionRate) / 100),
    count: included.length,
  };
}
