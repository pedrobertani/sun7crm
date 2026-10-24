import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useCrm } from '../../app/context';
import type { Ambassador, AmbassadorSale } from '../../domain/types';
import {
  ambassadorTotals,
  inAmbassadorPeriod,
  type AmbassadorPeriod,
} from '../../domain/ambassadors';
import { currency, dateLabel, today, uid } from '../../lib/format';
import { Heading, FormActions, FormError } from '../../components/shared';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import './growth.css';

export function Ambassadors() {
  const { data, session, update, notice } = useCrm();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [period, setPeriod] = useState<AmbassadorPeriod>('month');
  const [editing, setEditing] = useState<Ambassador | null | undefined>();
  const [form, setForm] = useState({ name: '', commissionRate: '5', active: true, reward: '' });
  const [error, setError] = useState('');
  const [saleOpen, setSaleOpen] = useState(false);
  const [sale, setSale] = useState({ ambassadorId: '', customer: '', value: '', date: today() });
  const [saleError, setSaleError] = useState('');
  const [cancelling, setCancelling] = useState<AmbassadorSale | null>(null);
  const canEdit = session.role === 'manager';
  const people = data.ambassadors.filter((a) => a.companyId === session.companyId);
  const sales = data.ambassadorSales.filter(
    (s) => s.companyId === session.companyId && inAmbassadorPeriod(s.date, month, period),
  );
  const ranking = people
    .map((person) => ({ person, ...ambassadorTotals(person, sales, month, period) }))
    .sort(
      (a, b) =>
        b.points - a.points || b.value - a.value || a.person.name.localeCompare(b.person.name),
    );
  function open(person: Ambassador | null) {
    setEditing(person);
    setError('');
    setForm(
      person
        ? { ...person, commissionRate: String(person.commissionRate) }
        : { name: '', commissionRate: '5', active: true, reward: '' },
    );
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const commissionRate = Number(form.commissionRate);
    if (
      !form.name.trim() ||
      !Number.isFinite(commissionRate) ||
      commissionRate < 0 ||
      commissionRate > 100
    ) {
      setError('Informe o nome e uma comissão entre 0% e 100%.');
      return;
    }
    const person: Ambassador = {
      ...form,
      name: form.name.trim(),
      commissionRate,
      id: editing?.id || uid(),
      companyId: session.companyId,
    };
    if (
      update((d) => ({
        ...d,
        ambassadors: editing
          ? d.ambassadors.map((a) =>
              a.id === person.id && a.companyId === session.companyId ? person : a,
            )
          : [...d.ambassadors, person],
      }))
    ) {
      setEditing(undefined);
      notice('Embaixador salvo nesta demo.');
    }
  }
  function saveSale(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    const value = Math.round(Number(sale.value) * 100);
    const parsed = new Date(sale.date + 'T12:00:00Z');
    if (
      !people.some((a) => a.id === sale.ambassadorId && a.active) ||
      !sale.customer.trim() ||
      !Number.isSafeInteger(value) ||
      value <= 0 ||
      value > 100000000000 ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== sale.date
    ) {
      setSaleError('Confira o embaixador ativo, o nome, o valor e a data.');
      return;
    }
    const item: AmbassadorSale = {
      ...sale,
      customer: sale.customer.trim(),
      value,
      id: uid(),
      companyId: session.companyId,
      cancelled: false,
    };
    if (update((d) => ({ ...d, ambassadorSales: [...d.ambassadorSales, item] }))) {
      setMonth(sale.date.slice(0, 7));
      setSaleOpen(false);
      notice('Indicação fictícia registrada. Nenhuma venda ou pagamento real foi gerado.');
    }
  }
  function cancelSale() {
    if (!canEdit || !cancelling || cancelling.companyId !== session.companyId) return;
    if (
      update((d) => ({
        ...d,
        ambassadorSales: d.ambassadorSales.map((s) =>
          s.id === cancelling.id && s.companyId === session.companyId
            ? { ...s, cancelled: true }
            : s,
        ),
      }))
    ) {
      setCancelling(null);
      notice('Indicação cancelada na demo. Pontos e comissão recalculados.');
    }
  }
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTO E INDICAÇÕES"
        title="Embaixadores"
        description="Acompanhe quem indica novos clientes e explore a pontuação do programa."
      >
        {canEdit && (
          <>
            <Button variant="outline" onClick={() => open(null)}>
              Novo embaixador
            </Button>
            <Button
              onClick={() => {
                setSale({
                  ambassadorId: people.find((a) => a.active)?.id || '',
                  customer: '',
                  value: '',
                  date: today(),
                });
                setSaleError('');
                setSaleOpen(true);
              }}
            >
              Registrar indicação
            </Button>
          </>
        )}
      </Heading>
      <div className="card growth-rule">
        Na simulação, cada <strong>R$ 1.000,00 em vendas indicadas confirmadas vale 1 ponto</strong>
        , somando o período selecionado. Comissão e premiação são exemplos editáveis para validação;
        não geram pagamentos. Organize as ações em <Link to="/demo/estrategias">Estratégias</Link>.
      </div>
      <div className="growth-summary">
        <div className="card">
          <span>Embaixadores ativos</span>
          <strong>{people.filter((a) => a.active).length}</strong>
        </div>
        <div className="card">
          <span>Vendas indicadas no período</span>
          <strong>{currency(ranking.reduce((n, a) => n + a.value, 0))}</strong>
        </div>
        <div className="card">
          <span>Comissão simulada</span>
          <strong>{currency(ranking.reduce((n, a) => n + a.commission, 0))}</strong>
        </div>
      </div>
      <section className="card">
        <div className="toolbar">
          <strong>Classificação do período</strong>
          <div className="growth-controls">
            <label className="growth-filter">
              Mês de referência
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
            <label className="growth-filter">
              Período
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as AmbassadorPeriod)}
              >
                <option value="month">Mensal</option>
                <option value="quarter">Trimestral</option>
                <option value="semester">Semestral</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Embaixador</th>
                <th>Indicações</th>
                <th>Vendas indicadas</th>
                <th>Pontos</th>
                <th>Comissão simulada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ person, count, value, points, commission }, i) => (
                <tr key={person.id}>
                  <td>
                    <strong>
                      {i + 1}. {person.name}
                    </strong>
                    <small className="growth-note">
                      {person.active ? 'Ativo' : 'Inativo'}
                      {person.reward ? ' · ' + person.reward : ''}
                    </small>
                  </td>
                  <td>{count}</td>
                  <td>{currency(value)}</td>
                  <td>
                    <strong>{points}</strong>
                  </td>
                  <td>
                    {currency(commission)}
                    <small className="growth-note">{person.commissionRate}% · exemplo</small>
                  </td>
                  <td>
                    <Button variant="outline" size="sm" onClick={() => open(person)}>
                      {canEdit ? 'Editar' : 'Detalhes'}
                    </Button>
                  </td>
                </tr>
              ))}
              {!ranking.length && (
                <tr>
                  <td colSpan={6} className="growth-empty">
                    Nenhum embaixador cadastrado nesta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card growth-section">
        <div className="toolbar">
          <h2>Indicações do período</h2>
          <span className="muted">Cancelamentos não pontuam</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente indicado</th>
                <th>Embaixador</th>
                <th>Data</th>
                <th>Valor</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sales
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((s) => (
                  <tr key={s.id}>
                    <td>{s.customer}</td>
                    <td>
                      {people.find((a) => a.id === s.ambassadorId)?.name || 'Embaixador inativo'}
                    </td>
                    <td>{dateLabel(s.date)}</td>
                    <td>{currency(s.value)}</td>
                    <td>
                      <span className={'badge ' + (s.cancelled ? 'gray' : 'good')}>
                        {s.cancelled ? 'Cancelada' : 'Confirmada'}
                      </span>
                    </td>
                    <td>
                      {canEdit && !s.cancelled ? (
                        <Button size="sm" variant="outline" onClick={() => setCancelling(s)}>
                          Cancelar indicação
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              {!sales.length && (
                <tr>
                  <td colSpan={6} className="growth-empty">
                    Nenhuma indicação neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {!canEdit && (
        <p className="small-note">
          O gestor cadastra embaixadores e gerencia as indicações desta demo.
        </p>
      )}
      <Modal
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title={
          canEdit ? (editing ? 'Editar embaixador' : 'Novo embaixador') : 'Detalhes do embaixador'
        }
        description="Cadastro fictício. A comissão é apenas uma simulação."
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
                Comissão simulada (%)
                <Input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.commissionRate}
                  onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                />
              </label>
              <label className="form-row">
                Situação
                <select
                  value={String(form.active)}
                  onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </label>
              <label className="form-row span2">
                Premiação / observação
                <Input
                  maxLength={250}
                  value={form.reward}
                  onChange={(e) => setForm({ ...form, reward: e.target.value })}
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
      <Modal
        open={saleOpen}
        onOpenChange={setSaleOpen}
        title="Registrar indicação"
        description="Informe uma venda fictícia para explorar pontos e comissão."
      >
        <form onSubmit={saveSale}>
          <div className="form-grid">
            <label className="form-row span2">
              Embaixador
              <select
                required
                value={sale.ambassadorId}
                onChange={(e) => setSale({ ...sale, ambassadorId: e.target.value })}
              >
                <option value="">Selecione</option>
                {people
                  .filter((a) => a.active)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-row span2">
              Cliente indicado
              <Input
                required
                maxLength={120}
                value={sale.customer}
                onChange={(e) => setSale({ ...sale, customer: e.target.value })}
              />
            </label>
            <label className="form-row">
              Valor confirmado (R$)
              <Input
                required
                type="number"
                min="0.01"
                max="1000000000"
                step="0.01"
                value={sale.value}
                onChange={(e) => setSale({ ...sale, value: e.target.value })}
              />
            </label>
            <label className="form-row">
              Data
              <Input
                required
                type="date"
                value={sale.date}
                onChange={(e) => setSale({ ...sale, date: e.target.value })}
              />
            </label>
          </div>
          <FormError message={saleError} />
          <FormActions onCancel={() => setSaleOpen(false)} label="Registrar indicação" />
        </form>
      </Modal>
      <Modal
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title="Cancelar esta indicação?"
        description="O histórico será preservado, mas esta indicação deixará de contar nos pontos e na comissão simulada."
      >
        <p>
          <strong>{cancelling?.customer}</strong> · {currency(cancelling?.value || 0)}
        </p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setCancelling(null)}>
            Manter indicação
          </Button>
          <Button onClick={cancelSale}>Confirmar cancelamento</Button>
        </div>
      </Modal>
    </>
  );
}
