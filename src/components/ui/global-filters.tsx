import { useId, useState, type ReactNode } from 'react';
import { ListFilter, X } from 'lucide-react';
import { Button } from './button';
import { Modal } from './modal';
import { SearchInput } from '../shared';
import './global-filters.css';

export interface FilterOption {
  value: string;
  label: string;
}
export interface FilterField {
  /** Identificador único da regra de filtragem: separado dos nomes apresentados. */
  key: string;
  label: string;
  type: 'select' | 'multi-select' | 'date' | 'month' | 'number' | 'text';
  defaultValue: string;
  options?: readonly FilterOption[];
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: number;
  /** Oculta um filtro sem perder seu estado (ex.: situação só na aba de recebíveis). */
  visible?: boolean;
  /** Mantém um contexto importante visível (ex.: mês atual), sem contar como filtro ativo. */
  pin?: boolean;
  /** Regra declarativa: mostra o campo somente quando outro filtro assume os valores indicados. */
  when?: {key: string; values: readonly string[]};
}
export type FilterValues = Record<string, string>;
export function filterSelectedValues(value:string,max=30):string[] {
  try {
    const parsed:unknown=JSON.parse(value);
    return Array.isArray(parsed)&&parsed.length<=max
      &&parsed.every(x=>typeof x==='string'&&x.length<=100)
      ? [...new Set(parsed)] : [];
  }catch{return [];}
}
export function toggleFilterSelection(value:string,id:string):string {
  const selected=filterSelectedValues(value);
  if(!selected.includes(id)&&selected.length>=30) return JSON.stringify(selected);
  return JSON.stringify(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]);
}


export function resetFilterValues(fields: readonly FilterField[]): FilterValues {
  return Object.fromEntries(fields.map(field => [field.key, field.defaultValue]));
}
export function filterFieldVisible(field:FilterField, values:FilterValues):boolean {
  return field.visible!==false && (!field.when || field.when.values.includes(values[field.when.key] ?? ''));
}
export function activeFilterFields(fields: readonly FilterField[], values: FilterValues): FilterField[] {
  return fields.filter(field => filterFieldVisible(field,values)
    && (values[field.key] ?? field.defaultValue) !== field.defaultValue);
}
export function filterValueLabel(field: FilterField, value: string): string {
  if (field.type === 'select') return field.options?.find(option => option.value === value)?.label ?? value;
  if (field.type === 'multi-select') {
    const ids=filterSelectedValues(value);
    const labels=ids.map(id=>field.options?.find(o=>o.value===id)?.label||id);
    return labels.length<=2 ? labels.join(', ') : labels.slice(0,2).join(', ')+' +'+(labels.length-2);
  }
  if (field.type === 'month' && /^\d{4}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(value + '-01T12:00:00Z'));
  }
  if (field.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return day + '/' + month + '/' + year;
  }
  return value;
}
export function patchFilterValues(
  fields: readonly FilterField[], current: FilterValues, patch: FilterValues,
): FilterValues {
  const allowed = new Set(fields.map(field => field.key));
  const next = {...current};
  for (const [key,value] of Object.entries(patch)) if (allowed.has(key)) next[key] = value;
  return next;
}

export function GlobalFilters({
  fields, values, onApply, search, actions, validate, label = 'Filtros', className = '', children,
}: {
  fields: readonly FilterField[];
  values: FilterValues;
  onApply: (values: FilterValues) => void;
  search?: {value: string; onChange: (value: string) => void; placeholder?: string};
  actions?: ReactNode;
  validate?: (values: FilterValues) => string | null;
  label?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [open,setOpen] = useState(false);
  const [draft,setDraft] = useState<FilterValues>({});
  const [optionSearch,setOptionSearch]=useState<Record<string,string>>({});
  const instance = useId();
  const available = fields.filter(f => filterFieldVisible(f,draft));
  const active = activeFilterFields(fields,values);
  const pinned = fields.filter(field=>field.pin && filterFieldVisible(field,values)
    && !active.includes(field) && !!(values[field.key] ?? field.defaultValue));
  const issue = validate?.(patchFilterValues(fields,values,draft)) || null;
  const defaults = () => resetFilterValues(fields);
  const openPanel = () => { setDraft({...defaults(),...values}); setOptionSearch({}); setOpen(true); };
  const clearAll = () => onApply(patchFilterValues(fields,values,defaults()));
  const updateField = (key:string,value:string) => setDraft(prev => ({...prev,[key]:value}));
  return <div className={'global-filters '+className}>
    <div className="global-filters-bar">
      {search && <SearchInput value={search.value} onChange={search.onChange}
        placeholder={search.placeholder || 'Buscar...'} />}
      {fields.some(field=>field.visible!==false) && <Button type="button" variant="outline"
        className="global-filters-trigger" aria-label={active.length ? label + ', ' + active.length + ' ativos' : label}
        aria-haspopup="dialog" onClick={openPanel}>
        <ListFilter size={18} aria-hidden="true"/>{label}
        {active.length>0 && <span className="global-filters-count" aria-label={active.length+' filtros ativos'}>{active.length}</span>}
      </Button>}
      {actions && <div className="global-filters-actions">{actions}</div>}
      {children}
    </div>
    {(active.length>0 || pinned.length>0) && <div className="global-filters-active" aria-label="Resumo dos filtros">
      {pinned.map(field=><span className="global-filter-context" key={field.key}>
        {field.label}: {filterValueLabel(field,values[field.key] ?? field.defaultValue)}
      </span>)}
      {active.map(field => <Button key={field.key} type="button" variant="outline" size="sm"
        className="global-filter-chip" aria-label={'Remover filtro '+field.label}
        onClick={() => onApply(patchFilterValues(fields,values,{[field.key]:field.defaultValue}))}>
        {field.label}: {filterValueLabel(field,values[field.key] ?? field.defaultValue)}
        <X size={13} aria-hidden="true"/>
      </Button>)}
      {active.length>0 &&
        <Button type="button" variant="link" size="sm" onClick={clearAll}>Limpar filtros</Button>}
    </div>}
    <Modal open={open} onOpenChange={setOpen} title={label} presentation="filters"
      description="Escolha os critérios e aplique à visualização.">
      <form className="global-filters-form" onSubmit={e=>{
        e.preventDefault();
        if (issue) return;
        onApply(patchFilterValues(fields,values,draft));
        setOpen(false);
      }}>
        <div className="global-filters-fields">
          {available.map(field => {
            const id=instance+'-'+field.key.replace(/[^\w-]/g,'-');
            if(field.type==='multi-select'){
              const checked=filterSelectedValues(draft[field.key] ?? field.defaultValue);
              const query=(optionSearch[field.key]||'').trim().toLocaleLowerCase('pt-BR');
              const options=(field.options||[]).filter(option=>
                option.label.toLocaleLowerCase('pt-BR').includes(query));
              return <fieldset key={field.key} className="global-filter-multiselect">
                <legend>{field.label} ({checked.length} selecionadas)</legend>
                {(field.options||[]).length>8 && <input type="search"
                  aria-label={'Buscar em '+field.label} placeholder={'Buscar em '+field.label}
                  value={optionSearch[field.key]||''}
                  onChange={e=>setOptionSearch(old=>({...old,[field.key]:e.target.value}))}/>}
                <div className="global-filter-options" role="group" aria-label={field.label}>
                  {options.slice(0,80).map(option=><label key={option.value} className="global-filter-option">
                    <input type="checkbox" checked={checked.includes(option.value)}
                      onChange={()=>updateField(field.key,
                        toggleFilterSelection(draft[field.key] ?? field.defaultValue,option.value))}/>
                    <span>{option.label}</span>
                  </label>)}
                  {options.length===0 && <span className="small-note">Nenhuma opção encontrada.</span>}
                  {options.length>80 && <span className="small-note">Refine a busca para encontrar mais opções.</span>}
                </div>
              </fieldset>;
            }
            return <label className="form-row" key={field.key} htmlFor={id}>
              {field.label}
              {field.type==='select' ? <select id={id} value={draft[field.key] ?? field.defaultValue}
                onChange={e=>updateField(field.key,e.target.value)}>
                {(field.options||[]).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
              </select> : <input id={id} type={field.type} value={draft[field.key] ?? field.defaultValue}
                placeholder={field.placeholder} min={field.min} max={field.max} step={field.step}
                onChange={e=>updateField(field.key,e.target.value)}/>}
            </label>;
          })}
        </div>
        {issue && <p className="global-filters-error" role="alert">{issue}</p>}
        <div className="global-filters-footer">
          <Button type="button" variant="outline" onClick={()=>setDraft(defaults())}>Limpar tudo</Button>
          <Button type="submit" disabled={!!issue}>Aplicar filtros</Button>
        </div>
      </form>
    </Modal>
  </div>;
}
