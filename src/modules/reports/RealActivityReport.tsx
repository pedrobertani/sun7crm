import { useQuery, useOperational } from '../workspace/operational';
import { useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { ActivityReportView } from './ActivityReport';
import { RealContactHistory } from '../contacts/RealContactHistory';
import { recordRealWhatsapp } from '../contacts/real-history';
import type { ActivityRow, ActorActivity } from './activity';

export function RealActivityReport({ companyId }: { companyId: string }) {
  const { can } = useOperational();
  const [selected, setSelected] = useState<ActivityRow | null>(null);
  const [actionError, setError] = useState('');
  const query = useQuery(async () => {
    const contacts: ActivityRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const r = await getSupabaseClient()
        .from('crm_contact_activity_report')
        .select('*')
        .eq('company_id', companyId)
        .order('contact_id')
        .range(offset, offset + 499);
      if (r.error) throw r.error;
      contacts.push(
        ...(r.data || []).map((e) => ({
          contactId: e.contact_id,
          name: e.name,
          phone: e.phone,
          ownerId: e.owner_membership_id,
          ownerName: e.owner_name,
          createdAt: e.created_at,
          lastActivityAt: e.last_activity_at,
          lastWhatsappAt: e.last_whatsapp_at,
          lastMovementAt: e.last_movement_at,
          whatsappCount: e.whatsapp_count,
          movementCount: e.movement_count,
          noteCount: e.note_count,
        })),
      );
      if ((r.data || []).length < 500) break;
      if (offset >= 49500) throw Error('Limite de relatório excedido');
    }
    const members: ActorActivity[] = [];
    for (let offset = 0; ; offset += 500) {
      const r = await getSupabaseClient()
        .from('crm_team_activity_report')
        .select('*')
        .eq('company_id', companyId)
        .order('actor_id')
        .range(offset, offset + 499);
      if (r.error) throw r.error;
      members.push(
        ...(r.data || []).map((e) => ({
          id: e.actor_id,
          name: e.actor_name,
          total: e.total,
          whatsappCount: e.whatsapp_count,
          movementCount: e.movement_count,
          noteCount: e.note_count,
          contactsCount: e.contacts_count,
          lastActivityAt: e.last_activity_at,
        })),
      );
      if ((r.data || []).length < 500) break;
      if (offset >= 49500) throw Error('Limite de relatório excedido');
    }
    return { rows: contacts, actors: members.sort((a, b) => b.total - a.total) };
  }, [companyId]);
  const rows = query.data?.rows;
  const actors = query.data?.actors || [];
  const error = query.error || actionError;
  return (
    <>
      {error ? (
        <div className="card history-empty">
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={() => query.retry()}>
            Tentar novamente
          </Button>
        </div>
      ) : rows ? (
        <ActivityReportView
          canWhatsapp={can('history.whatsapp')}
          rows={rows}
          actors={actors}
          onHistory={setSelected}
          onWhatsapp={(r) => {
            void recordRealWhatsapp(getSupabaseClient(), companyId, r.contactId)
              .then(() => query.retry())
              .catch((e) => setError(e.message));
          }}
        />
      ) : (
        <p role="status">Carregando relatório de atividades...</p>
      )}
      {selected && (
        <RealContactHistory
          key={companyId + selected.contactId}
          companyId={companyId}
          contact={{ id: selected.contactId, name: selected.name, phone: selected.phone }}
          canAdd={can('history.create')}
          canWhatsapp={can('history.whatsapp')}
          onClose={() => {
            setSelected(null);
            query.retry();
          }}
        />
      )}
    </>
  );
}
