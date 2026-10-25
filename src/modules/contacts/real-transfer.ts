import type { SupabaseClient } from '@supabase/supabase-js';
import { previewContacts, type TransferContact } from '../../domain/contact-transfer';
import { MAX_IMPORT_ROWS } from './excel';
/** Fetch every permitted row; never silently export only the first PostgREST page. */
export async function loadTransferContacts(
  client: SupabaseClient,
  companyId: string,
  selected?: string,
): Promise<TransferContact[]> {
  const rows: TransferContact[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client
      .from('crm_contacts')
      .select('id,name,phone')
      .eq('company_id', companyId)
      .order('id');
    if (selected) query = query.eq('id', selected);
    const result = await query.range(offset, offset + 499);
    if (result.error)
      throw Error('Não foi possível consultar os contatos permitidos. Tente novamente.');
    rows.push(...(result.data || []));
    if ((result.data || []).length < 500) return rows;
    if (rows.length >= 100000)
      throw Error('Há muitos contatos para um único Excel. Solicite uma exportação assistida.');
  }
}
export async function importRealContacts(
  client: SupabaseClient,
  companyId: string,
  membershipId: string,
  contacts: TransferContact[],
) {
  if (!contacts.length || contacts.length > MAX_IMPORT_ROWS)
    throw Error('Importe de 1 a 1.000 contatos por vez.');
  const checked = previewContacts(
    contacts.map((c, i) => ({ ...c, line: i + 2 })),
    await loadTransferContacts(client, companyId),
  );
  const candidates = checked.filter((c) => c.status === 'valid');
  if (!candidates.length) throw Error('Todos os contatos já existem ou precisam de correção.');
  // One atomic INSERT: no upsert, no UPDATE, with the caller session and RLS.
  const result = await client.rpc('crm_import_contacts', {
    p_company_id: companyId,
    p_owner_membership_id: membershipId,
    p_contacts: candidates.map((c) => ({ name: c.name, phone: c.phone })),
  });
  if (result.error)
    throw Error(
      'Não foi possível confirmar a importação. Atualize a lista antes de tentar novamente; nenhuma substituição foi solicitada.',
    );
  if (!Number.isInteger(result.data) || result.data < 0 || result.data > candidates.length)
    throw Error(
      'A confirmação da importação está indisponível. Atualize a lista antes de tentar novamente.',
    );
  return result.data as number;
}
