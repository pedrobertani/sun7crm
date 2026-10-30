import { AccountMenu } from '../components/AccountMenu';
import { WorkspaceTheme } from '../components/WorkspaceTheme';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Filter as Funnel,
  Users,
  ListTodo,
  Settings,
  Building2,
  UsersRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ChevronRight,
  FlaskConical,
  Megaphone,
  Award,
  Tags,
  ChartNoAxesCombined,
  CreditCard,
} from 'lucide-react';
import { useCrm } from './context';
import { roleLabels } from '../domain/config';
import type { Role } from '../domain/types';
import { initials } from '../lib/format';
import { Button } from '../components/ui/button';
const businessLinks = [
  { to: '/demo/painel', label: 'Dashboard', icon: LayoutDashboard, group: 'Dia a dia' },
  { to: '/demo/funil/leads', label: 'Funil', icon: Funnel, group: 'Dia a dia' },
  { to: '/demo/contatos', label: 'Contatos', icon: Users, group: 'Dia a dia' },
  { to: '/demo/tarefas', label: 'Tarefas', icon: ListTodo, group: 'Dia a dia' },
  { to: '/demo/estrategias', label: 'Estratégias', icon: Megaphone, group: 'Crescimento' },
  { to: '/demo/embaixadores', label: 'Embaixadores', icon: Award, group: 'Crescimento' },
  { to: '/demo/catalogo', label: 'Serviços e produtos', icon: ListTodo, group: 'Cadastros' },
  { to: '/demo/etiquetas', label: 'Etiquetas', icon: Tags, group: 'Cadastros' },
];
export function AppShell() {
  const { data, session, setSession, logout } = useCrm();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const company = data.companies.find((c) => c.id === session.companyId)!;
  const member = data.members.find((m) => m.id === session.memberId);
  const admin = session.role === 'admin';
  const workspaceName = admin ? 'SUN7CRM' : company.displayName || company.name;
  useEffect(() => {
    document.title = workspaceName;
  }, [workspaceName]);
  const links = admin
    ? [
        { to: '/demo/painel', label: 'Visão geral', icon: LayoutDashboard, group: 'Administração' },
        { to: '/demo/empresas', label: 'Empresas', icon: Building2, group: 'Administração' },
      ]
    : businessLinks;
  const allLinks = [
    ...links,
    ...(!admin && session.role === 'manager'
      ? [
          {
            to: '/demo/relatorios',
            label: 'Relatórios',
            icon: ChartNoAxesCombined,
            group: 'Gestão',
          },
          { to: '/demo/equipe', label: 'Equipe', icon: UsersRound, group: 'Gestão' },
        ]
      : []),
    { to: '/demo/configuracoes', label: 'Configurações', icon: Settings, group: 'Preferências' },
    ...(!admin && session.role === 'manager'
      ? [{ to: '/demo/plano', label: 'Plano', icon: CreditCard, group: 'Preferências' }]
      : []),
  ];
  const current = allLinks.find((l) => l.to === location.pathname)?.label || 'Área de trabalho';
  function switchView(role: Role, companyId = session.companyId) {
    const member = data.members.find(
      (m) => m.companyId === companyId && m.role === role && m.active,
    );
    setSession({ role, companyId, memberId: member?.id || '' });
    navigate('/demo/painel');
    setMobile(false);
  }
  return (
    <WorkspaceTheme
      theme={admin ? 'sun7' : company?.theme}
      template={company?.template}
      className={collapsed ? 'collapsed' : ''}
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
          <NavLink
            to="/demo/painel"
            className={'logo ' + (!admin ? 'workspace-logo' : '')}
            aria-label={workspaceName + ' início'}
            title={workspaceName}
          >
            <span className="mark">
              {!admin && company.logo ? (
                <img src={company.logo} alt={'Logo ' + workspaceName} />
              ) : admin ? (
                '7'
              ) : (
                initials(workspaceName)
              )}
            </span>
            <span className="brand">
              <strong>{workspaceName}</strong>
              {admin && <small>GESTÃO COMERCIAL</small>}
            </span>
          </NavLink>
          <button
            className="icon-button collapse-button"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            className="icon-button mobile-close"
            aria-label="Fechar menu"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-workspace">
          <p className="sbar-label hide-collapsed">
            {admin ? 'ADMINISTRAÇÃO' : 'ÁREA DE TRABALHO'}
          </p>
          <nav aria-label="Navegação principal">
            {(admin
              ? ['Administração', 'Preferências']
              : ['Dia a dia', 'Crescimento', 'Gestão', 'Cadastros', 'Preferências']
            ).map((group) => {
              const items = allLinks.filter((l) => l.group === group && l.group !== 'Preferências');
              return items.length ? (
                <div key={group} className="nav-section">
                  <p className="nav-section-label hide-collapsed">{group}</p>
                  {items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/demo/painel'}
                      title={collapsed ? label : undefined}
                      onClick={() => setMobile(false)}
                    >
                      <Icon size={19} />
                      <span className="hide-collapsed">{label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : null;
            })}
          </nav>
        </div>
      </aside>
      <div className="work">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">{admin ? 'Plataforma' : 'Área de trabalho'}</span>
            <ChevronRight size={14} />
            <strong>{current}</strong>
          </div>
          <div className="top-controls">
            <AccountMenu
              name={admin ? 'Caio' : member?.name || 'Usuário'}
              role={roleLabels[session.role]}
              settings="/demo/configuracoes"
              plan={!admin && session.role === 'manager' ? '/demo/plano' : undefined}
              onLogout={() => {
                logout();
                navigate('/demo', { replace: true });
              }}
            />
            <label>
              <span className="sr-only">Empresa da prévia</span>
              <select
                aria-label="Empresa da prévia"
                value={session.companyId}
                onChange={(e) => switchView('manager', e.target.value)}
              >
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        <main className="workspace" id="main">
          <div className="page">
            <div className="prototype-note">
              <FlaskConical size={14} />
              <span>Dados fictícios salvos neste navegador. Explore todas as funcionalidades.</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/demo/configuracoes?aba=previa')}
              >
                Sobre a demo <ChevronRight size={13} />
              </Button>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </WorkspaceTheme>
  );
}
