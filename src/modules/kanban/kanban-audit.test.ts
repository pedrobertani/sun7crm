import { describe, expect, it } from 'vitest';
import { visibleKanbanRows } from './page-size';
import { initialKanbanPeriod, kanbanDateRange, matchesKanbanPeriod } from './period-filter';

describe('Kanban: paginação por etapa e carga elevada', () => {
  const cards = Array.from({ length: 305 }, (_, index) => ({ id: index + 1 }));

  it('mantém 10, 50 e 100 cards por etapa, sem descartar os seguintes', () => {
    expect(visibleKanbanRows(cards, 10).rows).toHaveLength(10);
    expect(visibleKanbanRows(cards, 50).rows).toHaveLength(50);
    expect(visibleKanbanRows(cards, 100).rows).toHaveLength(100);
    expect(visibleKanbanRows(cards, 10, 1).rows[0].id).toBe(11);
    expect(visibleKanbanRows(cards, 50, 1).rows[0].id).toBe(51);
  });

  it('exibe todos os 305 registros ao selecionar Todos', () => {
    const all = visibleKanbanRows(cards, 'all', 99);
    expect(all.total).toBe(305);
    expect(all.rows).toHaveLength(305);
    expect(all.page).toBe(0);
  });

  it('ajusta automaticamente páginas fora do limite após movimentação ou filtro', () => {
    const last = visibleKanbanRows(cards, 100, 8);
    expect(last.page).toBe(3);
    expect(last.rows.map((card) => card.id)).toEqual([301, 302, 303, 304, 305]);
    expect(visibleKanbanRows(cards.slice(0, 12), 10, 12).page).toBe(1);
  });
});

describe('Kanban: filtro temporal inclusivo por dia de criação', () => {
  it('não restringe cards quando o modo é Todas as datas', () => {
    expect(matchesKanbanPeriod('2025-01-01T00:00:00Z', initialKanbanPeriod())).toBe(true);
  });

  it('inclui todo o último dia do intervalo mas exclui o seguinte', () => {
    const filter = { ...initialKanbanPeriod(), mode: 'custom' as const, from: '2026-10-01', to: '2026-10-29' };
    expect(matchesKanbanPeriod(new Date(2026, 9, 29, 23, 59, 59).toISOString(), filter)).toBe(true);
    expect(matchesKanbanPeriod(new Date(2026, 9, 30, 0, 0, 0).toISOString(), filter)).toBe(false);
  });

  it('rejeita intervalo invertido ou data inválida', () => {
    const initial = initialKanbanPeriod();
    expect(kanbanDateRange({ ...initial, mode: 'custom', from: '2026-10-30', to: '2026-10-29' })).toBeNull();
    expect(kanbanDateRange({ ...initial, mode: 'custom', from: '2026-02-30', to: '2026-03-01' })).toBeNull();
  });
});
