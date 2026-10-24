import { describe, expect, it, vi } from 'vitest';
import { fakeSupabase, fixtureUserId } from '../../test/supabase';
import { AccessChangedError } from '../auth/access';
import {
  AdminCommandError,
  companyInput,
  managerInput,
  createAdminCompany,
  createAdminManager,
  loadAdminPortfolio,
  mapPortfolio,
  readAllPages,
} from './repository';

const form = {
  name: ' Empresa de exemplo ',
  segment: ' Teste ',
  template: 'generic' as const,
  theme: 'blue' as const,
  amount: '249.90',
  dueDate: '2026-11-30',
};
const operationId = '00000000-0000-4000-8000-000000000090';

describe('Painel administrativo conectado', () => {
  it('valida valor em centavos, data real e identificação da empresa', () => {
    expect(companyInput(form)).toMatchObject({
      name: 'Empresa de exemplo',
      segment: 'Teste',
      monthly_amount_cents: 24990,
      due_date: '2026-11-30',
    });
    for (const amount of ['', '-1', '1.001', '21474836.48', 'NaN'])
      expect(() => companyInput({ ...form, amount })).toThrow();
    expect(() => companyInput({ ...form, dueDate: '2026-02-30' })).toThrow();
    expect(() => companyInput({ ...form, name: ' ' })).toThrow();
  });
  it('cria somente gestor, normaliza e-mail e valida a senha temporária', () => {
    expect(
      managerInput(
        'company-local',
        ' Pessoa ',
        ' PESSOA@EXAMPLE.INVALID ',
        'SenhaTemporariaLocal!',
      ),
    ).toMatchObject({ role: 'manager', display_name: 'Pessoa', email: 'pessoa@example.invalid' });
    expect(() =>
      managerInput('company-local', 'Pessoa', 'sem-email', 'SenhaTemporariaLocal!'),
    ).toThrow();
    expect(() =>
      managerInput('company-local', 'Pessoa', 'pessoa@example.invalid', 'curta'),
    ).toThrow();
    expect(() =>
      managerInput('company-local', 'Pessoa', 'pessoa@example.invalid', 'á'.repeat(40)),
    ).toThrow();
  });
  it('não consulta a carteira nem chama funções com documentos ausentes', async () => {
    const fake = fakeSupabase();
    fake.state.tables.crm_legal_requirements = [];
    await expect(loadAdminPortfolio(fake.client, fixtureUserId)).rejects.toBeInstanceOf(
      AccessChangedError,
    );
    await expect(
      createAdminCompany(fake.client, fixtureUserId, companyInput(form), operationId),
    ).rejects.toBeInstanceOf(AccessChangedError);
    expect(fake.from.mock.calls.some(([table]) => table === 'crm_companies')).toBe(false);
    expect(fake.invoke).not.toHaveBeenCalled();
  });
  it('revalida o papel antes de cada cadastro e recusa papel revogado', async () => {
    const fake = fakeSupabase();
    fake.state.admin = false;
    await expect(
      createAdminManager(
        fake.client,
        fixtureUserId,
        managerInput('company-local', 'Pessoa', 'pessoa@example.invalid', 'SenhaTemporariaLocal!'),
        operationId,
      ),
    ).rejects.toBeInstanceOf(AccessChangedError);
    expect(fake.invoke).not.toHaveBeenCalled();
  });
  it('consulta dados reais sem preencher estados vazios com dados da demo', async () => {
    const fake = fakeSupabase();
    expect(await loadAdminPortfolio(fake.client, fixtureUserId)).toEqual([]);
    expect(fake.from).toHaveBeenCalledWith('crm_companies');
    expect(fake.from).toHaveBeenCalledWith('crm_company_billing');
    expect(fake.from).toHaveBeenCalledWith('crm_memberships');
  });
  it('pagina todas as linhas sem truncar os indicadores no limite da API', async () => {
    const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));
    expect(await readAllPages(query)).toHaveLength(1001);
    expect(query).toHaveBeenCalledTimes(3);
    await expect(
      readAllPages(async () => ({ data: null, error: Error('Falha de página') })),
    ).rejects.toThrow('Falha de página');
  });
  it('preserva os valores, o gestor e a data local; cobrança ausente não vira zero', () => {
    const companies = [
      {
        id: 'company-local',
        name: 'Empresa local',
        display_name: null,
        segment: 'Teste',
        template: 'generic' as const,
        theme: 'blue' as const,
        enabled: false,
        created_at: '2026-10-24T02:30:00Z',
      },
    ];
    const billing = [
      { company_id: 'company-local', monthly_amount_cents: 24990, due_date: '2026-11-30' },
    ];
    const managers = [
      {
        id: 'membership-local',
        company_id: 'company-local',
        user_id: 'user-local',
        crm_profiles: { display_name: 'Gestor local' },
      },
    ];
    expect(mapPortfolio(companies, billing, managers)[0]).toMatchObject({
      monthlyAmount: 24990,
      dueDate: '2026-11-30',
      createdAt: '2026-10-23',
      enabled: false,
      managers: [{ id: 'membership-local', userId: 'user-local', name: 'Gestor local' }],
    });
    expect(() => mapPortfolio(companies, [], managers)).toThrow();
  });
  it('envia JWT da sessão e chave de idempotência ao endpoint específico', async () => {
    const fake = fakeSupabase(),
      input = companyInput(form);
    await expect(
      createAdminCompany(fake.client, fixtureUserId, input, operationId),
    ).resolves.toEqual({ company_id: 'company-local', enabled: false });
    expect(fake.invoke).toHaveBeenCalledWith('crm-create-company', {
      body: input,
      headers: { Authorization: 'Bearer local-test-token', 'Idempotency-Key': operationId },
    });
    const manager = managerInput(
      'company-local',
      'Pessoa',
      'pessoa@example.invalid',
      'SenhaTemporariaLocal!',
    );
    fake.invoke.mockResolvedValue({
      data: { data: { user_id: 'user-local', membership_id: 'membership-local' } },
      error: null,
    });
    await expect(
      createAdminManager(fake.client, fixtureUserId, manager, operationId),
    ).resolves.toEqual({ user_id: 'user-local', membership_id: 'membership-local' });
    expect(fake.invoke).toHaveBeenLastCalledWith(
      'crm-create-user',
      expect.objectContaining({ body: expect.objectContaining({ role: 'manager' }) }),
    );
  });
  it('mantém a mesma solicitação na falha de transporte e não mostra o corpo sensível', async () => {
    const fake = fakeSupabase();
    fake.invoke.mockRejectedValueOnce(Error('Falha de transporte'));
    await expect(
      createAdminCompany(fake.client, fixtureUserId, companyInput(form), operationId),
    ).rejects.toMatchObject({ recovery: 'retry' });
    await createAdminCompany(fake.client, fixtureUserId, companyInput(form), operationId);
    expect(
      fake.invoke.mock.calls.map(
        ([, options]) =>
          (options as { headers: Record<string, string> }).headers['Idempotency-Key'],
      ),
    ).toEqual([operationId, operationId]);
  });
  it('retorna ao controle de acesso quando a função rejeita sessão ou aceite', async () => {
    const fake = fakeSupabase();
    for (const [code, status] of [
      ['UNAUTHENTICATED', 401],
      ['LEGAL_REQUIRED', 403],
      ['FORBIDDEN', 403],
    ] as const) {
      fake.invoke.mockResolvedValue({
        data: null,
        error: { context: new Response(JSON.stringify({ error: { code } }), { status }) },
      });
      await expect(
        createAdminCompany(fake.client, fixtureUserId, companyInput(form), operationId),
      ).rejects.toMatchObject({ recovery: 'access' });
    }
  });
  it('não apresenta sucesso para resposta incompleta e exige revisão para resultado ambíguo de usuário', async () => {
    const fake = fakeSupabase();
    fake.invoke.mockResolvedValue({ data: { data: {} }, error: null });
    await expect(
      createAdminCompany(fake.client, fixtureUserId, companyInput(form), operationId),
    ).rejects.toMatchObject({ recovery: 'retry' });
    fake.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ error: { code: 'PROVISIONING_REVIEW_REQUIRED' } }), {
          status: 503,
        }),
      },
    });
    await expect(
      createAdminManager(
        fake.client,
        fixtureUserId,
        managerInput('company-local', 'Pessoa', 'pessoa@example.invalid', 'SenhaTemporariaLocal!'),
        operationId,
      ),
    ).rejects.toBeInstanceOf(AdminCommandError);
    await expect(
      createAdminManager(
        fake.client,
        fixtureUserId,
        managerInput('company-local', 'Pessoa', 'pessoa@example.invalid', 'SenhaTemporariaLocal!'),
        operationId,
      ),
    ).rejects.toMatchObject({ recovery: 'review' });
  });
});
