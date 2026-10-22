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
  const { session } = useCrm();
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          index
          element={session.role === 'admin' ? <AdminDashboard /> : <CompanyDashboard />}
        />
        <Route
          path="contatos"
          element={session.role === 'admin' ? <Navigate to="/" /> : <Contacts />}
        />
        <Route
          path="funil/:kind"
          element={session.role === 'admin' ? <Navigate to="/" /> : <Kanban />}
        />
        <Route
          path="tarefas"
          element={session.role === 'admin' ? <Navigate to="/" /> : <Tasks />}
        />
        <Route
          path="equipe"
          element={session.role === 'manager' ? <Team /> : <Navigate to="/" />}
        />
        <Route
          path="empresas"
          element={session.role === 'admin' ? <Companies /> : <Navigate to="/" />}
        />
        <Route
          path="configuracoes"
          element={<Settings key={session.companyId + session.memberId} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
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
        <Workspace />
      </CrmProvider>
    </ErrorBoundary>
  );
}
