import { DemoActivityReport } from '../modules/reports/ActivityReport';
import { DemoPlan } from '../modules/billing/Plan';
import { ContactPage } from '../modules/public/Contact';
import { FeaturesPage } from '../modules/public/Features';
import { Home } from '../modules/public/Home';
import { LoginPage } from '../modules/public/Login';
import { LegalPage } from '../modules/public/LegalPages';
import { PreviewEntry } from './PreviewEntry';
import { RealAccess } from '../modules/auth/RealAccess';
import { Component, useState, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { CrmProvider, useCrm } from './context';
import { BrowserRepository } from '../data/repository';
import { AppShell } from './Shell';
import { CompanyDashboard } from '../modules/dashboard/Dashboard';
import { Contacts } from '../modules/contacts/Contacts';
import { Kanban } from '../modules/kanban/Kanban';
import { Tasks } from '../modules/tasks/Tasks';
import { Team } from '../modules/team/Team';
import { Settings } from '../modules/settings/Settings';
import { Strategies } from '../modules/growth/Strategies';
import { Catalog, Labels } from '../modules/catalog/Catalog';
import { Ambassadors } from '../modules/growth/Ambassadors';
import { Button } from '../components/ui/button';
function DemoGuard() {
  const { session, signedOut } = useCrm();
  if (signedOut || session.role === 'admin') return <Navigate to="/demo" replace />;
  return <Outlet />;
}
function Demo() {
  const [repository] = useState(() => new BrowserRepository(window.localStorage));
  return (
    <ErrorBoundary demo>
      <CrmProvider repository={repository}>
        <Routes>
          <Route index element={<PreviewEntry />} />
          <Route element={<DemoGuard />}>
            <Route element={<AppShell />}>
              <Route path="painel" element={<CompanyDashboard />} />
              <Route path="contatos" element={<Contacts />} />
              <Route path="catalogo" element={<Catalog />} />
              <Route path="etiquetas" element={<Labels />} />
              <Route path="funil/:kind" element={<Kanban />} />
              <Route path="tarefas" element={<Tasks />} />
              <Route path="relatorios" element={<DemoActivityReport />} />
              <Route path="plano" element={<DemoPlan />} />
              <Route path="estrategias" element={<Strategies />} />
              <Route path="campanhas" element={<Navigate to="/demo/estrategias" replace />} />
              <Route path="embaixadores" element={<Ambassadors />} />
              <Route path="embaixador" element={<Navigate to="/demo/embaixadores" replace />} />
              <Route path="equipe" element={<DemoTeam />} />
              <Route path="configuracoes" element={<DemoSettings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Routes>
      </CrmProvider>
    </ErrorBoundary>
  );
}
function DemoTeam() {
  const { session } = useCrm();
  return session.role === 'manager' ? <Team /> : <Navigate to="/demo/painel" replace />;
}
function DemoSettings() {
  const { session } = useCrm();
  return <Settings key={session.companyId + session.memberId} />;
}
class ErrorBoundary extends Component<{ children: ReactNode; demo?: boolean }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Não foi possível carregar esta página.</h1>
        <p>
          {this.props.demo
            ? 'Recarregue a demonstração. Os dados fictícios ficam somente neste navegador.'
            : 'Recarregue a página para tentar novamente.'}
        </p>
        <Button onClick={() => location.reload()}>Tentar novamente</Button>
        {this.props.demo && (
          <Button
            variant="outline"
            onClick={() => {
              localStorage.removeItem('sun7crm:prototype:v1');
              location.reload();
            }}
          >
            Restaurar dados fictícios
          </Button>
        )}
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recursos" element={<FeaturesPage />} />
        <Route path="/contato" element={<ContactPage />} />
        <Route path="/acessar" element={<LoginPage />} />
        <Route path="/conta/*" element={<RealAccess />} />
        <Route path="/login" element={<Navigate to="/acessar" replace />} />
        <Route path="/admin/*" element={<RealAccess adminPage />} />
        <Route path="/app/*" element={<RealAccess staffPage />} />
        <Route path="/demo/*" element={<Demo />} />
        <Route path="/entrar" element={<Navigate to="/acessar" replace />} />
        <Route path="/empresas/*" element={<Navigate to="/admin/empresas" replace />} />
        <Route path="/painel/*" element={<Navigate to="/conta" replace />} />
        <Route path="/contatos/*" element={<Navigate to="/conta" replace />} />
        <Route path="/funil/*" element={<Navigate to="/conta" replace />} />
        <Route path="/tarefas/*" element={<Navigate to="/conta" replace />} />
        <Route path="/equipe/*" element={<Navigate to="/conta" replace />} />
        <Route path="/configuracoes/*" element={<Navigate to="/conta" replace />} />
        <Route path="/privacidade" element={<LegalPage kind="privacy" />} />
        <Route path="/termos" element={<LegalPage kind="terms" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
