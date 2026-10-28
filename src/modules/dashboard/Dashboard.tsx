import { ViewSwitcher } from '../../components/ui/view-switcher';
import { filterCompanies } from '../../domain/filters';
import { CHART_COLORS } from '../../lib/themes';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  ArrowUpRight,
  Users,
  Flame,
  ListTodo,
  TrendingUp,
  Building2,
  CalendarClock,
  UserPlus,
  Wallet,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { useCrm } from '../../app/context';
import type { Company } from '../../domain/types';
import { visibleContacts } from '../../domain/operations';
import { today, shiftDate, currency, dateLabel } from '../../lib/format';
import { Heading, Kpi, Panel, Empty } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { ThemeTooltip } from '../../components/ThemeTooltip';
import { DemoGoalFunnel } from '../goals/DemoGoalFunnel';
import { legacyPermissions } from '../permissions/model';
function ChartEmpty() {
  return (
    <Empty
      title="Ainda sem dados no período"
      description="Os gráficos serão preenchidos conforme os cadastros desta prévia."
    />
  );
}
export function CompanyDashboard() {
  const { data, session } = useCrm();
  const [days, setDays] = useState('30');
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'commercial' | 'achievements'>(
    'overview',
  );
  const member = data.members.find((m) => m.id === session.memberId);
  const keys = (member?.permissions || legacyPermissions(session.role)).keys;
  const canView = (key: string) => session.role === 'manager' || keys.includes(key);
  const availableTabs = [
    ['overview', 'Visão geral'],
    ...(canView('cards.view') ? [['commercial', 'Comercial']] : []),
    ...(canView('goals.view') ? [['achievements', 'Conquistas']] : []),
  ];
  const activeTab = availableTabs.some(([key]) => key === dashboardTab) ? dashboardTab : 'overview';
  const date = today();
  const from = shiftDate(date, -Number(days) + 1);
  const company = data.companies.find((c) => c.id === session.companyId)!;
  const palette = CHART_COLORS;
  const all = visibleContacts(data, session);
  const contacts = all.filter((c) => c.createdAt >= from && c.createdAt <= date);
  const allOpps = data.opportunities.filter(
    (o) => o.companyId === session.companyId && all.some((c) => c.id === o.contactId),
  );
  const opps = allOpps.filter((o) => o.createdAt >= from && o.createdAt <= date);
  const tasks = data.tasks.filter(
    (t) =>
      t.companyId === session.companyId &&
      (session.role === 'manager' || t.ownerId === session.memberId),
  );
  const pending = tasks.filter((t) => !t.done);
  const leadBoard = data.boards.find(
    (b) => b.companyId === session.companyId && b.kind === 'leads',
  )!;
  const stages = leadBoard.stages.map((s) => ({
    name: s.name,
    total: opps.filter((o) => o.boardId === leadBoard.id && o.stageId === s.id).length,
  }));
  const interval = Number(days);
  const bucket = Math.max(1, Math.ceil(interval / 7));
  const trend = Array.from({ length: Math.ceil(interval / bucket) }, (_, i) => {
    const start = shiftDate(from, i * bucket);
    const end = shiftDate(start, bucket - 1);
    return {
      name: dateLabel(start).slice(0, 5),
      novos: contacts.filter((c) => c.createdAt >= start && c.createdAt <= end).length,
    };
  });
  const sources = Array.from(new Set(opps.map((o) => o.source))).map((name) => ({
    name,
    total: opps.filter((o) => o.source === name).length,
  }));
  const overdue = pending.filter((t) => t.dueDate < date).length;
  return (
    <>
      <Heading
        eyebrow="VISÃO GERAL"
        title={
          'Olá, ' +
          (data.members.find((m) => m.id === session.memberId)?.name.split(' ')[0] || 'equipe') +
          ' 👋'
        }
        description={
          'Acompanhe o movimento comercial da ' + (company.displayName || company.name) + '.'
        }
      >
        <select
          aria-label="Período do dashboard"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </Heading>
      <ViewSwitcher
        className="dashboard-tabs"
        label="Áreas do dashboard"
        value={activeTab}
        onValueChange={setDashboardTab}
        items={availableTabs.map(([value, label]) => ({
          value: value as 'overview' | 'commercial' | 'achievements',
          label,
        }))}
      />
      {activeTab === 'overview' && (
        <>
          <div className="kpis">
            <Kpi
              label="Novos contatos"
              to={`/demo/contatos?de=${from}&ate=${date}`}
              value={contacts.length}
              foot="Cadastrados no período"
              icon={<Users size={19} />}
            />
            <Kpi
              label="Oportunidades quentes"
              to={`/demo/contatos?temperatura=hot&de=${from}&ate=${date}`}
              value={contacts.filter((c) => c.temperature === 'hot').length}
              foot="Temperatura definida pela equipe"
              icon={<Flame size={19} />}
            />
            <Kpi
              label="Valor no funil de leads"
              to={`/demo/funil/leads?de=${from}&ate=${date}`}
              value={currency(
                opps.filter((o) => o.boardId === leadBoard.id).reduce((s, o) => s + o.value, 0),
              )}
              foot="Estimado · não representa receita"
              icon={<TrendingUp size={19} />}
            />
            <Kpi
              label="Tarefas pendentes"
              to="/demo/tarefas?status=pending"
              value={pending.length}
              foot={overdue + ' atrasadas · todos os períodos'}
              icon={<ListTodo size={19} />}
            />
          </div>
        </>
      )}
      {activeTab === 'commercial' && (
        <>
          {canView('goals.view') && <DemoGoalFunnel view="commercial" />}

          <div className="dashboard-grid">
            <Panel
              title="Novos contatos ao longo do tempo"
              description="Entradas cadastradas no período selecionado."
              action={<span className="badge gray">{contacts.length} contatos</span>}
            >
              <div className="chart">
                {contacts.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ left: -22, right: 12, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="contactsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={palette[0]} stopOpacity={0.19} />
                          <stop offset="100%" stopColor={palette[0]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                      />
                      <ThemeTooltip />
                      <Area
                        name="Novos contatos"
                        type="monotone"
                        dataKey="novos"
                        stroke={palette[0]}
                        fill="url(#contactsFill)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty />
                )}
              </div>
            </Panel>
            <Panel
              title="De onde vêm as oportunidades?"
              description="Distribuição por origem de cadastro."
            >
              <div className="donut-layout">
                <div className="donut-chart">
                  {sources.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sources}
                          dataKey="total"
                          nameKey="name"
                          innerRadius={54}
                          outerRadius={75}
                          paddingAngle={4}
                          stroke="none"
                        >
                          {sources.map((s, i) => (
                            <Cell key={s.name} fill={palette[i % 4]} />
                          ))}
                        </Pie>
                        <ThemeTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartEmpty />
                  )}
                </div>
                <div className="chart-legend">
                  {sources.map((s, i) => (
                    <div key={s.name}>
                      <i style={{ background: palette[i % 4] }} />
                      <span>{s.name}</span>
                      <strong>{s.total}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
          <div className="dashboard-grid">
            <Panel
              title="Oportunidades por etapa"
              description="Posição atual das oportunidades criadas no período."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/demo/funil/leads">
                    Abrir funil
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
              }
            >
              <div className="stage-summary">
                {stages.map((s, i) => (
                  <div key={s.name}>
                    <span>{s.name}</span>
                    <div>
                      <i
                        style={{
                          width:
                            (Math.max(...stages.map((s) => s.total))
                              ? (s.total / Math.max(...stages.map((s) => s.total))) * 100
                              : 0) + '%',
                          background: palette[i % 4],
                        }}
                      />
                    </div>
                    <strong>{s.total}</strong>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel
              title="Próximas ações"
              description="Sua rotina organizada, começando pelas mais urgentes."
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/demo/tarefas">
                    Ver tarefas
                    <ArrowUpRight size={14} />
                  </Link>
                </Button>
              }
            >
              {pending.length ? (
                <div className="upcoming-list">
                  {[...pending]
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                    .slice(0, 4)
                    .map((t) => (
                      <Link to="/demo/tarefas" key={t.id}>
                        <span className={'task-mini-icon ' + (t.dueDate < date ? 'late' : '')}>
                          <Clock3 size={16} />
                        </span>
                        <span>
                          <strong>{t.title}</strong>
                          <small>
                            {data.contacts.find((c) => c.id === t.contactId)?.name ||
                              'Tarefa interna'}
                          </small>
                        </span>
                        <span className={'badge ' + (t.dueDate < date ? 'bad' : 'gray')}>
                          {t.dueDate === date ? 'Hoje' : dateLabel(t.dueDate).slice(0, 5)}
                        </span>
                      </Link>
                    ))}
                </div>
              ) : (
                <Empty title="Rotina em dia" description="Todas as tarefas foram concluídas." />
              )}
            </Panel>
          </div>
        </>
      )}
      {activeTab === 'achievements' && canView('goals.view') && <DemoGoalFunnel view="medals" />}
      {activeTab === 'overview' && (
        <div className="insight-strip">
          <CheckCircle2 size={20} />
          <p>
            <strong>Um próximo passo para cada conversa.</strong>
            <span>Use o funil e as tarefas para organizar o atendimento da sua equipe.</span>
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/demo/funil/leads">
              Organizar oportunidades
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
export function AdminDashboardView({
  companies: portfolio,
  basePath = '/admin',
  live = true,
}: {
  companies: Company[];
  basePath?: string;
  live?: boolean;
}) {
  const palette = CHART_COLORS;
  const [filter, setFilter] = useState('all');
  const [days, setDays] = useState('30');
  const date = today();
  const from = shiftDate(date, -Number(days) + 1);
  const companies = filterCompanies(portfolio, filter, from, date);
  const active = companies.filter((c) => c.enabled);
  const upcoming = active.filter((c) => c.dueDate >= date && c.dueDate <= shiftDate(date, 7));
  const news = companies.filter((c) => c.createdAt >= from && c.createdAt <= date);
  const chart = Array.from({ length: Number(days) <= 7 ? 7 : 6 }, (_, i) => {
    const width = Math.ceil(Number(days) / (Number(days) <= 7 ? 7 : 6));
    const start = shiftDate(from, i * width);
    return {
      name: dateLabel(start).slice(0, 5),
      empresas: companies.filter(
        (c) =>
          c.createdAt >= start && c.createdAt <= shiftDate(start, width - 1) && c.createdAt <= date,
      ).length,
    };
  });
  const segments = [
    { name: 'Estética', value: companies.filter((c) => c.template === 'aesthetic').length },
    { name: 'Genérico', value: companies.filter((c) => c.template === 'generic').length },
  ];
  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO SUN7CRM"
        title="Visão da plataforma"
        description="Acompanhe sua carteira, novos clientes e os próximos vencimentos."
      >
        <select
          aria-label="Filtro de empresas"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Todas as empresas</option>
          <option value="active">Ativas</option>
          <option value="upcoming">Vencem em até 7 dias</option>
          <option value="new">Novas no período</option>
          <option value="overdue">Com vencimento passado</option>
        </select>
        <select
          aria-label="Período administrativo"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </Heading>
      <div className="kpis">
        <Kpi
          label="Empresas ativas"
          to={`${basePath}/empresas?carteira=${filter}&periodo=${days}&situacao=active`}
          value={active.length}
          foot={live ? 'Empresas habilitadas na plataforma' : 'Habilitadas para uso na prévia'}
          icon={<Building2 size={19} />}
        />
        <Kpi
          label="Próximas a vencer"
          to={`${basePath}/empresas?carteira=${filter}&periodo=${days}&situacao=upcoming`}
          value={upcoming.length}
          foot="Entre hoje e os próximos 7 dias"
          icon={<CalendarClock size={19} />}
        />
        <Kpi
          label="Novas empresas"
          to={`${basePath}/empresas?carteira=${filter}&periodo=${days}&situacao=new`}
          value={news.length}
          foot="Cadastradas no período selecionado"
          icon={<UserPlus size={19} />}
        />
        <Kpi
          label="Mensalidade da carteira"
          to={`${basePath}/empresas?carteira=${filter}&periodo=${days}&situacao=active`}
          value={currency(active.reduce((s, c) => s + c.monthlyAmount, 0))}
          foot="Soma contratada · não recebimentos"
          icon={<Wallet size={19} />}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Entrada de novas empresas"
          description="Cadastros por intervalo no período selecionado."
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ left: -20, right: 12, top: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                />
                <ThemeTooltip />
                <Bar
                  name="Novas empresas"
                  dataKey="empresas"
                  fill={palette[0]}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel
          title="Perfil da carteira"
          description="Templates utilizados pelas empresas filtradas."
        >
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  nameKey="name"
                  dataKey="value"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {segments.map((s, i) => (
                    <Cell key={s.name} fill={palette[i]} />
                  ))}
                </Pie>
                <ThemeTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="inline-legend">
            {segments.map((s, i) => (
              <span key={s.name}>
                <i style={{ background: palette[i] }} />
                {s.name} · {s.value}
              </span>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Empresas para acompanhar"
        description="Vencimentos em ordem crescente. Todos os indicadores seguem o filtro de empresas."
        action={
          <Button asChild variant="ghost" size="sm">
            <Link to={`${basePath}/empresas`}>
              Gerenciar empresas
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        }
      >
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
                </tr>
              </thead>
              <tbody>
                {[...companies]
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <small>{c.segment}</small>
                      </td>
                      <td>{c.template === 'aesthetic' ? 'Estética' : 'Genérico'}</td>
                      <td>{currency(c.monthlyAmount)}</td>
                      <td>{dateLabel(c.dueDate)}</td>
                      <td>
                        <span
                          className={
                            'badge ' + (!c.enabled ? 'gray' : c.dueDate < date ? 'warn' : 'good')
                          }
                        >
                          {!c.enabled
                            ? 'Desativada'
                            : c.dueDate < date
                              ? 'Vencimento passado'
                              : 'Ativa'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma empresa encontrada"
            description="Selecione outro filtro para acompanhar a carteira."
          />
        )}
      </Panel>
      <p className="small-note">
        {live
          ? 'Valores contratuais informados no cadastro. Recebimentos e cobrança automática não fazem parte desta etapa.'
          : 'Cobrança e bloqueio automáticos ainda não estão ativos nesta base.'}
      </p>
    </>
  );
}
