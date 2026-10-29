import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  initialKanbanPeriod, kanbanDateRange, matchesKanbanPeriod,
  KanbanPeriodFilter, type KanbanPeriod,
} from './period-filter';

const base = initialKanbanPeriod(new Date(2026, 9, 29));

describe('Filtro temporal do Kanban', () => {
  it('não restringe os cards por padrão', () => {
    expect(base.mode).toBe('all');
    expect(kanbanDateRange(base)).toBe(null);
    expect(matchesKanbanPeriod('2024-01-01T00:00:00Z', base)).toBe(true);
  });

  it('aplica dia inteiro incluindo o final, excluindo o dia seguinte', () => {
    const period: KanbanPeriod = { ...base, mode: 'day', day: '2026-10-29' };
    const range = kanbanDateRange(period)!;
    expect(range.from).toBe(new Date(2026, 9, 29).toISOString());
    expect(range.until).toBe(new Date(2026, 9, 30).toISOString());
    expect(matchesKanbanPeriod(new Date(2026, 9, 29, 23, 59).toISOString(), period)).toBe(true);
    expect(matchesKanbanPeriod(range.until, period)).toBe(false);
  });

  it('respeita meses com durações diferentes e anos completos', () => {
    const month = { ...base, mode: 'month' as const, month: '2024-02' };
    expect(kanbanDateRange(month)?.until).toBe(new Date(2024, 2, 1).toISOString());
    expect(matchesKanbanPeriod(new Date(2024, 1, 29, 23, 59).toISOString(), month)).toBe(true);
    const year = { ...base, mode: 'year' as const, year: '2025' };
    expect(kanbanDateRange(year)?.from).toBe(new Date(2025, 0, 1).toISOString());
    expect(kanbanDateRange(year)?.until).toBe(new Date(2026, 0, 1).toISOString());
  });

  it('valida intervalos e preserva datas finais inclusivas', () => {
    const range = { ...base, mode: 'custom' as const, from: '2026-10-01', to: '2026-10-29' };
    expect(matchesKanbanPeriod(new Date(2026, 9, 29, 21).toISOString(), range)).toBe(true);
    expect(kanbanDateRange({ ...range, from: '2026-10-30' })).toBe(null);
    expect(matchesKanbanPeriod('2026-10-15T10:00:00Z', { ...range, from: '2026-10-30' })).toBe(false);
  });

  it('renderiza filtro de dia, mês, ano e intervalo com nome acessível', () => {
    const html = renderToStaticMarkup(<KanbanPeriodFilter value={base} onChange={() => {}} />);
    expect(html).toContain('Período de criação dos cards');
    for (const label of ['Todo o período', 'Dia', 'Mês', 'Ano', 'Intervalo']) {
      expect(html).toContain(label);
    }
    const custom = renderToStaticMarkup(
      <KanbanPeriodFilter value={{ ...base, mode: 'custom' }} onChange={() => {}} />,
    );
    expect(custom).toContain('Data inicial');
    expect(custom).toContain('Data final');
  });
});
