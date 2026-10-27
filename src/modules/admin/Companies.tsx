import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AppliedFilter, Empty, FormError, Heading, SearchInput } from '../../components/shared';
import { RecordTitle } from '../../components/RecordTitle';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { CurrencyInput } from '../../components/currency-input';
import { filterCompanies, companyFilterLabels } from '../../domain/filters';
import type { Template } from '../../domain/types';
import { currency, dateLabel, shiftDate, today, uid } from '../../lib/format';
import { CRM_THEMES, type CrmTheme } from '../../lib/themes';
import { getSupabaseClient } from '../../lib/supabase';
import { AccessChangedError } from '../auth/access';
import { stateLabels, subscriptionState } from '../billing/subscription';
import { CompanyUsers } from './CompanyUsers';
import {
  AdminCommandError,
  companyInput,
  managerInput,
  createAdminCompany,
  createAdminManager,
  updateAdminCompany,
  type AdminCompany,
  type CompanyInput,
  type ManagerInput,
  type CompanyUpdateInput,
} from './repository';

function initialCompany() {
  return {
    name: '',
    segment: '',
    template: 'aesthetic' as Template,
    theme: 'sun7' as CrmTheme,
    amount: '189.90',
    dueDate: today(),
    enabled: false,
  };
}
type Attempt<T> = { id: string; input: T };
type Recovery = AdminCommandError['recovery'] | null;

export function AdminCompanies({
  companies,
  userId,
  onReload,
  onRecheck,
  onNotice,
}: {
  companies: AdminCompany[];
  userId: string;
  onReload: () => void;
  onRecheck: () => void;
  onNotice: (message: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<string | null>(null);
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null);
  const [companyForm, setCompanyForm] = useState(initialCompany);
  const [companyAttempt, setCompanyAttempt] = useState<Attempt<
    CompanyInput | CompanyUpdateInput
  > | null>(null);
  const [companyError, setCompanyError] = useState('');
  const [companyRecovery, setCompanyRecovery] = useState<Recovery>(null);
  const [companyBusy, setCompanyBusy] = useState(false);
  const [managerCompany, setManagerCompany] = useState<{ id: string; name: string } | null>(null);
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '' });
  const [managerAttempt, setManagerAttempt] = useState<Attempt<ManagerInput> | null>(null);
  const [managerError, setManagerError] = useState('');
  const [managerRecovery, setManagerRecovery] = useState<Recovery>(null);
  const [managerBusy, setManagerBusy] = useState(false);
  const status = params.get('situacao') || 'all',
    portfolio = params.get('carteira') || 'all';
  const days = ['7', '30', '90'].includes(params.get('periodo') || '')
    ? Number(params.get('periodo'))
    : 30;
  const date = today(),
    from = shiftDate(date, -days + 1);
  const rows = filterCompanies(
    filterCompanies(companies, portfolio, from, date),
    status,
    from,
    date,
  )
    .filter((c) =>
      `${c.name} ${c.segment}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.trim().toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) as AdminCompany[];
  const selected = companies.find((c) => c.id === details);
  const companyLocked = companyBusy || companyRecovery === 'retry' || companyRecovery === 'review';
  const managerLocked = managerBusy || managerRecovery === 'retry' || managerRecovery === 'review';

  function openCompany() {
    setEditingCompany(null);
    setCompanyForm(initialCompany());
    setCompanyError('');
    setCompanyAttempt(null);
    setCompanyRecovery(null);
    setNewCompanyOpen(true);
  }
  function editCompany(company: AdminCompany) {
    setDetails(null);
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      segment: company.segment,
      template: company.template,
      theme: company.theme || 'sun7',
      amount: (company.monthlyAmount / 100).toFixed(2),
      dueDate: company.dueDate,
      enabled: company.enabled,
    });
    setCompanyError('');
    setCompanyAttempt(null);
    setCompanyRecovery(null);
    setNewCompanyOpen(true);
  }
  function openManager(company: { id: string; name: string }) {
    setDetails(null);
    setManagerForm({ name: '', email: '', password: '' });
    setManagerError('');
    setManagerAttempt(null);
    setManagerRecovery(null);
    setManagerCompany(company);
  }
  function closeCompany(open: boolean) {
    if (open || companyBusy || companyRecovery === 'retry') return;
    setNewCompanyOpen(false);
    setCompanyAttempt(null);
    setCompanyError('');
    if (companyRecovery === 'review') onReload();
  }
  function closeManager(open: boolean) {
    if (open || managerBusy || managerRecovery === 'retry') return;
    setManagerCompany(null);
    setManagerForm({ name: '', email: '', password: '' });
    setManagerAttempt(null);
    setManagerError('');
    if (managerRecovery === 'review') onReload();
  }

  async function saveCompany(event: FormEvent) {
    event.preventDefault();
    if (companyBusy || companyRecovery === 'review') return;
    let attempt: Attempt<CompanyInput | CompanyUpdateInput>;
    try {
      const values = companyInput(companyForm);
      attempt = companyAttempt || {
        id: uid(),
        input: editingCompany
          ? { ...values, company_id: editingCompany.id, enabled: companyForm.enabled }
          : values,
      };
    } catch (error) {
      setCompanyError((error as Error).message);
      return;
    }
    setCompanyAttempt(attempt);
    setCompanyBusy(true);
    setCompanyError('');
    try {
      const result = editingCompany
        ? await updateAdminCompany(
            getSupabaseClient(),
            userId,
            attempt.input as CompanyUpdateInput,
            attempt.id,
          )
        : await createAdminCompany(getSupabaseClient(), userId, attempt.input, attempt.id);
      setNewCompanyOpen(false);
      setCompanyAttempt(null);
      setCompanyRecovery(null);
      onNotice(
        editingCompany
          ? 'Empresa e vencimento atualizados.'
          : 'Empresa cadastrada. Agora cadastre o gestor responsável.',
      );
      onReload();
      if (!editingCompany) openManager({ id: result.company_id, name: attempt.input.name });
    } catch (error) {
      if (
        error instanceof AccessChangedError ||
        (error instanceof AdminCommandError && error.recovery === 'access')
      ) {
        setNewCompanyOpen(false);
        onRecheck();
        return;
      }
      const recovery = error instanceof AdminCommandError ? error.recovery : 'edit';
      setCompanyRecovery(recovery);
      setCompanyError(
        error instanceof AdminCommandError
          ? error.message
          : 'Não foi possível verificar seu acesso. Tente novamente.',
      );
      if (recovery === 'edit') setCompanyAttempt(null);
    } finally {
      setCompanyBusy(false);
    }
  }
  async function saveManager(event: FormEvent) {
    event.preventDefault();
    if (!managerCompany || managerBusy || managerRecovery === 'review') return;
    let attempt: Attempt<ManagerInput>;
    try {
      attempt = managerAttempt || {
        id: uid(),
        input: managerInput(
          managerCompany.id,
          managerForm.name,
          managerForm.email,
          managerForm.password,
        ),
      };
    } catch (error) {
      setManagerError((error as Error).message);
      return;
    }
    setManagerAttempt(attempt);
    setManagerBusy(true);
    setManagerError('');
    try {
      await createAdminManager(getSupabaseClient(), userId, attempt.input, attempt.id);
      setManagerCompany(null);
      setManagerAttempt(null);
      setManagerForm({ name: '', email: '', password: '' });
      setManagerRecovery(null);
      onNotice(
        'Gestor cadastrado. Ele poderá entrar com o e-mail e a senha temporária, definir uma senha pessoal e confirmar os documentos vigentes.',
      );
      onReload();
    } catch (error) {
      if (
        error instanceof AccessChangedError ||
        (error instanceof AdminCommandError && error.recovery === 'access')
      ) {
        setManagerCompany(null);
        setManagerForm({ name: '', email: '', password: '' });
        setManagerAttempt(null);
        onRecheck();
        return;
      }
      const recovery = error instanceof AdminCommandError ? error.recovery : 'edit';
      setManagerRecovery(recovery);
      setManagerError(
        error instanceof AdminCommandError
          ? error.message
          : 'Não foi possível verificar seu acesso. Tente novamente.',
      );
      if (recovery === 'edit') setManagerAttempt(null);
    } finally {
      setManagerBusy(false);
    }
  }

  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO SUN7CRM"
        title="Empresas"
        description="Cadastre empresas e os gestores responsáveis pelo acesso."
      >
        <Button onClick={openCompany}>
          <Plus size={16} />
          Nova empresa
        </Button>
      </Heading>
      {params.toString() && (
        <AppliedFilter
          label={`${companyFilterLabels[portfolio] || 'Todas as empresas'} · ${companyFilterLabels[status] || 'Todas as situações'}${status === 'new' || portfolio === 'new' ? ` · últimos ${days} dias` : ''}`}
          onClear={() => setParams({})}
        />
      )}
      <div className="card">
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar empresa ou segmento" />
          <select
            aria-label="Situação das empresas"
            value={status}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              next.set('situacao', e.target.value);
              setParams(next);
            }}
          >
            <option value="all">Todas as situações</option>
            <option value="active">Ativas</option>
            <option value="inactive">Desativadas</option>
            <option value="upcoming">Vencem em até 7 dias</option>
            <option value="new">Novas no período</option>
            <option value="overdue">Com vencimento passado</option>
          </select>
          <span className="muted result-count">{rows.length} empresas</span>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Gestor</th>
                  <th>Usuários</th>
                  <th>Valor mensal</th>
                  <th>Vencimento</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <RecordTitle title={company.name} onOpen={() => setDetails(company.id)} />
                      <small>{company.segment}</small>
                    </td>
                    <td>
                      {company.managers.length ? (
                        company.managers.map((m) => m.name).join(', ')
                      ) : (
                        <span className="muted">Sem gestor</span>
                      )}
                    </td>
                    <td>
                      {company.userCounts?.total ?? '—'} contas
                      <small>{company.userCounts?.activeEmployees ?? 0} funcionários ativos</small>
                    </td>
                    <td>{currency(company.monthlyAmount)}</td>
                    <td>{dateLabel(company.dueDate)}</td>
                    <td>
                      <span
                        className={`badge ${!company.enabled ? 'gray' : ['active', 'complimentary'].includes(subscriptionState(company.dueDate, company.cycleKind || 'monthly', date)) ? 'good' : 'warn'}`}
                      >
                        {!company.enabled
                          ? 'Desativada'
                          : stateLabels[
                              subscriptionState(
                                company.dueDate,
                                company.cycleKind || 'monthly',
                                date,
                              )
                            ]}
                      </span>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link className="home-text-link" to={`/admin/planos?empresa=${company.id}`}>
                          Plano
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetails(company.id)}
                          aria-label={`Ver detalhes de ${company.name}`}
                        >
                          Detalhes
                        </Button>
                        {!company.managers.length && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openManager(company)}
                            aria-label={`Cadastrar gestor de ${company.name}`}
                          >
                            Cadastrar gestor
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
            title="Nenhuma empresa encontrada"
            description={
              companies.length
                ? 'Ajuste a busca ou os filtros.'
                : 'Cadastre sua primeira empresa para começar.'
            }
          />
        )}
      </div>

      <Modal
        open={newCompanyOpen}
        onOpenChange={closeCompany}
        title={editingCompany ? 'Editar empresa' : 'Nova empresa'}
        description="Plano mensal SUN7CRM. Pagamentos e dias gratuitos são gerenciados na aba Planos."
      >
        <form onSubmit={(event) => void saveCompany(event)}>
          <fieldset disabled={companyLocked}>
            <div className="form-grid">
              <label className="form-row span2">
                Nome da empresa
                <Input
                  required
                  maxLength={160}
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                />
              </label>
              <label className="form-row span2">
                Segmento
                <Input
                  required
                  maxLength={160}
                  value={companyForm.segment}
                  onChange={(e) => setCompanyForm({ ...companyForm, segment: e.target.value })}
                  placeholder="Ex.: Clínica de estética"
                />
              </label>
              <label className="form-row">
                Modelo inicial
                <select
                  value={companyForm.template}
                  onChange={(e) => {
                    const template = e.target.value as Template;
                    setCompanyForm({
                      ...companyForm,
                      template,
                      theme: template === 'generic' ? 'blue' : 'sun7',
                    });
                  }}
                >
                  <option value="aesthetic">Estética</option>
                  <option value="generic">Genérico</option>
                </select>
              </label>
              <label className="form-row">
                Cor inicial
                <select
                  value={companyForm.theme}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, theme: e.target.value as CrmTheme })
                  }
                >
                  {CRM_THEMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-row">
                Valor mensal (R$)
                <CurrencyInput
                  readOnly
                  required
                  value={companyForm.amount}
                  onValueChange={(amount) => setCompanyForm({ ...companyForm, amount })}
                />
              </label>
              <label className="form-row">
                Vencimento
                <Input
                  required
                  type="date"
                  readOnly
                  value={companyForm.dueDate}
                  onInput={(e) =>
                    setCompanyForm({ ...companyForm, dueDate: e.currentTarget.value })
                  }
                  onChange={(e) => setCompanyForm({ ...companyForm, dueDate: e.target.value })}
                />
              </label>
              {editingCompany && (
                <label className="form-row span2">
                  Situação
                  <select
                    value={String(companyForm.enabled)}
                    onChange={(event) =>
                      setCompanyForm({ ...companyForm, enabled: event.target.value === 'true' })
                    }
                  >
                    <option value="false">Desativada</option>
                    <option value="true" disabled={!editingCompany.managers.length}>
                      Ativa{!editingCompany.managers.length ? ' — cadastre o gestor primeiro' : ''}
                    </option>
                  </select>
                </label>
              )}
            </div>
          </fieldset>
          <p className="small-note">
            {editingCompany
              ? 'A ativação exige um gestor cadastrado. Alterar o modelo preserva os contatos e as etapas dos quadros existentes.'
              : 'A empresa começa desativada. Cadastre o gestor no próximo passo e depois habilite o acesso em Editar empresa.'}
          </p>
          <FormError message={companyError} />
          {companyRecovery === 'retry' && (
            <p className="small-note">
              Mantenha esta janela aberta e confirme a mesma solicitação para evitar duplicidade.
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              disabled={companyBusy || companyRecovery === 'retry'}
              onClick={() => closeCompany(false)}
            >
              {companyRecovery === 'review' ? 'Fechar e atualizar lista' : 'Cancelar'}
            </Button>
            {companyRecovery !== 'review' && (
              <Button type="submit" disabled={companyBusy}>
                {companyBusy
                  ? 'Salvando...'
                  : companyRecovery === 'retry'
                    ? 'Confirmar resultado'
                    : editingCompany
                      ? 'Salvar alterações'
                      : 'Cadastrar e continuar'}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!managerCompany}
        onOpenChange={closeManager}
        title="Cadastrar gestor"
        description={managerCompany?.name || 'Empresa'}
      >
        <form onSubmit={(event) => void saveManager(event)} autoComplete="off">
          <fieldset disabled={managerLocked}>
            <div className="form-grid">
              <label className="form-row span2">
                Nome do gestor
                <Input
                  required
                  maxLength={160}
                  value={managerForm.name}
                  onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })}
                />
              </label>
              <label className="form-row span2">
                E-mail de acesso
                <Input
                  required
                  type="email"
                  maxLength={254}
                  value={managerForm.email}
                  autoComplete="off"
                  onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                />
              </label>
              <label className="form-row span2">
                Senha temporária
                <Input
                  required
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  value={managerForm.password}
                  onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          <p className="small-note">
            Confira o e-mail antes de salvar. Use uma senha temporária de pelo menos 12 caracteres e
            até 72 bytes. Informe o acesso ao gestor por um canal seguro; ele precisará definir uma
            senha pessoal e confirmar os documentos. Não será enviado e-mail automático.
          </p>
          <FormError message={managerError} />
          {managerRecovery === 'retry' && (
            <p className="small-note">
              Mantenha esta janela aberta e confirme a mesma solicitação antes de tentar outro
              cadastro.
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              disabled={managerBusy || managerRecovery === 'retry'}
              onClick={() => closeManager(false)}
            >
              {managerRecovery === 'review' ? 'Fechar e atualizar lista' : 'Cadastrar depois'}
            </Button>
            {managerRecovery !== 'review' && (
              <Button type="submit" disabled={managerBusy}>
                {managerBusy
                  ? 'Cadastrando...'
                  : managerRecovery === 'retry'
                    ? 'Confirmar resultado'
                    : 'Cadastrar gestor'}
              </Button>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        open={!!selected}
        onOpenChange={(open) => !open && setDetails(null)}
        title={selected?.name || 'Empresa'}
        description="Dados cadastrados na plataforma"
      >
        {selected && (
          <>
            <dl className="admin-company-details">
              <div>
                <dt>Segmento</dt>
                <dd>{selected.segment}</dd>
              </div>
              <div>
                <dt>Modelo inicial</dt>
                <dd>{selected.template === 'aesthetic' ? 'Estética' : 'Genérico'}</dd>
              </div>
              <div>
                <dt>Valor mensal</dt>
                <dd>{currency(selected.monthlyAmount)}</dd>
              </div>
              <div>
                <dt>Vencimento</dt>
                <dd>{dateLabel(selected.dueDate)}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>{selected.enabled ? 'Ativa' : 'Desativada'}</dd>
              </div>
              <div>
                <dt>Gestor responsável</dt>
                <dd>{selected.managers.map((m) => m.name).join(', ') || 'Ainda não cadastrado'}</dd>
              </div>
            </dl>
            <CompanyUsers
              key={selected.id}
              companyId={selected.id}
              userId={userId}
              onRecheck={onRecheck}
              onNotice={onNotice}
            />
            <div className="form-actions">
              <Button variant="outline" onClick={() => editCompany(selected)}>
                Editar empresa
              </Button>
              {!selected.managers.length && (
                <Button onClick={() => openManager(selected)}>Cadastrar gestor</Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
