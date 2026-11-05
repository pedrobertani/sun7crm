import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PAGE_SIZES, Pagination, paginatedRows } from './pagination';

describe('Paginação global segura', () => {
  it('expõe apenas tamanhos 10, 25, 50 e 100, nunca Todos', () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
    const html=renderToStaticMarkup(
      <Pagination page={0} total={50000} size={10}
        onChange={()=>{}} onSizeChange={()=>{}} label="contatos" />,
    );
    for(const size of PAGE_SIZES) expect(html).toContain('value="'+size+'"');
    expect(html).not.toContain('value="all"');
  });
  it('mantém 10 como limite de segurança para tamanho inválido', () => {
    const rows=Array.from({length:305},(_,i)=>i+1);
    expect(paginatedRows(rows,0,999999)).toEqual(rows.slice(0,10));
    expect(paginatedRows(rows,0,Infinity)).toEqual(rows.slice(0,10));
    expect(paginatedRows(rows,0,0)).toEqual(rows.slice(0,10));
  });
  it('não ultrapassa o fim da página e respeita 100 como máximo permitido', () => {
    const rows=Array.from({length:305},(_,i)=>i+1);
    expect(paginatedRows(rows,3,100)).toEqual(rows.slice(300,305));
    expect(paginatedRows(rows,200,100)).toEqual(rows.slice(300,305));
    expect(paginatedRows(rows,1,25)).toEqual(rows.slice(25,50));
  });
});
