import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { Plus, CalendarDays, Check, Circle } from 'lucide-react';
import { useCrm } from '../../app/context';
import { visibleContacts } from '../../domain/operations';
import { today, dateLabel, uid } from '../../lib/format';
import { Heading, SearchInput, Empty, FormActions, FormError } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
export function Tasks() {
  const { data, session, update, notice } = useCrm();
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    dueDate: today(),
    contactId: '',
    ownerId: session.memberId,
  });
  const contacts = visibleContacts(data, session);
  const members = data.members.filter((m) => m.companyId === session.companyId && m.active);
  const tasks = data.tasks
    .filter(
      (t) =>
        t.companyId === session.companyId &&
        (session.role === 'manager' || t.ownerId === session.memberId),
    )
    .filter(
      (t) =>
        filter === 'all' ||
        (filter === 'done'
          ? t.done
          : filter === 'overdue'
            ? !t.done && t.dueDate < today()
            : !t.done),
    )
    .filter((t) => t.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
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
            done: false,
          },
          ...d.tasks,
        ],
      }))
    ) {
      setOpen(false);
      notice('Tarefa criada.');
    }
  }
  return (
    <>
      <Heading
        eyebrow="ROTINA COMERCIAL"
        title="Tarefas"
        description="Organize as próximas ações e mantenha cada conversa em movimento."
      >
        <Button
          onClick={() => {
            setForm({ title: '', dueDate: today(), contactId: '', ownerId: session.memberId });
            setError('');
            setOpen(true);
          }}
        >
          <Plus size={16} />
          Nova tarefa
        </Button>
      </Heading>
      <div className="card">
        <div className="toolbar">
          <div className="segmented">
            {[
              ['pending', 'Pendentes'],
              ['overdue', 'Atrasadas'],
              ['done', 'Concluídas'],
              ['all', 'Todas'],
            ].map(([v, l]) => (
              <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
                {l}
              </button>
            ))}
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar tarefa" />
        </div>
        {tasks.length ? (
          <div className="task-list">
            {tasks.map((t) => (
              <div className={'task-row ' + (t.done ? 'done' : '')} key={t.id}>
                <button
                  className={'check-button ' + (t.done ? 'checked' : '')}
                  aria-label={(t.done ? 'Reabrir ' : 'Concluir ') + t.title}
                  onClick={() => {
                    if (
                      update((d) => ({
                        ...d,
                        tasks: d.tasks.map((item) =>
                          item.id === t.id ? { ...item, done: !item.done } : item,
                        ),
                      }))
                    )
                      notice(t.done ? 'Tarefa reaberta.' : 'Tarefa concluída.');
                  }}
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
