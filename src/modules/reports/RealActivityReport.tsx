import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { ActivityReportView } from './ActivityReport';
import { RealContactHistory } from '../contacts/RealContactHistory';
import { recordRealWhatsapp } from '../contacts/real-history';
import type { ActivityRow, ActorActivity } from './activity';

export function RealActivityReport({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null),
    [actors, setActors] = useState<ActorActivity[]>([]),
    [error, setError] = useState(''),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<ActivityRow | null>(null);
  useEffect(() => {
    let active = true;
    setError('');
    async function load() {
      try {
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
        if (active) {
          setRows(contacts);
          setActors(members.sort((a, b) => b.total - a.total));
        }
      } catch {
        if (active) setError('Não foi possível carregar o relatório completo. Tente novamente.');
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [companyId, refresh]);
  return (
    <>
      {error ? (
        <div className="card history-empty">
          <p role="alert">{error}</p>
          <Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : rows ? (
        <ActivityReportView
          rows={rows}
          actors={actors}
          onHistory={setSelected}
          onWhatsapp={(r) => {
            void recordRealWhatsapp(getSupabaseClient(), companyId, r.contactId)
              .then(() => setRefresh((n) => n + 1))
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
          canAdd
          onClose={() => {
            setSelected(null);
            setRefresh((n) => n + 1);
          }}
        />
      )}
    </>
  );
}
