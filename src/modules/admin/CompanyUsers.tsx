import { ModalFooter } from '../../components/ui/modal-footer';
import { KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Pagination, paginatedRows, usePagination } from '../../components/ui/pagination';
import { Users, ShieldCheck, UserRound, UserRoundX } from 'lucide-react';
import { Kpi } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { getSupabaseClient } from '../../lib/supabase';
import { uid } from '../../lib/format';
import { AccessChangedError } from '../auth/access';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import {
  AdminCommandError,
  loadAdminCompanyUsers,
  resetAdminCompanyPassword,
  type AdminCompanyUser,
} from './repository';

export function CompanyUsers({
  companyId,
  userId,
  onRecheck,
  onNotice,
}: {
  companyId: string;
  userId: string;
  onRecheck: () => void;
  onNotice: (message: string) => void;
}) {
  const [target, setTarget] = useState<AdminCompanyUser | null>(null);
  const {
    data: rows,
    error,
    refresh,
  } = useLiveQuery(
    async (signal) => {
      try {
        return await loadAdminCompanyUsers(getSupabaseClient(), userId, companyId);
      } catch (cause) {
        if (!signal.aborted && cause instanceof AccessChangedError) onRecheck();
        throw new Error('Não foi possível carregar os usuários desta empresa.');
      }
    },
    [companyId, userId],
    { group: 'admin:company-users', automatic: () => !target },
  );
  return (
    <section className="admin-company-users" aria-label="Usuários da empresa">
      <h3>Usuários da empresa</h3>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!rows && !error && <p role="status">Carregando usuários...</p>}
      {rows && <CompanyUsersView rows={rows} onReset={setTarget} />}
      {target && (
        <ResetCompanyUser
          key={target.user_id}
          row={target}
          companyId={companyId}
          userId={userId}
          onRecheck={onRecheck}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            void refresh();
            onNotice(
              'Senha temporária redefinida. O usuário deverá definir uma nova senha pessoal ao entrar.',
            );
          }}
        />
      )}
    </section>
  );
}

export function CompanyUsersView({
  rows,
  onReset,
}: {
  rows: AdminCompanyUser[];
  onReset: (row: AdminCompanyUser) => void;
}) {
  const pages = usePagination();
  const managers = rows.filter((row) => row.role === 'manager');
  const employees = rows.filter((row) => row.role !== 'manager');
  const displayed = paginatedRows([...rows].sort((a,b) => a.display_name.localeCompare(b.display_name, 'pt-BR')), pages.page, pages.size);
  const groups = [
    { title: 'Gestores', rows: displayed.filter((row) => row.role === 'manager'), total: managers.length, empty: 'Nenhum gestor cadastrado nesta empresa.' },
    {
      title: 'Funcionários',
      rows: displayed.filter((row) => row.role !== 'manager'),
      total: employees.length,
      empty: 'Nenhum funcionário cadastrado nesta empresa.',
    },
  ];
  return (
    <>
      <div className="company-user-counts" role="group" aria-label="Resumo dos usuários">
        <Kpi
          label="Contas cadastradas"
          value={rows.length}
          foot="Gestores e funcionários"
          icon={<Users size={18} />}
        />
        <Kpi
          label="Gestores"
          value={managers.length}
          foot={managers.filter((row) => row.active).length + ' com acesso ativo'}
          icon={<ShieldCheck size={18} />}
        />
        <Kpi
          label="Funcionários"
          value={employees.length}
          foot={employees.filter((row) => row.active).length + ' com acesso ativo'}
          icon={<UserRound size={18} />}
        />
        <Kpi
          label="Contas desativadas"
          value={rows.filter((row) => !row.active).length}
          foot="Incluídas nas contas cadastradas"
          icon={<UserRoundX size={18} />}
        />
      </div>
      <div className="company-user-table">
        <table aria-label="Contas da empresa por tipo de acesso">
          <colgroup>
            <col className="company-user-identity" />
            <col className="company-user-status" />
            <col className="company-user-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Usuário / e-mail de login</th>
              <th scope="col">Situação</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.title} aria-label={group.title}>
              <tr className="company-user-group">
                <th scope="rowgroup" colSpan={3}>
                  {group.title} <span>({group.total})</span>
                </th>
              </tr>
              {[...group.rows]
                .sort((a, b) => a.display_name.localeCompare(b.display_name, 'pt-BR'))
                .map((row) => (
                  <tr key={row.id} className="company-user-row">
                    <td data-label="Usuário / e-mail de login">
                      <strong>{row.display_name}</strong>
                      <small>{row.email || 'E-mail não informado'}</small>
                    </td>
                    <td data-label="Situação">
                      <span className={'badge ' + (row.active ? 'good' : 'gray')}>
                        {row.active ? 'Ativo' : 'Desativado'}
                      </span>
                      {row.password_change_required && <small>Troca de senha pendente</small>}
                    </td>
                    <td data-label="Ações">
                      <Button
                        variant="outline"
                        disabled={!row.can_reset}
                        aria-label={'Redefinir senha de ' + row.display_name}
                        onClick={() => onReset(row)}
                        size="icon"
                      >
                        <KeyRound size={16} aria-hidden="true" />
                      </Button>
                      {!row.can_reset && (
                        <small>Conta protegida ou vinculada a mais de uma empresa.</small>
                      )}
                    </td>
                  </tr>
                ))}
              {group.total === 0 && (
                <tr className="company-users-empty">
                  <td colSpan={3}>{group.empty}</td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>
      <Pagination page={pages.page} size={pages.size} total={rows.length} onChange={pages.setPage} onSizeChange={pages.setSize} label="usuários" />
    </>
  );
}

function ResetCompanyUser({
  row,
  companyId,
  userId,
  onRecheck,
  onClose,
  onSaved,
}: {
  row: AdminCompanyUser;
  companyId: string;
  userId: string;
  onRecheck: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [operationId] = useState(uid);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uncertain || !confirmation) return;
    setBusy(true);
    setError('');
    try {
      await resetAdminCompanyPassword(
        getSupabaseClient(),
        userId,
        { company_id: companyId, user_id: row.user_id, password },
        operationId,
      );
      setPassword('');
      onSaved();
    } catch (err) {
      if (
        err instanceof AccessChangedError ||
        (err instanceof AdminCommandError && err.recovery === 'access')
      )
        onRecheck();
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar a redefinição.');
      if (err instanceof AdminCommandError && ['retry', 'review'].includes(err.recovery)) {
        setUncertain(true);
        setPassword('');
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Redefinir senha temporária"
      description={row.display_name + ' · ' + row.email}
      onOpenChange={(open) => !open && !busy && onClose()}
    >
      <form onSubmit={(event) => void submit(event)}>
        <p>
          A senha atual será substituída. O usuário precisará definir uma senha pessoal no próximo
          acesso. A operação fica registrada sem incluir a senha.
        </p>
        <label className="form-row">
          Nova senha temporária
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            disabled={busy || uncertain}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="operational-check">
          <input
            type="checkbox"
            checked={confirmation}
            disabled={busy || uncertain}
            onChange={(e) => setConfirmation(e.target.checked)}
          />
          Confirmo a redefinição da senha desta conta.
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <ModalFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || uncertain || !confirmation}>
            {busy ? 'Redefinindo...' : 'Confirmar redefinição'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
