import { Link } from 'react-router-dom';
import { Input } from './ui/input';
import type { ReactNode } from 'react';
import { Search, Plus } from 'lucide-react';
import { Button } from './ui/button';
import type { Temperature } from '../domain/types';
import { temperatureLabels } from '../domain/config';
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="desc">{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={'card panel ' + className}>
      <div className="section-bar">
        <div>
          <h2>{title}</h2>
          {description && <p className="panel-sub">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Kpi({
  label,
  value,
  foot,
  icon,
  tone = '',
  to,
}: {
  label: string;
  value: ReactNode;
  foot: string;
  icon: ReactNode;
  tone?: string;
  to?: string;
}) {
  return (
    <div className={'card kpi ' + tone}>
      <div className="kpi-top">
        <span>{label}</span>
        {to ? (
          <Link to={to} className="kpi-shortcut" aria-label={'Ver ' + label} title={'Ver ' + label}>
            {icon}
          </Link>
        ) : (
          <span className="kpi-icon">{icon}</span>
        )}
      </div>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-foot">{foot}</span>
    </div>
  );
}

export function AppliedFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="applied-filter">
      <span>{label}</span>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Limpar filtros
      </Button>
    </div>
  );
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Plus />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <Search size={17} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
export function TemperatureBadge({ value }: { value: Temperature }) {
  return (
    <span className={'badge temperature ' + value}>
      <i />
      {temperatureLabels[value]}
    </span>
  );
}
export function FormError({ message }: { message: string }) {
  return message ? (
    <div className="form-error" role="alert">
      {message}
    </div>
  ) : null;
}
export function FormActions({
  onCancel,
  label = 'Salvar',
}: {
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="form-actions">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit">{label}</Button>
    </div>
  );
}
