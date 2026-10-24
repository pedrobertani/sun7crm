import { describe, expect, it } from 'vitest';
import { AccessChangedError, loadAccountAccess, requireReadyAdmin } from './access';
import { fakeSupabase, fixtureUserId } from '../../test/supabase';

describe('Acesso às páginas oficiais', () => {
  it('não consulta perfil ou dados com sessão ausente ou anônima', async () => {
    for (const anonymous of [false, true]) {
      const fake = fakeSupabase();
      if (anonymous) fake.state.user!.is_anonymous = true;
      else fake.state.user = null;
      expect(await loadAccountAccess(fake.client)).toEqual({ stage: 'signed-out' });
      expect(fake.rpc).not.toHaveBeenCalled();
      expect(fake.from).not.toHaveBeenCalled();
    }
  });
  it('exige troca de senha antes de consultar documentos ou decidir o papel', async () => {
    const fake = fakeSupabase();
    fake.state.passwordRequired = true;
    expect((await loadAccountAccess(fake.client)).stage).toBe('password');
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.rpc).toHaveBeenCalledTimes(1);
  });
  it('bloqueia o painel quando não existem documentos oficiais, inclusive para ADM', async () => {
    const fake = fakeSupabase();
    fake.state.tables.crm_legal_requirements = [];
    fake.state.tables.crm_legal_documents = [];
    expect((await loadAccountAccess(fake.client)).stage).toBe('legal-unavailable');
    expect(fake.rpc).not.toHaveBeenCalledWith('crm_is_platform_admin');
    expect(fake.from.mock.calls.every(([table]) => table.startsWith('crm_legal_'))).toBe(true);
  });
  it('exige a confirmação individual da versão vigente', async () => {
    const fake = fakeSupabase();
    fake.state.tables.crm_legal_acceptances = [
      { kind: 'terms', version: 'anterior' },
      { kind: 'privacy', version: 'local-fixture' },
    ];
    const access = await loadAccountAccess(fake.client);
    expect(access.stage).toBe('accept');
    if (access.stage === 'accept')
      expect(access.pending).toEqual([{ kind: 'terms', version: 'local-fixture' }]);
    expect(fake.rpc).not.toHaveBeenCalledWith('crm_is_platform_admin');
  });
  it('usa a condição administrativa do banco e ignora metadados editáveis', async () => {
    const fake = fakeSupabase();
    fake.state.admin = false;
    fake.state.user!.user_metadata = { role: 'admin', isAdmin: true };
    const access = await loadAccountAccess(fake.client);
    expect(access.stage).toBe('ready');
    if (access.stage === 'ready') expect(access.isAdmin).toBe(false);
    await expect(requireReadyAdmin(fake.client, fixtureUserId)).rejects.toBeInstanceOf(
      AccessChangedError,
    );
  });
  it('libera somente a própria conta administrativa verificada', async () => {
    const fake = fakeSupabase();
    await expect(requireReadyAdmin(fake.client, fixtureUserId)).resolves.toBeUndefined();
    await expect(requireReadyAdmin(fake.client, 'outra-pessoa')).rejects.toBeInstanceOf(
      AccessChangedError,
    );
    fake.state.admin = false;
    await expect(requireReadyAdmin(fake.client, fixtureUserId)).rejects.toBeInstanceOf(
      AccessChangedError,
    );
  });
  it('falha fechado se a consulta do papel ou dos documentos falhar', async () => {
    const fake = fakeSupabase();
    fake.state.adminError = Error('Consulta negada');
    await expect(loadAccountAccess(fake.client)).rejects.toThrow('Consulta negada');
    fake.state.adminError = null;
    fake.state.tableError = Error('Consulta indisponível');
    await expect(loadAccountAccess(fake.client)).rejects.toThrow('Consulta indisponível');
  });
});
