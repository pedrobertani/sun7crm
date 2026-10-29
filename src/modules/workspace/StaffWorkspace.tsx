import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Menu,
  Users,
  X,
  Filter as Funnel,
  Tags,
  Package,
  Megaphone,
  Handshake,
  ChartNoAxesCombined,
  UsersRound,
  Settings,
  CreditCard,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { pageRefreshScheduler } from '../../lib/query-refresh';
import { hasChangeConnection } from '../../lib/data-changes';
import { useDataChanges } from '../../hooks/useDataChanges';
import { Heading, Empty } from '../../components/shared';
import { WorkspaceTheme } from '../../components/WorkspaceTheme';
import { getSupabaseClient } from '../../lib/supabase';
import { initials } from '../../lib/format';
import type { CrmTheme } from '../../lib/themes';
import { AccountMenu } from '../../components/AccountMenu';
import { legacyPermissions } from '../permissions/model';
import { loadAccountAccess, type AccountUser } from '../auth/access';
import { PublicShell } from '../public/PublicShell';
import { NotificationBell } from '../notifications/NotificationBell';
import { RealPlan } from '../billing/Plan';
import {
  OperationalProvider,
  useOperational,
  useQuery,
  type OperationalCompany,
} from './operational';
import { RealKanban } from './RealKanban';
import { RealCatalog, RealContacts, RealStrategies, RealTasks } from './RealRecords';
import { RealDashboard, RealReports, RealSettings, RealTeam } from './RealManagement';
import { RealAmbassadors } from './RealAmbassadors';
import '../admin/admin.css';
import './operational.css';

interface Workspace extends OperationalCompany {
  theme: CrmTheme;
  logoPath: string | null;
}
export const operationalNavigation = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, group: 'Dia a dia' },
  { to: '/app/funil', label: 'Funil', icon: Funnel, group: 'Dia a dia' },
  { to: '/app/contatos', label: 'Contatos', icon: Users, group: 'Dia a dia' },
  { to: '/app/tarefas', label: 'Tarefas', icon: ListTodo, group: 'Dia a dia' },
  { to: '/app/estrategias', label: 'Estratégias', icon: Megaphone, group: 'Crescimento' },
  {
    to: '/app/embaixadores',
    label: 'Embaixadores',
    icon: Handshake,
    group: 'Crescimento',
    manager: true,
  },
  { to: '/app/catalogo', label: 'Serviços e produtos', icon: Package, group: 'Cadastros' },
  { to: '/app/etiquetas', label: 'Etiquetas', icon: Tags, group: 'Cadastros' },
  {
    to: '/app/relatorios',
    label: 'Relatórios',
    icon: ChartNoAxesCombined,
    group: 'Gestão',
    manager: true,
  },
  { to: '/app/equipe', label: 'Equipe', icon: UsersRound, group: 'Gestão', manager: true },
  {
    to: '/app/configuracoes',
    label: 'Configurações',
    icon: Settings,
    group: 'Preferências',
    manager: true,
  },
  { to: '/app/plano', label: 'Plano', icon: CreditCard, group: 'Preferências', manager: true },
];
export function StaffWorkspace({
  user,
  onLogout,
  onRecheck,
}: {
  user: AccountUser;
  onLogout: () => Promise<void>;
  onRecheck: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null),
    [companyId, setCompanyId] = useState(''),
    [error, setError] = useState(''),
    [tick, setTick] = useState(0),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false),
    [access, setAccess] = useState<{ companyId: string; access_allowed: boolean } | null>(null);
  const location = useLocation(),
    navigate = useNavigate(),
    company = workspaces?.find((c) => c.id === companyId),
    section =
      operationalNavigation.find((n) => n.to !== '/app' && location.pathname.startsWith(n.to)) ||
      operationalNavigation.find((n) => n.to === '/app')!;
  useEffect(() => {
    return pageRefreshScheduler().subscribe(
      async () => setTick((n) => n + 1),
      `access:${user.id}`,
      60_000,
      () => !hasChangeConnection(`access:${user.id}`),
      () => true,
    );
  }, [user.id]);
  useDataChanges({
    userId: user.id,
    companyId: company?.id,
    onAccessChanged: () => setTick((n) => n + 1),
  });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = getSupabaseClient(),
          account = await loadAccountAccess(client);
        if (account.stage !== 'ready' || account.user.id !== user.id || account.isAdmin) {
          if (active) onRecheck();
          return;
        }
        const result = await client
          .from('crm_memberships')
          .select('id,role,company_id,crm_companies(id,name,display_name,theme,logo_path)')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('id');
        if (result.error) throw result.error;
        const items: Workspace[] = [];
        for (const member of result.data || []) {
          const data = Array.isArray(member.crm_companies)
            ? member.crm_companies[0]
            : member.crm_companies;
          if (data && ['manager', 'seller', 'reception'].includes(member.role)) {
            const grants = await client.rpc('crm_employee_permissions', { p_company: data.id });
            if (
              grants.error ||
              !Array.isArray(grants.data?.keys) ||
              !['own', 'company'].includes(grants.data?.scope)
            )
              throw Error('Permissões indisponíveis');
            items.push({
              permissions: grants.data,
              id: data.id,
              membershipId: member.id,
              name: data.display_name || data.name,
              role: member.role,
              theme: data.theme,
              logoPath: data.logo_path,
            });
          }
        }
        if (active) {
          setWorkspaces(items);
          setCompanyId((old) => (items.some((c) => c.id === old) ? old : items[0]?.id || ''));
          setError('');
        }
      } catch {
        if (active)
          setError('Não foi possível atualizar a empresa e as permissões. Tente novamente.');
      }
    })();
    return () => {
      active = false;
    };
  }, [user.id, onRecheck, tick]);
  useEffect(() => {
    if (!companyId) return;
    let active = true;
    void (async () => {
      try {
        const r = await getSupabaseClient().rpc('crm_company_access_status', {
          p_company: companyId,
        });
        if (r.error || typeof r.data?.access_allowed !== 'boolean')
          throw Error('Acesso indisponível');
        if (active) {
          setAccess({ companyId, access_allowed: r.data.access_allowed });
          setError('');
        }
      } catch {
        if (active) setError('Não foi possível verificar o período de acesso. Tente atualizar.');
      }
    })();
    return () => {
      active = false;
    };
  }, [companyId, tick]);
  useEffect(() => {
    document.title = `${company?.name || 'Minha conta'} · SUN7CRM`;
    setMobile(false);
  }, [company?.name, location.pathname]);
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
                ? 'Verificando a empresa vinculada à sua conta.'
                : 'O responsável pelo cadastro precisa concluir a habilitação da sua empresa.'}
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
  const granted = (key: string) =>
      (company.permissions || legacyPermissions(company.role)).keys.includes(key),
    sectionPermission: Record<string, string> = {
      '/app/funil': 'cards.view',
      '/app/contatos': 'contacts.view',
      '/app/tarefas': 'tasks.view',
      '/app': 'dashboard.view',
      '/app/estrategias': 'strategies.view',
      '/app/embaixadores': 'ambassadors.view',
      '/app/catalogo': 'catalog.view',
      '/app/etiquetas': 'labels.view',
      '/app/relatorios': 'reports.view',
      '/app/equipe': 'team.view',
      '/app/configuracoes': 'settings.view',
      '/app/plano': 'plan.view',
    },
    links = operationalNavigation.filter(
      (n) =>
        granted(sectionPermission[n.to]) && (n.to !== '/app/plano' || company.role === 'manager'),
    ),
    sidebarLinks = links.filter((n) => n.group !== 'Preferências'),
    allowed = access?.companyId === company.id ? access.access_allowed : null;
  // An inaccessible dashboard must never become an empty landing page.
  // Also handle revoked access to routes already open after permissions refresh.
  const currentAllowed =
    granted(sectionPermission[section.to]) &&
    (section.to !== '/app/plano' || company.role === 'manager');
  if (allowed && !currentAllowed && links.length) {
    const next = links.find((n) => n.to !== section.to);
    if (next) return <Navigate to={next.to} replace />;
  }
  return (
    <WorkspaceTheme theme={company.theme} className="admin-live official-member">
      <OperationalProvider
        key={company.id + ':' + JSON.stringify(company.permissions)}
        company={company}
        page={section.to}
        user={user}
        onRecheck={onRecheck}
      >
        {mobile && (
          <button
            className="sidebar-scrim"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className={'sidebar ' + (mobile ? 'is-open' : '')}>
          <div className="sidebar-head">
            <Link className="logo workspace-logo" to={links[0]?.to || '/app'}>
              <WorkspaceLogo path={allowed ? company.logoPath : null} name={company.name} />
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
              {sidebarLinks.map((n, index) => (
                <div key={n.to}>
                  {sidebarLinks[index - 1]?.group !== n.group && (
                    <p className="nav-group-label">{n.group}</p>
                  )}
                  <NavLink to={n.to} end={n.to === '/app'} onClick={() => setMobile(false)}>
                    <n.icon size={19} />
                    <span>{n.label}</span>
                  </NavLink>
                </div>
              ))}
            </nav>
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
              <strong>{section.label}</strong>
            </div>
            <div className="top-controls">
              {workspaces!.length > 1 && (
                <select
                  aria-label="Empresa vinculada"
                  value={company.id}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    navigate('/app/funil');
                  }}
                >
                  {workspaces!.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <NotificationBell
                key={user.id + company.id}
                userId={user.id}
                companyId={company.id}
                onRecheck={onRecheck}
              />
              <AccountMenu
                name={user.displayName}
                email={user.email}
                role={
                  company.role === 'manager'
                    ? 'Gestor'
                    : granted('team.manage')
                      ? 'Administrador da empresa'
                      : 'Funcionário'
                }
                settings={granted('settings.view') ? '/app/configuracoes' : undefined}
                plan={company.role === 'manager' && granted('plan.view') ? '/app/plano' : undefined}
                busy={busy}
                onLogout={() => void logout()}
              />
            </div>
          </header>
          <div className="crm-homologation-banner" role="note">
            HOMOLOGAÇÃO INTERNA — As operações deste painel utilizam o banco de dados real. Use
            apenas informações de teste; não cadastre dados pessoais de clientes reais.
          </div>
          <main className="workspace" id="main">
            <div className="page">
              <Heading
                title={
                  section.to === '/app' ? `Olá, ${user.displayName.split(' ')[0]}` : section.label
                }
                description={
                  section.to === '/app/funil'
                    ? 'Organize os atendimentos e acompanhe o próximo passo de cada oportunidade.'
                    : section.to === '/app/plano'
                      ? 'Acompanhe seu plano, pague a mensalidade e consulte o histórico.'
                      : undefined
                }
              />
              {error && (
                <div className="secure-access-error" role="alert">
                  <p>{error}</p>
                  <Button variant="outline" onClick={() => setTick((n) => n + 1)}>
                    Tentar novamente
                  </Button>
                </div>
              )}
              {allowed === null ? (
                <p role="status">Verificando o período de acesso...</p>
              ) : !allowed ? (
                company.role === 'manager' && granted('plan.view') ? (
                  <RealPlan key={company.id} companyId={company.id} />
                ) : (
                  <div className="card panel">
                    <Empty
                      title="Acesso da empresa suspenso"
                      description="Fale com o gestor para regularizar o acesso."
                    />
                  </div>
                )
              ) : !granted(sectionPermission[section.to]) ||
                (section.to === '/app/plano' && company.role !== 'manager') ? (
                <div className="card panel">
                  <Empty
                    title="Funcionalidade sem acesso"
                    description="Peça ao administrador da empresa para liberar esta funcionalidade nas suas permissões."
                  />
                  {links[0] && <Link to={links[0].to}>Abrir {links[0].label}</Link>}
                </div>
              ) : (
                <OperationalContent
                  path={section.to}
                  onCompanyChanged={() => setTick((n) => n + 1)}
                />
              )}
            </div>
          </main>
        </div>
      </OperationalProvider>
    </WorkspaceTheme>
  );
}
function WorkspaceLogo({ path, name }: { path: string | null; name: string }) {
  const { api } = useOperational(),
    image = useQuery(() => (path ? api.downloadLogo(path) : Promise.resolve(null)), [api, path], {
      live: false,
    }),
    [url, setUrl] = useState('');
  useEffect(() => {
    if (!image.data) {
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(image.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [image.data]);
  return (
    <span className="mark">
      {url ? (
        <img className="operational-sidebar-logo" src={url} alt={'Logo de ' + name} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
function OperationalContent({
  path,
  onCompanyChanged,
}: {
  path: string;
  onCompanyChanged: () => void;
}) {
  const { company } = useOperational();
  switch (path) {
    case '/app/funil':
      return <RealKanban />;
    case '/app/contatos':
      return <RealContacts />;
    case '/app/tarefas':
      return <RealTasks />;
    case '/app/catalogo':
      return <RealCatalog />;
    case '/app/etiquetas':
      return <RealCatalog key="labels" labels />;
    case '/app/estrategias':
      return <RealStrategies />;
    case '/app/embaixadores':
      return <RealAmbassadors />;
    case '/app/equipe':
      return <RealTeam />;
    case '/app/configuracoes':
      return <RealSettings onCompanyChanged={onCompanyChanged} />;
    case '/app/relatorios':
      return <RealReports />;
    case '/app/plano':
      return <RealPlan key={company.id} companyId={company.id} />;
    default:
      return <RealDashboard />;
  }
}
