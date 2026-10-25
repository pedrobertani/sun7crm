import type { SupabaseClient } from '@supabase/supabase-js';
export async function recordRealWhatsapp(
  client: SupabaseClient,
  companyId: string,
  contactId: string,
  cardId?: string,
) {
  const r = await client.from('crm_contact_history').insert({
    company_id: companyId,
    contact_id: contactId,
    opportunity_id: cardId || null,
    kind: 'whatsapp_opened',
    title: 'WhatsApp acionado',
    body: '',
  });
  if (r.error)
    throw Error(
      'O link do WhatsApp foi acionado, mas não foi possível registrar a atividade no histórico.',
    );
}
