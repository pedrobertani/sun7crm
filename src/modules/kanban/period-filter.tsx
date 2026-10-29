import type { ChangeEvent } from 'react';
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
    <div className="kanban-period-filter">
      <label className="kanban-filter-field">
        Período
        <select aria-label="Período de criação dos cards" value={value.mode}
          onChange={(event) => set({ mode: event.target.value as KanbanPeriodMode })}>
          <option value="all">Todo o período</option>
          <option value="day">Dia</option>
          <option value="month">Mês</option>
          <option value="year">Ano</option>
          <option value="custom">Intervalo</option>
        </select>
      </label>
      {value.mode === 'day' && <label className="kanban-filter-field">Data{input('date', 'day', 'Selecionar dia')}</label>}
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
