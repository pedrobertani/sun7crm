import { useCardDrag } from '../../hooks/useCardDrag';
import { useSearchParams } from 'react-router-dom';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import {
  Plus,
  CalendarDays,
  Check,
  Circle,
  List,
  KanbanSquare,
  GripVertical,
  UserRound,
} from 'lucide-react';
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
  }
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
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
    setForm({ title: '', dueDate: today(), contactId: '', ownerId: session.memberId, status });
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
    if (
      update((d) => ({
        ...d,
        tasks: [
          {
            ...form,
            title: form.title.trim(),
            ownerId: session.role === 'manager' ? form.ownerId : session.memberId,
            id: uid(),
            companyId: session.companyId,
            done: form.status === 'done',
          },
          ...d.tasks,
        ],
      }))
    ) {
      setOpen(false);
      notice('Tarefa criada.');
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
        <div className="segmented" aria-label="Visualização das tarefas">
          <button
            className={view === 'quadro' ? 'active' : ''}
            aria-pressed={view === 'quadro'}
            onClick={() => changeParam('visualizacao', 'quadro')}
          >
            <KanbanSquare size={15} />
            Quadro Kanban
          </button>
          <button
            className={view === 'lista' ? 'active' : ''}
            aria-pressed={view === 'lista'}
            onClick={() => changeParam('visualizacao', 'lista')}
          >
            <List size={15} />
            Lista
          </button>
        </div>
        <span className="muted result-count">{tasks.length} tarefas</span>
      </div>
      <div className={view === 'lista' ? 'card' : 'tasks-board-area'}>
        <div className={'toolbar ' + (view === 'quadro' ? 'tasks-filterbar' : '')}>
          <div className="segmented">
            {[
              ['all', 'Todas'],
              ['pending', 'Pendentes'],
              ['overdue', 'Atrasadas'],
              ['done', 'Concluídas'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'active' : ''}
                onClick={() => changeParam('status', value)}
              >
                {label}
              </button>
            ))}
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar tarefa" />
        </div>
        {view === 'quadro' ? (
          <>
            <div className="kanban-scroll">
              <div className="tasks-kanban">
                {TASK_STAGES.map((stage, i) => {
                  const rows = tasks.filter((t) => taskStatus(t) === stage.id);
                  return (
                    <section
                      key={stage.id}
                      className="kanban-column"
                      aria-label={'Tarefas: ' + stage.label}
                      data-drop-stage={stage.id}
                    >
                      <div className="column-head">
                        <div>
                          <span className={'stage-dot tone-' + i} />
                          <h2>{stage.label}</h2>
                          <span className="stage-count">{rows.length}</span>
                        </div>
                      </div>
                      <div className="column-body">
                        {rows.map((t) => {
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
                                <strong>{t.title}</strong>
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
                    </section>
                  );
                })}
              </div>
            </div>
            <p className="small-note">
              Arraste as tarefas entre as etapas ou use o seletor de cada cartão. As visualizações
              compartilham os mesmos cadastros.
            </p>
          </>
        ) : tasks.length ? (
          <div className="task-list">
            {tasks.map((t) => (
              <div className={'task-row ' + (t.done ? 'done' : '')} key={t.id}>
                <button
                  className={'check-button ' + (t.done ? 'checked' : '')}
                  aria-label={(t.done ? 'Reabrir ' : 'Concluir ') + t.title}
                  onClick={() => move(t.id, t.done ? 'todo' : 'done')}
                >
                  {t.done ? <Check size={16} /> : <Circle size={19} />}
                </button>
                <div className="task-content">
                  <strong>{t.title}</strong>
                  <small>
                    {data.contacts.find((c) => c.id === t.contactId)?.name ||
                      'Sem contato vinculado'}{' '}
                    <span>·</span>{' '}
                    {members.find((m) => m.id === t.ownerId)?.name || 'Sem responsável'}
                  </small>
                </div>
                <span
                  className={
                    'badge ' + (t.done ? 'good' : taskStatus(t) === 'in_progress' ? 'warn' : 'gray')
                  }
                >
                  {TASK_STAGES.find((s) => s.id === taskStatus(t))?.label}
                </span>
                <span className={'task-date ' + (!t.done && t.dueDate < today() ? 'overdue' : '')}>
                  <CalendarDays size={14} />
                  {t.dueDate === today() ? 'Hoje' : dateLabel(t.dueDate)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Tudo em dia por aqui"
            description="Nenhuma tarefa para os filtros selecionados."
          />
        )}
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Nova tarefa"
        description="Cadastro manual. Cadências automáticas serão definidas em outra etapa."
      >
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
