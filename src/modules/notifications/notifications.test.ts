import { describe, expect, it } from 'vitest';
import { notificationTarget } from './NotificationBell';
describe('Destinos dos avisos oficiais', () => {
  it('abre o card no funil autenticado', () => {
    expect(
      notificationTarget({
        kind: 'card_idle',
        entity_id: 'card-local',
        contact_id: 'contato-local',
      }),
    ).toBe('/app/funil?card=card-local');
    expect(notificationTarget({ kind: 'card_escalation', entity_id: 'card-local' })).toBe(
      '/app/contatos',
    );
  });
  it('mantém tarefas, contatos e vencimento nas páginas oficiais', () => {
    expect(notificationTarget({ kind: 'subscription_due', entity_id: 'empresa-local' })).toBe(
      '/app/plano',
    );
    expect(notificationTarget({ kind: 'task_due', entity_id: 'tarefa-local' })).toBe(
      '/app/tarefas?registro=tarefa-local',
    );
    expect(notificationTarget({ kind: 'task_assigned', entity_id: 'tarefa-local' })).toBe(
      '/app/tarefas?registro=tarefa-local',
    );
    expect(notificationTarget({ kind: 'new_contact', entity_id: 'contato-local' })).toBe(
      '/app/contatos?registro=contato-local',
    );
    expect(notificationTarget({ kind: 'contact_assigned', entity_id: 'contato-local' })).toBe(
      '/app/contatos?registro=contato-local',
    );
  });
});
