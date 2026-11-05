import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KanbanSizeControl, visibleKanbanRows } from './page-size';
import { PAGE_SIZES } from '../../components/ui/pagination';

describe('Paginação limitada dos cards por etapa', () => {
  it('oferece apenas valores finitos e compartilha as opções das tabelas', () => {
    const html = renderToStaticMarkup(<KanbanSizeControl size={10} onChange={() => {}} />);
    expect(PAGE_SIZES).toEqual([10,25,50,100]);
    for (const option of PAGE_SIZES) {
      expect(html).toContain(`value="${option}"`);
    }
    expect(html).not.toContain('value="all"');
    expect(html).not.toContain('>Todos</option>');
    expect(html).toContain('Cards por etapa');
  });
  it('não retorna todos os 305 cards em uma única página', () => {
    const cards = Array.from({ length: 305 }, (_, n) => ({ id: n + 1, etapa: 'Fechado' }));
    expect(visibleKanbanRows(cards, 10).rows).toEqual(cards.slice(0, 10));
    expect(visibleKanbanRows(cards, 25, 2).rows).toEqual(cards.slice(50, 75));
    expect(visibleKanbanRows(cards, 50, 1).rows).toEqual(cards.slice(50, 100));
    expect(visibleKanbanRows(cards, 100, 3)).toEqual({rows:cards.slice(300,305), page:3,total:305});
    expect(visibleKanbanRows(cards, 100, 0).rows).toHaveLength(100);
  });
  it('ajusta índices inválidos e respeita etapas vazias', () => {
    const cards = Array.from({ length: 17 }, (_, n) => n);
    expect(visibleKanbanRows(cards, 10, 99)).toEqual({ rows: cards.slice(10), page: 1, total: 17 });
    expect(visibleKanbanRows(cards, 10, -3)).toEqual({ rows: cards.slice(0, 10), page: 0, total: 17 });
    expect(visibleKanbanRows([], 50, 2)).toEqual({ rows: [], page: 0, total: 0 });
  });
  it('seleciona um tamanho válido sem precisar de Todos', () => {
    const html=renderToStaticMarkup(<KanbanSizeControl size={50} onChange={()=>{}}/>);
    expect(html).toContain('value="50" selected=""');
    expect(html).not.toContain('value="all"');
  });
});
