import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { filterCompanies, inPeriod, readPeriod } from './filters';
describe('filtros dos atalhos do dashboard', () => {
  const companies = createSeed().companies.map((c, i) => ({
    ...c,
    createdAt: '2026-10-01',
    dueDate: ['2026-10-22', '2026-10-29', '2026-10-30', '2026-10-21', '2026-10-25'][i],
    enabled: i !== 4,
  }));
  it('inclui hoje e D+7, sem empresas inativas ou D+8', () => {
    expect(
      filterCompanies(companies, 'upcoming', '2026-10-01', '2026-10-22').map((c) => c.id),
    ).toEqual(['aurora', 'casa']);
  });
  it('preserva o filtro de carteira quando o card adiciona outro critério', () => {
    const base = filterCompanies(companies, 'overdue', '2026-10-01', '2026-10-22');
    expect(filterCompanies(base, 'active', '2026-10-01', '2026-10-22').map((c) => c.id)).toEqual([
      'lumina',
    ]);
    expect(filterCompanies(base, 'upcoming', '2026-10-01', '2026-10-22')).toHaveLength(0);
  });
  it('respeita o período inclusivo dos cadastros e ignora datas futuras', () => {
    expect(
      inPeriod('2026-10-22', readPeriod(new URLSearchParams('de=2026-10-01&ate=2026-10-22'))),
    ).toBe(true);
    expect(
      inPeriod('2026-10-23', readPeriod(new URLSearchParams('de=2026-10-01&ate=2026-10-22'))),
    ).toBe(false);
    expect(
      filterCompanies(
        [{ ...companies[0], createdAt: '2026-10-23' }],
        'new',
        '2026-10-01',
        '2026-10-22',
      ),
    ).toHaveLength(0);
  });
  it('não aplica datas malformadas na navegação direta', () => {
    expect(readPeriod(new URLSearchParams('de=abc&ate=errado'))).toEqual({ from: '', to: '' });
  });
});
