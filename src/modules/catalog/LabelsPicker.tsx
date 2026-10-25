import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FormError } from '../../components/shared';
import { uid } from '../../lib/format';
import { useCrm } from '../../app/context';

export function LabelsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, session, update } = useCrm();
  const manager = session.role === 'manager';
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8b5cf6');
  const [error, setError] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const [side, setSide] = useState<'top' | 'bottom'>('bottom');
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null),
    results = useRef<HTMLDivElement>(null);
  const id = useId();
  const labels = (data.labels || []).filter((l) => l.companyId === session.companyId);
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  const matches = labels.filter((l) => normalize(l.name).includes(normalize(query.trim())));
  const chosen = labels.filter((l) => value.includes(l.id));
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function outside(e: PointerEvent) {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (adding) nameInput.current?.focus();
  }, [adding]);
  function create() {
    if (!manager) return;
    if (!name.trim()) {
      setError('Informe o nome da etiqueta.');
      return;
    }
    if (labels.some((l) => normalize(l.name.trim()) === normalize(name.trim()))) {
      setError('Já existe uma etiqueta com esse nome.');
      return;
    }
    if (value.length >= 3) {
      setError('Remova uma etiqueta do card antes de cadastrar e selecionar outra.');
      return;
    }
    const item = { id: uid(), companyId: session.companyId, name: name.trim(), color };
    if (update((d) => ({ ...d, labels: [...(d.labels || []), item] }))) {
      onChange([...value, item.id]);
      setAdding(false);
      setError('');
      trigger.current?.focus();
    }
  }
  function toggle(labelId: string) {
    if (value.includes(labelId)) onChange(value.filter((id) => id !== labelId));
    else if (value.length < 3) onChange([...value, labelId]);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function expand() {
    const box = trigger.current?.getBoundingClientRect(),
      bounds = trigger.current?.closest('.dialog-body')?.getBoundingClientRect();
    if (box) {
      const bottom =
        Math.min(window.innerHeight, bounds?.bottom || window.innerHeight) - box.bottom;
      setSide(bottom < 260 && box.top - (bounds?.top || 0) > bottom ? 'top' : 'bottom');
    }
    setQuery('');
    setOpen(!open);
  }
  function listKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const options = Array.from(
      results.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [],
    );
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? options.length - 1
          : e.key === 'ArrowDown'
            ? (current + 1) % options.length
            : (current - 1 + options.length) % options.length;
    options[next]?.focus();
  }
  return (
    <div
      className="contact-picker labels-picker form-row"
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
        Etiquetas <small className="muted">até 3 por card</small>
      </label>
      <div className="contact-picker-anchor">
        <button
          ref={trigger}
          type="button"
          role="combobox"
          id={id + '-trigger'}
          aria-labelledby={id + '-label'}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id + '-popup' : undefined}
          className="contact-picker-trigger"
          onClick={expand}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              expand();
            }
          }}
        >
          <span className={chosen.length ? '' : 'muted'}>
            {chosen.length
              ? `${chosen.length} de 3 etiquetas selecionadas`
              : 'Selecione as etiquetas'}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open && (
          <div
            id={id + '-popup'}
            role="dialog"
            aria-label="Selecionar etiquetas"
            className="contact-picker-popup"
            data-side={side}
          >
            <div className="contact-picker-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={search}
                aria-label="Buscar etiqueta"
                placeholder="Buscar etiqueta..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    results.current
                      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
                      ?.focus();
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches[0]) toggle(matches[0].id);
                  }
                }}
              />
            </div>
            {manager && (
              <button
                type="button"
                className="contact-picker-create"
                disabled={value.length >= 3}
                onClick={() => {
                  setName(query.trim());
                  setColor('#8b5cf6');
                  setError('');
                  setOpen(false);
                  setAdding(true);
                }}
              >
                <Plus size={17} aria-hidden="true" />
                Cadastrar nova etiqueta
              </button>
            )}
            <div
              ref={results}
              role="listbox"
              aria-label="Etiquetas disponíveis"
              aria-multiselectable="true"
              className="contact-picker-results"
              onKeyDown={listKey}
            >
              {matches.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected={value.includes(l.id)}
                  disabled={!value.includes(l.id) && value.length >= 3}
                  className="contact-picker-option"
                  onClick={() => toggle(l.id)}
                >
                  <span
                    className={'catalog-check ' + (value.includes(l.id) ? 'is-selected' : '')}
                    aria-hidden="true"
                  >
                    {value.includes(l.id) && <Check size={12} />}
                  </span>
                  <i className="label-color-dot" style={{ background: l.color }} />
                  <span>{l.name}</span>
                </button>
              ))}
              {!matches.length && (
                <p className="contact-picker-empty">
                  Nenhuma etiqueta encontrada. O gestor pode cadastrar etiquetas na área de
                  trabalho.
                </p>
              )}
            </div>
            <div className="catalog-picker-summary">
              <span role="status">
                {value.length >= 3
                  ? 'Limite de 3 atingido. Desmarque uma para trocar.'
                  : `${value.length} de 3 selecionadas`}
              </span>
              <button type="button" onClick={close}>
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
      {!!chosen.length && (
        <div className="catalog-selection" aria-label="Etiquetas selecionadas">
          {chosen.map((l) => (
            <span className="catalog-selection-chip" key={l.id}>
              <i className="label-color-dot" style={{ background: l.color }} />
              {l.name}
              <button
                type="button"
                aria-label={'Remover etiqueta ' + l.name}
                onClick={() => toggle(l.id)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {adding && manager && (
        <section
          className="contact-picker-registration"
          aria-label="Cadastrar nova etiqueta"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
        >
          <strong>Cadastrar nova etiqueta</strong>
          <label className="form-row">
            Nome da etiqueta
            <Input
              ref={nameInput}
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-row">
            Cor da etiqueta
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <FormError message={error} />
          <div className="contact-picker-registration-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                trigger.current?.focus();
              }}
            >
              Cancelar cadastro
            </Button>
            <Button type="button" onClick={create}>
              Cadastrar e selecionar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
