import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import type { Page } from '../../data/backend';
import { errorMessage } from './operational';

export interface Choice {
  id: string;
  label: string;
  detail?: string;
  color?: string;
  disabled?: boolean;
}
export function RecordPicker({
  label,
  items = [],
  value,
  onChange,
  multiple = false,
  max,
  load,
  onCreate,
  createLabel = 'Cadastrar novo',
  disabled = false,
}: {
  label: string;
  items?: Choice[];
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  max?: number;
  load?: (search: string, page: number) => Promise<Page<Choice>>;
  onCreate?: (search: string) => void;
  createLabel?: string;
  disabled?: boolean;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null),
    results = useRef<HTMLDivElement>(null),
    loader = useRef(load);
  loader.current = load;
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [remote, setRemote] = useState<Choice[]>([]),
    [selectedCache, setSelectedCache] = useState<Choice[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [side, setSide] = useState<'top' | 'bottom'>('bottom');
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (!open || !loader.current) return;
    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      void loader.current!(query, page)
        .then((r) => {
          if (active) {
            setRemote((old) =>
              page ? [...old, ...r.rows.filter((n) => !old.some((i) => i.id === n.id))] : r.rows,
            );
            setMore(r.hasMore);
          }
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query, page]);
  const available = [...items, ...remote, ...selectedCache];
  const all = available.filter(
      (item, index) => available.findIndex((i) => i.id === item.id) === index,
    ),
    chosen = all.filter((i) => value.includes(i.id));
  const matches = load
    ? remote
    : items.filter((i) =>
        `${i.label} ${i.detail || ''}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase()
          .includes(
            query
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLocaleLowerCase(),
          ),
      );
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function toggle(item: Choice) {
    if (item.disabled && !value.includes(item.id)) return;
    setSelectedCache((old) => [...old.filter((i) => i.id !== item.id), item]);
    if (multiple) {
      if (value.includes(item.id)) onChange(value.filter((v) => v !== item.id));
      else if (!max || value.length < max) onChange([...value, item.id]);
    } else {
      onChange([item.id]);
      close();
    }
  }
  function expand() {
    const b = trigger.current?.getBoundingClientRect(),
      bounds = trigger.current?.closest('.dialog-body')?.getBoundingClientRect();
    if (b) {
      const below = Math.min(window.innerHeight, bounds?.bottom || window.innerHeight) - b.bottom;
      setSide(below < 250 && b.top - (bounds?.top || 0) > below ? 'top' : 'bottom');
    }
    setQuery('');
    setPage(0);
    setRemote([]);
    setMore(false);
    setLoading(!!load);
    setOpen(!open);
  }
  return (
    <div
      className="contact-picker form-row"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
    >
      <label id={id + '-label'} htmlFor={id + '-trigger'}>
        {label}
        {max && <small className="muted"> · até {max}</small>}
      </label>
      <div className="contact-picker-anchor">
        <button
          ref={trigger}
          id={id + '-trigger'}
          type="button"
          role="combobox"
          aria-labelledby={id + '-label'}
          aria-expanded={open}
          aria-controls={open ? id + '-list' : undefined}
          aria-haspopup="listbox"
          className="contact-picker-trigger"
          disabled={disabled}
          onClick={expand}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              expand();
            }
          }}
        >
          <span className={value.length ? '' : 'muted'}>
            {multiple
              ? value.length
                ? `${value.length} ${value.length === 1 ? 'selecionado' : 'selecionados'}`
                : 'Selecione'
              : chosen[0]?.label || 'Selecione'}
          </span>
          <ChevronDown size={16} />
        </button>
        {open && (
          <div className="contact-picker-popup" data-side={side}>
            <div className="contact-picker-search">
              <Search size={16} />
              <input
                ref={search}
                aria-label={'Buscar ' + label.toLocaleLowerCase()}
                placeholder="Buscar..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                  setRemote([]);
                  setMore(false);
                  setLoading(!!load);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    results.current
                      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
                      ?.focus();
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches[0]) toggle(matches[0]);
                  }
                }}
              />
            </div>
            {onCreate && (
              <button
                className="contact-picker-create"
                type="button"
                disabled={!!max && value.length >= max}
                onClick={() => {
                  close();
                  onCreate(query);
                }}
              >
                <Plus size={16} />
                {createLabel}
              </button>
            )}
            {!multiple && value.length > 0 && (
              <button
                type="button"
                className="contact-picker-create"
                onClick={() => {
                  onChange([]);
                  close();
                }}
              >
                Limpar seleção
              </button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div
              className="contact-picker-results"
              id={id + '-list'}
              role="listbox"
              aria-label={label}
              aria-multiselectable={multiple || undefined}
              ref={results}
              onKeyDown={(e) => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
                e.preventDefault();
                const buttons = Array.from(
                    results.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ||
                      [],
                  ),
                  index = buttons.indexOf(document.activeElement as HTMLButtonElement),
                  next =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? buttons.length - 1
                        : e.key === 'ArrowDown'
                          ? (index + 1) % buttons.length
                          : (index - 1 + buttons.length) % buttons.length;
                buttons[next]?.focus();
              }}
            >
              {matches.map((i) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value.includes(i.id)}
                  disabled={
                    (i.disabled && !value.includes(i.id)) ||
                    (!value.includes(i.id) && !!max && value.length >= max)
                  }
                  className="contact-picker-option"
                  key={i.id}
                  onClick={() => toggle(i)}
                >
                  {multiple && (
                    <span
                      className={'catalog-check ' + (value.includes(i.id) ? 'is-selected' : '')}
                      aria-hidden="true"
                    >
                      {value.includes(i.id) && <Check size={12} />}
                    </span>
                  )}
                  {i.color && <i className="label-color-dot" style={{ background: i.color }} />}
                  <span>
                    {i.label}
                    {i.detail && <small className="catalog-item-kind">{i.detail}</small>}
                  </span>
                </button>
              ))}
              {!matches.length && !loading && !error && (
                <p className="contact-picker-empty">Nenhum registro encontrado.</p>
              )}
            </div>
            {loading && (
              <p className="contact-picker-empty" role="status">
                Buscando...
              </p>
            )}
            {load && more && !loading && (
              <button
                type="button"
                className="contact-picker-create"
                onClick={() => setPage((p) => p + 1)}
              >
                Carregar mais resultados
              </button>
            )}
            {multiple && (
              <div className="catalog-picker-summary">
                <span>
                  {value.length}
                  {max ? ` de ${max}` : ''} selecionados
                </span>
                <button type="button" onClick={close}>
                  Concluir
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {multiple && chosen.length > 0 && (
        <div className="catalog-selection">
          {chosen.map((i) => (
            <span className="catalog-selection-chip" key={i.id}>
              {i.color && <i className="label-color-dot" style={{ background: i.color }} />}
              {i.label}
              <button
                type="button"
                aria-label={'Remover ' + i.label}
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== i.id))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
