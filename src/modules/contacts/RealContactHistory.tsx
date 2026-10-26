import { recordRealWhatsapp } from './real-history';
import { useEffect, useState } from 'react';
import type { ContactHistoryEvent } from '../../domain/types';
import { getSupabaseClient } from '../../lib/supabase';
import { ContactHistoryDialog } from './ContactHistory';
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
  const [items, setItems] = useState<ContactHistoryEvent[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [page, setPage] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        let query = getSupabaseClient()
          .from('crm_contact_history')
          .select(
            'id,company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body,occurred_at',
          )
          .eq('company_id', companyId)
          .eq('contact_id', contact.id);
        if (cardId) query = query.eq('opportunity_id', cardId);
        const r = await query
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
          .range(page * 50, page * 50 + 49);
        if (r.error) throw r.error;
        const rows: ContactHistoryEvent[] = (r.data || []).map((e) => ({
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
        }));
        if (active) {
          setItems((previous) =>
            page === 0
              ? rows
              : [...previous, ...rows.filter((r) => !previous.some((p) => p.id === r.id))],
          );
          setHasMore(rows.length === 50);
        }
      } catch {
        if (active)
          setError('Não foi possível carregar o histórico. Feche e abra novamente para tentar.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [companyId, contact.id, cardId, page, refresh]);
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
