import { PermissionTree } from '../permissions/PermissionTree';
import { legacyPermissions, type EmployeePermissions } from '../permissions/model';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Plus, Pencil, UserRound, ShieldCheck } from 'lucide-react';
import { useCrm } from '../../app/context';
import type { Member } from '../../domain/types';
import { initials, uid } from '../../lib/format';
import { Heading, SearchInput, FormActions, FormError } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
const initial = { name: '', email: '', role: 'seller' as Member['role'], active: true };
export function Team() {
  const { data, session, update, notice } = useCrm();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Member | null | undefined>();
  const [form, setForm] = useState(initial);
  const [permissions, setPermissions] = useState<EmployeePermissions>({
    keys: [],
    scope: 'own',
    version: 0,
  });
  const [error, setError] = useState('');
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const members = data.members.filter(
    (m) =>
      m.companyId === session.companyId &&
      m.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  function open(m: Member | null) {
    setEditing(m);
    setForm(m ? { ...m } : initial);
    setPermissions(
      m?.permissions || (m ? legacyPermissions(m.role) : { keys: [], scope: 'own', version: 0 }),
    );
    setError('');
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome.');
      return;
    }
    if (
      data.members.some(
        (m) =>
          m.companyId === session.companyId &&
          m.id !== editing?.id &&
          m.email.toLowerCase() === form.email.trim().toLowerCase(),
      )
    ) {
      setError('Este e-mail já pertence à equipe.');
      return;
    }
    if (
      form.role === 'manager' &&
      form.active &&
      data.members.some(
        (m) =>
          m.companyId === session.companyId &&
          m.id !== editing?.id &&
          m.role === 'manager' &&
          m.active,
      )
    ) {
      setError('A empresa já possui um gestor ativo.');
      return;
    }
    if (editing?.id === session.memberId && (!form.active || form.role !== 'manager')) {
      setError('A substituição do gestor será realizada por Caio.');
      return;
    }
    const member: Member = {
      ...form,
      permissions,
      name: form.name.trim(),
      email: form.email.trim(),
      id: editing?.id || uid(),
      companyId: session.companyId,
    };
    if (
      update((d) => ({
        ...d,
        members: editing
          ? d.members.map((m) => (m.id === editing.id ? member : m))
          : [...d.members, member],
      }))
    ) {
      setEditing(undefined);
      notice('Cadastro fictício salvo. Nenhum acesso real foi criado.');
    }
  }
  return (
    <>
      <Heading
        eyebrow="GESTÃO DA EMPRESA"
        title="Equipe"
        description="Cadastre funcionários e explore as permissões por funcionalidade."
      >
        <Button onClick={() => open(null)}>
          <Plus size={16} />
          Novo integrante
        </Button>
      </Heading>
      <div className="card">
        <div className="toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar pessoa da equipe" />
          <span className="muted result-count">
            <UserRound size={15} />
            {members.filter((m) => m.active).length} ativos
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Integrante</th>
                <th>Acesso</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar">{initials(m.name)}</span>
                      <div>
                        <strong>{m.name}</strong>
                        <small>{m.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    {m.role === 'manager'
                      ? 'Gestor'
                      : m.permissions?.keys.includes('team.manage')
                        ? 'Administrador da empresa'
                        : 'Permissões individuais'}
                  </td>
                  <td>
                    <span className={'badge ' + (m.active ? 'good' : 'gray')}>
                      {m.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => open(m)}
                        aria-label={'Editar ' + m.name}
                      >
                        <Pencil size={14} />
                        Editar
                      </Button>
                      {m.role !== 'manager' && (
                        <Button variant="outline" size="sm" onClick={() => setResetMember(m)}>
                          <ShieldCheck size={14} />
                          Redefinir senha
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="small-note">
        A desativação preserva os contatos e a autoria dos cadastros. Na demo, as alterações ficam
        apenas neste navegador.
      </p>
      <Modal
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
        title={editing ? 'Editar integrante' : 'Novo integrante'}
        description="Este cadastro organiza a prévia e não cria uma conta de acesso."
      >
        <form onSubmit={save}>
          <div className="form-grid">
            <label className="form-row span2">
              Nome
              <Input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="form-row span2">
              E-mail
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>

            <label className="form-row">
              Situação
              <select
                disabled={editing?.id === session.memberId}
                value={String(form.active)}
                onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
          </div>
          <PermissionTree
            value={permissions}
            onChange={setPermissions}
            disabled={editing?.role === 'manager'}
          />
          <p className="small-note">
            Esta tela demonstra a configuração de acessos. A demo mantém todas as funcionalidades
            disponíveis para exploração.
          </p>
          <FormError message={error} />
          <FormActions onCancel={() => setEditing(undefined)} />
        </form>
      </Modal>
      <Modal
        open={!!resetMember}
        onOpenChange={(v) => !v && setResetMember(null)}
        title="Redefinir senha"
        description="Fluxo previsto para a versão com autenticação."
      >
        <div className="info-box">
          O gestor poderá redefinir a senha de <strong>{resetMember?.name}</strong> sem solicitar a
          senha antiga. Nesta prévia não existem senhas nem contas reais.
        </div>
        <Button variant="outline" onClick={() => setResetMember(null)}>
          Entendi
        </Button>
      </Modal>
    </>
  );
}
