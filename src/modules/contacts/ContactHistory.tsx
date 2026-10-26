import { formatContactPhone } from '../../domain/contact-transfer';
import { useState } from 'react';
import { History, NotebookPen } from 'lucide-react';
import { useCrm } from '../../app/context';
import {
  addContactNote,
  visibleContactHistory,
  recordWhatsappOpen,
} from '../../domain/contact-history';
import { visibleContacts } from '../../domain/operations';
import type { ContactHistoryEvent } from '../../domain/types';
import { Modal } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';
import { FormError } from '../../components/shared';
import { WhatsAppButton } from '../../components/WhatsAppButton';

export function ContactHistoryDialog({
  contact,
  onClose,
  items,
  canAdd,
  canWhatsapp = true,
  onAdd,
  loading = false,
  error = '',
  hasMore = false,
  onMore,
  onWhatsApp,
  scope = 'contact',
}: {
  contact: { name: string; phone: string } | null;
  onClose: () => void;
  items: ContactHistoryEvent[];
  canAdd: boolean;
  canWhatsapp?: boolean;
  onAdd: (body: string) => Promise<void>;
  loading?: boolean;
  error?: string;
  hasMore?: boolean;
  onMore?: () => void;
  onWhatsApp?: () => void;
  scope?: 'contact' | 'card';
}) {
  const [body, setBody] = useState(''),
    [busy, setBusy] = useState(false),
    [saveError, setSaveError] = useState('');
  async function save() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setSaveError('');
    try {
      await onAdd(body);
      setBody('');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível registrar a anotação.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!contact}
      onOpenChange={(v) => !v && onClose()}
      title={scope === 'card' ? 'Histórico do card' : 'Histórico do cliente'}
      description={
        scope === 'card'
          ? 'Movimentações, anotações e acionamentos vinculados a esta oportunidade.'
          : 'Cadastro, oportunidades e anotações reunidos por pessoa.'
      }
    >
      {contact && (
        <>
          <div className="history-person">
            <div>
              <strong>{contact.name}</strong>
              <small>{formatContactPhone(contact.phone) || 'Telefone não informado'}</small>
            </div>
            <WhatsAppButton
              disabled={!canWhatsapp}
              name={contact.name}
              phone={contact.phone}
              onOpen={onWhatsApp}
            />
          </div>
          {canAdd && (
            <form
              className="history-note-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="form-row">
                {scope === 'card' ? 'Adicionar anotação neste card' : 'Adicionar anotação'}
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={body}
                  placeholder="Registre o atendimento, uma preferência ou o próximo passo..."
                  disabled={busy}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <div className="history-note-actions">
                <small>{body.length}/2.000</small>
                <Button disabled={busy || !body.trim()}>
                  <NotebookPen size={15} />
                  {busy ? 'Registrando...' : 'Registrar anotação'}
                </Button>
              </div>
              <FormError message={saveError} />
            </form>
          )}
          <div className="history-heading">
            <History size={16} />
            <h3>Linha do tempo</h3>
          </div>
          <FormError message={error} />
          {loading && !items.length ? (
            <p role="status" className="history-empty">
              Carregando histórico...
            </p>
          ) : !items.length && !error ? (
            <p className="history-empty">
              Nenhuma atividade registrada ainda. Novas alterações aparecerão aqui; movimentações
              anteriores não são reconstruídas.
            </p>
          ) : (
            <ol className="contact-timeline">
              {items.map((e) => (
                <li
                  key={e.id}
                  className={'timeline-entry ' + (e.kind === 'note' ? 'timeline-note' : '')}
                >
                  <div className="timeline-entry-head">
                    <strong>{e.title}</strong>
                    <time dateTime={e.occurredAt}>
                      {new Intl.DateTimeFormat('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'America/Sao_Paulo',
                      }).format(new Date(e.occurredAt))}
                    </time>
                  </div>
                  <p>{e.body}</p>
                  <small>Por {e.actorName || 'Sistema'}</small>
                </li>
              ))}
            </ol>
          )}
          {hasMore && (
            <Button variant="outline" disabled={loading} onClick={onMore}>
              {loading ? 'Carregando...' : 'Carregar atividades anteriores'}
            </Button>
          )}
          <p className="small-note">
            Anotações e atividades ficam no histórico. O atalho do WhatsApp abre a conversa;
            mensagens não são importadas para o CRM.
          </p>
        </>
      )}
    </Modal>
  );
}
export function DemoContactHistory({
  contactId,
  onClose,
}: {
  contactId: string;
  onClose: () => void;
}) {
  const { data, session, update } = useCrm();
  const contact = visibleContacts(data, session).find((c) => c.id === contactId) || null;
  const events = visibleContactHistory(data, session, contactId);
  return (
    <ContactHistoryDialog
      key={contactId}
      contact={contact}
      onClose={onClose}
      items={events}
      onWhatsApp={() => update((d) => recordWhatsappOpen(d, session, contactId))}
      canAdd={['manager', 'seller'].includes(session.role)}
      onAdd={async (body) => {
        if (!update((d) => addContactNote(d, session, contactId, body)))
          throw Error('Não foi possível registrar a anotação. Tente novamente.');
      }}
    />
  );
}
