import { AccountMenu } from '../../components/AccountMenu';
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Building2,
  CreditCard,
  ChevronRight,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { ThemeProvider } from '../../components/theme-provider';
import { Button } from '../../components/ui/button';
import { Empty } from '../../components/shared';
import { getSupabaseClient } from '../../lib/supabase';
import { AccessChangedError, type AccountUser } from '../auth/access';
import { BrandSymbol } from '../public/PublicShell';
import { AdminDashboardView } from '../dashboard/Dashboard';
import { AdminCompanies } from './Companies';
import { loadAdminPortfolio, type AdminCompany } from './repository';
import './admin.css';
import { NotificationBell } from '../notifications/NotificationBell';
import { AdminPlans } from '../billing/AdminPlans';
import { ADMIN_THEME } from './theme';

export function AdminWorkspace({
  user,
  onLogout,
  onRecheck,
}: {
  user: AccountUser;
  onLogout: () => Promise<void>;
  onRecheck: () => void;
}) {
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const isCompanies = location.pathname.startsWith('/admin/empresas');
  const isPlans = location.pathname.startsWith('/admin/planos');
  const current = isCompanies ? 'Empresas' : isPlans ? 'Planos' : 'Visão geral';
  const colors = ADMIN_THEME;

  useEffect(() => {
    document.title = `${current} · Administração SUN7CRM`;
    setMobile(false);
  }, [current]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void loadAdminPortfolio(getSupabaseClient(), user.id, controller.signal)
      .then((rows) => {
        if (active) setCompanies(rows);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof AccessChangedError) {
          setCompanies(null);
          onRecheck();
        } else
          setError(
            'Não foi possível atualizar as empresas. Confira sua conexão e tente novamente.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [refresh, user.id, onRecheck]);
  useEffect(() => {
    if (!mobile) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [mobile]);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onLogout();
    } catch {
      setError('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setSigningOut(false);
    }
  }
  const links = [
    { to: '/admin', label: 'Visão geral', icon: LayoutDashboard },
    { to: '/admin/empresas', label: 'Empresas', icon: Building2 },
    { to: '/admin/planos', label: 'Planos', icon: CreditCard },
  ];
  return (
    <ThemeProvider style={colors}>
      <div className="admin-canvas">
        <div
          data-theme="sun7"
          data-color-scheme="dark"
          className={`layout themed-workspace admin-live ${collapsed ? 'collapsed' : ''}`}
          style={colors}
        >
          {mobile && (
            <button
              className="sidebar-scrim"
              aria-label="Fechar menu"
              onClick={() => setMobile(false)}
            />
          )}
          <aside id="admin-navigation" className={`sidebar ${mobile ? 'is-open' : ''}`}>
            <div className="sidebar-head">
              <Link to="/admin" className="logo" aria-label="SUN7CRM, painel administrativo">
                <BrandSymbol className="admin-brand-symbol" />
                <span className="brand hide-collapsed">
                  <strong>
                    SUN7<span>CRM</span>
                  </strong>
                  <small>ADMINISTRAÇÃO</small>
                </span>
              </Link>
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
              <p className="sbar-label hide-collapsed">PLATAFORMA</p>
              <nav aria-label="Administração SUN7CRM">
                {links.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/admin'}
                    title={collapsed ? label : undefined}
                    onClick={() => setMobile(false)}
                  >
                    <Icon size={19} />
                    <span className="hide-collapsed">{label}</span>
                  </NavLink>
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
                  aria-controls="admin-navigation"
                  onClick={() => setMobile(true)}
                >
                  <Menu size={21} />
                </button>
                <span className="breadcrumb-root">Administração</span>
                <ChevronRight size={14} />
                <strong>{current}</strong>
              </div>
              <div className="top-controls">
                <NotificationBell userId={user.id} onRecheck={onRecheck} />
                <span className="badge good admin-real-badge">Conta real</span>
                <AccountMenu
                  name={user.displayName}
                  email={user.email}
                  role="Administrador"
                  busy={signingOut}
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
                <div className="admin-data-bar">
                  <span>{loading ? 'Atualizando empresas...' : 'Dados da plataforma'}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loading}
                    onClick={() => {
                      setNotice('');
                      setRefresh((n) => n + 1);
                    }}
                  >
                    Atualizar
                  </Button>
                </div>
                {notice && (
                  <p className="admin-feedback" role="status">
                    {notice}
                  </p>
                )}
                {error && (
                  <div className="secure-access-error" role="alert">
                    <p>{error}</p>
                    {companies && <p>Os dados abaixo podem estar desatualizados.</p>}
                  </div>
                )}
                {companies === null ? (
                  <div className="card panel" role="status">
                    {loading ? (
                      <p>Carregando seu painel...</p>
                    ) : (
                      <Empty
                        title="O painel não pôde ser carregado"
                        description="Use Atualizar para tentar novamente."
                      />
                    )}
                  </div>
                ) : (
                  <Routes>
                    <Route
                      path="planos"
                      element={
                        <AdminPlans
                          companies={companies}
                          userId={user.id}
                          onRecheck={onRecheck}
                          onReload={() => setRefresh((n) => n + 1)}
                          onNotice={setNotice}
                        />
                      }
                    />
                    <Route index element={<AdminDashboardView companies={companies} dark />} />
                    <Route
                      path="empresas"
                      element={
                        <AdminCompanies
                          companies={companies}
                          userId={user.id}
                          onRecheck={onRecheck}
                          onReload={() => setRefresh((n) => n + 1)}
                          onNotice={setNotice}
                        />
                      }
                    />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Routes>
                )}
              </div>
            </main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
