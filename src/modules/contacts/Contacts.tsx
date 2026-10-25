import { recordWhatsappOpen } from '../../domain/contact-history';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { DemoContactHistory } from './ContactHistory';
import { History } from 'lucide-react';
import { CatalogPicker } from '../catalog/CatalogPicker';
import { ContactTransfer } from './ContactTransfer';
import { normalizeContactPhone } from '../../domain/contact-transfer';
import { useSearchParams } from 'react-router-dom';
import { readPeriod, inPeriod } from '../../domain/filters';
import { dateLabel } from '../../lib/format';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, ArrowUpRight, Users } from 'lucide-react';
import { useCrm } from '../../app/context';
import type { Contact, Temperature } from '../../domain/types';
import { temperatureLabels } from '../../domain/config';
import { visibleContacts } from '../../domain/operations';
import { initials, uid, today } from '../../lib/format';
import {
  Heading,
  AppliedFilter,
  SearchInput,
  TemperatureBadge,
  Empty,
  FormActions,
  FormError,
} from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
const blank = {
  name: '',
  phone: '',
  email: '',
  temperature: 'unclassified' as Temperature,
  ownerId: '',
  interests: '',
  catalogIds: [] as string[],
  notes: '',
};
export function Contacts() {
  const { data, session, update, notice } = useCrm();
  const [query, setQuery] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [params, setParams] = useSearchParams();
  const temperature = Object.keys(temperatureLabels).includes(params.get('temperatura') || '')
    ? params.get('temperatura')!
    : 'all';
  const period = readPeriod(params);
  function setTemperature(value: string) {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('temperatura');
    else next.set('temperatura', value);
    setParams(next);
  }
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const members = data.members.filter((m) => m.companyId === session.companyId && m.active);
  const contacts = visibleContacts(data, session).filter(
    (c) =>
      inPeriod(c.createdAt, period) &&
      (temperature === 'all' || c.temperature === temperature) &&
      (c.name + ' ' + c.phone + ' ' + c.interests)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const canEdit = session.role === 'manager' || session.role === 'seller';
  function open(contact: Contact | null) {
    setEditing(contact);
    setError('');
    setForm(
      contact
        ? { ...contact, catalogIds: contact.catalogIds || [] }
        : { ...blank, ownerId: session.memberId },
    );
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome do contato.');
      return;
    }
    const phone = form.phone.trim() ? normalizeContactPhone(form.phone) : '';
    if (phone === null) {
      setError('Informe um telefone com DDD válido.');
      return;
    }
    if (
      data.contacts.some(
        (c) =>
          c.companyId === session.companyId &&
          c.id !== editing?.id &&
          phone &&
          normalizeContactPhone(c.phone) === phone,
      )
    ) {
      setError('Já existe um contato com este telefone nesta empresa. Confira antes de duplicar.');
      return;
    }
    const contact: Contact = {
      ...form,
      interests: form.catalogIds.length
        ? (data.catalog || [])
            .filter((i) => form.catalogIds.includes(i.id) && i.companyId === session.companyId)
            .map((i) => i.name)
            .join(', ')
        : form.interests,
      name: form.name.trim(),
      phone,
      id: editing?.id || uid(),
      companyId: session.companyId,
      createdAt: editing?.createdAt || today(),
      ownerId: session.role === 'seller' ? session.memberId : form.ownerId,
    };
    if (
      update((d) => ({
        ...d,
        contacts: editing
          ? d.contacts.map((c) => (c.id === editing.id ? contact : c))
          : [contact, ...d.contacts],
      }))
    ) {
      setEditing(undefined);
      notice(
        editing
          ? 'Contato atualizado.'
          : 'Contato criado. Crie um card no funil quando houver uma oportunidade.',
      );
    }
  }
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTOS"
        title="Contatos"
        description="Conheça cada pessoa, seus interesses e o próximo passo da conversa."
      >
        <ContactTransfer
          key={session.companyId + session.memberId}
          demo
          canImport={canEdit}
          scopeLabel={session.role === 'seller' ? 'permitidos para mim' : 'da empresa'}
          loadContacts={async () => visibleContacts(data, session)}
          loadExisting={async () => data.contacts.filter((c) => c.companyId === session.companyId)}
          filtered={async () => contacts}
          onImport={async (items) => {
            const created: Contact[] = items.map((item) => ({
              ...blank,
              ...item,
              id: uid(),
              companyId: session.companyId,
              ownerId: session.memberId,
              createdAt: today(),
            }));
            const saved = update((d) => ({
              ...d,
              contacts: [...created, ...d.contacts],
            }));
            if (!saved) throw Error('Não foi possível salvar a importação neste navegador.');
            return created.length;
          }}
        />
        {canEdit && (
          <Button onClick={() => open(null)}>
            <Plus size={16} />
            Novo contato
          </Button>
        )}
      </Heading>
      {(period.from || period.to) && (
        <AppliedFilter
          label={`Cadastros de ${period.from ? dateLabel(period.from) : 'qualquer data'} até ${period.to ? dateLabel(period.to) : 'hoje'}`}
          onClear={() => setParams({})}
        />
      )}
      <div className="card">
        <div className="toolbar">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Buscar nome, telefone ou interesse"
          />
          <select
            aria-label="Filtrar temperatura"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          >
            <option value="all">Todas as temperaturas</option>
            {Object.entries(temperatureLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <span className="muted result-count">
            <Users size={15} />
            {contacts.length} contatos
          </span>
        </div>
        {contacts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contato</th>
                  <th>Temperatura</th>
                  <th>Interesse</th>
                  <th>Responsável</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">{initials(c.name)}</span>
                        <div>
                          <strong>{c.name}</strong>
                          <small>{c.email || 'E-mail não informado'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <TemperatureBadge value={c.temperature} />
                    </td>
                    <td>{c.interests || 'Não informado'}</td>
                    <td>{members.find((m) => m.id === c.ownerId)?.name || 'Sem responsável'}</td>
                    <td>
                      <div className="actions">
                        <WhatsAppButton
                          phone={c.phone}
                          name={c.name}
                          onOpen={() => update((d) => recordWhatsappOpen(d, session, c.id))}
                          compact
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={'Histórico de ' + c.name}
                          onClick={() => setHistoryId(c.id)}
                        >
                          <History size={15} />
                          Histórico
                        </Button>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => open(c)}
                            aria-label={'Editar ' + c.name}
                          >
                            <Pencil size={14} />
                            Editar
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => open(c)}>
                            <ArrowUpRight size={14} />
                            Ver
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum contato encontrado"
            description="Ajuste os filtros ou cadastre o primeiro contato."
          />
        )}
      </div>
      {historyId && <DemoContactHistory contactId={historyId} onClose={() => setHistoryId('')} />}
      <Modal
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title={editing ? 'Dados do contato' : 'Novo contato'}
        description="A temperatura é manual e independente da etapa do funil."
      >
        <form onSubmit={save}>
          <fieldset disabled={!canEdit}>
            <div className="form-grid">
              <label className="form-row span2">
                Nome
                <Input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="form-row">
                Telefone com DDD
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="form-row">
                E-mail
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="form-row">
                Temperatura
                <select
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: e.target.value as Temperature })}
                >
                  {Object.entries(temperatureLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                Responsável
                <select
                  disabled={session.role === 'seller'}
                  value={form.ownerId}
                  onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                >
                  <option value="">Sem responsável</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="span2">
                <CatalogPicker
                  value={form.catalogIds}
                  onChange={(ids) =>
                    setForm({
                      ...form,
                      catalogIds: ids,
                      interests: ids.length ? form.interests : '',
                    })
                  }
                />
                {form.interests && !form.catalogIds.length && (
                  <p className="small-note">Interesse registrado anteriormente: {form.interests}</p>
                )}
              </div>
              <label className="form-row span2">
                Observações
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          <FormError message={error} />
          {canEdit ? (
            <FormActions onCancel={() => setEditing(undefined)} />
          ) : (
            <Button type="button" variant="outline" onClick={() => setEditing(undefined)}>
              Fechar
            </Button>
          )}
        </form>
      </Modal>
    </>
  );
}
