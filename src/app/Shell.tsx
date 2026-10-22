import { ThemeProvider } from '../components/theme-provider';
import { themeStyle } from '../lib/themes';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  KanbanSquare,
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
} from 'lucide-react';
import { useCrm } from './context';
import { roleLabels } from '../domain/config';
import type { Role } from '../domain/types';
import { initials } from '../lib/format';
import { Button } from '../components/ui/button';
const businessLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/funil/leads', label: 'Funil de leads', icon: KanbanSquare },
  { to: '/funil/clients', label: 'Funil de clientes', icon: KanbanSquare },
  { to: '/contatos', label: 'Contatos', icon: Users },
  { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
];
export function AppShell() {
  const { data, session, setSession } = useCrm();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const company = data.companies.find((c) => c.id === session.companyId)!;
  const member = data.members.find((m) => m.id === session.memberId);
  const admin = session.role === 'admin';
  const links = admin
    ? [
        { to: '/', label: 'Visão geral', icon: LayoutDashboard },
        { to: '/empresas', label: 'Empresas', icon: Building2 },
      ]
    : businessLinks;
  const allLinks = [
    ...links,
    ...(!admin && session.role === 'manager'
      ? [{ to: '/equipe', label: 'Equipe', icon: UsersRound }]
      : []),
    { to: '/configuracoes', label: 'Configurações', icon: Settings },
  ];
  const current = allLinks.find((l) => l.to === location.pathname)?.label || 'Área de trabalho';
  function switchView(role: Role, companyId = session.companyId) {
    const member = data.members.find(
      (m) => m.companyId === companyId && m.role === role && m.active,
    );
    setSession({ role, companyId, memberId: member?.id || '' });
    navigate('/');
    setMobile(false);
  }
  const colors = themeStyle(admin ? 'sun7' : company?.theme, company?.template);
  return (
    <ThemeProvider style={colors}>
      <div
        style={colors}
        className={
          'layout ' +
          (collapsed ? 'collapsed ' : '') +
          (company?.template === 'generic' && !admin ? 'generic' : '')
        }
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
            <NavLink to="/" className="logo" aria-label="SUN7CRM início">
              <span className="mark">7</span>
              <span className="brand">
                <strong>SUN7CRM</strong>
                <small>GESTÃO COMERCIAL</small>
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
          <div className="company-identity">
            <span className="company-avatar">
              {!admin && company?.logo ? (
                <img src={company.logo} alt="" />
              ) : admin ? (
                'S7'
              ) : (
                initials(company?.name || 'Empresa')
              )}
            </span>
            <div className="hide-collapsed">
              <strong>{admin ? 'SUN7CRM' : company?.name}</strong>
              <small>{admin ? 'Painel da plataforma' : company?.segment}</small>
            </div>
          </div>
          <div className="sidebar-workspace">
            <p className="sbar-label hide-collapsed">
              {admin ? 'ADMINISTRAÇÃO' : 'ÁREA DE TRABALHO'}
            </p>
            <nav aria-label="Navegação principal">
              {allLinks.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  title={collapsed ? label : undefined}
                  onClick={() => setMobile(false)}
                >
                  <Icon size={19} />
                  <span className="hide-collapsed">{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="sidebar-bottom">
            <NavLink to="/configuracoes" className="user-block" onClick={() => setMobile(false)}>
              <span className="avatar">{initials(admin ? 'Caio' : member?.name || 'Usuário')}</span>
              <span className="hide-collapsed">
                <strong>{admin ? 'Caio' : member?.name || 'Usuário'}</strong>
                <small>{roleLabels[session.role]}</small>
              </span>
              <Settings size={16} className="hide-collapsed" />
            </NavLink>
            <div className="sidebar-note hide-collapsed">
              <FlaskConical size={12} /> Ambiente de validação
            </div>
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
              <span className="preview-tag">
                <span />
                PRÉVIA
              </span>
              <label>
                <span className="sr-only">Empresa da prévia</span>
                <select
                  aria-label="Empresa da prévia"
                  value={session.companyId}
                  onChange={(e) => switchView(session.role, e.target.value)}
                >
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Perfil da prévia</span>
                <select
                  aria-label="Perfil da prévia"
                  value={session.role}
                  onChange={(e) => switchView(e.target.value as Role)}
                >
                  {Object.entries(roleLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
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
                <span>
                  Dados fictícios salvos neste navegador. Perfis simulados para validação.
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigate('/configuracoes')}>
                  Sobre a prévia <ChevronRight size={13} />
                </Button>
              </div>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
