import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KanbanSizeControl, visibleKanbanRows } from './page-size';

describe('Quantidade de cards por etapa', () => {
  it('oferece as quatro opções sem mudar a paginação de outras tabelas', () => {
    const html = renderToStaticMarkup(<KanbanSizeControl size={10} onChange={() => {}} />);
    for (const option of ['10', '50', '100']) {
      expect(html).toContain(`value="${option}"`);
    }
    expect(html).toContain('value="all"');
    expect(html).toContain('Todos');
    expect(html).toContain('Cards por etapa');
  });
  it('mostra 10, 50, 100 ou os 305 cards completos, sem truncar Todos', () => {
    const cards = Array.from({ length: 305 }, (_, n) => ({ id: n + 1, etapa: 'Fechado' }));
    expect(visibleKanbanRows(cards, 10).rows).toEqual(cards.slice(0, 10));
    expect(visibleKanbanRows(cards, 50, 1).rows).toEqual(cards.slice(50, 100));
    expect(visibleKanbanRows(cards, 100, 3).rows).toEqual(cards.slice(300, 305));
    expect(visibleKanbanRows(cards, 'all', 99)).toEqual({ rows: cards, page: 0, total: 305 });
  });
  it('limita índices fora das páginas válidas e suporta etapas vazias', () => {
    const cards = Array.from({ length: 17 }, (_, n) => n);
    expect(visibleKanbanRows(cards, 10, 99)).toEqual({ rows: cards.slice(10), page: 1, total: 17 });
    expect(visibleKanbanRows(cards, 10, -3)).toEqual({ rows: cards.slice(0, 10), page: 0, total: 17 });
    expect(visibleKanbanRows([], 'all', 0)).toEqual({ rows: [], page: 0, total: 0 });
    expect(visibleKanbanRows([], 50, 2)).toEqual({ rows: [], page: 0, total: 0 });
  });
  it('marca Todos como opção selecionada ao carregar todos os cards', () => {
    const html = renderToStaticMarkup(<KanbanSizeControl size="all" onChange={() => {}} />);
    expect(html).toContain('value="all" selected=""');
  });
});
