import { recordRealWhatsapp } from './real-history';
import { useState } from 'react';
import type { ContactHistoryEvent } from '../../domain/types';
import { getSupabaseClient } from '../../lib/supabase';
import { ContactHistoryDialog } from './ContactHistory';
import { useLiveQuery } from '../../hooks/useLiveQuery';
export function RealContactHistory({
  contact,
  companyId,
  canAdd,
  canWhatsapp = true,
  onClose,
  cardId,
}: {
  contact: { id: string; name: string; phone: string };
  companyId: string;
  canAdd: boolean;
  canWhatsapp?: boolean;
  onClose: () => void;
  cardId?: string;
}) {
  const [page, setPage] = useState(0),
    [revision, setRefresh] = useState(0);
  const [actionError, setError] = useState('');
  const {
    data,
    loading,
    error: queryError,
  } = useLiveQuery(
    async () => {
      const limit = (page + 1) * 50;
      const rows: ContactHistoryEvent[] = [];
      for (let offset = 0; offset <= limit; offset += 500) {
        let query = getSupabaseClient()
          .from('crm_contact_history')
          .select(
            'id,company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body,occurred_at',
          )
          .eq('company_id', companyId)
          .eq('contact_id', contact.id);
        if (cardId) query = query.eq('opportunity_id', cardId);
        const result = await query
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, Math.min(offset + 499, limit));
        if (result.error)
          throw Error(
            'Não foi possível consultar o histórico. Tentaremos novamente automaticamente.',
          );
        rows.push(
          ...(result.data || []).map((e) => ({
            id: e.id,
            companyId: e.company_id,
            contactId: e.contact_id,
            opportunityId: e.opportunity_id || undefined,
            actorId: e.actor_user_id || undefined,
            actorName: e.actor_name,
            kind: e.kind,
            title: e.title,
            body: e.body,
            occurredAt: e.occurred_at,
          })),
        );
        if ((result.data || []).length < Math.min(500, limit - offset + 1)) break;
      }
      return { items: rows.slice(0, limit), hasMore: rows.length > limit };
    },
    [companyId, contact.id, cardId, page, revision],
    { group: `workspace:${companyId}:/app/contatos` },
  );
  const items = data?.items || [];
  const hasMore = data?.hasMore || false;
  const error = queryError || actionError;
  return (
    <ContactHistoryDialog
      contact={contact}
      scope={cardId ? 'card' : 'contact'}
      onClose={onClose}
      items={items}
      loading={loading}
      error={error}
      hasMore={hasMore}
      onMore={() => setPage((p) => p + 1)}
      onWhatsApp={() => {
        void recordRealWhatsapp(getSupabaseClient(), companyId, contact.id, cardId)
          .then(() => {
            setPage(0);
            setRefresh((n) => n + 1);
          })
          .catch((e) => setError(e.message));
      }}
      canAdd={canAdd}
      canWhatsapp={canWhatsapp}
      onAdd={async (body) => {
        if (!body.trim() || body.trim().length > 2000)
          throw Error('Escreva uma anotação de até 2.000 caracteres.');
        const r = await getSupabaseClient()
          .from('crm_contact_history')
          .insert({
            company_id: companyId,
            contact_id: contact.id,
            opportunity_id: cardId || null,
            kind: 'note',
            title: 'Anotação de atendimento',
            body: body.trim(),
          });
        if (r.error)
          throw Error(
            'Não foi possível confirmar a anotação. Confira o histórico antes de tentar novamente.',
          );
        setPage(0);
        setRefresh((n) => n + 1);
      }}
    />
  );
}
