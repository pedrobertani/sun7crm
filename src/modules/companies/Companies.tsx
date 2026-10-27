import { useSearchParams } from 'react-router-dom';
import { RecordTitle } from '../../components/RecordTitle';
import { filterCompanies, companyFilterLabels } from '../../domain/filters';
import { AppliedFilter } from '../../components/shared';
import { CurrencyInput } from '../../components/currency-input';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Building2 } from 'lucide-react';
import { useCrm } from '../../app/context';
import type { Company, Template } from '../../domain/types';
import { defaultStages } from '../../domain/config';
import { currency, dateLabel, today, shiftDate, uid } from '../../lib/format';
import { Heading, SearchInput, Empty, FormActions, FormError } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
const initial = {
  name: '',
  segment: '',
  template: 'aesthetic' as Template,
  monthlyAmount: '199.00',
  dueDate: shiftDate(today(), 30),
  enabled: true,
  managerName: '',
  managerEmail: '',
};
export function Companies() {
  const { data, update, notice } = useCrm();
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  const status = params.get('situacao') || 'all';
  const portfolio = params.get('carteira') || 'all';
  const days = ['7', '30', '90'].includes(params.get('periodo') || '')
    ? Number(params.get('periodo'))
    : 30;
  const date = today(),
    from = shiftDate(date, -days + 1);
  function setStatus(value: string) {
    const next = new URLSearchParams(params);
    next.set('situacao', value);
    setParams(next);
  }
  const [editing, setEditing] = useState<Company | null | undefined>();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const companies = filterCompanies(
    filterCompanies(data.companies, portfolio, from, date),
    status,
    from,
    date,
  ).filter((c) => c.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function open(c: Company | null) {
    setEditing(c);
    setError('');
    setForm(
      c
        ? {
            ...c,
            monthlyAmount: (c.monthlyAmount / 100).toFixed(2),
            managerName:
              data.members.find((m) => m.companyId === c.id && m.role === 'manager' && m.active)
                ?.name || '',
            managerEmail:
              data.members.find((m) => m.companyId === c.id && m.role === 'manager' && m.active)
                ?.email || '',
          }
        : initial,
    );
  }
  function save(e: FormEvent) {
    e.preventDefault();
    const amount = Math.round(Number(form.monthlyAmount) * 100);
    if (!form.name.trim() || !Number.isFinite(amount) || amount < 0) {
      setError('Confira o nome e informe um valor mensal válido.');
      return;
    }
    if (!form.managerName.trim() || !form.managerEmail.trim()) {
      setError('Informe o gestor responsável e seu e-mail.');
      return;
    }
    const currentManager = data.members.find(
      (m) => m.companyId === editing?.id && m.role === 'manager' && m.active,
    );
    if (
      data.members.some(
        (m) =>
          m.companyId === editing?.id &&
          m.id !== currentManager?.id &&
          m.email.toLowerCase() === form.managerEmail.trim().toLowerCase(),
      )
    ) {
      setError('Este e-mail já pertence a outro integrante da equipe.');
      return;
    }
    const company: Company = {
      segment: form.segment,
      template: form.template,
      enabled: form.enabled,
      dueDate: form.dueDate,
      id: editing?.id || uid(),
      name: form.name.trim(),
      monthlyAmount: amount,
      createdAt: editing?.createdAt || today(),
      displayName: editing?.displayName,
      logo: editing?.logo,
      theme: editing?.theme,
    };
    if (
      update((d) => ({
        ...d,
        companies: editing
          ? d.companies.map((c) => (c.id === editing.id ? company : c))
          : [...d.companies, company],
        members: currentManager
          ? d.members.map((m) =>
              m.id === currentManager.id
                ? { ...m, name: form.managerName.trim(), email: form.managerEmail.trim() }
                : m,
            )
          : [
              ...d.members,
              {
                id: uid(),
                companyId: company.id,
                name: form.managerName.trim(),
                email: form.managerEmail.trim(),
                role: 'manager',
                active: true,
              },
            ],
        boards: editing
          ? d.boards
          : [
              ...d.boards,
              ...(['leads', 'clients'] as const).map((kind) => ({
                id: uid(),
                companyId: company.id,
                kind,
                stages: defaultStages[kind].map((name) => ({ id: uid(), name })),
              })),
            ],
      }))
    ) {
      setEditing(undefined);
      notice(
        editing
          ? 'Empresa atualizada.'
          : 'Empresa e gestor fictícios cadastrados. Nenhum login real foi criado.',
      );
    }
  }
  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO"
        title="Empresas"
        description="Defina a identidade, o valor e o vencimento de cada empresa."
      >
        <Button onClick={() => open(null)}>
          <Plus size={16} />
          Nova empresa
        </Button>
      </Heading>
      {params.toString() && (
        <AppliedFilter
          label={`Painel: ${[companyFilterLabels[portfolio] || 'Todas as empresas', ...(status !== portfolio ? [companyFilterLabels[status] || 'Todas as situações'] : [])].join(' · ')}${status === 'new' || portfolio === 'new' ? ` · últimos ${days} dias` : ''}`}
          onClear={() => setParams({})}
        />
      )}
      <div className="card">
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar empresa" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Situação das empresas"
          >
            <option value="all">Todas as situações</option>
            <option value="active">Ativas</option>
            <option value="inactive">Desativadas</option>
            <option value="upcoming">Vencem em até 7 dias</option>
            <option value="new">Novas no período</option>
            <option value="overdue">Com vencimento passado</option>
          </select>
          <span className="muted result-count">{companies.length} empresas</span>
        </div>
        {companies.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Template</th>
                  <th>Valor mensal</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">
                          <Building2 size={17} />
                        </span>
                        <div>
                          <RecordTitle title={c.name} onOpen={() => open(c)} />
                          <small>{c.segment}</small>
                        </div>
                      </div>
                    </td>
                    <td>{c.template === 'aesthetic' ? 'Estética' : 'Genérico'}</td>
                    <td>{currency(c.monthlyAmount)}</td>
                    <td>{dateLabel(c.dueDate)}</td>
                    <td>
                      <span className={'badge ' + (c.enabled ? 'good' : 'gray')}>
                        {c.enabled ? 'Ativa' : 'Desativada'}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => open(c)}
                        aria-label={'Editar ' + c.name}
                      >
                        <Pencil size={14} />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma empresa encontrada"
            description="Ajuste a busca ou cadastre uma empresa."
          />
        )}
      </div>
      <Modal
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title={editing ? 'Editar empresa' : 'Nova empresa'}
        description="Sem planos: o valor e o vencimento são definidos individualmente."
      >
        <form onSubmit={save}>
          <div className="form-grid">
            <label className="form-row span2">
              Nome da empresa
              <Input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="form-row span2">
              Segmento
              <Input
                required
                maxLength={100}
                value={form.segment}
                onChange={(e) => setForm({ ...form, segment: e.target.value })}
              />
            </label>
            <label className="form-row">
              Gestor responsável
              <Input
                required
                maxLength={100}
                value={form.managerName}
                onChange={(e) => setForm({ ...form, managerName: e.target.value })}
              />
            </label>
            <label className="form-row">
              E-mail do gestor
              <Input
                required
                type="email"
                value={form.managerEmail}
                onChange={(e) => setForm({ ...form, managerEmail: e.target.value })}
              />
            </label>
            <label className="form-row">
              Template do segmento
              <select
                value={form.template}
                onChange={(e) => setForm({ ...form, template: e.target.value as Template })}
              >
                <option value="aesthetic">Estética</option>
                <option value="generic">Genérico</option>
              </select>
            </label>
            <label className="form-row">
              Situação
              <select
                value={String(form.enabled)}
                onChange={(e) => setForm({ ...form, enabled: e.target.value === 'true' })}
              >
                <option value="true">Ativa</option>
                <option value="false">Desativada</option>
              </select>
            </label>
            <label className="form-row">
              Valor mensal (R$)
              <CurrencyInput
                required
                value={form.monthlyAmount}
                onValueChange={(value) => setForm({ ...form, monthlyAmount: value })}
              />
            </label>
            <label className="form-row">
              Vencimento
              <Input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
          </div>
          <p className="small-note">
            Somente Caio altera o segmento e seu template. A troca preserva contatos, tarefas,
            histórico e etapas personalizadas dos funis.
          </p>
          <FormError message={error} />
          <FormActions onCancel={() => setEditing(undefined)} />
        </form>
      </Modal>
    </>
  );
}
