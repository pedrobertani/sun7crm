import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { importRealContacts, loadTransferContacts } from './real-transfer';
function client(
  pages: { data: { name: string; phone: string }[] | null; error: unknown }[],
  result = { data: 1, error: null as unknown },
) {
  const range = vi.fn().mockImplementation(async () => pages.shift());
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const api = { from: vi.fn().mockReturnValue(query), rpc: vi.fn().mockResolvedValue(result) };
  return { api, query, typed: api as unknown as SupabaseClient };
}
describe('Transferência autenticada', () => {
  it('exporta todas as páginas e aplica empresa e RLS, não somente a página da tela', async () => {
    const c = client([
      {
        data: Array.from({ length: 500 }, () => ({ name: 'Teste', phone: '14996732848' })),
        error: null,
      },
      { data: [{ name: 'Último', phone: '11988887777' }], error: null },
    ]);
    expect(await loadTransferContacts(c.typed, 'empresa')).toHaveLength(501);
    expect(c.query.eq).toHaveBeenCalledWith('company_id', 'empresa');
    expect(c.query.range.mock.calls).toEqual([
      [0, 499],
      [500, 999],
    ]);
  });
  it('não retorna arquivo incompleto se uma página falhar', async () => {
    const c = client([{ data: null, error: Error('sensitive backend message') }]);
    await expect(loadTransferContacts(c.typed, 'empresa')).rejects.toThrow(
      'Não foi possível consultar',
    );
  });
  it('envia apenas válidos não duplicados para RPC sem upsert nem update', async () => {
    const c = client([{ data: [{ name: 'Original', phone: '+55 (14) 99673-2848' }], error: null }]);
    expect(
      await importRealContacts(c.typed, 'empresa', 'membro', [
        { name: 'Não substituir', phone: '14996732848' },
        { name: 'Novo', phone: '11988887777' },
        { name: 'Repetido', phone: '5511988887777' },
      ]),
    ).toBe(1);
    expect(c.api.rpc).toHaveBeenCalledWith('crm_import_contacts', {
      p_company_id: 'empresa',
      p_owner_membership_id: 'membro',
      p_contacts: [{ name: 'Novo', phone: '11988887777' }],
    });
  });
  it('aceita zero inseridos por duplicação adicional no banco sem prometer sucesso falso', async () => {
    const c = client([{ data: [], error: null }], { data: 0, error: null });
    expect(
      await importRealContacts(c.typed, 'empresa', 'membro', [
        { name: 'Teste', phone: '14996732848' },
      ]),
    ).toBe(0);
  });
  it('trata falha e não expõe a mensagem bruta do banco', async () => {
    const c = client([{ data: [], error: null }], { data: 0, error: Error('private SQL') });
    await expect(
      importRealContacts(c.typed, 'empresa', 'membro', [{ name: 'Teste', phone: '14996732848' }]),
    ).rejects.toThrow('Não foi possível confirmar');
    expect(c.api.rpc).toHaveBeenCalledTimes(1);
  });
});
