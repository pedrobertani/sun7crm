import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GlobalFilters, activeFilterFields, filterValueLabel, patchFilterValues,
  resetFilterValues, type FilterField } from './global-filters';

const fields: FilterField[] = [
  {key:'month',label:'Mês de referência',type:'month',defaultValue:'2026-11'},
  {key:'seller',label:'Vendedor',type:'select',defaultValue:'all',
    options:[{value:'all',label:'Todos'},{value:'ana',label:'Ana'}]},
  {key:'method',label:'Forma de pagamento',type:'select',defaultValue:'all',
    options:[{value:'all',label:'Todas'},{value:'pix',label:'Pix'}]},
  {key:'from',label:'Início',type:'date',defaultValue:''},
  {key:'to',label:'Fim',type:'date',defaultValue:''},
];

describe('GlobalFilters, o mesmo componente para todo o CRM', () => {
  it('recebe parâmetros por chave e retorna valores padrão sem modificar o schema', () => {
    expect(resetFilterValues(fields)).toEqual({
      month:'2026-11',seller:'all',method:'all',from:'',to:'',
    });
    expect(fields[1].defaultValue).toBe('all');
    expect(activeFilterFields(fields, resetFilterValues(fields))).toHaveLength(0);
  });
  it('conta cada filtro ativo uma só vez e permite remover individualmente', () => {
    const values={month:'2026-11',seller:'ana',method:'pix',from:'2026-11-01',to:''};
    expect(activeFilterFields(fields,values).map(field=>field.key)).toEqual(['seller','method','from']);
    expect(patchFilterValues(fields,values,{seller:'all'})).toEqual({...values,seller:'all'});
    expect(activeFilterFields(fields,patchFilterValues(fields,values,{seller:'all'})).map(f=>f.key))
      .toEqual(['method','from']);
    expect(patchFilterValues(fields,values,resetFilterValues(fields))).toEqual(resetFilterValues(fields));
  });
  it('não permite que campos desconhecidos ou parâmetros externos sejam sobrescritos', () => {
    const current={seller:'ana',month:'2026-11',external:'preserved'};
    expect(patchFilterValues(fields,current,{seller:'all',unknown:'unsafe',external:'deleted'}))
      .toEqual({seller:'all',month:'2026-11',external:'preserved'});
  });
  it('não conta campos ocultos, mas preserva seus valores ao alternar abas', () => {
    const hidden=[...fields,{key:'status',label:'Situação',type:'select',
      defaultValue:'all',visible:false,options:[{value:'all',label:'Todas'}]}] as FilterField[];
    const values={...resetFilterValues(fields),status:'pendente'};
    expect(activeFilterFields(hidden,values)).toHaveLength(0);
    const shown=hidden.map(field=>field.key==='status'?{...field,visible:true}:field);
    expect(activeFilterFields(shown,values).map(field=>field.key)).toEqual(['status']);
  });
  it('exibe rótulos legíveis para valores selecionados e datas', () => {
    expect(filterValueLabel(fields[1],'ana')).toBe('Ana');
    expect(filterValueLabel(fields[0],'2026-11')).toContain('2026');
    expect(filterValueLabel(fields[3],'2026-11-05')).toBe('05/11/2026');
    expect(filterValueLabel(fields[2],'missing')).toBe('missing');
  });
  it('renderiza uma busca e um botão de filtro com contador, sem campos sempre abertos', () => {
    const html=renderToStaticMarkup(<GlobalFilters fields={fields}
      values={{...resetFilterValues(fields),seller:'ana',method:'pix'}}
      onApply={()=>{}} search={{value:'',onChange:()=>{},placeholder:'Buscar cliente'}} />);
    expect(html).toContain('Buscar cliente');
    expect(html).toContain('Filtros, 2 ativos');
    expect(html).toContain('aria-label="Remover filtro Vendedor"');
    expect(html).toContain('aria-label="Remover filtro Forma de pagamento"');
    expect(html).toContain('Limpar filtros');
    expect(html).not.toContain('<select');
  });
  it('não mostra contador nem chips de filtros no estado inicial', () => {
    const html=renderToStaticMarkup(<GlobalFilters fields={fields}
      values={resetFilterValues(fields)} onApply={()=>{}} />);
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('global-filters-count');
    expect(html).not.toContain('Remover filtro');
    expect(html).not.toContain('Limpar filtros');
  });
  it('continua acessível quando a tela só precisa de busca e não de filtros avançados', () => {
    const html=renderToStaticMarkup(<GlobalFilters fields={[]} values={{}}
      onApply={()=>{}} search={{value:'ana',onChange:()=>{}}}/>);
    expect(html).toContain('value="ana"');
    expect(html).not.toContain('aria-haspopup="dialog"');
  });
});
