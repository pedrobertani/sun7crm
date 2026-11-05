import { GlobalFilters } from '../../components/ui/global-filters';
import { dateLabel } from '../../lib/format';
import './dashboard-date-controls.css';

export interface DashboardDateRange { from: string; to: string }

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** A single day is a shortcut; the filter panel configures the full inclusive range. */
export function DashboardDateControls({
  value, onChange, initial,
}: {
  value: DashboardDateRange;
  onChange: (value: DashboardDateRange) => void;
  initial: DashboardDateRange;
}) {
  const fields = [
    { key: 'from', label: 'De', type: 'date' as const, defaultValue: initial.from },
    { key: 'to', label: 'Até', type: 'date' as const, defaultValue: initial.to },
  ];
  return (
    <div className="dashboard-date-controls" role="group" aria-label="Período do dashboard">
      <GlobalFilters
        className="dashboard-date-filter"
        fields={fields}
        values={{from: value.from, to: value.to}}
        validate={(next) => !isValidDate(next.from) || !isValidDate(next.to) || next.from > next.to
          ? 'Escolha datas válidas. O início não pode ser depois do fim.'
          : null}
        onApply={(next) => onChange({ from: next.from, to: next.to })}
      />
      <label className="dashboard-day-picker" title="Selecionar um dia para filtrar o dashboard">
        <input
          type="date"
          aria-label="Selecionar dia do dashboard"
          value={value.to}
          onChange={(event) => {
            const day = event.target.value;
            if (isValidDate(day)) onChange({from: day, to: day});
          }}
        />
      </label>
      <span className="dashboard-period-label" aria-live="polite">
        {value.from === value.to
          ? 'Dia: ' + dateLabel(value.to)
          : 'Período: ' + dateLabel(value.from) + ' – ' + dateLabel(value.to)}
      </span>
    </div>
  );
}
