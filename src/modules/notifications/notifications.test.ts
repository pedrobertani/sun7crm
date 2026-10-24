import { describe, expect, it } from 'vitest';
import { notificationTarget } from './NotificationBell';
describe('Destinos dos avisos oficiais', () => {
  it('mantém tarefas, contatos e vencimento nas páginas oficiais', () => {
    expect(notificationTarget({ kind: 'subscription_due', entity_id: 'empresa-local' })).toBe(
      '/app',
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
