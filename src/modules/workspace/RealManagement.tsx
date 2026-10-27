import { PermissionTree } from '../permissions/PermissionTree';
import { type EmployeePermissions } from '../permissions/model';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, ListTodo, KanbanSquare, Wallet, History, Clock3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Empty, Kpi, Panel } from '../../components/shared';
import { RecordTitle } from '../../components/RecordTitle';
import type { TeamRow, CardActivity } from '../../data/backend';
import { currency, dateLabel, today, uid } from '../../lib/format';
import { CRM_THEMES } from '../../lib/themes';
import { ThemeTooltip } from '../../components/ThemeTooltip';
import { ThemePreview } from '../../components/ThemePreview';
import { RealContactHistory } from '../contacts/RealContactHistory';
import { RealActivityReport } from '../reports/RealActivityReport';
import { Pager, QueryState, SaveActions, useOperational, useQuery, useSave } from './operational';

export function RealDashboard() {
  const { api } = useOperational(),
    [from, setFrom] = useState(today().slice(0, 7) + '-01'),
    [to, setTo] = useState(today());
  const query = useQuery(async () => {
    const [metrics, boards, stages, strategies] = await Promise.all([
      api.metrics(from, to),
      api.all('boards'),
      api.all('stages'),
      api.all('strategies'),
    ]);
    return { metrics, boards, stages, strategies };
  }, [api, from, to]);
  return (
    <>
      <div className="operational-toolbar">
        <div className="actions">
          <label className="form-row">
            Cadastros e origens de
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="form-row">
            Até
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <Link className="operational-text-link" to="/app/funil">
          Abrir funil →
        </Link>
      </div>
      <QueryState query={query} />
      {query.data && (
        <>
          <div className="kpis">
            <Kpi
              label="Novos contatos"
              value={query.data.metrics.contacts}
              foot="Cadastros no período selecionado"
              icon={<Users size={19} />}
              to="/app/contatos"
            />
            <Kpi
              label="Cards abertos"
              value={query.data.metrics.open_cards}
              foot="Todos os cards em andamento"
              icon={<KanbanSquare size={19} />}
              to="/app/funil"
            />
            <Kpi
              label="Pipeline estimado"
              value={currency(query.data.metrics.estimated_pipeline_cents)}
              foot="Valor estimado dos cards abertos"
              icon={<Wallet size={19} />}
            />
            <Kpi
              label="Tarefas pendentes"
              value={query.data.metrics.pending_tasks}
              foot={`${query.data.metrics.overdue_tasks} com prazo vencido`}
              icon={<ListTodo size={19} />}
              to="/app/tarefas"
            />
          </div>
          <div className="operational-dashboard-grid">
            <Panel
              title="Entrada de contatos"
              description="Cadastros por dia no período selecionado"
            >
              {query.data.metrics.contacts_by_day.length ? (
                <div className="operational-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={query.data.metrics.contacts_by_day}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: 'var(--muted)' }}
                        axisLine={{ stroke: 'var(--line)' }}
                        tickLine={{ stroke: 'var(--line)' }}
                        tickFormatter={(v) => String(v).slice(5).split('-').reverse().join('/')}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'var(--muted)' }}
                        axisLine={{ stroke: 'var(--line)' }}
                        tickLine={{ stroke: 'var(--line)' }}
                      />
                      <ThemeTooltip labelFormatter={(v) => dateLabel(String(v))} />
                      <Bar
                        name="Contatos"
                        dataKey="count"
                        fill="var(--primary)"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty
                  title="Sem cadastros no período"
                  description="Os novos contatos aparecerão aqui."
                />
              )}
            </Panel>
            <Panel title="Cards por etapa" description="Distribuição atual dos cards abertos">
              {query.data.metrics.cards_by_stage.length ? (
                <div className="operational-summary-list">
                  {query.data.metrics.cards_by_stage.map((s) => (
                    <div key={s.stage_id}>
                      <span>
                        <strong>
                          {query.data!.stages.find((x) => x.id === s.stage_id)?.name || 'Etapa'}
                        </strong>
                        <small>{query.data!.boards.find((x) => x.id === s.board_id)?.name}</small>
                      </span>
                      <span>
                        <strong>{s.count} cards</strong>
                        <small>{currency(s.estimated_cents)} estimados</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Nenhum card aberto"
                  description="Crie cards no funil para acompanhar a distribuição."
                />
              )}
            </Panel>
          </div>
          <Panel
            title="Origem das oportunidades"
            description="Cards criados no período, agrupados pela estratégia informada"
          >
            <div className="operational-table">
              <table>
                <thead>
                  <tr>
                    <th>Estratégia</th>
                    <th>Cards</th>
                    <th>Valor estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.metrics.cards_by_strategy.map((s) => (
                    <tr key={s.strategy_id || 'none'}>
                      <td>
                        {query.data!.strategies.find((x) => x.id === s.strategy_id)?.name ||
                          'Sem estratégia'}
                      </td>
                      <td>{s.count}</td>
                      <td>{currency(s.estimated_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data.metrics.cards_by_strategy.length && (
                <p className="small-note">Nenhuma oportunidade criada neste período.</p>
              )}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
export function RealReports() {
  const { api, company, can, revision } = useOperational(),
    [tab, setTab] = useState<'cards' | 'contacts'>('cards'),
    [page, setPage] = useState(0),
    [history, setHistory] = useState<CardActivity | null>(null);
  const query = useQuery(() => api.cardActivity(page, 50, true), [api, page]);
  return (
    <>
      <div className="tabs">
        <button
          type="button"
          className={tab === 'cards' ? 'active' : ''}
          onClick={() => setTab('cards')}
        >
          Acompanhamento por card
        </button>
        <button
          type="button"
          className={tab === 'contacts' ? 'active' : ''}
          onClick={() => setTab('contacts')}
        >
          Clientes e equipe
        </button>
      </div>
      {tab === 'contacts' ? (
        <RealActivityReport key={company.id + revision} companyId={company.id} />
      ) : (
        <>
          <p className="small-note">
            24h sem primeiro acompanhamento · 3 dias para o responsável · 7 dias para o gestor. O
            clique no WhatsApp registra o acionamento do atalho.
          </p>
          <QueryState query={query} />
          {query.data && (
            <>
              <div className="card panel operational-table">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente / card</th>
                      <th>Responsável</th>
                      <th>Funil / etapa</th>
                      <th>Acompanhamento</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.rows.map((c) => {
                      const future = c.follow_up_at && new Date(c.follow_up_at) > new Date(),
                        idle = !future && c.days_without_activity >= 3;
                      return (
                        <tr key={c.opportunity_id}>
                          <td>
                            <RecordTitle
                              title={c.contact_name}
                              to={
                                can('contacts.view')
                                  ? '/app/contatos?registro=' + c.contact_id
                                  : undefined
                              }
                            />
                            <small className="operational-cell-note">
                              {c.title || 'Card sem título'}
                            </small>
                          </td>
                          <td>{c.owner_name}</td>
                          <td>
                            {c.board_name}
                            <small className="operational-cell-note">{c.stage_name}</small>
                          </td>
                          <td>
                            {future ? (
                              <span className="badge">Retorno agendado</span>
                            ) : idle ? (
                              <span className="operational-idle">
                                <Clock3 size={13} />
                                {c.days_without_activity} dias sem atividade
                              </span>
                            ) : !c.first_activity_at && c.hours_without_activity >= 24 ? (
                              <span className="operational-idle">Sem primeiro acompanhamento</span>
                            ) : (
                              <span className="badge">Dentro do prazo</span>
                            )}
                            <small className="operational-cell-note">
                              {c.last_activity_at
                                ? 'Última atividade: ' +
                                  new Intl.DateTimeFormat('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                    timeZone: 'America/Sao_Paulo',
                                  }).format(new Date(c.last_activity_at))
                                : 'Ainda sem atividade vinculada ao card'}
                            </small>
                          </td>
                          <td>
                            <div className="actions">
                              <Button variant="ghost" size="sm" onClick={() => setHistory(c)}>
                                <History size={15} />
                                Histórico
                              </Button>
                              <Link
                                className="operational-text-link"
                                to={'/app/funil?card=' + c.opportunity_id}
                              >
                                Abrir card
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!query.data.rows.length && (
                  <Empty
                    title="Nenhum card em andamento"
                    description="Os cards abertos da empresa aparecerão neste relatório."
                  />
                )}
              </div>
              <Pager page={page} total={query.data.total} onChange={setPage} />
            </>
          )}
        </>
      )}
      {history && (
        <RealContactHistory
          key={history.opportunity_id}
          companyId={company.id}
          contact={{ id: history.contact_id, name: history.contact_name, phone: history.phone }}
          cardId={history.opportunity_id}
          canAdd={can('history.create')}
          canWhatsapp={can('history.whatsapp')}
          onClose={() => {
            setHistory(null);
            query.retry();
          }}
        />
      )}
    </>
  );
}
export function RealTeam() {
  const { api, user, can, refresh, notice } = useOperational(),
    query = useQuery(() => api.team(), [api]),
    [permissionsFor, setPermissionsFor] = useState<TeamRow | null>(null),
    [editing, setEditing] = useState<TeamRow | null>(null),
    [creating, setCreating] = useState(false),
    [resetting, setResetting] = useState<TeamRow | null>(null);
  return (
    <>
      <div className="operational-toolbar">
        <p className="small-note">
          Cadastre funcionários, defina as permissões e redistribua a carteira ao desativar um
          integrante.
        </p>
        <Button disabled={!can('team.manage')} onClick={() => setCreating(true)}>
          <Plus size={16} />
          Adicionar integrante
        </Button>
      </div>
      <QueryState query={query} />
      {query.data && (
        <div className="card panel operational-table">
          <table>
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Acesso</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <RecordTitle
                      title={row.display_name}
                      onOpen={
                        can('team.manage') && row.role !== 'manager' && row.user_id !== user.id
                          ? () => setEditing(row)
                          : undefined
                      }
                    />
                    <small className="operational-cell-note">{row.email}</small>
                  </td>
                  <td>{row.role === 'manager' ? 'Gestor' : 'Permissões individuais'}</td>
                  <td>{row.active ? 'Ativo' : 'Inativo'}</td>
                  <td>
                    {can('team.manage') && row.role !== 'manager' && row.user_id !== user.id ? (
                      <div className="actions">
                        <Button variant="outline" size="sm" onClick={() => setPermissionsFor(row)}>
                          Permissões
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setResetting(row)}>
                          Redefinir senha
                        </Button>
                      </div>
                    ) : (
                      <span className="muted">Gestão administrativa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {permissionsFor && (
        <EmployeePermissionsDialog
          row={permissionsFor}
          onClose={() => setPermissionsFor(null)}
          onSaved={() => {
            setPermissionsFor(null);
            refresh();
            notice('Permissões atualizadas. As regras já estão valendo no banco.');
          }}
        />
      )}
      {editing && query.data && (
        <MemberDialog
          row={editing}
          members={query.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            notice('Integrante atualizado.');
          }}
        />
      )}
      {creating && (
        <CreateMember
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            refresh();
            notice('Integrante cadastrado. No primeiro acesso, ele definirá a própria senha.');
          }}
        />
      )}
      {resetting && (
        <ResetMember
          row={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => {
            setResetting(null);
            notice(
              'Senha inicial redefinida. O integrante deverá cadastrar uma senha pessoal ao entrar.',
            );
          }}
        />
      )}
    </>
  );
}
function MemberDialog({
  row,
  members,
  onClose,
  onSaved,
}: {
  row: TeamRow;
  members: TeamRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    [form, setForm] = useState({
      display_name: row.display_name,
      role: row.role as 'seller' | 'reception',
      active: row.active,
    }),
    [target, setTarget] = useState('');
  return (
    <Modal open title="Editar integrante" onOpenChange={(v) => !v && !save.busy && onClose()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            await api.updateMember(row.id, row.row_version, form, target || undefined);
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Nome
            <Input
              required
              maxLength={160}
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </label>

          <label className="operational-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Vínculo ativo
          </label>
          {row.active && !form.active && (
            <label className="form-row">
              Transferir carteira e tarefas pendentes para
              <select required value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Selecione o novo responsável</option>
                {members
                  .filter((m) => m.active && m.id !== row.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
              </select>
              <small>
                A desativação e a transferência são feitas juntas. O histórico mantém os autores
                originais.
              </small>
            </label>
          )}
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
    </Modal>
  );
}
function validPassword(value: string) {
  if ([...value].length < 12 || new TextEncoder().encode(value).length > 72)
    throw Error('Use uma senha inicial com pelo menos 12 caracteres e no máximo 72 bytes.');
}
function CreateMember({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { api, company, companyScope } = useOperational(),
    save = useSave(),
    [requestId] = useState(uid),
    [permissions, setPermissions] = useState<EmployeePermissions>({
      keys: [],
      scope: 'own',
      version: 0,
    }),
    [provisioned, setProvisioned] = useState<string | null>(null),
    [form, setForm] = useState({
      display_name: '',
      email: '',
      password: '',
      role: 'seller' as 'seller' | 'reception',
    });
  return (
    <Modal
      open
      title="Adicionar integrante"
      description="O integrante receberá uma senha inicial e definirá a própria senha no primeiro acesso."
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            validPassword(form.password);
            const result = provisioned
              ? { membership_id: provisioned }
              : await api.createMember(
                  {
                    ...form,
                    display_name: form.display_name.trim(),
                    email: form.email.trim().toLocaleLowerCase(),
                  },
                  requestId,
                );
            setProvisioned(result.membership_id);
            const current = await api.employeePermissions(result.membership_id);
            await api.saveEmployeePermissions(result.membership_id, {
              ...permissions,
              version: current.version,
            });
            setForm({ ...form, password: '' });
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Nome
            <Input
              required
              maxLength={160}
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </label>
          <label className="form-row">
            E-mail
            <Input
              type="email"
              required
              maxLength={254}
              value={form.email}
              autoComplete="off"
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <PermissionTree
            value={permissions}
            availableKeys={company.permissions?.keys}
            allowCompanyScope={companyScope}
            onChange={setPermissions}
            disabled={save.busy || save.uncertain}
          />
          <label className="form-row">
            Senha inicial
            <Input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
        </fieldset>
        {provisioned && (
          <p role="status">
            A conta foi criada sem acesso às funcionalidades. Conclua o salvamento das permissões;
            não será criada uma segunda conta.
          </p>
        )}
        <SaveActions
          save={save}
          onClose={onClose}
          label={provisioned ? 'Salvar permissões' : 'Cadastrar funcionário'}
        />
      </form>
    </Modal>
  );
}
function ResetMember({
  row,
  onClose,
  onSaved,
}: {
  row: TeamRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    [requestId] = useState(uid),
    [password, setPassword] = useState('');
  return (
    <Modal
      open
      title="Redefinir senha inicial"
      description={'Integrante: ' + row.display_name + '. O acesso exigirá uma nova senha pessoal.'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            validPassword(password);
            await api.resetMember(row.user_id, password, requestId);
            setPassword('');
            onSaved();
          });
        }}
      >
        <label className="form-row">
          Nova senha inicial
          <Input
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            disabled={save.busy || save.uncertain}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <SaveActions save={save} onClose={onClose} label="Confirmar redefinição" />
      </form>
    </Modal>
  );
}
export function RealSettings({ onCompanyChanged }: { onCompanyChanged: () => void }) {
  const { api } = useOperational(),
    query = useQuery(() => api.company(), [api]);
  return (
    <>
      <QueryState query={query} />
      {query.data && (
        <BrandForm key={query.data.row_version} row={query.data} onSaved={onCompanyChanged} />
      )}
    </>
  );
}
function BrandForm({
  row,
  onSaved,
}: {
  row: {
    row_version: number;
    display_name: string | null;
    name: string;
    theme: string;
    logo_path: string | null;
  };
  onSaved: () => void;
}) {
  const { api, can, notice, refresh } = useOperational(),
    save = useSave(),
    [name, setName] = useState(row.display_name || row.name),
    [theme, setTheme] = useState(row.theme),
    [file, setFile] = useState<File | null>(null),
    [remove, setRemove] = useState(false),
    [logo, setLogo] = useState('');
  const image = useQuery(
    async () => (row.logo_path ? api.downloadLogo(row.logo_path) : null),
    [api, row.logo_path],
  );
  useEffect(() => {
    if (!image.data) return;
    const url = URL.createObjectURL(image.data);
    setLogo(url);
    return () => URL.revokeObjectURL(url);
  }, [image.data]);
  return (
    <Panel
      title="Identidade da empresa"
      description="Nome exibido, cores e logo utilizados pela equipe."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const path = file ? await api.uploadLogo(file) : remove ? null : row.logo_path;
            await api.updateBrand(row.row_version, {
              display_name: name.trim(),
              theme,
              logo_path: path,
            });
            notice('Identidade da empresa atualizada.');
            refresh();
            onSaved();
          });
        }}
      >
        <fieldset
          className="operational-fields"
          disabled={!can('settings.edit') || save.busy || save.uncertain}
        >
          <label className="form-row">
            Nome exibido
            <Input
              required
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="form-row">
            Tema
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              {CRM_THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <ThemePreview theme={theme} />
          <QueryState query={image} />
          {logo && !remove && !file && (
            <img className="operational-logo-preview" src={logo} alt="Logo atual da empresa" />
          )}
          <label className="form-row">
            Logo (PNG, JPG ou WebP de até 2 MB)
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setRemove(false);
              }}
            />
          </label>
          {row.logo_path && (
            <label className="operational-check">
              <input
                type="checkbox"
                checked={remove}
                onChange={(e) => {
                  setRemove(e.target.checked);
                  setFile(null);
                }}
              />
              Remover logo do cadastro
            </label>
          )}
        </fieldset>
        {can('settings.edit') && (
          <SaveActions
            save={save}
            onClose={() => {
              setName(row.display_name || row.name);
              setTheme(row.theme);
              setFile(null);
              setRemove(false);
            }}
            label="Salvar identidade"
          />
        )}
      </form>
    </Panel>
  );
}

function EmployeePermissionsDialog({
  row,
  onClose,
  onSaved,
}: {
  row: TeamRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    query = useQuery(() => api.employeePermissions(row.id), [api, row.id]);
  return (
    <Modal
      open
      title={'Permissões · ' + row.display_name}
      description="Expanda os grupos e escolha as ações que este funcionário poderá realizar."
      onOpenChange={(v) => !v && onClose()}
    >
      <QueryState query={query} />
      {query.data && (
        <EmployeePermissionsForm
          key={row.id + ':' + query.data.version}
          memberId={row.id}
          initial={query.data}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}
function EmployeePermissionsForm({
  memberId,
  initial,
  onClose,
  onSaved,
}: {
  memberId: string;
  initial: EmployeePermissions;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api, company, companyScope } = useOperational(),
    save = useSave(),
    [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run(async () => {
          await api.saveEmployeePermissions(memberId, value);
          onSaved();
        });
      }}
    >
      <fieldset disabled={save.busy || save.uncertain}>
        <PermissionTree
          value={value}
          availableKeys={company.permissions?.keys}
          allowCompanyScope={companyScope}
          onChange={setValue}
        />
      </fieldset>
      <SaveActions save={save} onClose={onClose} label="Salvar permissões" />
    </form>
  );
}
