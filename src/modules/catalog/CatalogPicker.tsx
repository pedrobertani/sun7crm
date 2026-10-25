import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useCrm } from '../../app/context';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FormError } from '../../components/shared';
import { currency, uid } from '../../lib/format';
import type { CatalogItem } from '../../domain/types';

export function CatalogPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data, session, update } = useCrm();
  const manager = session.role === 'manager';
  const [open, setOpen] = useState(false),
    [adding, setAdding] = useState(false),
    [query, setQuery] = useState('');
  const [side, setSide] = useState<'top' | 'bottom'>('bottom');
  const [form, setForm] = useState({
    name: '',
    kind: 'service' as CatalogItem['kind'],
    description: '',
    price: '',
  });
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null),
    nameInput = useRef<HTMLInputElement>(null),
    results = useRef<HTMLDivElement>(null);
  const id = useId();
  const catalog = (data.catalog || []).filter((i) => i.companyId === session.companyId);
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  const matches = catalog.filter(
    (i) =>
      (i.active || value.includes(i.id)) &&
      normalize(
        i.name + ' ' + i.description + ' ' + (i.kind === 'service' ? 'Serviço' : 'Produto'),
      ).includes(normalize(query)),
  );
  const chosen = catalog.filter((i) => value.includes(i.id));
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
  function toggle(itemId: string) {
    onChange(value.includes(itemId) ? value.filter((id) => id !== itemId) : [...value, itemId]);
  }
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function expand() {
    const box = trigger.current?.getBoundingClientRect(),
      dialog = trigger.current?.closest('.dialog-body')?.getBoundingClientRect();
    if (box) {
      const below = Math.min(window.innerHeight, dialog?.bottom || window.innerHeight) - box.bottom;
      const above = box.top - Math.max(0, dialog?.top || 0);
      setSide(below < 260 && above > below ? 'top' : 'bottom');
    }
    setQuery('');
    setOpen(!open);
  }
  function create() {
    if (!manager) return;
    const cents = Math.round(Number(form.price) * 100);
    if (!form.name.trim() || !form.price || !Number.isSafeInteger(cents) || cents < 0) {
      setError('Informe nome e valor válido.');
      return;
    }
    if (catalog.some((i) => i.kind === form.kind && normalize(i.name) === normalize(form.name))) {
      setError('Já existe um item desse tipo com esse nome no catálogo.');
      return;
    }
    const item: CatalogItem = {
      id: uid(),
      companyId: session.companyId,
      kind: form.kind,
      name: form.name.trim(),
      description: form.description.trim(),
      value: cents,
      active: true,
    };
    if (update((d) => ({ ...d, catalog: [...(d.catalog || []), item] }))) {
      onChange([...value, item.id]);
      setAdding(false);
      setError('');
      trigger.current?.focus();
    }
  }
  function listKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const buttons = Array.from(
        results.current?.querySelectorAll<HTMLButtonElement>('button') || [],
      ),
      index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? buttons.length - 1
          : e.key === 'ArrowDown'
            ? (index + 1) % buttons.length
            : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }
  return (
    <div
      className="contact-picker catalog-picker form-row"
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
        Serviços e produtos de interesse
      </label>
      <div className="contact-picker-anchor">
        <button
          type="button"
          id={id + '-trigger'}
          ref={trigger}
          role="combobox"
          aria-labelledby={id + '-label'}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id + '-popup' : undefined}
          className="contact-picker-trigger"
          onClick={expand}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!open) expand();
            }
          }}
        >
          <span className={chosen.length ? '' : 'muted'}>
            {chosen.length
              ? `${chosen.length} ${chosen.length === 1 ? 'item selecionado' : 'itens selecionados'}`
              : 'Selecione serviços ou produtos'}
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open && (
          <div
            id={id + '-popup'}
            role="dialog"
            aria-label="Selecionar serviços e produtos"
            className="contact-picker-popup"
            data-side={side}
          >
            <div className="contact-picker-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={search}
                placeholder="Buscar serviço ou produto..."
                aria-label="Buscar serviço ou produto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    results.current?.querySelector<HTMLButtonElement>('button')?.focus();
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
                onClick={() => {
                  setForm({ name: query.trim(), kind: 'service', description: '', price: '' });
                  setError('');
                  setOpen(false);
                  setAdding(true);
                }}
              >
                <Plus size={17} aria-hidden="true" />
                Cadastrar serviço ou produto
              </button>
            )}
            <div
              className="contact-picker-results"
              ref={results}
              role="listbox"
              aria-multiselectable="true"
              aria-label="Serviços e produtos disponíveis"
              onKeyDown={listKey}
            >
              {matches.map((i) => (
                <button
                  type="button"
                  key={i.id}
                  role="option"
                  aria-selected={value.includes(i.id)}
                  className="contact-picker-option"
                  onClick={() => toggle(i.id)}
                >
                  <span
                    className={'catalog-check ' + (value.includes(i.id) ? 'is-selected' : '')}
                    aria-hidden="true"
                  >
                    {value.includes(i.id) && <Check size={12} />}
                  </span>
                  <span>
                    {i.name}
                    <small className="catalog-item-kind">
                      {i.kind === 'service' ? 'Serviço' : 'Produto'}
                      {!i.active ? ' · Inativo' : ''}
                    </small>
                  </span>
                  <small>{currency(i.value)}</small>
                </button>
              ))}
              {!matches.length && (
                <p className="contact-picker-empty">
                  Nenhum serviço ou produto encontrado.
                  {manager
                    ? ' Cadastre um novo item acima.'
                    : ' Consulte o gestor para cadastrar novos itens.'}
                </p>
              )}
            </div>
            <div className="catalog-picker-summary">
              <span>{chosen.length} selecionados</span>
              <button type="button" onClick={close}>
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
      {!!chosen.length && (
        <div className="catalog-selection" aria-label="Itens selecionados">
          {chosen.map((i) => (
            <span key={i.id} className="catalog-selection-chip">
              {i.name}
              <button type="button" aria-label={'Remover ' + i.name} onClick={() => toggle(i.id)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {adding && manager && (
        <section
          className="contact-picker-registration"
          aria-label="Cadastrar serviço ou produto"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              create();
            }
          }}
        >
          <strong>Cadastrar serviço ou produto</strong>
          <label className="form-row">
            Tipo
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as CatalogItem['kind'] })}
            >
              <option value="service">Serviço</option>
              <option value="product">Produto</option>
            </select>
          </label>
          <label className="form-row">
            Nome do item
            <Input
              ref={nameInput}
              maxLength={120}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="form-row">
            Valor do item (R$)
            <Input
              type="number"
              min="0"
              max="1000000000"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </label>
          <label className="form-row">
            Descrição
            <Input
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
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
