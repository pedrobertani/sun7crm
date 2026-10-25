import { describe, it, expect } from 'vitest';
import { ambassadorTotals } from './ambassadors';
import type { Ambassador, AmbassadorSale } from './types';

const person: Ambassador = {
  id: 'a',
  companyId: 'one',
  name: 'Exemplo',
  commissionRate: 5,
  active: true,
  reward: '',
};
const sale = (id: string, value: number, date = '2026-10-10'): AmbassadorSale => ({
  id,
  companyId: 'one',
  ambassadorId: 'a',
  customer: 'Cliente fictício',
  value,
  date,
  cancelled: false,
});
describe('pontuação demonstrativa dos embaixadores', () => {
  it('soma frações antes de atribuir um ponto por mil reais e arredonda comissão em centavos', () => {
    expect(
      ambassadorTotals(
        person,
        [sale('1', 50000), sale('2', 50000), sale('3', 1)],
        '2026-10',
        'month',
      ),
    ).toEqual({ value: 100001, points: 1, commission: 5000, count: 3 });
  });
  it('não soma cancelamentos, outra empresa, outro embaixador nem valores inválidos', () => {
    const sales = [
      sale('1', 100000),
      { ...sale('2', 100000), cancelled: true },
      { ...sale('3', 100000), companyId: 'two' },
      { ...sale('4', 100000), ambassadorId: 'b' },
      sale('5', -100),
      sale('6', NaN),
    ];
    expect(ambassadorTotals(person, sales, '2026-10', 'month').points).toBe(1);
  });
  it('trimestre e semestre seguem o calendário e não misturam anos', () => {
    const sales = [
      sale('1', 100000, '2026-07-01'),
      sale('2', 100000, '2026-10-01'),
      sale('3', 100000, '2026-12-31'),
      sale('4', 100000, '2025-10-01'),
    ];
    expect(ambassadorTotals(person, sales, '2026-10', 'month').points).toBe(1);
    expect(ambassadorTotals(person, sales, '2026-10', 'quarter').points).toBe(2);
    expect(ambassadorTotals(person, sales, '2026-10', 'semester').points).toBe(3);
    expect(ambassadorTotals(person, sales, '', 'month').value).toBe(0);
  });
});
