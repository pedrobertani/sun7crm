import { KanbanSizeControl, visibleKanbanRows, type KanbanPageSize } from '../kanban/page-size';
import './tasks-layout.css';
import { TasksSegmented } from './tasks-segmented';
import { Pagination, paginatedRows, usePagination } from '../../components/ui/pagination';
import { useCardDrag } from '../../hooks/useCardDrag';
import { RecordTitle } from '../../components/RecordTitle';
import type { Task } from '../../domain/types';
import { useSearchParams } from 'react-router-dom';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Pencil, Plus, CalendarDays, Check, Circle, GripVertical, UserRound, List, KanbanSquare } from 'lucide-react';
import { useCrm } from '../../app/context';
import { visibleContacts } from '../../domain/operations';
import {
  TASK_STAGES,
  taskStatus,
  visibleTasks,
  moveTask,
  type TaskStatus,
} from '../../domain/tasks';
import { today, dateLabel, uid, initials } from '../../lib/format';
import { Heading, SearchInput, Empty, FormActions, FormError } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
export function Tasks() {
  const pages = usePagination();
  const [boardSize, setBoardSize] = useState<KanbanPageSize>(10);
  const [boardPages, setBoardPages] = useState<Record<string, number>>({});
  const changeBoardSize = (size: KanbanPageSize) => { setBoardSize(size); setBoardPages({}); };
  const { data, session, update, notice } = useCrm();
  const [params, setParams] = useSearchParams();
  const view = params.get('visualizacao') === 'lista' ? 'lista' : 'quadro';
  const filter = ['pending', 'overdue', 'done', 'all'].includes(params.get('status') || '')
    ? params.get('status')!
    : 'all';
  function changeParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
    setBoardPages({});
    pages.setPage(0);
  }
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    dueDate: today(),
    contactId: '',
    ownerId: session.memberId,
    status: 'todo' as TaskStatus,
  });
  const contacts = visibleContacts(data, session);
  const members = data.members.filter((m) => m.companyId === session.companyId && m.active);
  const tasks = visibleTasks(data, session)
    .filter(
      (t) =>
        filter === 'all' ||
        (filter === 'done'
          ? t.done
          : filter === 'overdue'
            ? !t.done && t.dueDate < today()
            : !t.done),
    )
    .filter((t) => t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  function newTask(status: TaskStatus = 'todo') {
    setEditingId('');
    setForm({ title: '', dueDate: today(), contactId: '', ownerId: session.memberId, status });
    setError('');
    setOpen(true);
  }
  function openTask(task: Task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      dueDate: task.dueDate,
      contactId: task.contactId,
      ownerId: task.ownerId,
      status: taskStatus(task),
    });
    setError('');
    setOpen(true);
  }
  function move(id: string, status: TaskStatus) {
    if (update((d) => moveTask(d, session, id, status)))
      notice(status === 'done' ? 'Tarefa concluída.' : 'Tarefa atualizada.');
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Informe a descrição da tarefa.');
      return;
    }
    if (editingId && !visibleTasks(data, session).some((task) => task.id === editingId)) {
      setError('Tarefa não encontrada para este perfil.');
      return;
    }
    const task: Task = {
      ...form,
      title: form.title.trim(),
      ownerId: session.role === 'manager' ? form.ownerId : session.memberId,
      id: editingId || uid(),
      companyId: session.companyId,
      done: form.status === 'done',
    };
    if (
      update((d) => ({
        ...d,
        tasks: editingId
          ? d.tasks.map((row) => (row.id === editingId ? task : row))
          : [task, ...d.tasks],
      }))
    ) {
      setOpen(false);
      notice(editingId ? 'Tarefa atualizada.' : 'Tarefa criada.');
    }
  }
  const startDrag = useCardDrag((id, stage) => move(id, stage as TaskStatus));
  return (
    <>
      <Heading
        eyebrow="ROTINA COMERCIAL"
        title="Tarefas"
        description="Organize as próximas ações e acompanhe o andamento do trabalho."
      >
        <Button onClick={() => newTask()}>
          <Plus size={16} />
          Nova tarefa
        </Button>
      </Heading>
      <div className="tasks-view-toolbar">
        <TasksSegmented
          label="Visualização das tarefas"
          value={view}
          onValueChange={(value) => changeParam('visualizacao', value)}
          items={[
            { value: 'quadro', label: 'Quadro Kanban', icon: <KanbanSquare size={15} /> },
            { value: 'lista', label: 'Lista', icon: <List size={15} /> },
          ]}
        />
        <span className="muted result-count">{tasks.length} tarefas</span>
      </div>
      <div className={view === 'lista' ? 'card' : 'tasks-board-area'}>
        <div className={'toolbar ' + (view === 'quadro' ? 'tasks-filterbar' : 'tasks-list-filterbar')}>
          <TasksSegmented
            label="Situação das tarefas"
            value={filter}
            onValueChange={(value) => changeParam('status', value)}
            items={[
              { value: 'all', label: 'Todas' },
              { value: 'pending', label: 'Pendentes' },
              { value: 'overdue', label: 'Atrasadas' },
              { value: 'done', label: 'Concluídas' },
            ]}
          />
          <SearchInput value={query} onChange={(v) => { setQuery(v); pages.setPage(0); setBoardPages({}); }} placeholder="Buscar tarefa" />
        </div>
        {view === 'quadro' ? (
          <>
            <div className="kanban-scroll">
              <div className="tasks-kanban">
                {TASK_STAGES.map((stage) => {
                  const rows = tasks.filter((t) => taskStatus(t) === stage.id);
                  const visible = visibleKanbanRows(rows, boardSize, boardPages[stage.id] || 0);
                  return (
                    <section
                      key={stage.id}
                      className="kanban-column"
                      aria-label={'Tarefas: ' + stage.label}
                      data-drop-stage={stage.id}
                    >
                      <div className="column-head">
                        <div>
                          <span className="stage-dot" />
                          <h2>{stage.label}</h2>
                          <span className="stage-count">{rows.length}</span>
                        </div>
                      </div>
                      <div className="column-body">
                        {visible.rows.map((t) => {
                          const owner = members.find((m) => m.id === t.ownerId);
                          const contact = data.contacts.find((c) => c.id === t.contactId);
                          return (
                            <article
                              key={t.id}
                              className={
                                'opportunity-card task-kanban-card ' +
                                (t.done ? 'task-complete' : '')
                              }
                              draggable={false}
                            >
                              <div className="task-card-heading">
                                <RecordTitle title={t.title} onOpen={() => openTask(t)} />
                                <button
                                  type="button"
                                  className="card-drag-handle"
                                  aria-label={'Arrastar tarefa ' + t.title}
                                  title="Arrastar para outra etapa"
                                  onPointerDown={(e) => startDrag(e, t.id, stage.id)}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  <GripVertical size={18} />
                                </button>
                              </div>
                              <p className="task-card-contact">
                                {contact?.name || 'Tarefa interna'}
                              </p>
                              <div className="task-card-meta">
                                <span
                                  className={
                                    'badge ' +
                                    (t.done
                                      ? 'good'
                                      : t.dueDate < today()
                                        ? 'bad'
                                        : t.dueDate === today()
                                          ? 'warn'
                                          : 'gray')
                                  }
                                >
                                  <CalendarDays size={11} />
                                  {t.dueDate === today() ? 'Hoje' : dateLabel(t.dueDate)}
                                  {!t.done && t.dueDate < today() ? ' · atrasada' : ''}
                                </span>
                                <span
                                  className="mini-avatar"
                                  title={owner?.name || 'Sem responsável'}
                                >
                                  {initials(owner?.name || 'Sem responsável')}
                                </span>
                              </div>
                              <div className="task-card-owner">
                                <UserRound size={12} />
                                {owner?.name || 'Sem responsável'}
                              </div>
                              <label className="move-select">
                                <span className="sr-only">Mover tarefa {t.title}</span>
                                <select
                                  aria-label={'Mover tarefa ' + t.title}
                                  value={stage.id}
                                  onChange={(e) => move(t.id, e.target.value as TaskStatus)}
                                >
                                  {TASK_STAGES.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </article>
                          );
                        })}
                        {!rows.length && (
                          <div className="column-empty">
                            {filter === 'all'
                              ? 'Nenhuma tarefa nesta etapa'
                              : 'Nenhuma tarefa para este filtro'}
                          </div>
                        )}
                        <Button
                          className="add-task-column"
                          variant="ghost"
                          size="sm"
                          onClick={() => newTask(stage.id)}
                        >
                          <Plus size={14} />
                          Adicionar tarefa
                        </Button>
                      </div>
                      {boardSize !== 'all' && rows.length > boardSize && (
                        <div className="kanban-column-pagination">
                          <Pagination
                            page={visible.page} size={boardSize} total={rows.length}
                            onChange={(next) => setBoardPages((previous) => ({ ...previous, [stage.id]: next }))}
                            label={'tarefas de ' + stage.label}
                          />
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
            <div className="tasks-board-footer">
              <KanbanSizeControl size={boardSize} onChange={changeBoardSize} />
              <span className="muted">{tasks.length} tarefas</span>
            </div>
            <p className="small-note">
              Arraste as tarefas entre as etapas ou use o seletor de cada cartão. As visualizações
              compartilham os mesmos cadastros.
            </p>
          </>
        ) : tasks.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Responsável</th>
                  <th>Prazo</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows(tasks, pages.page, pages.size).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <RecordTitle title={t.title} onOpen={() => openTask(t)} />
                      <small>
                        {data.contacts.find((c) => c.id === t.contactId)?.name || 'Sem contato'}
                      </small>
                    </td>
                    <td>{members.find((m) => m.id === t.ownerId)?.name || 'Sem responsável'}</td>
                    <td>{t.dueDate === today() ? 'Hoje' : dateLabel(t.dueDate)}</td>
                    <td>
                      <span
                        className={
                          'badge ' +
                          (t.done ? 'good' : taskStatus(t) === 'in_progress' ? 'warn' : 'gray')
                        }
                      >
                        {TASK_STAGES.find((s) => s.id === taskStatus(t))?.label}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={(t.done ? 'Reabrir ' : 'Concluir ') + t.title}
                          onClick={() => move(t.id, t.done ? 'todo' : 'done')}
                        >
                          {t.done ? <Circle size={16} /> : <Check size={16} />}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label={'Editar ' + t.title}
                          onClick={() => openTask(t)}
                        >
                          <Pencil size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Tudo em dia por aqui"
            description="Nenhuma tarefa para os filtros selecionados."
          />
        )}
        {view === 'lista' && <Pagination page={pages.page} total={tasks.length} size={pages.size} onChange={pages.setPage} onSizeChange={pages.setSize} label="tarefas" />}
      </div>
      <Modal open={open} onOpenChange={setOpen} title={editingId ? 'Editar tarefa' : 'Nova tarefa'}>
        <form onSubmit={save}>
          <div className="form-grid">
            <label className="form-row span2">
              O que precisa ser feito?
              <Input
                autoFocus
                required
                maxLength={160}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="form-row">
              Prazo
              <Input
                required
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
            <label className="form-row">
              Etapa
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
              >
                {TASK_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row span2">
              Responsável
              <select
                value={session.role === 'manager' ? form.ownerId : session.memberId}
                disabled={session.role !== 'manager'}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row span2">
              Contato relacionado
              <select
                value={form.contactId}
                onChange={(e) => setForm({ ...form, contactId: e.target.value })}
              >
                <option value="">Sem contato</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <FormError message={error} />
          <FormActions onCancel={() => setOpen(false)} />
        </form>
      </Modal>
    </>
  );
}
