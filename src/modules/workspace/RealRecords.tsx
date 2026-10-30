import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, History, KanbanSquare } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { usePagination } from '../../components/ui/pagination';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { CurrencyInput } from '../../components/currency-input';
import { Empty, SearchInput, TemperatureBadge } from '../../components/shared';
import { RecordTitle } from '../../components/RecordTitle';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import type { ContactRow, CatalogRow, LabelRow, StrategyRow, TaskRow } from '../../data/backend';
import type { Temperature } from '../../domain/types';
import { currency, dateLabel, today } from '../../lib/format';
import { ContactTransfer } from '../contacts/ContactTransfer';
import { loadTransferContacts, importRealContacts } from '../contacts/real-transfer';
import { getSupabaseClient } from '../../lib/supabase';
import { RealContactHistory } from '../contacts/RealContactHistory';
import { recordRealWhatsapp } from '../contacts/real-history';
import { CatalogDialog, ContactDialog, LabelDialog } from './RecordForms';
import { RecordPicker } from './RecordPicker';
import {
  cents,
  Pager,
  QueryState,
  SaveActions,
  useOperational,
  useQuery,
  useSave,
  useTeam,
} from './operational';

export function RealContacts() {
  const { page, size, setPage, setSize } = usePagination();
  const { api, can, company, refresh, notice } = useOperational(),
    [params, setParams] = useSearchParams(),
    selected = params.get('registro') || '';
  const     [search, setSearch] = useState(''),
    [editing, setEditing] = useState<ContactRow | 'new' | null>(null),
    [history, setHistory] = useState<ContactRow | null>(null);
  const query = useQuery(
    () => api.list('contacts', page, size, selected ? { id: selected } : {}, search),
    [api, page, size, search, selected],
  );
  return (
    <>
      <div className="operational-toolbar">
        <SearchInput
          value={search}
          onChange={(s) => {
            setSearch(s);
            setPage(0);
          }}
          placeholder="Buscar nome ou telefone..."
        />
        <div className="actions">
          <ContactTransfer
            key={company.id + company.membershipId}
            canImport={can('contacts.import')}
            canExport={can('contacts.export')}
            scopeLabel="permitidos para mim"
            loadContacts={() => loadTransferContacts(getSupabaseClient(), company.id)}
            filtered={
              selected
                ? () => loadTransferContacts(getSupabaseClient(), company.id, selected)
                : undefined
            }
            filteredLabel="Contato selecionado"
            onImport={(rows) =>
              importRealContacts(getSupabaseClient(), company.id, company.membershipId, rows)
            }
            onImported={refresh}
          />
          {can('contacts.create') && (
            <Button onClick={() => setEditing('new')}>
              <Plus size={16} />
              Novo contato
            </Button>
          )}
        </div>
      </div>
      {selected && (
        <Button
          variant="ghost"
          onClick={() => {
            setParams({});
            setPage(0);
          }}
        >
          Mostrar todos os contatos
        </Button>
      )}
      <QueryState query={query} />
      {query.data && (
        <>
          <div className="card panel operational-table">
            <table>
              <thead>
                <tr>
                  <th>Contato</th>
                  <th>Telefone</th>
                  <th>Temperatura</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <RecordTitle
                        title={c.name}
                        onOpen={can('contacts.edit') ? () => setEditing(c) : undefined}
                      />
                      <small className="operational-cell-note">
                        {c.email || 'E-mail não informado'}
                      </small>
                    </td>
                    <td>{c.phone || 'Não informado'}</td>
                    <td>
                      <TemperatureBadge value={c.temperature as Temperature} />
                    </td>
                    <td>
                      <div className="actions">
                        <WhatsAppButton
                          disabled={!can('history.whatsapp')}
                          name={c.name}
                          phone={c.phone}
                          compact
                          onOpen={() =>
                            void recordRealWhatsapp(getSupabaseClient(), company.id, c.id).catch(
                              (e) => notice(e.message),
                            )
                          }
                        />
                        <Button
                          disabled={!can('history.view')}
                          variant="ghost"
                          size="icon"
                          onClick={() => setHistory(c)}
                          aria-label="Histórico"
                        >
                          <History size={16} aria-hidden="true" />
                        </Button>
                        {can('contacts.edit') && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setEditing(c)}
                            aria-label="Editar"
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </Button>
                        )}
                        <Button
                          asChild
                          size="icon"
                          variant="outline"
                          aria-label={'Ver cards de ' + c.name}
                        >
                          <Link to={'/app/funil?contato=' + c.id}>
                            <KanbanSquare size={16} aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.rows.length && (
              <Empty
                title="Nenhum contato encontrado"
                description="Cadastre um contato ou ajuste a busca."
              />
            )}
          </div>
          <Pager page={page} total={query.data.total} size={size} onSizeChange={setSize} onChange={setPage} />
        </>
      )}
      {editing && (
        <ContactDialog
          contact={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            notice('Contato salvo.');
          }}
        />
      )}
      {history && (
        <RealContactHistory
          key={history.id}
          companyId={company.id}
          contact={history}
          canAdd={can('history.create')}
          canWhatsapp={can('history.whatsapp')}
          onClose={() => setHistory(null)}
        />
      )}
    </>
  );
}
export function RealCatalog({ labels = false }: { labels?: boolean }) {
  const { page, size, setPage, setSize } = usePagination();
  const { api, can, refresh, notice } = useOperational(),
        [search, setSearch] = useState(''),
    [editing, setEditing] = useState<CatalogRow | LabelRow | 'new' | null>(null);
  const query = useQuery(
    async () =>
      labels ? api.list('labels', page, size, {}, search) : api.list('catalog', page, size, {}, search),
    [api, labels, page, size, search],
  );
  function saved() {
    setEditing(null);
    refresh();
    notice(labels ? 'Etiqueta salva.' : 'Item salvo no catálogo.');
  }
  return (
    <>
      <div className="operational-toolbar">
        <SearchInput
          value={search}
          onChange={(s) => {
            setSearch(s);
            setPage(0);
          }}
          placeholder={labels ? 'Buscar etiqueta...' : 'Buscar serviço ou produto...'}
        />
        {can(labels ? 'labels.create' : 'catalog.create') && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} />
            {labels ? 'Nova etiqueta' : 'Novo serviço ou produto'}
          </Button>
        )}
      </div>
      <QueryState query={query} />
      {query.data && (
        <>
          <div className="card panel operational-table">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>{labels ? 'Cor' : 'Tipo'}</th>
                  {!labels && <th>Valor</th>}
                  <th>Situação</th>
                  {can(labels ? 'labels.edit' : 'catalog.edit') && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <RecordTitle
                        title={row.name}
                        onOpen={
                          can(labels ? 'labels.edit' : 'catalog.edit')
                            ? () => setEditing(row)
                            : undefined
                        }
                      />
                      {'description' in row && (
                        <small className="operational-cell-note">{row.description}</small>
                      )}
                    </td>
                    <td>
                      {'color' in row ? (
                        <span className="operational-color">
                          <i className="label-color-dot" style={{ background: row.color }} />
                          {row.color}
                        </span>
                      ) : row.kind === 'service' ? (
                        'Serviço'
                      ) : (
                        'Produto'
                      )}
                    </td>
                    {'value_cents' in row && <td>{currency(row.value_cents)}</td>}
                    <td>
                      <span className="badge">{row.active ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    {can(labels ? 'labels.edit' : 'catalog.edit') && (
                      <td>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditing(row)}
                          aria-label="Editar"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.rows.length && (
              <Empty
                title={labels ? 'Nenhuma etiqueta encontrada' : 'Nenhum item encontrado'}
                description="Os cadastros ficam disponíveis para seleção nos contatos e cards."
              />
            )}
          </div>
          <Pager page={page} total={query.data.total} size={size} onSizeChange={setSize} onChange={setPage} />
        </>
      )}
      {editing &&
        can(
          editing === 'new'
            ? labels
              ? 'labels.create'
              : 'catalog.create'
            : labels
              ? 'labels.edit'
              : 'catalog.edit',
        ) &&
        (labels ? (
          <LabelDialog
            item={editing === 'new' ? undefined : (editing as LabelRow)}
            onClose={() => setEditing(null)}
            onSaved={saved}
          />
        ) : (
          <CatalogDialog
            item={editing === 'new' ? undefined : (editing as CatalogRow)}
            onClose={() => setEditing(null)}
            onSaved={saved}
          />
        ))}
    </>
  );
}
export function RealStrategies() {
  const { page, size, setPage, setSize } = usePagination();
  const { api, can, refresh, notice } = useOperational(),
        [search, setSearch] = useState(''),
    [editing, setEditing] = useState<StrategyRow | 'new' | null>(null);
  const query = useQuery(() => api.list('strategies', page, size, {}, search), [api, page, size, search]);
  return (
    <>
      <div className="operational-toolbar">
        <SearchInput
          value={search}
          onChange={(s) => {
            setSearch(s);
            setPage(0);
          }}
          placeholder="Buscar estratégia..."
        />
        {can('strategies.create') && (
          <Button onClick={() => setEditing('new')}>
            <Plus size={16} />
            Nova estratégia
          </Button>
        )}
      </div>
      <QueryState query={query} />
      {query.data && (
        <>
          <div className="card panel operational-table">
            <table>
              <thead>
                <tr>
                  <th>Estratégia</th>
                  <th>Mês</th>
                  <th>Canal</th>
                  <th>Orçamento</th>
                  <th>Situação</th>
                  {can('strategies.edit') && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <RecordTitle
                        title={row.name}
                        onOpen={can('strategies.edit') ? () => setEditing(row) : undefined}
                      />
                      <small className="operational-cell-note">{row.notes}</small>
                    </td>
                    <td>{row.month.slice(0, 7).split('-').reverse().join('/')}</td>
                    <td>{row.channel || 'Não informado'}</td>
                    <td>{currency(row.budget_cents)}</td>
                    <td>
                      {row.status === 'active'
                        ? 'Em andamento'
                        : row.status === 'completed'
                          ? 'Concluída'
                          : 'Planejada'}
                      {!row.active ? ' · Inativa' : ''}
                    </td>
                    {can('strategies.edit') && (
                      <td>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditing(row)}
                          aria-label="Editar"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.rows.length && (
              <Empty
                title="Nenhuma estratégia encontrada"
                description="Vincule as estratégias aos cards para acompanhar a origem das oportunidades."
              />
            )}
          </div>
          <Pager page={page} total={query.data.total} size={size} onSizeChange={setSize} onChange={setPage} />
        </>
      )}
      {editing && (
        <StrategyDialog
          row={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            notice('Estratégia salva.');
          }}
        />
      )}
    </>
  );
}
function StrategyDialog({
  row,
  onClose,
  onSaved,
}: {
  row?: StrategyRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api, company } = useOperational(),
    team = useTeam(),
    save = useSave(),
    [form, setForm] = useState({
      name: row?.name || '',
      month: row?.month.slice(0, 7) || today().slice(0, 7),
      channel: row?.channel || '',
      status: row?.status || 'planned',
      owner_membership_id: row?.owner_membership_id || company.membershipId,
      notes: row?.notes || '',
      price: ((row?.budget_cents || 0) / 100).toFixed(2),
      active: row?.active ?? true,
    });
  return (
    <Modal
      open
      title={row ? 'Editar estratégia' : 'Nova estratégia'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const { price, month, ...rest } = form,
              input = { ...rest, month: month + '-01', budget_cents: cents(price) };
            if (row) await api.patch('strategies', row.id, input);
            else await api.create('strategies', input);
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Nome
            <Input
              autoFocus
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="form-row">
              Mês
              <Input
                type="month"
                required
                value={form.month}
                onChange={(e) => setForm({ ...form, month: e.target.value })}
              />
            </label>
            <label className="form-row">
              Canal
              <Input
                maxLength={80}
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value })}
              />
            </label>
            <label className="form-row">
              Orçamento (R$)
              <CurrencyInput
                required
                value={form.price}
                onValueChange={(price) => setForm({ ...form, price })}
              />
            </label>
            <label className="form-row">
              Situação
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as StrategyRow['status'] })
                }
              >
                <option value="planned">Planejada</option>
                <option value="active">Em andamento</option>
                <option value="completed">Concluída</option>
              </select>
            </label>
          </div>
          <QueryState query={team} />
          {team.data && (
            <label className="form-row">
              Responsável
              <select
                required
                value={form.owner_membership_id}
                onChange={(e) => setForm({ ...form, owner_membership_id: e.target.value })}
              >
                {team.data
                  .filter((t) => t.active || t.id === form.owner_membership_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="form-row">
            Observações
            <textarea
              rows={3}
              maxLength={10000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          <label className="operational-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Disponível como origem de novos cards
          </label>
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function RealTasks() {
  const { page, size, setPage, setSize } = usePagination();
  const { api, can, refresh, notice } = useOperational(),
    [params, setParams] = useSearchParams(),
    selected = params.get('registro') || '',
        [search, setSearch] = useState(''),
    [editing, setEditing] = useState<TaskRow | 'new' | null>(null);
  const query = useQuery(
    () => api.list('tasks', page, size, selected ? { id: selected } : {}, search),
    [api, page, size, search, selected],
  );
  return (
    <>
      <div className="operational-toolbar">
        <SearchInput
          value={search}
          onChange={(s) => {
            setSearch(s);
            setPage(0);
          }}
          placeholder="Buscar tarefa..."
        />
        <Button disabled={!can('tasks.create')} onClick={() => setEditing('new')}>
          <Plus size={16} />
          Nova tarefa
        </Button>
      </div>
      {selected && (
        <Button
          variant="ghost"
          onClick={() => {
            setParams({});
            setPage(0);
          }}
        >
          Mostrar todas as tarefas
        </Button>
      )}
      <QueryState query={query} />
      {query.data && (
        <>
          <div className="card panel operational-table">
            <table>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Prazo</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {query.data.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <RecordTitle
                        title={row.title}
                        label={'Abrir tarefa ' + row.title}
                        onOpen={can('tasks.edit') ? () => setEditing(row) : undefined}
                      />
                      {row.completed_at && (
                        <small className="operational-cell-note">
                          Concluída em{' '}
                          {new Intl.DateTimeFormat('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                            timeZone: 'America/Sao_Paulo',
                          }).format(new Date(row.completed_at))}
                        </small>
                      )}
                    </td>
                    <td
                      className={
                        row.status !== 'done' && row.due_date < today() ? 'danger-text' : ''
                      }
                    >
                      {dateLabel(row.due_date)}
                    </td>
                    <td>
                      {row.status === 'done'
                        ? 'Concluída'
                        : row.status === 'in_progress'
                          ? 'Em andamento'
                          : 'A fazer'}
                    </td>
                    <td>
                      <Button
                        disabled={!can('tasks.edit')}
                        variant="outline"
                        size="icon"
                        onClick={() => setEditing(row)}
                        aria-label="Editar tarefa"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!query.data.rows.length && (
              <Empty
                title="Nenhuma tarefa encontrada"
                description="Organize os próximos passos de atendimento e os prazos da equipe."
              />
            )}
          </div>
          <Pager page={page} total={query.data.total} size={size} onSizeChange={setSize} onChange={setPage} />
        </>
      )}
      {editing && (
        <TaskDialog
          row={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            notice('Tarefa salva.');
          }}
        />
      )}
    </>
  );
}
function TaskDialog({
  row,
  onClose,
  onSaved,
}: {
  row?: TaskRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api, can, companyScope, company } = useOperational(),
    team = useTeam(),
    save = useSave(),
    initial = useQuery(
      async () => ({
        contact: row?.contact_id ? await api.get('contacts', row.contact_id) : null,
        card: row?.opportunity_id ? await api.get('cards', row.opportunity_id) : null,
      }),
      [api, row?.id],
    );
  const [form, setForm] = useState({
      title: row?.title || '',
      due_date: row?.due_date || today(),
      status: row?.status || 'todo',
      owner_membership_id: row?.owner_membership_id || company.membershipId,
      contact_id: row?.contact_id || '',
      opportunity_id: row?.opportunity_id || '',
    }),
    [contacts, setContacts] = useState<ContactRow[]>([]);
  return (
    <Modal
      open
      title={row ? 'Editar tarefa' : 'Nova tarefa'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <QueryState query={initial} />
      <QueryState query={team} />
      {initial.data && team.data && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run(async () => {
              await api.saveTask(
                {
                  ...form,
                  contact_id: form.contact_id || null,
                  opportunity_id: form.opportunity_id || null,
                },
                row?.id,
                row?.row_version,
              );
              onSaved();
            });
          }}
        >
          <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
            <label className="form-row">
              Título
              <Input
                required
                autoFocus
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label className="form-row">
                Prazo
                <Input
                  type="date"
                  required
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </label>
              <label className="form-row">
                Situação
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as TaskRow['status'] })
                  }
                >
                  <option value="todo">A fazer</option>
                  <option value="in_progress">Em andamento</option>
                  <option value="done">Concluída</option>
                </select>
              </label>
            </div>
            <RecordPicker
              label="Contato relacionado"
              value={form.contact_id ? [form.contact_id] : []}
              items={[...(initial.data.contact ? [initial.data.contact] : []), ...contacts].map(
                (c) => ({ id: c.id, label: c.name, detail: c.phone }),
              )}
              onChange={(ids) => {
                const contact = contacts.find((c) => c.id === ids[0]) || initial.data!.contact;
                setForm({
                  ...form,
                  contact_id: ids[0] || '',
                  opportunity_id: '',
                  owner_membership_id:
                    can('contacts.edit') && contact && ids[0]
                      ? contact.owner_membership_id
                      : form.owner_membership_id,
                });
              }}
              load={async (search, page) => {
                const r = await api.list('contacts', page, 25, {}, search);
                setContacts((old) => [
                  ...old,
                  ...r.rows.filter((c) => !old.some((x) => x.id === c.id)),
                ]);
                return {
                  ...r,
                  rows: r.rows.map((c) => ({ id: c.id, label: c.name, detail: c.phone })),
                };
              }}
            />
            {form.contact_id && (
              <RecordPicker
                key={form.contact_id}
                label="Card relacionado"
                value={form.opportunity_id ? [form.opportunity_id] : []}
                items={
                  initial.data.card
                    ? [
                        {
                          id: initial.data.card.id,
                          label: initial.data.card.title || 'Card sem título',
                        },
                      ]
                    : []
                }
                onChange={(ids) => setForm({ ...form, opportunity_id: ids[0] || '' })}
                load={async (search, page) => {
                  const r = await api.list(
                    'cards',
                    page,
                    25,
                    { contact_id: form.contact_id },
                    search,
                  );
                  return {
                    ...r,
                    rows: r.rows.map((c) => ({
                      id: c.id,
                      label: c.title || 'Card sem título',
                      detail: currency(c.value_cents),
                    })),
                  };
                }}
              />
            )}
            <label className="form-row">
              Responsável
              <select
                required
                disabled={!companyScope}
                value={form.owner_membership_id}
                onChange={(e) => setForm({ ...form, owner_membership_id: e.target.value })}
              >
                {team.data
                  .filter((t) => t.active || t.id === form.owner_membership_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
              </select>
            </label>
          </fieldset>
          <SaveActions save={save} onClose={onClose} />
        </form>
      )}
    </Modal>
  );
}
