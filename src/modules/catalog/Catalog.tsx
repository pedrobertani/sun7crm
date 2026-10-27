import { useState, type FormEvent } from 'react';
import { RecordTitle } from '../../components/RecordTitle';
import { useCrm } from '../../app/context';
import { Heading, FormActions, FormError } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { uid, currency } from '../../lib/format';
import type { CatalogItem, Label } from '../../domain/types';

export function Catalog() {
  const { data, session, update } = useCrm();
  const manager = session.role === 'manager';
  const [editing, setEditing] = useState<CatalogItem | null | undefined>();
  const [error, setError] = useState('');
  const items = (data.catalog || []).filter((i) => i.companyId === session.companyId);
  function open(item?: CatalogItem) {
    setError('');
    setEditing(
      item || {
        id: uid(),
        companyId: session.companyId,
        kind: 'service',
        name: '',
        description: '',
        value: 0,
        active: true,
      },
    );
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!manager || !editing) return;
    if (!editing.name.trim() || !Number.isSafeInteger(editing.value) || editing.value < 0) {
      setError('Informe nome e valor válido.');
      return;
    }
    if (
      update((d) => ({
        ...d,
        catalog: [
          ...(d.catalog || []).filter((i) => i.id !== editing.id),
          { ...editing, name: editing.name.trim() },
        ],
      }))
    )
      setEditing(undefined);
  }
  return (
    <>
      <Heading
        eyebrow="ÁREA DE TRABALHO"
        title="Serviços e produtos"
        description="Catálogo da empresa. Itens desativados permanecem no histórico dos cards."
      >
        {manager && <Button onClick={() => open()}>Novo serviço ou produto</Button>}
      </Heading>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Descrição</th>
                <th>Valor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <RecordTitle title={i.name} onOpen={manager ? () => open(i) : undefined} />
                  </td>
                  <td>{i.kind === 'service' ? 'Serviço' : 'Produto'}</td>
                  <td>{i.description}</td>
                  <td>{currency(i.value)}</td>
                  <td>{i.active ? 'Ativo' : 'Inativo'}</td>
                  <td>
                    {manager && (
                      <Button variant="outline" onClick={() => open(i)}>
                        Editar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={6}>Nenhum item cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Modal
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title="Serviço ou produto"
      >
        {editing && (
          <form onSubmit={save}>
            <label className="form-row">
              Tipo
              <select
                value={editing.kind}
                onChange={(e) =>
                  setEditing({ ...editing, kind: e.target.value as CatalogItem['kind'] })
                }
              >
                <option value="service">Serviço</option>
                <option value="product">Produto</option>
              </select>
            </label>
            <label className="form-row">
              Nome
              <Input
                required
                maxLength={120}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="form-row">
              Descrição
              <Input
                maxLength={500}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <label className="form-row">
              Valor (R$)
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                value={editing.value / 100}
                onChange={(e) =>
                  setEditing({ ...editing, value: Math.round(Number(e.target.value) * 100) })
                }
              />
            </label>
            <label className="form-row">
              Situação
              <select
                value={String(editing.active)}
                onChange={(e) => setEditing({ ...editing, active: e.target.value === 'true' })}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
            <FormError message={error} />
            <FormActions onCancel={() => setEditing(undefined)} />
          </form>
        )}
      </Modal>
    </>
  );
}
export function Labels() {
  const { data, session, update } = useCrm();
  const manager = session.role === 'manager';
  const [editing, setEditing] = useState<Label | null>(null);
  const [error, setError] = useState('');
  const labels = (data.labels || []).filter((l) => l.companyId === session.companyId);
  function save(e: FormEvent) {
    e.preventDefault();
    if (!manager || !editing) return;
    if (
      labels.some(
        (l) =>
          l.id !== editing.id &&
          l.name.toLocaleLowerCase() === editing.name.trim().toLocaleLowerCase(),
      )
    ) {
      setError('Já existe uma etiqueta com esse nome.');
      return;
    }
    if (
      update((d) => ({
        ...d,
        labels: [
          ...(d.labels || []).filter((l) => l.id !== editing.id),
          { ...editing, name: editing.name.trim() },
        ],
      }))
    )
      setEditing(null);
  }
  return (
    <>
      <Heading
        eyebrow="ÁREA DE TRABALHO"
        title="Etiquetas"
        description="O gestor define nomes e cores. Cada card pode receber até 3 etiquetas."
      >
        {manager && (
          <Button
            onClick={() => {
              setError('');
              setEditing({ id: uid(), companyId: session.companyId, name: '', color: '#8b5cf6' });
            }}
          >
            Nova etiqueta
          </Button>
        )}
      </Heading>
      <section className="card">
        <div className="toolbar">
          {labels.map((l) => (
            <Button
              key={l.id}
              variant="outline"
              onClick={() => {
                if (manager) {
                  setError('');
                  setEditing(l);
                }
              }}
            >
              <span style={{ background: l.color, width: 12, height: 12, borderRadius: 6 }} />
              {l.name}
            </Button>
          ))}
          {!labels.length && <p>Nenhuma etiqueta cadastrada.</p>}
        </div>
      </section>
      <Modal open={!!editing} onOpenChange={(v) => !v && setEditing(null)} title="Etiqueta">
        {editing && (
          <form onSubmit={save}>
            <label className="form-row">
              Nome
              <Input
                required
                maxLength={50}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label className="form-row">
              Cor
              <Input
                type="color"
                value={editing.color}
                onChange={(e) => setEditing({ ...editing, color: e.target.value })}
              />
            </label>
            <FormError message={error} />
            <FormActions onCancel={() => setEditing(null)} />
          </form>
        )}
      </Modal>
    </>
  );
}
