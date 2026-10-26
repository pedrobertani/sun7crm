import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { getSupabaseClient } from '../../lib/supabase';
import { uid } from '../../lib/format';
import { AccessChangedError } from '../auth/access';
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
  const [rows, setRows] = useState<AdminCompanyUser[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<AdminCompanyUser | null>(null);
  useEffect(() => {
    let active = true;
    setRows(null);
    setError('');
    void loadAdminCompanyUsers(getSupabaseClient(), userId, companyId)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof AccessChangedError) onRecheck();
        setError('Não foi possível carregar os usuários desta empresa.');
      });
    return () => {
      active = false;
    };
  }, [companyId, userId, revision, onRecheck]);
  return (
    <section className="admin-company-users" aria-label="Usuários da empresa">
      <h3>Usuários da empresa</h3>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!rows && !error && <p role="status">Carregando usuários...</p>}
      {rows && (
        <>
          <p className="muted">
            {rows.length} contas cadastradas · {rows.filter((r) => r.role === 'manager').length}{' '}
            gestores · {rows.filter((r) => r.role !== 'manager' && r.active).length} funcionários
            ativos · {rows.filter((r) => !r.active).length} contas desativadas
          </p>
          {rows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuário / e-mail de login</th>
                    <th>Acesso</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.display_name}</strong>
                        <small>{row.email || 'E-mail não informado'}</small>
                      </td>
                      <td>{row.role === 'manager' ? 'Gestor' : 'Funcionário'}</td>
                      <td>
                        <span className={'badge ' + (row.active ? 'good' : 'gray')}>
                          {row.active ? 'Ativo' : 'Desativado'}
                        </span>
                        {row.password_change_required && <small>Troca de senha pendente</small>}
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          disabled={!row.can_reset}
                          onClick={() => setTarget(row)}
                        >
                          Redefinir senha
                        </Button>
                        {!row.can_reset && (
                          <small>Conta protegida ou vinculada a mais de uma empresa.</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nenhum usuário cadastrado nesta empresa.</p>
          )}
        </>
      )}
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
            setRevision((v) => v + 1);
            onNotice(
              'Senha temporária redefinida. O usuário deverá definir uma nova senha pessoal ao entrar.',
            );
          }}
        />
      )}
    </section>
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
        <div className="form-actions">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || uncertain || !confirmation}>
            {busy ? 'Redefinindo...' : 'Confirmar redefinição'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
