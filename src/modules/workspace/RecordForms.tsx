import { useState } from 'react';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import { CurrencyInput } from '../../components/currency-input';
import type { CatalogRow, ContactRow, LabelRow } from '../../data/backend';
import {
  cents,
  QueryState,
  SaveActions,
  useOperational,
  useQuery,
  useSave,
  useTeam,
} from './operational';
import { RecordPicker } from './RecordPicker';
import { currency } from '../../lib/format';

export function CatalogDialog({
  item,
  name = '',
  onClose,
  onSaved,
}: {
  item?: CatalogRow;
  name?: string;
  onClose: () => void;
  onSaved: (row: CatalogRow) => void;
}) {
  const { api } = useOperational(),
    save = useSave();
  const [form, setForm] = useState({
    name: item?.name || name,
    kind: item?.kind || 'service',
    description: item?.description || '',
    price: ((item?.value_cents || 0) / 100).toFixed(2),
    active: item?.active ?? true,
  });
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !save.busy && onClose()}
      title={item ? 'Editar serviço ou produto' : 'Cadastrar serviço ou produto'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const input = {
              name: form.name.trim(),
              kind: form.kind as 'service' | 'product',
              description: form.description,
              value_cents: cents(form.price),
              active: form.active,
            };
            const row = item
              ? await api.patch('catalog', item.id, input)
              : await api.create('catalog', input);
            onSaved(row);
          });
        }}
      >
        <fieldset disabled={save.busy || save.uncertain} className="operational-fields">
          <label className="form-row">
            Nome
            <Input
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="form-row">
              Tipo
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as 'service' | 'product' })
                }
              >
                <option value="service">Serviço</option>
                <option value="product">Produto</option>
              </select>
            </label>
            <label className="form-row">
              Valor (R$)
              <CurrencyInput
                required
                value={form.price}
                onValueChange={(price) => setForm({ ...form, price })}
              />
            </label>
          </div>
          <label className="form-row">
            Descrição
            <textarea
              maxLength={4000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          {item && (
            <label className="operational-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Disponível para novas seleções
            </label>
          )}
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function LabelDialog({
  item,
  name = '',
  onClose,
  onSaved,
}: {
  item?: LabelRow;
  name?: string;
  onClose: () => void;
  onSaved: (row: LabelRow) => void;
}) {
  const { api } = useOperational(),
    save = useSave();
  const [form, setForm] = useState({
    name: item?.name || name,
    color: item?.color || '#8b5cf6',
    active: item?.active ?? true,
  });
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !save.busy && onClose()}
      title={item ? 'Editar etiqueta' : 'Cadastrar etiqueta'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const row = item
              ? await api.patch('labels', item.id, form)
              : await api.create('labels', form);
            onSaved(row);
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Nome
            <Input
              required
              maxLength={50}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="form-row">
            Cor
            <Input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
            />
          </label>
          {item && (
            <label className="operational-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Disponível para novas seleções
            </label>
          )}
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function ContactDialog({
  contact,
  name = '',
  onClose,
  onSaved,
}: {
  contact?: ContactRow;
  name?: string;
  onClose: () => void;
  onSaved: (row: ContactRow) => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    team = useTeam();
  const details = useQuery(
    async () => ({
      contact: contact ? await api.contactDetails(contact.id) : null,
      catalog: await api.all('catalog'),
    }),
    [api, contact?.id],
  );
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !save.busy && onClose()}
      title={contact ? 'Editar contato' : 'Cadastrar novo contato'}
      description="A mesma pessoa pode ter vários cards, cada um com seu próprio andamento."
    >
      <QueryState query={details} />
      {details.data && team.data && (
        <ContactFields
          key={contact?.id || 'new'}
          data={details.data}
          name={name}
          team={team.data}
          save={save}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
      <QueryState query={team} />
    </Modal>
  );
}
function ContactFields({
  data,
  name,
  team,
  save,
  onClose,
  onSaved,
}: {
  data: { contact: ContactRow | null; catalog: CatalogRow[] };
  name: string;
  team: import('../../data/backend').TeamRow[];
  save: ReturnType<typeof useSave>;
  onClose: () => void;
  onSaved: (row: ContactRow) => void;
}) {
  const { api, company, can, companyScope } = useOperational(),
    c = data.contact;
  const [form, setForm] = useState({
      name: c?.name || name,
      phone: c?.phone || '',
      email: c?.email || '',
      temperature: c?.temperature || 'unclassified',
      owner_membership_id: c?.owner_membership_id || company.membershipId,
      notes: c?.notes || '',
      catalog_ids: c?.catalog_ids || ([] as string[]),
    }),
    [catalog, setCatalog] = useState(data.catalog),
    [adding, setAdding] = useState<string | null>(null);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const row = await api.saveContact(form, c?.id, c?.row_version);
            onSaved(row);
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
              Telefone com DDD
              <Input
                inputMode="tel"
                maxLength={30}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="form-row">
              E-mail
              <Input
                type="email"
                maxLength={254}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="form-row">
              Temperatura
              <select
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              >
                <option value="unclassified">Sem classificação</option>
                <option value="cold">Frio</option>
                <option value="warm">Morno</option>
                <option value="hot">Quente</option>
              </select>
            </label>
            <label className="form-row">
              Responsável
              <select
                required
                value={form.owner_membership_id}
                disabled={!companyScope}
                onChange={(e) => setForm({ ...form, owner_membership_id: e.target.value })}
              >
                {team
                  .filter((t) => t.active || t.id === form.owner_membership_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                      {!t.active ? ' · Inativo' : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <RecordPicker
            label="Serviços e produtos de interesse"
            multiple
            items={catalog.map((i) => ({
              id: i.id,
              label: i.name,
              detail: `${i.kind === 'service' ? 'Serviço' : 'Produto'} · ${currency(i.value_cents)}${!i.active ? ' · Inativo' : ''}`,
              disabled: !i.active,
            }))}
            value={form.catalog_ids}
            onChange={(catalog_ids) => setForm({ ...form, catalog_ids })}
            onCreate={can('catalog.create') ? setAdding : undefined}
            createLabel="Cadastrar serviço ou produto"
          />
          <label className="form-row">
            Observações
            <textarea
              rows={3}
              maxLength={10000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
      {adding !== null && (
        <CatalogDialog
          name={adding}
          onClose={() => setAdding(null)}
          onSaved={(row) => {
            setCatalog((old) => [...old, row]);
            setForm((f) => ({ ...f, catalog_ids: [...f.catalog_ids, row.id] }));
            setAdding(null);
          }}
        />
      )}
    </>
  );
}
