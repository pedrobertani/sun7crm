import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import {
  addContactNote,
  recordContactChanges,
  recordWhatsappOpen,
  visibleContactHistory,
} from './contact-history';
import { demoActivityReport, idleDays } from '../modules/reports/activity';
import { whatsappLink } from '../lib/whatsapp';
import type { Session } from './types';
const manager: Session = { companyId: 'aurora', memberId: 'aurora-manager', role: 'manager' };
const seller: Session = { ...manager, memberId: 'aurora-seller', role: 'seller' };
describe('Histórico do cliente', () => {
  it('registra somente alterações reais e preserva a etapa no momento da movimentação', () => {
    const before = createSeed(),
      opportunity = before.opportunities.find((o) => o.companyId === 'aurora')!,
      board = before.boards.find((b) => b.id === opportunity.boardId)!;
    expect(recordContactChanges(before, { ...before }, manager).contactHistory).toBeUndefined();
    const after = {
      ...before,
      opportunities: before.opportunities.map((o) =>
        o.id === opportunity.id ? { ...o, stageId: board.stages[1].id } : o,
      ),
    };
    const captured = recordContactChanges(before, after, manager, '2026-10-24T13:00:00Z');
    expect(captured.contactHistory).toHaveLength(1);
    expect(captured.contactHistory![0]).toMatchObject({
      kind: 'card_moved',
      actorName: 'Mariana Costa',
      contactId: opportunity.contactId,
    });
    expect(captured.contactHistory![0].body).toContain(board.stages[0].name);
    expect(captured.contactHistory![0].body).toContain(board.stages[1].name);
    board.stages[0].name = 'Nome posterior';
    expect(captured.contactHistory![0].body).not.toContain('Nome posterior');
  });
  it('registra edição de cadastro e novo card sem duplicar a pessoa', () => {
    const before = createSeed(),
      c = before.contacts.find((c) => c.companyId === 'aurora')!,
      op = before.opportunities.find((o) => o.contactId === c.id)!;
    const next = recordContactChanges(
      before,
      {
        ...before,
        contacts: before.contacts.map((x) => (x.id === c.id ? { ...x, notes: 'Preferência' } : x)),
        opportunities: [...before.opportunities, { ...op, id: 'retorno', title: 'Retorno' }],
      },
      manager,
    );
    expect(next.contactHistory!.map((e) => e.kind)).toEqual(['contact_updated', 'card_created']);
    expect(next.contacts.length).toBe(before.contacts.length);
  });
  it('anotações e cliques no WhatsApp têm autoria e permanecem distintos', () => {
    const data = createSeed(),
      c = data.contacts.find((c) => c.companyId === 'aurora')!;
    const note = addContactNote(data, seller, c.id, '  Retornar amanhã  ');
    const next = recordWhatsappOpen(note, seller, c.id);
    expect(visibleContactHistory(next, seller, c.id)).toHaveLength(2);
    expect(next.contactHistory![0].body).toBe('Retornar amanhã');
    expect(next.contactHistory![1]).toMatchObject({
      kind: 'whatsapp_opened',
      actorId: seller.memberId,
      title: 'WhatsApp acionado',
    });
    expect(next.contactHistory![1].body).toContain('não são confirmados');
  });
  it('não permite notas nem leitura de cliente de outro consultor ou empresa', () => {
    const data = createSeed(),
      c = data.contacts.find((c) => c.companyId === 'aurora')!;
    c.ownerId = 'other';
    expect(() => addContactNote(data, seller, c.id, 'Texto')).toThrow();
    expect(() => recordWhatsappOpen(data, seller, c.id)).toThrow();
    expect(visibleContactHistory(data, seller, c.id)).toEqual([]);
    const foreign = data.contacts.find((c) => c.companyId !== 'aurora')!;
    expect(() => addContactNote(data, manager, foreign.id, 'Texto')).toThrow();
    expect(() => addContactNote(data, { ...manager, role: 'reception' }, c.id, 'Texto')).toThrow();
    expect(() => addContactNote(data, manager, c.id, ' ')).toThrow();
  });
  it('relatório distingue responsável atual de quem atuou e restringe visão ao gestor', () => {
    const data = createSeed(),
      c = data.contacts.find((c) => c.companyId === 'aurora')!;
    const after = recordWhatsappOpen(data, seller, c.id);
    after.contactHistory![0].occurredAt = '2026-10-20T10:00:00Z';
    c.ownerId = manager.memberId;
    const report = demoActivityReport(after, manager, new Date('2026-10-24T10:00:00Z'));
    expect(report.actors[0]).toMatchObject({
      id: seller.memberId,
      whatsappCount: 1,
      contactsCount: 1,
    });
    const row = report.rows.find((r) => r.contactId === c.id)!;
    expect(row.ownerId).toBe(manager.memberId);
    expect(idleDays(row, new Date('2026-10-24T10:00:00Z'))).toBe(4);
    expect(demoActivityReport(after, seller).rows).toEqual([]);
  });
});
describe('Link oficial do WhatsApp', () => {
  it.each(['(14) 99673-2848', '14996732848', '+55 (14) 99673-2848', '5514996732848'])(
    'normaliza %s sem duplicar o prefixo do país',
    (phone) => {
      expect(whatsappLink(phone)).toBe('https://wa.me/5514996732848');
    },
  );
  it.each(['', '996732848', 'javascript:alert(1)', '+1 212 555 1234'])(
    'não monta link para número inválido: %s',
    (phone) => {
      expect(whatsappLink(phone)).toBeNull();
    },
  );
});
