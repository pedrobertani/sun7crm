import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { getSupabaseClient } from '../../lib/supabase';
import './notifications.css';

export interface Notification {
  id: string;
  company_id: string;
  kind:
    | 'subscription_due'
    | 'task_assigned'
    | 'task_due'
    | 'contact_assigned'
    | 'new_contact'
    | 'card_first_response'
    | 'card_idle'
    | 'card_escalation';
  entity_id: string;
  contact_id?: string | null;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  priority: number;
}
export function notificationTarget(
  notification: Pick<Notification, 'kind' | 'entity_id' | 'contact_id'>,
) {
  if (notification.kind === 'subscription_due') return '/app/plano';
  if (['card_first_response', 'card_idle', 'card_escalation'].includes(notification.kind)) {
    return notification.contact_id
      ? `/app/funil?card=${encodeURIComponent(notification.entity_id)}`
      : '/app/contatos';
  }
  const page =
    notification.kind === 'task_due' || notification.kind === 'task_assigned'
      ? 'tarefas'
      : 'contatos';
  return `/app/${page}?registro=${encodeURIComponent(notification.entity_id)}`;
}

export function NotificationBell({
  userId,
  companyId,
  onRecheck,
}: {
  userId: string;
  companyId?: string;
  onRecheck: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const alive = useRef(false),
    inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (alive.current) setLoading(true);
    try {
      const client = getSupabaseClient();
      let list = client
        .from('crm_notifications')
        .select('id,company_id,kind,entity_id,contact_id,title,body,created_at,read_at,priority')
        .eq('recipient_user_id', userId)
        .eq('active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
        .limit(50);
      let unread = client
        .from('crm_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_user_id', userId)
        .eq('active', true)
        .is('read_at', null);
      if (companyId) {
        list = list.eq('company_id', companyId);
        unread = unread.eq('company_id', companyId);
      }
      const [rows, total] = await Promise.all([list, unread]);
      const failure = rows.error || total.error;
      if (failure && ['42501', 'PGRST301', 'PGRST302'].includes(failure.code)) {
        onRecheck();
        return;
      }
      if (rows.error || total.error || total.count === null)
        throw rows.error || total.error || Error('Contagem indisponível');
      if (alive.current) {
        setItems(rows.data as Notification[]);
        setCount(total.count);
        setError('');
      }
    } catch {
      if (alive.current)
        setError('Não foi possível consultar os avisos. Tentaremos novamente automaticamente.');
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }, [userId, companyId, onRecheck]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const focusedRefresh = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(focusedRefresh, 60_000);
    window.addEventListener('focus', focusedRefresh);
    document.addEventListener('visibilitychange', focusedRefresh);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', focusedRefresh);
      document.removeEventListener('visibilitychange', focusedRefresh);
    };
  }, [refresh]);

  async function markRead(ids: string[]) {
    if (!ids.length || marking) return;
    setMarking(true);
    try {
      const result = await getSupabaseClient().rpc('crm_mark_notifications_read', { p_ids: ids });
      if (result.error) throw result.error;
      await refresh();
    } catch {
      if (alive.current) setError('Não foi possível salvar a leitura. Tente novamente.');
    } finally {
      if (alive.current) setMarking(false);
    }
  }
  const unreadShown = items.filter((item) => !item.read_at).map((item) => item.id);
  return (
    <>
      <button
        className="notification-bell"
        aria-label={
          error
            ? 'Notificações, atualização indisponível'
            : `Notificações${count ? `, ${count} não lidas` : ''}`
        }
        title="Notificações"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
      >
        <Bell size={21} />
        {error ? (
          <span className="notification-count">!</span>
        ) : (
          !!count && <span className="notification-count">{count > 99 ? '99+' : count}</span>
        )}
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Notificações"
        description="Avisos do seu acesso, contatos e tarefas."
      >
        <div className="notification-toolbar">
          <p className="small-note" role="status" aria-live="polite">
            {loading ? 'Consultando avisos…' : 'Atualização automática a cada minuto.'}
          </p>
          {!!unreadShown.length && (
            <Button
              size="sm"
              variant="ghost"
              disabled={marking}
              onClick={() => void markRead(unreadShown)}
            >
              Marcar exibidas como lidas
            </Button>
          )}
        </div>
        {error && (
          <p className="secure-access-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && !items.length && (
          <p className="notification-empty">
            Você está em dia. Seus próximos avisos aparecerão aqui.
          </p>
        )}
        <ul className="notification-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`${item.read_at ? '' : 'is-unread'} ${item.kind === 'subscription_due' ? 'subscription-notice' : ''}`}
            >
              <div>
                <strong>{item.title}</strong>
                {!item.read_at && <span className="notification-new">Não lida</span>}
              </div>
              <p>{item.body}</p>
              <small>
                {new Intl.DateTimeFormat('pt-BR', {
                  timeZone: 'America/Sao_Paulo',
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(item.created_at))}
              </small>
              <div className="notification-actions">
                <Link
                  to={notificationTarget(item)}
                  onClick={() => {
                    setOpen(false);
                    void markRead([item.id]);
                  }}
                >
                  Ver detalhes
                </Link>
                {!item.read_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={marking}
                    onClick={() => void markRead([item.id])}
                  >
                    Marcar como lida
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {items.length === 50 && (
          <p className="small-note">
            Exibindo os 50 avisos prioritários mais recentes. O contador considera todos os avisos
            não lidos.
          </p>
        )}
      </Modal>
    </>
  );
}
