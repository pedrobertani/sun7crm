import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useCrm } from '../../app/context';
import { visibleContacts } from '../../domain/operations';
import { normalizeContactPhone, formatContactPhone } from '../../domain/contact-transfer';
import { uid, today } from '../../lib/format';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FormError } from '../../components/shared';

export function ContactPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data, session, update } = useCrm();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const contacts = visibleContacts(data, session);
  const selected = contacts.find((c) => c.id === value);
  const normalizedQuery = query
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
  const digits = query.replace(/\D/g, '');
  const matches = contacts.filter(
    (c) =>
      c.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .includes(normalizedQuery) ||
      (!!digits && c.phone.replace(/\D/g, '').includes(digits)),
  );

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (adding) nameInput.current?.focus();
  }, [adding]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  function select(id: string) {
    onChange(id);
    setQuery('');
    close();
  }
  function startAdding() {
    setName(/\d/.test(query) ? '' : query.trim());
    setPhone(/^[\d\s()+.\-]+$/.test(query.trim()) ? query.trim() : '');
    setError('');
    setOpen(false);
    setAdding(true);
  }
  function add() {
    const normalized = normalizeContactPhone(phone);
    if (!name.trim() || !normalized) {
      setError('Informe nome e telefone completo com DDD válido.');
      return;
    }
    // Never reveal contacts outside the current consultant scope.
    if (
      data.contacts.some(
        (c) => c.companyId === session.companyId && normalizeContactPhone(c.phone) === normalized,
      )
    ) {
      setError(
        'Este telefone já está cadastrado na empresa. Se não estiver na sua lista, consulte o gestor.',
      );
      return;
    }
    const id = uid();
    if (
      update((d) => ({
        ...d,
        contacts: [
          ...d.contacts,
          {
            id,
            companyId: session.companyId,
            name: name.trim(),
            phone: normalized,
            email: '',
            temperature: 'unclassified',
            ownerId: session.memberId,
            interests: '',
            notes: '',
            createdAt: today(),
          },
        ],
      }))
    ) {
      onChange(id);
      setAdding(false);
      setQuery('');
      setName('');
      setPhone('');
      setError('');
      trigger.current?.focus();
    }
  }
  function searchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (matches[0]) select(matches[0].id);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      results.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }
  function listKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(
      results.current?.querySelectorAll<HTMLButtonElement>('button') || [],
    );
    const index = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? (index + 1) % options.length
            : (index - 1 + options.length) % options.length;
    options[next]?.focus();
  }
  return (
    <div
      className="contact-picker form-row"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <label id={id + '-label'} htmlFor={id + '-trigger'}>
        Contato
      </label>
      <div className="contact-picker-anchor">
        <button
          id={id + '-trigger'}
          ref={trigger}
          type="button"
          className="contact-picker-trigger"
          role="combobox"
          aria-labelledby={id + '-label'}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id + '-popup' : undefined}
          aria-required="true"
          onClick={() => {
            setOpen(!open);
            setQuery('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
            }
          }}
        >
          <span className={selected ? '' : 'muted'}>
            {selected?.name || 'Selecione um contato'}
          </span>
          {selected && <small>{formatContactPhone(selected.phone)}</small>}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {open && (
          <div
            id={id + '-popup'}
            className="contact-picker-popup"
            role="dialog"
            aria-label="Selecionar contato"
          >
            <div className="contact-picker-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={search}
                aria-label="Buscar contato"
                placeholder="Buscar contato..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={searchKey}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => {
                    setQuery('');
                    search.current?.focus();
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="button" className="contact-picker-create" onClick={startAdding}>
              <Plus size={17} aria-hidden="true" />
              Cadastrar novo contato
            </button>
            <div
              className="contact-picker-results"
              ref={results}
              role="listbox"
              aria-label="Contatos disponíveis"
              onKeyDown={listKey}
            >
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === value}
                  className="contact-picker-option"
                  onClick={() => select(c.id)}
                >
                  <span>{c.name}</span>
                  <small>{formatContactPhone(c.phone)}</small>
                  {c.id === value && <Check size={15} aria-hidden="true" />}
                </button>
              ))}
              {!matches.length && (
                <p className="contact-picker-empty">
                  Nenhum contato encontrado. Cadastre um novo contato acima.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {adding && (
        <section
          className="contact-picker-registration"
          aria-label="Cadastrar novo contato"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        >
          <strong>Cadastrar novo contato</strong>
          <label className="form-row">
            Nome
            <Input
              ref={nameInput}
              value={name}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-row">
            Telefone com DDD
            <Input
              type="tel"
              value={phone}
              maxLength={25}
              autoComplete="off"
              placeholder="(11) 99999-9999"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <FormError message={error} />
          <div className="contact-picker-registration-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setError('');
                trigger.current?.focus();
              }}
            >
              Cancelar cadastro
            </Button>
            <Button type="button" onClick={add}>
              Cadastrar e selecionar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
