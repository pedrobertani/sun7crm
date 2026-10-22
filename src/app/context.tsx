import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { CrmRepository } from '../data/repository';
import type { Snapshot, Session } from '../domain/types';
interface Context {
  data: Snapshot;
  session: Session;
  setSession: (s: Session) => void;
  update: (f: (d: Snapshot) => Snapshot) => boolean;
  reset: () => void;
  notice: (message: string) => void;
}
const CrmContext = createContext<Context | null>(null);
export function CrmProvider({
  repository,
  children,
}: {
  repository: CrmRepository;
  children: ReactNode;
}) {
  const [data, setData] = useState(() => repository.read());
  const [session, setSession] = useState<Session>({
    role: 'manager',
    companyId: 'aurora',
    memberId: 'aurora-manager',
  });
  const [message, setMessage] = useState('');
  const notice = (msg: string) => {
    setMessage(msg);
    window.setTimeout(() => setMessage((current) => (current === msg ? '' : current)), 5000);
  };
  const value = useMemo(
    () => ({
      data,
      session,
      setSession,
      notice,
      update: (f: (d: Snapshot) => Snapshot) => {
        try {
          const next = f(data);
          repository.write(next);
          setData(next);
          return true;
        } catch (error) {
          notice(
            error instanceof Error ? error.message : 'Não foi possível salvar neste navegador.',
          );
          return false;
        }
      },
      reset: () => {
        try {
          setData(repository.reset());
          setSession({ role: 'manager', companyId: 'aurora', memberId: 'aurora-manager' });
          notice('Dados fictícios restaurados.');
        } catch {
          notice('O navegador não permitiu restaurar os dados.');
        }
      },
    }),
    [data, session, repository],
  );
  return (
    <CrmContext.Provider value={value}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </CrmContext.Provider>
  );
}
export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) throw Error('CrmProvider ausente');
  return context;
}
