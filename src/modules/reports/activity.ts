import type { Session, Snapshot } from '../../domain/types';
export interface ActivityRow {
  contactId: string;
  name: string;
  phone: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  lastActivityAt: string | null;
  lastWhatsappAt: string | null;
  lastMovementAt: string | null;
  whatsappCount: number;
  movementCount: number;
  noteCount: number;
}
export interface ActorActivity {
  id: string;
  name: string;
  total: number;
  whatsappCount: number;
  movementCount: number;
  noteCount: number;
  contactsCount: number;
  lastActivityAt: string;
}
export function idleDays(row: ActivityRow, now = new Date()) {
  return Math.max(
    0,
    Math.floor(
      (now.getTime() -
        new Date(
          row.lastActivityAt ||
            (row.createdAt.length === 10 ? row.createdAt + 'T00:00:00-03:00' : row.createdAt),
        ).getTime()) /
        86400000,
    ),
  );
}
export function demoActivityReport(data: Snapshot, session: Session, now = new Date()) {
  if (session.role !== 'manager')
    return { rows: [] as ActivityRow[], actors: [] as ActorActivity[] };
  const history = (data.contactHistory || []).filter((e) => e.companyId === session.companyId);
  const rows: ActivityRow[] = data.contacts
    .filter((c) => c.companyId === session.companyId)
    .map((c) => {
      const events = history
        .filter((e) => e.contactId === c.id)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      return {
        contactId: c.id,
        name: c.name,
        phone: c.phone,
        ownerId: c.ownerId,
        ownerName:
          data.members.find((m) => m.id === c.ownerId && m.companyId === session.companyId)?.name ||
          'Sem responsável',
        createdAt: c.createdAt,
        lastActivityAt: events[0]?.occurredAt || null,
        lastWhatsappAt: events.find((e) => e.kind === 'whatsapp_opened')?.occurredAt || null,
        lastMovementAt: events.find((e) => e.kind === 'card_moved')?.occurredAt || null,
        whatsappCount: events.filter((e) => e.kind === 'whatsapp_opened').length,
        movementCount: events.filter((e) => e.kind === 'card_moved').length,
        noteCount: events.filter((e) => e.kind === 'note').length,
      };
    });
  const permitted = new Set(rows.map((r) => r.contactId));
  const actors: ActorActivity[] = [];
  for (const e of history.filter(
    (e) =>
      e.actorId &&
      permitted.has(e.contactId) &&
      new Date(e.occurredAt).getTime() >= now.getTime() - 30 * 86400000,
  )) {
    let actor = actors.find((a) => a.id === e.actorId);
    if (!actor) {
      actor = {
        id: e.actorId!,
        name: e.actorName,
        total: 0,
        whatsappCount: 0,
        movementCount: 0,
        noteCount: 0,
        contactsCount: 0,
        lastActivityAt: e.occurredAt,
      };
      actors.push(actor);
    }
    actor.total++;
    if (e.kind === 'whatsapp_opened') actor.whatsappCount++;
    if (e.kind === 'card_moved') actor.movementCount++;
    if (e.kind === 'note') actor.noteCount++;
    if (e.occurredAt > actor.lastActivityAt) {
      actor.lastActivityAt = e.occurredAt;
      actor.name = e.actorName;
    }
  }
  for (const actor of actors)
    actor.contactsCount = new Set(
      history
        .filter(
          (e) =>
            permitted.has(e.contactId) &&
            e.actorId === actor.id &&
            new Date(e.occurredAt).getTime() >= now.getTime() - 30 * 86400000,
        )
        .map((e) => e.contactId),
    ).size;
  return { rows, actors: actors.sort((a, b) => b.total - a.total) };
}
