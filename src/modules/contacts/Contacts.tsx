import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Phone, ArrowUpRight, Users } from 'lucide-react';
import { useCrm } from '../../app/context';
import type { Contact, Temperature } from '../../domain/types';
import { temperatureLabels } from '../../domain/config';
import { visibleContacts } from '../../domain/operations';
import { initials, uid, today } from '../../lib/format';
import {
  Heading,
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
  notes: '',
};
export function Contacts() {
  const { data, session, update, notice } = useCrm();
  const [query, setQuery] = useState('');
  const [temperature, setTemperature] = useState('all');
  const [editing, setEditing] = useState<Contact | null | undefined>(undefined);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const members = data.members.filter((m) => m.companyId === session.companyId && m.active);
  const contacts = visibleContacts(data, session).filter(
    (c) =>
      (temperature === 'all' || c.temperature === temperature) &&
      (c.name + ' ' + c.phone + ' ' + c.interests)
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const canEdit = session.role === 'manager' || session.role === 'seller';
  function open(contact: Contact | null) {
    setEditing(contact);
    setError('');
    setForm(contact ? { ...contact } : { ...blank, ownerId: session.memberId });
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome do contato.');
      return;
    }
    const phone = form.phone.replace(/\D/g, '');
    if (phone && (phone.length < 10 || phone.length > 13)) {
      setError('Informe um telefone com DDD válido.');
      return;
    }
    if (
      data.contacts.some(
        (c) =>
          c.companyId === session.companyId && c.id !== editing?.id && phone && c.phone === phone,
      )
    ) {
      setError('Já existe um contato com este telefone nesta empresa. Confira antes de duplicar.');
      return;
    }
    const contact: Contact = {
      ...form,
      name: form.name.trim(),
      phone,
      id: editing?.id || uid(),
      companyId: session.companyId,
      createdAt: editing?.createdAt || today(),
      ownerId: session.role === 'seller' ? session.memberId : form.ownerId,
    };
    const board = data.boards.find((b) => b.companyId === session.companyId && b.kind === 'leads')!;
    if (
      update((d) => ({
        ...d,
        contacts: editing
          ? d.contacts.map((c) => (c.id === editing.id ? contact : c))
          : [contact, ...d.contacts],
        opportunities: editing
          ? d.opportunities
          : [
              ...d.opportunities,
              {
                id: uid(),
                companyId: session.companyId,
                contactId: contact.id,
                boardId: board.id,
                stageId: board.stages[0].id,
                value: 0,
                source: 'Cadastro manual',
                createdAt: today(),
              },
            ],
      }))
    ) {
      setEditing(undefined);
      notice(editing ? 'Contato atualizado.' : 'Contato criado e incluído no funil de leads.');
    }
  }
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTOS"
        title="Contatos"
        description="Conheça cada pessoa, seus interesses e o próximo passo da conversa."
      >
        {canEdit && (
          <Button onClick={() => open(null)}>
            <Plus size={16} />
            Novo contato
          </Button>
        )}
      </Heading>
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
                        {c.phone && (
                          <Button asChild variant="outline" size="sm">
                            <a
                              href={'tel:+' + (c.phone.length <= 11 ? '55' : '') + c.phone}
                              aria-label={'Ligar para ' + c.name}
                            >
                              <Phone size={14} />
                            </a>
                          </Button>
                        )}
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
              <label className="form-row span2">
                Serviços e produtos de interesse
                <Input
                  maxLength={200}
                  value={form.interests}
                  onChange={(e) => setForm({ ...form, interests: e.target.value })}
                />
              </label>
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
