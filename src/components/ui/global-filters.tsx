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
  type: 'select' | 'date' | 'month' | 'number' | 'text';
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
  const instance = useId();
  const available = fields.filter(f => filterFieldVisible(f,draft));
  const active = activeFilterFields(fields,values);
  const pinned = fields.filter(field=>field.pin && filterFieldVisible(field,values)
    && !active.includes(field) && !!(values[field.key] ?? field.defaultValue));
  const issue = validate?.(patchFilterValues(fields,values,draft)) || null;
  const defaults = () => resetFilterValues(fields);
  const openPanel = () => { setDraft({...defaults(),...values}); setOpen(true); };
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
            const id = instance+'-'+field.key.replace(/[^\w-]/g,'-');
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
