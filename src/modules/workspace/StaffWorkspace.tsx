import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutDashboard, ListTodo, LogOut, Menu, Users, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Empty, Heading, Kpi } from '../../components/shared';
import { ThemeProvider } from '../../components/theme-provider';
import { getSupabaseClient } from '../../lib/supabase';
import { dateLabel, initials } from '../../lib/format';
import { themeStyle, type CrmTheme } from '../../lib/themes';
import { roleLabels, temperatureLabels } from '../../domain/config';
import type { Role, Temperature } from '../../domain/types';
import { loadAccountAccess, type AccountUser } from '../auth/access';
import { PublicShell } from '../public/PublicShell';
import { NotificationBell } from '../notifications/NotificationBell';
import '../admin/admin.css';

interface Workspace {
  id: string;
  membershipId: string;
  name: string;
  role: Exclude<Role, 'admin'>;
  theme: CrmTheme;
}
type RecordRow = {
  id: string;
  title?: string;
  due_date?: string;
  status?: string;
  name?: string;
  phone?: string;
  temperature?: Temperature;
};

export function StaffWorkspace({
  user,
  onLogout,
  onRecheck,
}: {
  user: AccountUser;
  onLogout: () => Promise<void>;
  onRecheck: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<RecordRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ contacts: number; tasks: number } | null>(null);
  const location = useLocation(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const selected = params.get('registro') || '';
  const rawPage = Number(params.get('pagina') || '0');
  const page = Number.isInteger(rawPage) && rawPage >= 0 && rawPage <= 100_000 ? rawPage : 0;
  const section = location.pathname.startsWith('/app/tarefas')
    ? 'tasks'
    : location.pathname.startsWith('/app/contatos')
      ? 'contacts'
      : 'home';
  const company = workspaces?.find((item) => item.id === companyId);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = getSupabaseClient();
        const result = await client
          .from('crm_memberships')
          .select('id,role,company_id,crm_companies(id,name,display_name,theme)')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('id');
        if (result.error) throw result.error;
        const items: Workspace[] = [];
        for (const member of result.data || []) {
          const data = Array.isArray(member.crm_companies)
            ? member.crm_companies[0]
            : member.crm_companies;
          if (data && ['manager', 'seller', 'reception'].includes(member.role))
            items.push({
              id: data.id,
              membershipId: member.id,
              name: data.display_name || data.name,
              role: member.role,
              theme: data.theme,
            });
        }
        if (active) {
          setWorkspaces(items);
          setCompanyId(items[0]?.id || '');
        }
      } catch {
        if (active)
          setError('Não foi possível consultar a empresa vinculada à sua conta. Tente novamente.');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user.id]);
  useEffect(() => {
    document.title = `${company?.name || 'Minha conta'} · SUN7CRM`;
    setMobile(false);
  }, [company?.name, location.pathname]);
  useEffect(() => {
    if (!companyId) return;
    let active = true;
    setRows(null);
    setCounts(null);
    setError('');
    async function load() {
      try {
        const client = getSupabaseClient(),
          access = await loadAccountAccess(client);
        if (access.stage !== 'ready' || access.user.id !== user.id || access.isAdmin) {
          if (active) onRecheck();
          return;
        }
        if (section === 'home') {
          const [contacts, tasks] = await Promise.all([
            client
              .from('crm_contacts')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId),
            client
              .from('crm_tasks')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId)
              .neq('status', 'done'),
          ]);
          if (contacts.error || tasks.error || contacts.count === null || tasks.count === null)
            throw Error('Consulta indisponível');
          if (active) setCounts({ contacts: contacts.count, tasks: tasks.count });
        } else {
          if (
            selected &&
            !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(selected)
          )
            throw Error('Identificador inválido');
          let query =
            section === 'tasks'
              ? client
                  .from('crm_tasks')
                  .select('id,title,due_date,status', { count: 'exact' })
                  .eq('company_id', companyId)
                  .order('due_date')
                  .order('id')
              : client
                  .from('crm_contacts')
                  .select('id,name,phone,temperature', { count: 'exact' })
                  .eq('company_id', companyId)
                  .order('name')
                  .order('id');
          if (selected) query = query.eq('id', selected);
          const result = await query.range(page * 50, page * 50 + 49);
          if (result.error || result.count === null)
            throw result.error || Error('Contagem indisponível');
          if (active) {
            setRows(result.data as RecordRow[]);
            setTotal(result.count);
          }
        }
      } catch {
        if (active)
          setError('Não foi possível carregar os dados. Atualize a página para tentar novamente.');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [companyId, user.id, section, selected, page, refresh, onRecheck]);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await onLogout();
    } catch {
      setError('Não foi possível sair da conta. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  if (!company)
    return (
      <PublicShell title="Minha empresa · SUN7CRM">
        <main className="secure-access-page public-container">
          <section className="secure-access-card">
            <h1>
              {workspaces === null ? 'Consultando seu acesso...' : 'Seu acesso está em preparação'}
            </h1>
            <p>
              {workspaces === null
                ? 'Estamos verificando a empresa vinculada à sua conta.'
                : 'Ainda não existe uma empresa habilitada vinculada a esta conta. O responsável pelo cadastro precisa concluir a habilitação.'}
            </p>
            {error && (
              <p className="secure-access-error" role="alert">
                {error}
              </p>
            )}
            <div className="secure-access-foot">
              <Button onClick={onRecheck}>Verificar novamente</Button>
              <Button variant="outline" disabled={busy} onClick={() => void logout()}>
                Sair da conta
              </Button>
            </div>
          </section>
        </main>
      </PublicShell>
    );
  const colors = themeStyle(company.theme),
    current = section === 'tasks' ? 'Tarefas' : section === 'contacts' ? 'Contatos' : 'Visão geral';
  const links = [
    { to: '/app', label: 'Visão geral', icon: LayoutDashboard },
    { to: '/app/contatos', label: 'Contatos', icon: Users },
    { to: '/app/tarefas', label: 'Tarefas', icon: ListTodo },
  ];
  return (
    <ThemeProvider style={colors}>
      <div className="layout admin-live official-member" style={colors}>
        {mobile && (
          <button
            className="sidebar-scrim"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
          <div className="sidebar-head">
            <Link className="logo workspace-logo" to="/app">
              <span className="mark">{initials(company.name)}</span>
              <span className="brand">
                <strong>{company.name}</strong>
              </span>
            </Link>
            <button
              className="icon-button mobile-close"
              aria-label="Fechar menu"
              onClick={() => setMobile(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="sidebar-workspace">
            <nav aria-label="Navegação da empresa">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/app'} onClick={() => setMobile(false)}>
                  <Icon size={19} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="sidebar-bottom">
            <div className="user-block">
              <span className="avatar">{initials(user.displayName)}</span>
              <span>
                <strong>{user.displayName}</strong>
                <small>{roleLabels[company.role]}</small>
              </span>
              <button
                className="logout-button"
                aria-label="Sair da conta"
                disabled={busy}
                onClick={() => void logout()}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </aside>
        <div className="work">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Abrir menu"
                aria-expanded={mobile}
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </button>
              <strong>{current}</strong>
            </div>
            <div className="top-controls">
              {workspaces!.length > 1 && (
                <select
                  aria-label="Empresa vinculada"
                  value={company.id}
                  onChange={(event) => {
                    setCompanyId(event.target.value);
                    navigate('/app');
                  }}
                >
                  {workspaces!.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
              <NotificationBell
                key={`${user.id}:${company.id}`}
                userId={user.id}
                companyId={company.id}
                onRecheck={onRecheck}
              />
              <Link className="demo-site-link" to="/">
                Voltar ao site
              </Link>
            </div>
          </header>
          <div className="crm-homologation-banner" role="note">HOMOLOGAÇÃO INTERNA — As operações deste painel utilizam o banco de dados real. Use apenas informações de teste; não cadastre dados pessoais de clientes reais.</div>
          <main className="workspace" id="main">
            <div className="page">
              <Heading
                eyebrow={roleLabels[company.role].toLocaleUpperCase('pt-BR')}
                title={section === 'home' ? `Olá, ${user.displayName.split(' ')[0]}` : current}
                description={
                  section === 'home'
                    ? 'Acompanhe sua rotina e os avisos no sininho.'
                    : 'Registros disponíveis para o seu perfil na empresa.'
                }
              >
                <Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>
                  Atualizar
                </Button>
              </Heading>
              {error && (
                <p className="secure-access-error" role="alert">
                  {error}
                </p>
              )}
              {section === 'home' ? (
                counts ? (
                  <div className="kpis">
                    <Kpi
                      label="Contatos disponíveis"
                      value={counts.contacts}
                      foot="Conforme as permissões do seu perfil"
                      icon={<Users size={19} />}
                      to="/app/contatos"
                    />
                    <Kpi
                      label="Tarefas pendentes"
                      value={counts.tasks}
                      foot={
                        company.role === 'manager'
                          ? 'Pendências da equipe'
                          : 'Sob sua responsabilidade'
                      }
                      icon={<ListTodo size={19} />}
                      to="/app/tarefas"
                    />
                  </div>
                ) : (
                  !error && <p role="status">Carregando sua rotina...</p>
                )
              ) : (
                <>
                  {selected && (
                    <Button variant="ghost" onClick={() => setParams({})}>
                      Mostrar todos os registros
                    </Button>
                  )}
                  <div className="card panel">
                    {rows === null ? (
                      !error && <p role="status">Carregando registros...</p>
                    ) : !rows.length ? (
                      <Empty
                        title="Nenhum registro disponível"
                        description={
                          selected
                            ? 'O registro pode ter sido alterado ou estar fora das suas permissões.'
                            : 'Os registros da empresa aparecerão aqui conforme forem cadastrados.'
                        }
                      />
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>{section === 'tasks' ? 'Tarefa' : 'Contato'}</th>
                              <th>{section === 'tasks' ? 'Vencimento' : 'Telefone'}</th>
                              <th>{section === 'tasks' ? 'Situação' : 'Temperatura'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr key={row.id}>
                                <td>
                                  <strong>{row.title || row.name}</strong>
                                </td>
                                <td>
                                  {section === 'tasks'
                                    ? dateLabel(row.due_date!)
                                    : row.phone || 'Não informado'}
                                </td>
                                <td>
                                  {section === 'tasks'
                                    ? {
                                        todo: 'Pendente',
                                        in_progress: 'Em andamento',
                                        done: 'Concluída',
                                      }[row.status!] || row.status
                                    : temperatureLabels[row.temperature!] || 'Não classificada'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {!!total && (
                    <div className="admin-data-bar">
                      <span>
                        {total} registros · página {page + 1}
                      </span>
                      <div className="actions">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page === 0}
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.set('pagina', String(page - 1));
                            setParams(next);
                          }}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(page + 1) * 50 >= total}
                          onClick={() => {
                            const next = new URLSearchParams(params);
                            next.set('pagina', String(page + 1));
                            setParams(next);
                          }}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
