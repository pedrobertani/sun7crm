import type { ChangeEvent } from 'react';
import { GlobalFilters, type FilterValues } from '../../components/ui/global-filters';
import './period-filter.css';

export type KanbanPeriodMode = 'all' | 'day' | 'month' | 'year' | 'custom';
export interface KanbanPeriod {
  mode: KanbanPeriodMode;
  day: string;
  month: string;
  year: string;
  from: string;
  to: string;
}
export interface KanbanDateRange { from: string; until: string }

function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function initialKanbanPeriod(date = new Date()): KanbanPeriod {
  const today = localDate(date);
  return {
    mode: 'all', day: today, month: today.slice(0, 7), year: today.slice(0, 4),
    from: today, to: today,
  };
}

function validDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day
    ? result : null;
}

/** A half-open range prevents the last day of the month from losing late-evening cards. */
export function kanbanDateRange(filter: KanbanPeriod): KanbanDateRange | null {
  if (filter.mode === 'all') return null;
  let start: Date;
  let end: Date;
  if (filter.mode === 'day') {
    const day = validDay(filter.day);
    if (!day) return null;
    start = day;
    end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  } else if (filter.mode === 'month') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(filter.month)) return null;
    const [year, month] = filter.month.split('-').map(Number);
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 1);
  } else if (filter.mode === 'year') {
    if (!/^\d{4}$/.test(filter.year)) return null;
    const year = Number(filter.year);
    if (year < 1900 || year > 2200) return null;
    start = new Date(year, 0, 1);
    end = new Date(year + 1, 0, 1);
  } else {
    const from = validDay(filter.from);
    const to = validDay(filter.to);
    if (!from || !to || from.getTime() > to.getTime()) return null;
    start = from;
    end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  }
  return { from: start.toISOString(), until: end.toISOString() };
}

export function matchesKanbanPeriod(date: string, filter: KanbanPeriod): boolean {
  if (filter.mode === 'all') return true;
  const range = kanbanDateRange(filter);
  if (!range) return false;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) &&
    timestamp >= Date.parse(range.from) && timestamp < Date.parse(range.until);
}

export function KanbanPeriodFilter({
  value, onChange,
}: {
  value: KanbanPeriod;
  onChange: (filter: KanbanPeriod) => void;
}) {
  const set = (patch: Partial<KanbanPeriod>) => onChange({ ...value, ...patch });
  const valid = value.mode === 'all' || kanbanDateRange(value) !== null;
  const input = (type: string, field: 'day' | 'month' | 'year' | 'from' | 'to', label: string) => (
    <input
      type={type}
      aria-label={label}
      value={value[field]}
      min={type === 'number' ? '1900' : undefined}
      max={type === 'number' ? '2200' : undefined}
      onChange={(event: ChangeEvent<HTMLInputElement>) => set({ [field]: event.target.value })}
    />
  );
  return (
    <div className="kanban-period-filter" role="group" aria-label="Filtrar cards por data de criação">
      <label className="kanban-filter-field">
        Data
        <select aria-label="Tipo de filtro de data" value={value.mode}
          onChange={(event) => set({ mode: event.target.value as KanbanPeriodMode })}>
          <option value="all">Todas as datas</option>
          <option value="day">Dia</option>
          <option value="month">Mês</option>
          <option value="year">Ano</option>
          <option value="custom">Intervalo</option>
        </select>
      </label>
      {(value.mode === 'all' || value.mode === 'day') && (
        <label className="kanban-filter-field">
          Selecionar data
          <input
            type="date"
            aria-label="Escolher data do card"
            value={value.mode === 'day' ? value.day : ''}
            onChange={(event) => {
              const day = event.target.value;
              set(day ? { mode: 'day', day } : { mode: 'all' });
            }}
          />
        </label>
      )}
      {value.mode === 'month' && <label className="kanban-filter-field">Mês{input('month', 'month', 'Selecionar mês')}</label>}
      {value.mode === 'year' && <label className="kanban-filter-field">Ano{input('number', 'year', 'Selecionar ano')}</label>}
      {value.mode === 'custom' && (
        <>
          <label className="kanban-filter-field">De{input('date', 'from', 'Data inicial')}</label>
          <label className="kanban-filter-field">Até{input('date', 'to', 'Data final')}</label>
        </>
      )}
      {!valid && <span className="kanban-filter-error" role="alert">Confira as datas do filtro.</span>}
    </div>
  );
}

/** A mesma barra universal de filtros, com datas condicionais específicas do Kanban. */
export function KanbanGlobalFilters({
  value,onChange,search,onSearchChange,placeholder='Buscar no quadro',
}: {
  value:KanbanPeriod;
  onChange:(period:KanbanPeriod)=>void;
  search:string;
  onSearchChange:(search:string)=>void;
  placeholder?:string;
}) {
  const initial=initialKanbanPeriod();
  const fields = [
    {key:'mode',label:'Filtrar cards por data',type:'select' as const,defaultValue:'all',
      options:[
        {value:'all',label:'Todas as datas'},{value:'day',label:'Dia'},
        {value:'month',label:'Mês'},{value:'year',label:'Ano'},
        {value:'custom',label:'Intervalo'},
      ]},
    {key:'day',label:'Data',type:'date' as const,defaultValue:initial.day,
      when:{key:'mode',values:['day']}},
    {key:'month',label:'Mês',type:'month' as const,defaultValue:initial.month,
      when:{key:'mode',values:['month']}},
    {key:'year',label:'Ano',type:'number' as const,defaultValue:initial.year,min:1900,max:2200,step:1,
      when:{key:'mode',values:['year']}},
    {key:'from',label:'De',type:'date' as const,defaultValue:initial.from,
      when:{key:'mode',values:['custom']}},
    {key:'to',label:'Até',type:'date' as const,defaultValue:initial.to,
      when:{key:'mode',values:['custom']}},
  ];
  const asPeriod=(next:FilterValues):KanbanPeriod=>({
    ...value,mode:next.mode as KanbanPeriodMode,
    day:next.day,month:next.month,year:next.year,from:next.from,to:next.to,
  });
  return <GlobalFilters className="kanban-global-filters"
    fields={fields} values={value}
    onApply={next=>onChange(asPeriod(next))}
    validate={next=>kanbanDateRange(asPeriod(next))||next.mode==='all'
      ? null : 'Confira o período informado antes de aplicar o filtro.'}
    search={{value:search,onChange:onSearchChange,placeholder}}
  />;
}
