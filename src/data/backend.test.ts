import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { BackendError, OperationalBackend } from './backend';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
describe('Contrato do ambiente real', () => {
  it('o SDK codifica a tentativa de injeção como um único valor e preserva a empresa', async () => {
    let requested: URL | undefined;
    const client = createClient('https://fixture.supabase.co', 'sb_publishable_fixture', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input) => {
          requested = new URL(
            typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
          );
          return new Response('[]', {
            status: 200,
            headers: { 'content-type': 'application/json', 'content-range': '*/0' },
          });
        },
      },
    });
    const payload = "x'),or(company_id.neq.null),name.ilike.(*);--";
    await new OperationalBackend(client, id(100)).list('contacts', 0, 50, {}, payload);
    expect(requested!.pathname).toBe('/rest/v1/crm_contacts');
    expect(requested!.searchParams.get('company_id')).toBe('eq.' + id(100));
    expect(requested!.searchParams.get('name')).toBe(
      'ilike.%' + payload.replace(/[\\%_]/g, '\\$&') + '%',
    );
    expect(requested!.searchParams.has('or')).toBe(false);
    expect(requested!.searchParams.has('and')).toBe(false);
  });
  it('mantém o escopo da empresa na busca paginada e escapa curingas da busca', async () => {
    const calls: unknown[][] = [];
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        calls.push(['eq', ...args]);
        return query;
      },
      ilike: (...args: unknown[]) => {
        calls.push(['ilike', ...args]);
        return query;
      },
      order: () => query,
      range: async (...args: unknown[]) => {
        calls.push(['range', ...args]);
        return { data: [], count: 125, error: null };
      },
    };
    const api = new OperationalBackend({ from: () => query } as unknown as SupabaseClient, id(100));
    expect(await api.list('contacts', 1, 50, {}, 'A_100%')).toMatchObject({
      total: 125,
      page: 1,
      hasMore: true,
    });
    expect(calls).toContainEqual(['eq', 'company_id', id(100)]);
    expect(calls).toContainEqual(['ilike', 'name', '%A\\_100\\%%']);
    expect(calls).toContainEqual(['range', 50, 99]);
    await expect(api.list('contacts', 0, 50, { company_id: id(200) })).rejects.toMatchObject({
      code: 'INVALID_FILTER',
    });
    await expect(api.list('cards', 0, 50, { board_id: 'demo-leads' })).rejects.toMatchObject({
      code: 'INVALID_IDENTIFIER',
    });
  });
  it('exige e compara a versão ao editar a campanha, sem sobrescrever outra edição', async () => {
    const eq = vi.fn(() => query),
      update = vi.fn(() => query),
      query = {
        update,
        eq,
        select: () => query,
        single: async () => ({ data: null, error: { code: 'PGRST116' } }),
      },
      from = vi.fn(() => query);
    const api = new OperationalBackend({ from } as unknown as SupabaseClient, id(100));
    await expect(api.patch('campaigns', id(1), { name: 'Revisada' })).rejects.toMatchObject({
      code: 'VERSION_REQUIRED',
    });
    expect(from).not.toHaveBeenCalled();
    await expect(api.patch('campaigns', id(1), { name: 'Revisada' }, 7)).rejects.toMatchObject({
      kind: 'conflict',
      resultUncertain: false,
    });
    expect(eq).toHaveBeenCalledWith('row_version', 7);
    expect(eq).toHaveBeenCalledWith('company_id', id(100));
  });
  it('consulta contatos vinculados em lotes completos sem extrapolar o tamanho da URL', async () => {
    const seen: string[][] = [];
    const query = {
      select: () => query,
      eq: () => query,
      in: async (_column: string, ids: string[]) => {
        seen.push(ids);
        return { data: ids.map((id) => ({ id })), error: null };
      },
    };
    const api = new OperationalBackend({ from: () => query } as unknown as SupabaseClient, id(100));
    const ids = Array.from({ length: 205 }, (_, n) => id(n + 1));
    expect((await api.contactsByIds([...ids, ids[0]])).map((r) => r.id)).toEqual(ids);
    expect(seen.map((batch) => batch.length)).toEqual([100, 100, 5]);
  });
  it('consulta todos os cards filtrados em lotes de 200 sem limitar o resultado', async () => {
    const items = Array.from({ length: 305 }, (_, n) => ({ id: id(n + 1), stage_id: id(9) }));
    const ranges: number[][] = [], filters: unknown[][] = [];
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { filters.push(args); return query; },
      order: () => query,
      range: async (from: number, to: number) => {
        ranges.push([from, to]);
        return { data: items.slice(from, to + 1), count: items.length, error: null };
      },
    };
    const api = new OperationalBackend({ from: () => query } as unknown as SupabaseClient, id(100));
    const result = await api.listAllMatching('cards', { stage_id: id(9) });
    expect(result.total).toBe(305);
    expect(result.rows).toEqual(items);
    expect(ranges).toEqual([[0, 199], [200, 399]]);
    expect(filters).toContainEqual(['company_id', id(100)]);
    expect(filters).toContainEqual(['stage_id', id(9)]);
  });
  it('aplica empresa, funil, etapa, busca e intervalo de datas a todas as páginas', async () => {
    const calls: unknown[][] = [];
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { calls.push(['eq', ...args]); return query; },
      gte: (...args: unknown[]) => { calls.push(['gte', ...args]); return query; },
      lt: (...args: unknown[]) => { calls.push(['lt', ...args]); return query; },
      ilike: (...args: unknown[]) => { calls.push(['ilike', ...args]); return query; },
      order: () => query,
      range: async (from: number, to: number) => {
        calls.push(['range', from, to]);
        return { data: [{ id: id(from + 1) }], count: 201, error: null };
      },
    };
    const api = new OperationalBackend({ from: () => query } as unknown as SupabaseClient, id(100));
    const date = { from: '2026-01-01T00:00:00.000Z', until: '2026-02-01T00:00:00.000Z' };
    const result = await api.listAllMatching(
      'cards', { board_id: id(8), stage_id: id(9) }, 'Juliana', date,
    );
    expect(result.total).toBe(2);
    expect(calls.filter((entry) => entry[0] === 'range')).toEqual([
      ['range', 0, 199], ['range', 200, 399],
    ]);
    expect(calls.filter((entry) => entry[0] === 'eq' && entry[1] === 'company_id')).toHaveLength(2);
    expect(calls.filter((entry) => entry[0] === 'eq' && entry[1] === 'board_id')).toHaveLength(2);
    expect(calls.filter((entry) => entry[0] === 'eq' && entry[1] === 'stage_id')).toHaveLength(2);
    expect(calls.filter((entry) => entry[0] === 'ilike')).toEqual([
      ['ilike', 'title', '%Juliana%'], ['ilike', 'title', '%Juliana%'],
    ]);
    expect(calls.filter((entry) => entry[0] === 'gte')).toEqual([
      ['gte', 'created_at', date.from], ['gte', 'created_at', date.from],
    ]);
    expect(calls.filter((entry) => entry[0] === 'lt')).toEqual([
      ['lt', 'created_at', date.until], ['lt', 'created_at', date.until],
    ]);
  });
  it('busca histórico e etiquetas de todos os cards em lotes seguros', async () => {
    const batches: { table: string; ids: string[] }[] = [];
    let table = '';
    const query = {
      select: () => query,
      eq: () => query,
      in: async (_column: string, batch: string[]) => {
        batches.push({ table, ids: batch });
        return {
          data: batch.map((opportunity_id) => ({ opportunity_id, label_id: id(1) })),
          error: null,
        };
      },
    };
    const from = (name: string) => { table = name; return query; };
    const api = new OperationalBackend({ from } as unknown as SupabaseClient, id(100));
    const ids = Array.from({ length: 305 }, (_, n) => id(n + 1));
    expect((await api.activityByIds(ids)).length).toBe(305);
    expect((await api.labelsByCardIds(ids)).length).toBe(305);
    expect(batches.filter((entry) => entry.table === 'crm_card_activity').map((entry) => entry.ids.length)).toEqual([100, 100, 100, 5]);
    expect(batches.filter((entry) => entry.table === 'crm_card_labels').map((entry) => entry.ids.length)).toEqual([100, 100, 100, 5]);
  });
  it('envia a criação de integrante à função autorizada e não expõe o erro interno', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: { code: 'AUTH_CREATE_FAILED', message: 'detalhe interno' } }),
          { status: 409 },
        ),
      },
    });
    const api = new OperationalBackend(
      { functions: { invoke } } as unknown as SupabaseClient,
      id(100),
    );
    const input = {
      display_name: 'Teste',
      email: 'teste@example.invalid',
      password: 'Senha apenas da fixture',
      role: 'seller' as const,
    };
    await expect(
      api.createMember({ ...input, company_id: id(200) } as typeof input, id(5)),
    ).rejects.toMatchObject({
      kind: 'transport',
      resultUncertain: true,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe('crm-create-user');
    expect(invoke.mock.calls[0][1].body.company_id).toBe(id(100));
    expect(invoke.mock.calls[0][1].headers['Idempotency-Key']).toBe(id(5));
  });
  it('recusa identidades da demo antes de acessar o banco', () => {
    const rpc = vi.fn();
    expect(() => new OperationalBackend({ rpc } as unknown as SupabaseClient, 'aurora')).toThrow(
      BackendError,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it('não repete quitação automaticamente após falha de rede e distingue conflito conhecido', async () => {
    const rpc = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        data: null,
        error: { code: '40001', message: 'CRM_TOTALS_CHANGED' },
      });
    const backend = new OperationalBackend({ rpc } as unknown as SupabaseClient, id(100));
    await expect(backend.recordCampaignPayment(id(1), id(2), 10000, id(3))).rejects.toMatchObject({
      kind: 'transport',
      resultUncertain: true,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(backend.recordCampaignPayment(id(1), id(2), 10000, id(3))).rejects.toMatchObject({
      kind: 'conflict',
      code: 'CRM_TOTALS_CHANGED',
      resultUncertain: false,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('converte valores monetários textuais exatos e rejeita perda de precisão', async () => {
    let amount = '11254';
    const row = () => ({
      company_id: id(100),
      campaign_id: id(1),
      ambassador_id: id(2),
      indicated_count: 1,
      attended_count: 1,
      paid_count: 1,
      eligible_cents: 150050,
      points: 1,
      amount_cents: amount,
      paid_cents: 0,
      paid_points: 0,
      balance_cents: amount,
      remaining_points: 1,
      settled: false,
    });
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      range: async () => ({ data: [row()], error: null }),
    };
    const backend = new OperationalBackend(
      { from: () => query } as unknown as SupabaseClient,
      id(100),
    );
    expect((await backend.campaignTotals(id(1)))[0].amount_cents).toBe(11254);
    expect((await backend.campaignPayments(id(1)))[0].amount_cents).toBe(11254);
    amount = '9007199254740993';
    await expect(backend.campaignTotals(id(1))).rejects.toMatchObject({
      code: 'INVALID_SERVER_AMOUNT',
    });
    await expect(backend.campaignPayments(id(1))).rejects.toMatchObject({
      code: 'INVALID_SERVER_AMOUNT',
    });
  });
});
