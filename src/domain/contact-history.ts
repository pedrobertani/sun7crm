import type { ContactHistoryEvent, Session, Snapshot } from './types';
import { visibleContacts } from './operations';
import { currency, uid } from '../lib/format';

export function visibleContactHistory(data: Snapshot, session: Session, contactId: string) {
  if (!visibleContacts(data, session).some((c) => c.id === contactId)) return [];
  return (data.contactHistory || [])
    .filter((e) => e.companyId === session.companyId && e.contactId === contactId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
export function addContactNote(
  data: Snapshot,
  session: Session,
  contactId: string,
  body: string,
): Snapshot {
  if (
    !['manager', 'seller'].includes(session.role) ||
    !visibleContacts(data, session).some((c) => c.id === contactId)
  )
    throw Error('Você não pode registrar anotações neste contato.');
  if (!body.trim() || body.trim().length > 2000)
    throw Error('Escreva uma anotação de até 2.000 caracteres.');
  return {
    ...data,
    contactHistory: [
      ...(data.contactHistory || []),
      {
        id: uid(),
        companyId: session.companyId,
        contactId,
        actorId: session.memberId,
        actorName:
          data.members.find((m) => m.id === session.memberId && m.companyId === session.companyId)
            ?.name || 'Usuário',
        occurredAt: new Date().toISOString(),
        kind: 'note',
        title: 'Anotação de atendimento',
        body: body.trim(),
      },
    ],
  };
}
/** Capture only changes made now. Never fabricate earlier movements for legacy data. */
export function recordContactChanges(
  before: Snapshot,
  after: Snapshot,
  session: Session,
  now = new Date().toISOString(),
): Snapshot {
  const events: ContactHistoryEvent[] = [];
  const actorName =
    after.members.find((m) => m.id === session.memberId && m.companyId === session.companyId)
      ?.name || 'Usuário';
  const permitted = new Set(visibleContacts(after, session).map((c) => c.id));
  const add = (
    contactId: string,
    kind: ContactHistoryEvent['kind'],
    title: string,
    body: string,
    opportunityId?: string,
  ) => {
    if (permitted.has(contactId))
      events.push({
        id: uid(),
        companyId: session.companyId,
        contactId,
        actorId: session.memberId,
        actorName,
        occurredAt: now,
        kind,
        title,
        body,
        opportunityId,
      });
  };
  const oldContacts = new Map(before.contacts.map((c) => [c.id, c]));
  const fields = {
    name: 'nome',
    phone: 'telefone',
    email: 'e-mail',
    temperature: 'temperatura',
    ownerId: 'responsável',
    interests: 'interesses',
    notes: 'observações',
    catalogIds: 'serviços e produtos',
  } as const;
  for (const contact of after.contacts.filter((c) => c.companyId === session.companyId)) {
    const previous = oldContacts.get(contact.id);
    if (!previous) {
      add(contact.id, 'contact_created', 'Contato cadastrado', 'Cadastro criado no CRM.');
      continue;
    }
    const changed = Object.entries(fields)
      .filter(
        ([key]) =>
          JSON.stringify(previous[key as keyof typeof fields] ?? []) !==
          JSON.stringify(contact[key as keyof typeof fields] ?? []),
      )
      .map(([, name]) => name);
    if (changed.length)
      add(
        contact.id,
        'contact_updated',
        'Cadastro atualizado',
        'Campos alterados: ' + changed.join(', ') + '.',
      );
  }
  const oldCards = new Map(before.opportunities.map((o) => [o.id, o]));
  const stage = (d: Snapshot, boardId: string, stageId: string) => {
    const b = d.boards.find((b) => b.id === boardId);
    return (
      (b?.name || (b?.kind === 'clients' ? 'Clientes' : b?.kind === 'leads' ? 'Leads' : 'Funil')) +
      ' / ' +
      (b?.stages.find((s) => s.id === stageId)?.name || 'Etapa anterior')
    );
  };
  for (const card of after.opportunities.filter((c) => c.companyId === session.companyId)) {
    const previous = oldCards.get(card.id),
      title = card.title || 'Oportunidade';
    if (!previous) {
      add(
        card.contactId,
        'card_created',
        'Novo card',
        title + ' · ' + stage(after, card.boardId, card.stageId) + ' · ' + currency(card.value),
        card.id,
      );
      continue;
    }
    if (previous.contactId !== card.contactId) {
      add(
        previous.contactId,
        'card_updated',
        'Card desvinculado',
        'Uma oportunidade foi desvinculada deste contato.',
        card.id,
      );
      add(
        card.contactId,
        'card_created',
        'Card vinculado',
        title + ' · ' + stage(after, card.boardId, card.stageId),
        card.id,
      );
      continue;
    }
    if (previous.stageId !== card.stageId || previous.boardId !== card.boardId)
      add(
        card.contactId,
        'card_moved',
        'Card movimentado',
        title +
          ': ' +
          stage(before, previous.boardId, previous.stageId) +
          ' → ' +
          stage(after, card.boardId, card.stageId),
        card.id,
      );
    const changed = [
      ['title', 'título'],
      ['value', 'valor'],
      ['strategyId', 'estratégia'],
      ['source', 'origem'],
      ['labelIds', 'etiquetas'],
      ['catalogIds', 'serviços e produtos'],
    ]
      .filter(
        ([key]) =>
          JSON.stringify(previous[key as keyof typeof card] ?? []) !==
          JSON.stringify(card[key as keyof typeof card] ?? []),
      )
      .map(([, label]) => label);
    if (changed.length)
      add(
        card.contactId,
        'card_updated',
        'Card atualizado',
        title + ' · Campos alterados: ' + changed.join(', ') + '.',
        card.id,
      );
  }
  return events.length
    ? { ...after, contactHistory: [...(after.contactHistory || []), ...events] }
    : after;
}

export function recordWhatsappOpen(data: Snapshot, session: Session, contactId: string): Snapshot {
  if (!visibleContacts(data, session).some((c) => c.id === contactId))
    throw Error('Contato indisponível.');
  return {
    ...data,
    contactHistory: [
      ...(data.contactHistory || []),
      {
        id: uid(),
        companyId: session.companyId,
        contactId,
        actorId: session.memberId,
        actorName:
          data.members.find((m) => m.id === session.memberId && m.companyId === session.companyId)
            ?.name || 'Usuário',
        occurredAt: new Date().toISOString(),
        kind: 'whatsapp_opened',
        title: 'WhatsApp acionado',
        body: 'Atalho acionado no CRM. O envio de mensagem e a resposta do cliente não são confirmados.',
      },
    ],
  };
}
