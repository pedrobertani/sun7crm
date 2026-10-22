import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import { moveTask, taskStatus, visibleTasks } from './tasks';
import type { Session } from './types';
const manager: Session = { role: 'manager', companyId: 'aurora', memberId: 'aurora-manager' };
describe('tarefas em lista e Kanban', () => {
  it('mantém compatibilidade com tarefas antigas sem etapa', () => {
    const d = createSeed();
    expect(taskStatus({ ...d.tasks[0], done: false, status: undefined })).toBe('todo');
    expect(taskStatus({ ...d.tasks[0], done: true, status: undefined })).toBe('done');
  });
  it('em andamento continua pendente e concluir atualiza o indicador legado', () => {
    const d = createSeed(),
      id = d.tasks[0].id;
    const progress = moveTask(d, manager, id, 'in_progress');
    expect(taskStatus(progress.tasks[0])).toBe('in_progress');
    expect(progress.tasks[0].done).toBe(false);
    const done = moveTask(progress, manager, id, 'done');
    expect(done.tasks[0].done).toBe(true);
    expect(done.tasks.filter((t) => t.companyId === 'aurora' && !t.done).length).toBe(
      d.tasks.filter((t) => t.companyId === 'aurora' && !t.done).length - 1,
    );
  });
  it('reabrir preserva prazo, responsável e vínculo com contato', () => {
    const d = createSeed(),
      t = d.tasks[0];
    const next = moveTask(moveTask(d, manager, t.id, 'done'), manager, t.id, 'todo');
    expect(next.tasks[0]).toEqual({ ...t, status: 'todo', done: false });
  });
  it('não movimenta tarefas de outra empresa nem de outro responsável', () => {
    const d = createSeed();
    expect(() => moveTask(d, manager, 'casa-task1', 'done')).toThrow();
    const reception: Session = { ...manager, role: 'reception', memberId: 'aurora-reception' };
    expect(visibleTasks(d, reception).every((t) => t.ownerId === reception.memberId)).toBe(true);
    expect(() => moveTask(d, reception, 'aurora-task1', 'done')).toThrow();
  });
  it('grava a etapa no mesmo registro usado pelas duas visualizações', () => {
    const d = createSeed();
    const next = moveTask(d, manager, 'aurora-task1', 'in_progress');
    expect(next.tasks.length).toBe(d.tasks.length);
    expect(next.tasks.find((t) => t.id === 'aurora-task1')?.status).toBe('in_progress');
    expect(next.tasks.find((t) => t.id === 'casa-task1')).toEqual(
      d.tasks.find((t) => t.id === 'casa-task1'),
    );
  });
});
