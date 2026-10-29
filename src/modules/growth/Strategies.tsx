import { Pencil, Eye } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RecordTitle } from '../../components/RecordTitle';
import { useCrm } from '../../app/context';
import type { Strategy } from '../../domain/types';
import { currency, today, uid } from '../../lib/format';
import { Heading, SearchInput, FormActions, FormError } from '../../components/shared';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import './growth.css';

const statuses = { planned: 'Planejada', active: 'Em andamento', completed: 'Concluída' };
const channels = [
  'Tráfego pago',
  'Indicação',
  'Parcerias',
  'Instagram',
  'Black Friday',
  'Embaixadores',
  'Outra',
];
export function Strategies() {
  const { data, session, update, notice } = useCrm();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Strategy | null | undefined>();
  const [form, setForm] = useState({
    name: '',
    month,
    channel: channels[0],
    status: 'planned' as Strategy['status'],
    budget: '0',
    ownerId: session.memberId,
    notes: '',
  });
  const [error, setError] = useState('');
  const canEdit = session.role === 'manager';
  const members = data.members.filter((m) => m.companyId === session.companyId);
  const all = data.strategies.filter((s) => s.companyId === session.companyId && s.month === month);
  const rows = all.filter((s) =>
    (s.name + ' ' + s.channel).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  function open(item: Strategy | null) {
    setEditing(item);
    setError('');
    setForm(
      item
        ? { ...item, budget: String(item.budget / 100) }
        : {
            name: '',
            month,
            channel: channels[0],
            status: 'planned',
            budget: '0',
            ownerId: session.memberId,
            notes: '',
          },
    );
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const budget = Math.round(Number(form.budget) * 100);
    if (
      !form.name.trim() ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.month) ||
      !Number.isSafeInteger(budget) ||
      budget < 0 ||
      budget > 100000000000
    ) {
      setError('Confira nome, mês e orçamento.');
      return;
    }
    if (!members.some((m) => m.id === form.ownerId)) {
      setError('Escolha um responsável desta empresa.');
      return;
    }
    const item: Strategy = {
      ...form,
      id: editing?.id || uid(),
      companyId: session.companyId,
      name: form.name.trim(),
      budget,
    };
    if (
      update((d) => ({
        ...d,
        strategies: editing
          ? d.strategies.map((s) =>
              s.id === item.id && s.companyId === session.companyId ? item : s,
            )
          : [...d.strategies, item],
      }))
    ) {
      setMonth(item.month);
      setEditing(undefined);
      notice('Estratégia salva nesta demo.');
    }
  }
  return (
    <>
      <Heading
        eyebrow="PLANEJAMENTO COMERCIAL"
        title="Estratégias"
        description="Organize as ações do mês e acompanhe o que está em andamento."
      >
        {canEdit && <Button onClick={() => open(null)}>Nova estratégia</Button>}
      </Heading>
      <div className="growth-summary">
        <div className="card">
          <span>Ações no mês</span>
          <strong>{all.length}</strong>
        </div>
        <div className="card">
          <span>Em andamento</span>
          <strong>{all.filter((s) => s.status === 'active').length}</strong>
        </div>
        <div className="card">
          <span>Orçamento planejado</span>
          <strong>{currency(all.reduce((n, s) => n + s.budget, 0))}</strong>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar estratégia" />
          <label className="growth-filter">
            Mês
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Estratégia</th>
                <th>Canal</th>
                <th>Responsável</th>
                <th>Orçamento</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <RecordTitle title={s.name} onOpen={() => open(s)} />
                    {s.notes && <small className="growth-note">{s.notes}</small>}
                  </td>
                  <td>{s.channel}</td>
                  <td>{members.find((m) => m.id === s.ownerId)?.name || 'Não atribuído'}</td>
                  <td>{currency(s.budget)}</td>
                  <td>
                    <span className={'badge ' + (s.status === 'active' ? 'good' : 'gray')}>
                      {statuses[s.status]}
                    </span>
                  </td>
                  <td>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label={(canEdit ? 'Editar ' : 'Detalhes de ') + s.name}
                      onClick={() => open(s)}
                    >
                      {canEdit ? <Pencil size={16} /> : <Eye size={16} />}
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="growth-empty">
                    Nenhuma estratégia encontrada para este mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small-note">
        Planejamento demonstrativo: não publica anúncios nem envia mensagens.{' '}
        {canEdit ? '' : 'O gestor edita as estratégias.'}
      </p>
      <Modal
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title={
          canEdit ? (editing ? 'Editar estratégia' : 'Nova estratégia') : 'Detalhes da estratégia'
        }
        description="Dados fictícios salvos apenas neste navegador."
      >
        <form onSubmit={save}>
          <fieldset disabled={!canEdit} className="growth-fieldset">
            <div className="form-grid">
              <label className="form-row span2">
                Nome
                <Input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="form-row">
                Mês
                <Input
                  required
                  type="month"
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: e.target.value })}
                />
              </label>
              <label className="form-row">
                Canal
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                >
                  {channels.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                Responsável
                <select
                  value={form.ownerId}
                  onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                Orçamento (R$)
                <Input
                  required
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                />
              </label>
              <label className="form-row span2">
                Situação
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as Strategy['status'] })
                  }
                >
                  {Object.entries(statuses).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row span2">
                Objetivo, mensagem ou premiação
                <textarea
                  maxLength={2000}
                  rows={4}
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
