import { ModalFooter } from '../../components/ui/modal-footer';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type DependencyList,
} from 'react';
import { OperationalBackend, BackendError, type TeamRow } from '../../data/backend';
import { getSupabaseClient } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Pagination, type PageSize } from '../../components/ui/pagination';
import { FormError } from '../../components/shared';
import { legacyPermissions, type EmployeePermissions } from '../permissions/model';
import type { AccountUser } from '../auth/access';
import { useLiveQuery } from '../../hooks/useLiveQuery';

export interface OperationalCompany {
  id: string;
  membershipId: string;
  name: string;
  role: 'manager' | 'seller' | 'reception';
  permissions?: EmployeePermissions;
}
interface Context {
  page: string;
  can: (key: string) => boolean;
  companyScope: boolean;
  api: OperationalBackend;
  company: OperationalCompany;
  user: AccountUser;
  revision: number;
  refresh: () => void;
  notice: (message: string) => void;
  recheck: () => void;
}
const OperationalContext = createContext<Context | null>(null);
export function OperationalProvider({
  company,
  user,
  onRecheck,
  children,
  backend,
  page = 'all',
}: {
  company: OperationalCompany;
  user: AccountUser;
  onRecheck: () => void;
  children: ReactNode;
  backend?: OperationalBackend;
  page?: string;
}) {
  const api = useMemo(
    () => backend || new OperationalBackend(getSupabaseClient(), company.id),
    [company.id, backend],
  );
  const [revision, setRevision] = useState(0),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 7000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <OperationalContext.Provider
      value={{
        page,
        can: (key) => (company.permissions || legacyPermissions(company.role)).keys.includes(key),
        companyScope: (company.permissions || legacyPermissions(company.role)).scope === 'company',
        api,
        company,
        user,
        revision,
        refresh: () => setRevision((n) => n + 1),
        notice: setMessage,
        recheck: onRecheck,
      }}
    >
      {message && (
        <div className="operational-notice" role="status">
          {message}
          <button type="button" aria-label="Fechar aviso" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
      {children}
    </OperationalContext.Provider>
  );
}
export function useOperational() {
  const value = useContext(OperationalContext);
  if (!value) throw Error('Área operacional indisponível.');
  return value;
}
export function useQuery<T>(
  load: () => Promise<T>,
  deps: DependencyList = [],
  { live = true }: { live?: boolean } = {},
) {
  const { revision, recheck, company, page } = useOperational();
  const query = useLiveQuery(
    async (signal) => {
      try {
        return await load();
      } catch (cause) {
        if (!signal.aborted && cause instanceof BackendError && cause.kind === 'access') recheck();
        throw new Error(errorMessage(cause));
      }
    },
    [revision, ...deps],
    {
      group: live ? `workspace:${company.id}:${page}` : `static:${company.id}`,
      automatic: () => live && !document.querySelector('[role="dialog"]'),
    },
  );
  return {
    ...query,
    loading: query.loading && query.data === null,
    retry: () => void query.refresh(),
  };
}
export function errorMessage(e: unknown) {
  return e instanceof BackendError
    ? e.message
    : e instanceof Error
      ? e.message
      : 'Não foi possível concluir. Atualize os dados e tente novamente.';
}
export function useSave() {
  const { recheck } = useOperational();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  async function run(action: () => Promise<void>, idempotent = false) {
    if (pending.current || (!idempotent && uncertain)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof BackendError) {
        if (e.kind === 'access') recheck();
        if (e.resultUncertain && !idempotent) setUncertain(true);
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    uncertain,
    run,
    setError,
    reset: () => {
      setError('');
      setUncertain(false);
    },
  };
}
export function QueryState({
  query,
}: {
  query: { loading: boolean; error: string; retry: () => void };
}) {
  return query.error ? (
    <div className="card panel">
      <FormError message={query.error} />
      <Button variant="outline" onClick={query.retry}>
        Tentar novamente
      </Button>
    </div>
  ) : query.loading ? (
    <p role="status" className="operational-loading">
      Carregando registros...
    </p>
  ) : null;
}
export function SaveActions({
  save,
  onClose,
  label = 'Salvar',
}: {
  save: ReturnType<typeof useSave>;
  onClose: () => void;
  label?: string;
}) {
  return (
    <>
      <FormError message={save.error} />
      {save.uncertain && (
        <p className="small-note">
          Confira a lista atualizada antes de iniciar outra gravação. Seus dados preenchidos
          continuam neste formulário.
        </p>
      )}
      <ModalFooter>
        <Button type="button" variant="outline" disabled={save.busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.busy || save.uncertain}>
          {save.busy ? 'Salvando...' : label}
        </Button>
      </ModalFooter>
    </>
  );
}
export function Pager({
  page, total, size = 10, onChange, onSizeChange, loading = false,
}: {
  page: number; total: number; size?: number;
  onChange: (page: number) => void;
  onSizeChange?: (size: PageSize) => void;
  loading?: boolean;
}) {
  return <Pagination page={page} total={total} size={size} onChange={onChange} onSizeChange={onSizeChange} loading={loading} />;
}
export function useTeam() {
  const { api, company, user, can } = useOperational();
  return useQuery(
    async () =>
      can('team.view')
        ? api.team()
        : ([
            {
              id: company.membershipId,
              user_id: user.id,
              display_name: user.displayName,
              email: '',
              role: company.role,
              active: true,
              row_version: 1,
            },
          ] as TeamRow[]),
    [api, company.role, company.membershipId, user.id],
  );
}
export function cents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Informe um valor válido.');
  const n = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(n) || n < 0 || n > 2147483647)
    throw Error('O valor está fora do limite permitido.');
  return n;
}
export function datetimeLocal(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(d)
    .replace(' ', 'T');
}
export function fromLocal(value: string) {
  if (!value) return null;
  const d = new Date(value + '-03:00');
  if (Number.isNaN(d.valueOf())) throw Error('Informe data e hora válidas.');
  return d.toISOString();
}
