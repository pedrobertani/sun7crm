import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KanbanSizeControl, visibleKanbanRows } from './page-size';

describe('Limite seguro de cards por etapa', () => {
  it('oferece apenas 10, 25, 50 e 100 sem opção ilimitada', () => {
    const html=renderToStaticMarkup(<KanbanSizeControl size={10} onChange={()=>{}}/>);
    for(const n of [10,25,50,100]) expect(html).toContain('value="'+n+'"');
    expect(html).not.toContain('value="all"');
    expect(html).not.toContain('>Todos</option>');
    expect(html).toContain('Cards por etapa');
  });
  it('respeita o tamanho de cada página inclusive para grandes listas',()=>{
    const cards=Array.from({length:305},(_,n)=>({id:n+1,etapa:'Fechado'}));
    expect(visibleKanbanRows(cards,10).rows).toEqual(cards.slice(0,10));
    expect(visibleKanbanRows(cards,25,1).rows).toEqual(cards.slice(25,50));
    expect(visibleKanbanRows(cards,50,1).rows).toEqual(cards.slice(50,100));
    expect(visibleKanbanRows(cards,100,3)).toEqual({rows:cards.slice(300,305),page:3,total:305});
    expect(visibleKanbanRows(cards,100,0).rows).toHaveLength(100);
  });
  it('limita páginas inexistentes e suporta etapas vazias',()=>{
    const rows=Array.from({length:17},(_,n)=>n);
    expect(visibleKanbanRows(rows,10,99)).toEqual({rows:rows.slice(10),page:1,total:17});
    expect(visibleKanbanRows(rows,10,-3)).toEqual({rows:rows.slice(0,10),page:0,total:17});
    expect(visibleKanbanRows([],50,2)).toEqual({rows:[],page:0,total:0});
  });
});
