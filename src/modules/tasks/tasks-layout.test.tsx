import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TasksSegmented } from './tasks-segmented';
import { visibleKanbanRows } from '../kanban/page-size';

describe('Tarefas — layout anterior aprovado e paginação', () => {
  it('mantém Quadro Kanban/Lista como seletor segmentado, não abas globais', () => {
    const html = renderToStaticMarkup(
      <TasksSegmented
        label="Visualização das tarefas"
        value="quadro"
        onValueChange={() => {}}
        items={[{ value: 'quadro', label: 'Quadro Kanban' }, { value: 'lista', label: 'Lista' }]}
      />,
    );
    expect(html).toContain('tasks-segmented');
    expect(html).toContain('aria-label="Visualização das tarefas"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Quadro Kanban');
    expect(html).toContain('Lista');
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html).not.toContain('ui-tabs-list');
  });
  it('mantém status compactos com rótulos e seleção acessível', () => {
    const html = renderToStaticMarkup(
      <TasksSegmented
        label="Situação das tarefas"
        value="pending"
        onValueChange={() => {}}
        items={[
          { value: 'all', label: 'Todas' },
          { value: 'pending', label: 'Pendentes' },
          { value: 'overdue', label: 'Atrasadas' },
          { value: 'done', label: 'Concluídas' },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Situação das tarefas"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    for (const label of ['Todas', 'Pendentes', 'Atrasadas', 'Concluídas']) {
      expect(html).toContain(label);
    }
  });
  it('não perde tarefas ao navegar 10/50/100 ou exibir Todas', () => {
    const tasks = Array.from({ length: 305 }, (_, index) => ({ id: index + 1 }));
    expect(visibleKanbanRows(tasks, 10, 0).rows).toHaveLength(10);
    expect(visibleKanbanRows(tasks, 50, 3).rows).toEqual(tasks.slice(150, 200));
    expect(visibleKanbanRows(tasks, 100, 3).rows).toHaveLength(5);
    expect(visibleKanbanRows(tasks, 'all', 5)).toEqual({ rows: tasks, page: 0, total: 305 });
  });
});
