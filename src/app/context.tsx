import {
  readAcceptances,
  recordAcceptance,
  currentAcceptance,
  type LegalAcceptance,
} from '../domain/legal';
import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { CrmRepository } from '../data/repository';
import type { Snapshot, Session } from '../domain/types';
interface Context {
  data: Snapshot;
  session: Session;
  setSession: (s: Session) => void;
  signedOut: boolean;
  acceptance: LegalAcceptance | undefined;
  acceptLegal: (terms: boolean, privacy: boolean) => boolean;
  logout: () => void;
  enterPreview: () => void;
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
  const [signedOut, setSignedOut] = useState(() => {
    try {
      return window.sessionStorage.getItem('sun7crm:preview:signed-out') === '1';
    } catch {
      return false;
    }
  });
  const [acceptances, setAcceptances] = useState(() => readAcceptances(window.localStorage));
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
      signedOut,
      acceptance: currentAcceptance(acceptances, session),
      acceptLegal: (terms: boolean, privacy: boolean) => {
        try {
          setAcceptances(
            recordAcceptance(window.localStorage, acceptances, session, terms, privacy),
          );
          return true;
        } catch {
          notice(
            'Não foi possível registrar a confirmação. Verifique se o navegador permite salvar dados e tente novamente.',
          );
          return false;
        }
      },
      logout: () => {
        setSignedOut(true);
        setMessage('');
        setSession({ role: 'manager', companyId: 'aurora', memberId: 'aurora-manager' });
        try {
          window.sessionStorage.setItem('sun7crm:preview:signed-out', '1');
        } catch {
          /* O estado em memória continua encerrado. */
        }
      },
      enterPreview: () => {
        setSignedOut(false);
        try {
          window.sessionStorage.removeItem('sun7crm:preview:signed-out');
        } catch {
          /* Entrada local sem persistência da sessão simulada. */
        }
      },
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
    [data, session, repository, signedOut, acceptances],
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
