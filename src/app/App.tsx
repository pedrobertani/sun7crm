import { ContactPage } from '../modules/public/Contact';
import { FeaturesPage } from '../modules/public/Features';
import { Home } from '../modules/public/Home';
import { LoginPage } from '../modules/public/Login';
import { LegalPage } from '../modules/public/LegalPages';
import { Acceptance } from '../modules/public/Acceptance';
import { PreviewEntry } from './PreviewEntry';
import { Component, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CrmProvider, useCrm } from './context';
import { BrowserRepository } from '../data/repository';
import { AppShell } from './Shell';
import { CompanyDashboard, AdminDashboard } from '../modules/dashboard/Dashboard';
import { Contacts } from '../modules/contacts/Contacts';
import { Kanban } from '../modules/kanban/Kanban';
import { Tasks } from '../modules/tasks/Tasks';
import { Companies } from '../modules/companies/Companies';
import { Team } from '../modules/team/Team';
import { Settings } from '../modules/settings/Settings';
import { Button } from '../components/ui/button';
const repository = new BrowserRepository(window.localStorage);
function Workspace() {
  const { session, signedOut, acceptance } = useCrm();
  if (signedOut) return <Navigate to="/demo" replace />;
  if (!acceptance)
    return <Acceptance key={session.companyId + ':' + session.role + ':' + session.memberId} />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="painel"
          element={session.role === 'admin' ? <AdminDashboard /> : <CompanyDashboard />}
        />
        <Route
          path="contatos"
          element={session.role === 'admin' ? <Navigate to="/painel" /> : <Contacts />}
        />
        <Route
          path="funil/:kind"
          element={session.role === 'admin' ? <Navigate to="/painel" /> : <Kanban />}
        />
        <Route
          path="tarefas"
          element={session.role === 'admin' ? <Navigate to="/painel" /> : <Tasks />}
        />
        <Route
          path="equipe"
          element={session.role === 'manager' ? <Team /> : <Navigate to="/painel" />}
        />
        <Route
          path="empresas"
          element={session.role === 'admin' ? <Companies /> : <Navigate to="/painel" />}
        />
        <Route
          path="configuracoes"
          element={<Settings key={session.companyId + session.memberId} />}
        />
        <Route path="*" element={<Navigate to="/painel" replace />} />
      </Route>
    </Routes>
  );
}
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Não foi possível abrir a prévia.</h1>
        <p>Recarregue a página. Os dados deste protótipo ficam somente neste navegador.</p>
        <Button onClick={() => location.reload()}>Tentar novamente</Button>
        <Button
          variant="outline"
          onClick={() => {
            localStorage.removeItem('sun7crm:prototype:v1');
            location.reload();
          }}
        >
          Restaurar dados fictícios
        </Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <CrmProvider repository={repository}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/recursos" element={<FeaturesPage />} />
          <Route path="/contato" element={<ContactPage />} />
          <Route path="/acessar" element={<LoginPage />} />
          <Route path="/login" element={<Navigate to="/acessar" replace />} />
          <Route path="/demo" element={<PreviewEntry />} />
          <Route path="/entrar" element={<PreviewEntry />} />
          <Route path="/privacidade" element={<LegalPage kind="privacy" />} />
          <Route path="/termos" element={<LegalPage kind="terms" />} />
          <Route path="*" element={<Workspace />} />
        </Routes>
      </CrmProvider>
    </ErrorBoundary>
  );
}
