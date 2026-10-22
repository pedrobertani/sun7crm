import type { Task, Session, Snapshot } from './types';
export const TASK_STAGES = [
  { id: 'todo', label: 'A fazer' },
  { id: 'in_progress', label: 'Em andamento' },
  { id: 'done', label: 'Concluídas' },
] as const;
export type TaskStatus = (typeof TASK_STAGES)[number]['id'];
export function taskStatus(task: Task): TaskStatus {
  return task.done ? 'done' : task.status === 'in_progress' ? 'in_progress' : 'todo';
}
export function visibleTasks(data: Snapshot, session: Session) {
  return data.tasks.filter(
    (t) =>
      session.role !== 'admin' &&
      t.companyId === session.companyId &&
      (session.role === 'manager' || t.ownerId === session.memberId),
  );
}
export function moveTask(
  data: Snapshot,
  session: Session,
  id: string,
  status: TaskStatus,
): Snapshot {
  if (!TASK_STAGES.some((s) => s.id === status)) throw Error('Etapa de tarefa inválida.');
  if (!visibleTasks(data, session).some((t) => t.id === id))
    throw Error('Tarefa não encontrada para este perfil.');
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id ? { ...t, status, done: status === 'done' } : t)),
  };
}
