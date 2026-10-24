import { useCardDrag } from '../../hooks/useCardDrag';
import { readPeriod, inPeriod } from '../../domain/filters';
import { dateLabel } from '../../lib/format';
import { Input } from '../../components/ui/input';
import { useState, type FormEvent } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  Plus,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Pencil,
  LayoutGrid,
  Users,
} from 'lucide-react';
import { useCrm } from '../../app/context';
import {
  visibleContacts,
  moveOpportunity,
  addStage,
  removeStage,
  stageNameError,
} from '../../domain/operations';
import { currency, initials, uid } from '../../lib/format';
import type { BoardKind, Opportunity } from '../../domain/types';
import {
  Heading,
  AppliedFilter,
  SearchInput,
  TemperatureBadge,
  Empty,
  FormError,
  FormActions,
} from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
export function Kanban() {
  const { kind } = useParams();
  const [params, setParams] = useSearchParams();
  const period = readPeriod(params);
  const boardKind: BoardKind = kind === 'clients' ? 'clients' : 'leads';
  const { data, session, update, notice } = useCrm();
  const board = data.boards.find((b) => b.companyId === session.companyId && b.kind === boardKind)!;
  const [query, setQuery] = useState('');
  const [managing, setManaging] = useState(false);
  const [stageName, setStageName] = useState('');
  const [renaming, setRenaming] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const contacts = visibleContacts(data, session);
  const opps = data.opportunities
    .filter(
      (o) =>
        inPeriod(o.createdAt, period) &&
        o.boardId === board.id &&
        contacts.some((c) => c.id === o.contactId),
    )
    .filter((o) =>
      contacts
        .find((c) => c.id === o.contactId)
        ?.name.toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    );
  const manager = session.role === 'manager';
  const movable = manager || session.role === 'seller';
  function move(id: string, stage: string) {
    if (update((d) => moveOpportunity(d, session, id, stage))) notice('Oportunidade movida.');
  }
  const startDrag = useCardDrag(move);
  function saveStage(e: FormEvent) {
    e.preventDefault();
    const err = stageNameError(board.stages, stageName, renaming);
    if (err) {
      setError(err);
      return;
    }
    try {
      const next = renaming
        ? {
            ...board,
            stages: board.stages.map((s) =>
              s.id === renaming ? { ...s, name: stageName.trim() } : s,
            ),
          }
        : addStage(board, { id: uid(), name: stageName });
      if (update((d) => ({ ...d, boards: d.boards.map((b) => (b.id === board.id ? next : b)) }))) {
        setStageName('');
        setRenaming('');
        setError('');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function reorder(index: number, delta: number) {
    const stages = [...board.stages];
    [stages[index], stages[index + delta]] = [stages[index + delta], stages[index]];
    update((d) => ({
      ...d,
      boards: d.boards.map((b) => (b.id === board.id ? { ...b, stages } : b)),
    }));
  }
  function deleteStage(e: FormEvent) {
    e.preventDefault();
    try {
      const result = removeStage(board, data.opportunities, deleteId, targetId);
      if (
        update((d) => ({
          ...d,
          boards: d.boards.map((b) => (b.id === board.id ? result.board : b)),
          opportunities: result.opportunities,
        }))
      ) {
        setDeleteId('');
        notice('Etapa removida; cartões transferidos.');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ÁREA COMERCIAL"
        title={boardKind === 'leads' ? 'Funil de leads' : 'Funil de clientes'}
        description={
          boardKind === 'leads'
            ? 'Cada conversa no lugar certo. Acompanhe as oportunidades da sua equipe.'
            : 'Continue o relacionamento com quem já é cliente e acompanhe novas oportunidades.'
        }
      >
        {manager && (
          <Button
            variant="outline"
            onClick={() => {
              setManaging(true);
              setError('');
              setRenaming('');
              setStageName('');
            }}
          >
            <SlidersHorizontal size={16} />
            Editar etapas
          </Button>
        )}
        <Button asChild>
          <Link to="/demo/contatos">
            <Plus size={16} />
            Novo contato
          </Link>
        </Button>
      </Heading>
      {(period.from || period.to) && (
        <AppliedFilter
          label={`Oportunidades criadas de ${period.from ? dateLabel(period.from) : 'qualquer data'} até ${period.to ? dateLabel(period.to) : 'hoje'}`}
          onClear={() => setParams({})}
        />
      )}
      <div className="kanban-toolbar">
        <div className="segmented">
          <Link
            className={boardKind === 'leads' ? 'active' : ''}
            to={'/demo/funil/leads' + (params.toString() ? '?' + params.toString() : '')}
          >
            <LayoutGrid size={15} />
            Leads
          </Link>
          <Link
            className={boardKind === 'clients' ? 'active' : ''}
            to={'/demo/funil/clients' + (params.toString() ? '?' + params.toString() : '')}
          >
            <Users size={15} />
            Clientes
          </Link>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar no quadro" />
        <span className="muted result-count">
          {opps.length} oportunidades · {currency(opps.reduce((s, o) => s + o.value, 0))}
        </span>
      </div>
      <div className="kanban-scroll" key={board.id}>
        <div className="kanban-board">
          {board.stages.map((stage, i) => {
            const rows = opps.filter((o) => o.stageId === stage.id);
            return (
              <section
                key={stage.id}
                aria-label={'Etapa ' + stage.name}
                className="kanban-column"
                data-drop-stage={stage.id}
              >
                <div className="column-head">
                  <div>
                    <span className={'stage-dot tone-' + (i % 4)} />
                    <h2>{stage.name}</h2>
                    <span className="stage-count">{rows.length}</span>
                  </div>
                  <small>{currency(rows.reduce((s, o) => s + o.value, 0))}</small>
                </div>
                <div className="column-body">
                  {rows.map((o) => {
                    const c = contacts.find((c) => c.id === o.contactId)!;
                    return (
                      <article key={o.id} className="opportunity-card" draggable={false}>
                        <div className="opportunity-top">
                          <TemperatureBadge value={c.temperature} />
                          {movable && (
                            <button
                              type="button"
                              className="card-drag-handle"
                              aria-label={'Arrastar ' + c.name}
                              title="Arrastar para outra etapa"
                              onPointerDown={(e) => startDrag(e, o.id, stage.id)}
                              onContextMenu={(e) => e.preventDefault()}
                            >
                              <GripVertical size={18} />
                            </button>
                          )}
                        </div>
                        <button className="contact-link" onClick={() => setSelected(o)}>
                          {c.name}
                        </button>
                        <p>{c.interests || 'Interesse a definir'}</p>
                        <strong className="opportunity-value">{currency(o.value)}</strong>
                        <div className="opportunity-footer">
                          <span className="badge gray">{o.source}</span>
                          <span
                            className="mini-avatar"
                            title={data.members.find((m) => m.id === c.ownerId)?.name}
                          >
                            {initials(
                              data.members.find((m) => m.id === c.ownerId)?.name ||
                                'Sem responsável',
                            )}
                          </span>
                        </div>
                        {movable && (
                          <label className="move-select">
                            <span className="sr-only">Mover {c.name}</span>
                            <select
                              aria-label={'Mover ' + c.name}
                              value={stage.id}
                              onChange={(e) => move(o.id, e.target.value)}
                            >
                              {board.stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </article>
                    );
                  })}
                  {!rows.length && (
                    <div className="column-empty">
                      {movable
                        ? 'Arraste uma oportunidade para cá'
                        : 'Nenhuma oportunidade nesta etapa'}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <p className="small-note">
        Etapas e movimentações desta prévia não disparam mensagens, vendas ou automações.
      </p>
      <Modal
        open={managing}
        onOpenChange={setManaging}
        title="Personalizar etapas"
        description="Nomes e ordem editáveis. Limite provisório: 10 etapas por quadro."
      >
        <div className="stage-list">
          {board.stages.map((s, i) => (
            <div key={s.id} className="stage-row">
              <span className="stage-position">{i + 1}</span>
              <strong>{s.name}</strong>
              <div className="actions">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === 0}
                  aria-label={'Mover ' + s.name + ' para esquerda'}
                  onClick={() => reorder(i, -1)}
                >
                  <ArrowLeft size={15} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={i === board.stages.length - 1}
                  aria-label={'Mover ' + s.name + ' para direita'}
                  onClick={() => reorder(i, 1)}
                >
                  <ArrowRight size={15} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={'Renomear ' + s.name}
                  onClick={() => {
                    setRenaming(s.id);
                    setStageName(s.name);
                    setError('');
                  }}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={board.stages.length === 1}
                  aria-label={'Excluir ' + s.name}
                  onClick={() => {
                    setDeleteId(s.id);
                    setTargetId(board.stages.find((t) => t.id !== s.id)?.id || '');
                    setError('');
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={saveStage}>
          <label className="form-row">
            {renaming ? 'Novo nome da etapa' : 'Adicionar etapa'}
            <Input
              required
              maxLength={50}
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="Ex.: Em negociação"
            />
          </label>
          <FormError message={error} />
          <div className="form-actions">
            {renaming && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setRenaming('');
                  setStageName('');
                }}
              >
                Cancelar edição
              </Button>
            )}
            <Button disabled={!renaming && board.stages.length >= 10}>
              {renaming ? 'Salvar nome' : 'Adicionar etapa'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!deleteId}
        onOpenChange={(v) => !v && setDeleteId('')}
        title="Remover etapa"
        description="Escolha para onde transferir os cartões desta etapa."
      >
        <form onSubmit={deleteStage}>
          <label className="form-row">
            Etapa de destino
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              {board.stages
                .filter((s) => s.id !== deleteId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <FormError message={error} />
          <FormActions onCancel={() => setDeleteId('')} label="Transferir e remover" />
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        title="Detalhes da oportunidade"
      >
        {selected &&
          (() => {
            const c = contacts.find((c) => c.id === selected.contactId);
            return c ? (
              <>
                <div className="detail-person">
                  <span className="avatar">{initials(c.name)}</span>
                  <div>
                    <h3>{c.name}</h3>
                    <p className="muted">{c.interests}</p>
                  </div>
                </div>
                <div className="detail-grid">
                  <div>
                    <small>Valor estimado</small>
                    <strong>{currency(selected.value)}</strong>
                  </div>
                  <div>
                    <small>Origem</small>
                    <strong>{selected.source}</strong>
                  </div>
                  <div>
                    <small>Temperatura</small>
                    <TemperatureBadge value={c.temperature} />
                  </div>
                  <div>
                    <small>Responsável</small>
                    <strong>
                      {data.members.find((m) => m.id === c.ownerId)?.name || 'Não definido'}
                    </strong>
                  </div>
                </div>
                <p className="small-note">{c.notes || 'Sem observações adicionais.'}</p>
                <Button asChild variant="outline">
                  <Link to="/demo/contatos">Abrir contatos</Link>
                </Button>
              </>
            ) : (
              <Empty title="Contato indisponível" description="Confira a empresa selecionada." />
            );
          })()}
      </Modal>
    </>
  );
}
