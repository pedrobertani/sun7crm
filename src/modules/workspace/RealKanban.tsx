import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  SlidersHorizontal,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  History,
  Clock3,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Input } from '../../components/ui/input';
import { CurrencyInput } from '../../components/currency-input';
import { Empty, FormError, SearchInput } from '../../components/shared';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import type {
  BoardRow,
  CardRow,
  StageRow,
  ContactRow,
  LabelRow,
  CatalogRow,
} from '../../data/backend';
import { currency, uid } from '../../lib/format';
import { useCardDrag } from '../../hooks/useCardDrag';
import { useStageDrag } from '../../hooks/useStageDrag';
import { RecordTitle } from '../../components/RecordTitle';
import { RealContactHistory } from '../contacts/RealContactHistory';
import { RecordPicker } from './RecordPicker';
import { CatalogDialog, ContactDialog, LabelDialog } from './RecordForms';
import {
  cents,
  datetimeLocal,
  fromLocal,
  Pager,
  QueryState,
  SaveActions,
  useOperational,
  useQuery,
  useSave,
} from './operational';

export function removedStageTarget(
  original: StageRow[],
  next: { id: string; name: string }[],
  removedId: string,
) {
  const index = original.findIndex((s) => s.id === removedId),
    prior = original
      .slice(0, index)
      .reverse()
      .find((s) => next.some((n) => n.id === s.id)),
    fallback = original.find((s) => next.some((n) => n.id === s.id));
  return next.find((n) => n.id === (prior || fallback)?.id) || next[0];
}
export function RealKanban() {
  const { api, company, can, refresh, notice } = useOperational(),
    manager =
      can('boards.edit') || ['create', 'edit', 'delete', 'reorder'].some((a) => can('stages.' + a)),
    writable = can('cards.edit');
  const [params, setParams] = useSearchParams(),
    boardId = params.get('funil') || '',
    contactId = params.get('contato') || '',
    cardId = params.get('card') || '';
  const [page, setPage] = useState(0),
    [search, setSearch] = useState(''),
    [editing, setEditing] = useState<CardRow | 'new' | null>(null),
    [deleting, setDeleting] = useState<CardRow | null>(null),
    [newBoard, setNewBoard] = useState(false),
    [stagesOpen, setStagesOpen] = useState(false),
    [history, setHistory] = useState<{ contact: ContactRow; cardId: string } | null>(null);
  const refs = useQuery(async () => {
    const [boards, stages, labels] = await Promise.all([
      api.all('boards'),
      api.all('stages'),
      api.all('labels'),
    ]);
    return { boards: boards.sort((a, b) => a.position - b.position), stages, labels };
  }, [api]);
  const board = refs.data?.boards.find((b) => b.id === boardId) || refs.data?.boards[0],
    stages =
      refs.data?.stages
        .filter((s) => s.board_id === board?.id)
        .sort((a, b) => a.position - b.position) || [];
  const cards = useQuery(async () => {
    if (!board) return null;
    const list = await api.list(
      'cards',
      page,
      50,
      { board_id: board.id, ...(contactId ? { contact_id: contactId } : {}) },
      search,
    );
    const [contacts, activity, labels] = await Promise.all([
      api.contactsByIds(list.rows.map((c) => c.contact_id)),
      api.activityByIds(list.rows.map((c) => c.id)),
      api.labelsByCardIds(list.rows.map((c) => c.id)),
    ]);
    return { ...list, contacts, activity, labels };
  }, [api, board?.id, page, search, contactId]);
  const deepLink = useQuery(async () => (cardId ? api.cardDetails(cardId) : null), [api, cardId]);
  useEffect(() => {
    if (deepLink.data) {
      setEditing(deepLink.data);
      if (deepLink.data.board_id !== boardId) {
        setParams(
          (p) => {
            p.set('funil', deepLink.data!.board_id);
            return p;
          },
          { replace: true },
        );
      }
    }
  }, [deepLink.data, boardId, setParams]);
  function closeCard() {
    setEditing(null);
    if (cardId)
      setParams(
        (p) => {
          p.delete('card');
          return p;
        },
        { replace: true },
      );
  }
  const moving = useSave();
  async function move(id: string, stage: string) {
    const card = cards.data?.rows.find((c) => c.id === id);
    if (!card || !writable || card.stage_id === stage) return;
    await moving.run(async () => {
      await api.saveCard({ stage_id: stage }, card.id, card.row_version);
      refresh();
      notice('Card movido. A alteração foi registrada no histórico.');
    });
  }
  const startDrag = useCardDrag((id, stage) => void move(id, stage));
  return (
    <>
      <QueryState query={refs} />
      {cardId && <QueryState query={deepLink} />}
      <FormError message={moving.error} />
      {moving.uncertain && (
        <Button
          variant="outline"
          onClick={() => {
            moving.reset();
            refresh();
          }}
        >
          Conferir e recarregar o funil
        </Button>
      )}
      {contactId && (
        <div className="applied-filter">
          <span>Cards do contato selecionado</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setParams((p) => {
                p.delete('contato');
                return p;
              });
              setPage(0);
            }}
          >
            Limpar filtro de contato
          </Button>
        </div>
      )}
      {refs.data && (
        <>
          <div className="section-bar operational-toolbar">
            <div className="tabs" aria-label="Funis">
              {refs.data.boards.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={b.id === board?.id ? 'active' : ''}
                  onClick={() => {
                    setParams({ funil: b.id, ...(contactId ? { contato: contactId } : {}) });
                    setPage(0);
                  }}
                >
                  {b.name}
                </button>
              ))}
              {can('boards.create') && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Adicionar funil"
                  onClick={() => setNewBoard(true)}
                >
                  <Plus size={16} />
                </Button>
              )}
            </div>
            <div className="actions">
              {manager && board && (
                <Button variant="outline" onClick={() => setStagesOpen(true)}>
                  <SlidersHorizontal size={16} />
                  Personalizar etapas
                </Button>
              )}
              {can('cards.create') && board && (
                <Button onClick={() => setEditing('new')}>
                  <Plus size={16} />
                  Novo card
                </Button>
              )}
            </div>
          </div>
          {board ? (
            <>
              <div className="operational-toolbar">
                <SearchInput
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    setPage(0);
                  }}
                  placeholder="Buscar pelo título do card..."
                />
                <p className="small-note">
                  Alertas fixos: 24h sem primeiro acompanhamento · 3 dias para o responsável · 7
                  dias para o gestor.
                </p>
              </div>
              <QueryState query={cards} />
              {cards.data && (
                <>
                  <div className="kanban-scroll" aria-busy={moving.busy || cards.loading}>
                    {stages.map((stage) => (
                      <section className="kanban-column" data-drop-stage={stage.id} key={stage.id}>
                        <div className="kanban-column-head">
                          <h2>{stage.name}</h2>
                          <span>
                            {cards.data!.rows.filter((c) => c.stage_id === stage.id).length} nesta
                            página
                          </span>
                        </div>
                        <div className="kanban-cards">
                          {cards
                            .data!.rows.filter((c) => c.stage_id === stage.id)
                            .map((card) => {
                              const contact = cards.data!.contacts.find(
                                  (c) => c.id === card.contact_id,
                                ),
                                activity = cards.data!.activity.find(
                                  (a) => a.opportunity_id === card.id,
                                ),
                                badge =
                                  activity &&
                                  !activity.is_closed &&
                                  (!activity.follow_up_at ||
                                    new Date(activity.follow_up_at) <= new Date())
                                    ? activity.days_without_activity >= 7
                                      ? 'Gestão: ' +
                                        activity.days_without_activity +
                                        ' dias sem atividade'
                                      : activity.days_without_activity >= 3
                                        ? activity.days_without_activity + ' dias sem atividade'
                                        : !activity.first_activity_at &&
                                            activity.hours_without_activity >= 24
                                          ? 'Aguardando primeiro acompanhamento'
                                          : ''
                                    : '';
                              return (
                                <article className="opportunity-card" key={card.id}>
                                  <div className="operational-card-title">
                                    {writable && (
                                      <button
                                        className="card-drag-handle icon-button"
                                        type="button"
                                        disabled={moving.busy || moving.uncertain}
                                        aria-label={
                                          'Arrastar ' + (card.title || contact?.name || 'card')
                                        }
                                        onPointerDown={(e) => startDrag(e, card.id, card.stage_id)}
                                      >
                                        <GripVertical size={16} />
                                      </button>
                                    )}
                                    <RecordTitle
                                      title={card.title || contact?.name || 'Oportunidade'}
                                      onOpen={() => setEditing(card)}
                                    />
                                    {can('cards.delete') && (
                                      <button
                                        type="button"
                                        className="icon-button"
                                        aria-label={
                                          'Excluir ' + (card.title || contact?.name || 'card')
                                        }
                                        onClick={() => setDeleting(card)}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                    {writable && (
                                      <button
                                        className="icon-button"
                                        aria-label={
                                          'Editar ' + (card.title || contact?.name || 'card')
                                        }
                                        onClick={() => setEditing(card)}
                                      >
                                        <Pencil size={15} />
                                      </button>
                                    )}
                                  </div>
                                  <p>{contact?.name || 'Contato indisponível'}</p>
                                  <div className="card-value">{currency(card.value_cents)}</div>
                                  <small className="muted">
                                    {activity?.owner_name || 'Responsável do contato'}
                                  </small>
                                  {card.is_closed ? (
                                    <span className="badge">Encerrado</span>
                                  ) : badge ? (
                                    <span className="operational-idle">
                                      <Clock3 size={13} />
                                      {badge}
                                    </span>
                                  ) : null}
                                  <div className="operational-card-labels">
                                    {cards
                                      .data!.labels.filter((x) => x.opportunity_id === card.id)
                                      .map((x) => {
                                        const label = refs.data!.labels.find(
                                          (l) => l.id === x.label_id,
                                        );
                                        return label ? (
                                          <span className="catalog-selection-chip" key={label.id}>
                                            <i
                                              className="label-color-dot"
                                              style={{ background: label.color }}
                                            />
                                            {label.name}
                                          </span>
                                        ) : null;
                                      })}
                                  </div>
                                  {contact && (
                                    <div className="operational-card-actions">
                                      <WhatsAppButton
                                        disabled={!can('history.whatsapp')}
                                        compact
                                        name={contact.name}
                                        phone={contact.phone}
                                        onOpen={() =>
                                          void api
                                            .recordCardWhatsapp(contact.id, card.id)
                                            .then(() => {
                                              refresh();
                                              notice('Acionamento do WhatsApp registrado.');
                                            })
                                            .catch((e) => notice(e.message))
                                        }
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!can('history.view')}
                                        onClick={() => setHistory({ contact, cardId: card.id })}
                                      >
                                        <History size={15} />
                                        Histórico
                                      </Button>
                                    </div>
                                  )}
                                  {writable && (
                                    <label className="operational-move-label">
                                      Mover para
                                      <select
                                        aria-label={
                                          'Mover ' +
                                          (card.title || contact?.name || 'card') +
                                          ' para etapa'
                                        }
                                        disabled={moving.busy || moving.uncertain}
                                        value={card.stage_id}
                                        onChange={(e) => void move(card.id, e.target.value)}
                                      >
                                        {stages.map((s) => (
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
                          {!cards.data!.rows.some((c) => c.stage_id === stage.id) && (
                            <p className="kanban-empty">Nenhum card nesta página.</p>
                          )}
                        </div>
                      </section>
                    ))}
                  </div>
                  <Pager
                    page={page}
                    total={cards.data.total}
                    onChange={setPage}
                    loading={cards.loading}
                  />
                </>
              )}
            </>
          ) : (
            <Empty
              title="Nenhum funil disponível"
              description="O gestor pode criar um funil para organizar os atendimentos."
            />
          )}
        </>
      )}
      {newBoard && (
        <NewBoard
          onClose={() => setNewBoard(false)}
          onSaved={(b) => {
            setNewBoard(false);
            setParams({ funil: b.id });
            refresh();
            notice('Funil criado.');
          }}
        />
      )}
      {stagesOpen && board && (
        <StageEditor
          board={board}
          stages={stages}
          onClose={() => setStagesOpen(false)}
          onSaved={() => {
            setStagesOpen(false);
            refresh();
            notice('Etapas atualizadas.');
          }}
        />
      )}
      {editing && board && (
        <CardDialog
          card={editing === 'new' ? undefined : editing}
          boardId={board.id}
          onClose={closeCard}
          onSaved={() => {
            closeCard();
            refresh();
            notice('Card salvo.');
          }}
        />
      )}
      {deleting && (
        <DeleteCardDialog
          card={deleting}
          onClose={() => setDeleting(null)}
          onSaved={() => {
            setDeleting(null);
            refresh();
            notice('Card excluído. O histórico foi preservado.');
          }}
        />
      )}
      {history && (
        <RealContactHistory
          key={history.cardId}
          companyId={company.id}
          contact={history.contact}
          cardId={history.cardId}
          canAdd={can('history.create')}
          canWhatsapp={can('history.whatsapp')}
          onClose={() => setHistory(null)}
        />
      )}
    </>
  );
}
function NewBoard({ onClose, onSaved }: { onClose: () => void; onSaved: (b: BoardRow) => void }) {
  const { api } = useOperational(),
    save = useSave(),
    [name, setName] = useState('');
  return (
    <Modal open title="Adicionar funil" onOpenChange={(v) => !v && !save.busy && onClose()}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => onSaved(await api.createBoard(name.trim())));
        }}
      >
        <label className="form-row">
          Nome do funil
          <Input
            autoFocus
            required
            maxLength={100}
            value={name}
            disabled={save.busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <SaveActions save={save} onClose={onClose} label="Criar funil" />
      </form>
    </Modal>
  );
}
function StageEditor({
  board,
  stages,
  onClose,
  onSaved,
}: {
  board: BoardRow;
  stages: StageRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api, can } = useOperational(),
    save = useSave(),
    [name, setName] = useState(board.name),
    [items, setItems] = useState(stages.map((s) => ({ id: s.id, name: s.name }))),
    [remove, setRemove] = useState('');
  function reorder(from: number, to: number) {
    if (!can('stages.reorder') || from === to || to < 0 || to >= items.length) return;
    setItems((old) => {
      const next = [...old];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }
  const drag = useStageDrag(reorder),
    removed = stages.filter((s) => !items.some((i) => i.id === s.id));
  return (
    <Modal
      open
      title="Personalizar etapas"
      description="Arraste as alças ou use as setas. Cada funil pode ter de 1 a 10 etapas."
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            if (new Set(items.map((s) => s.name.trim().toLocaleLowerCase())).size !== items.length)
              throw Error('As etapas precisam ter nomes diferentes.');
            await api.configureBoard(
              board.id,
              name.trim(),
              items.map((s) => ({ ...s, name: s.name.trim() })),
              board.row_version,
            );
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Nome do funil
            <Input
              required
              maxLength={100}
              disabled={!can('boards.edit')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="stage-list">
            {items.map((s, index) => (
              <div className="stage-item operational-stage-row" key={s.id} data-stage-index={index}>
                <button
                  type="button"
                  className="icon-button stage-drag-handle"
                  aria-label={'Arrastar etapa ' + s.name}
                  onPointerDown={(e) => drag(e, index)}
                >
                  <GripVertical size={18} />
                </button>
                <Input
                  required
                  maxLength={50}
                  aria-label={'Nome da etapa ' + (index + 1)}
                  disabled={!can('stages.edit') && stages.some((old) => old.id === s.id)}
                  value={s.name}
                  onChange={(e) =>
                    setItems((old) =>
                      old.map((i) => (i.id === s.id ? { ...i, name: e.target.value } : i)),
                    )
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={'Subir ' + s.name}
                  disabled={!can('stages.reorder') || !index}
                  onClick={() => reorder(index, index - 1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={'Descer ' + s.name}
                  disabled={!can('stages.reorder') || index === items.length - 1}
                  onClick={() => reorder(index, index + 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={'Excluir etapa ' + s.name}
                  disabled={!can('stages.delete') || items.length === 1}
                  onClick={() => setRemove(s.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={!can('stages.create') || items.length >= 10}
            onClick={() => setItems([...items, { id: uid(), name: '' }])}
          >
            <Plus size={16} />
            Adicionar etapa ({items.length}/10)
          </Button>
          {removed.length > 0 && (
            <div className="operational-transfer-review">
              <strong>Ao salvar, os cards serão transferidos:</strong>
              {removed.map((s) => (
                <p key={s.id}>
                  {s.name} → {removedStageTarget(stages, items, s.id)?.name || 'Primeira etapa'}
                </p>
              ))}
            </div>
          )}
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
      {remove && (
        <Modal
          open
          title="Excluir esta etapa?"
          description="Os cards voltam para a etapa anterior disponível. Quando for a primeira, seguem para a próxima. A alteração é aplicada ao salvar."
          onOpenChange={(v) => !v && setRemove('')}
        >
          <p>
            Etapa: <strong>{items.find((i) => i.id === remove)?.name || 'Sem nome'}</strong>
          </p>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setRemove('')}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setItems(items.filter((i) => i.id !== remove));
                setRemove('');
              }}
            >
              Confirmar exclusão
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
export function CardDialog({
  card,
  boardId,
  onClose,
  onSaved,
}: {
  card?: CardRow;
  boardId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave();
  const details = useQuery(async () => {
    const [boards, stages, labels, catalog, strategies, full] = await Promise.all([
      api.all('boards'),
      api.all('stages'),
      api.all('labels'),
      api.all('catalog'),
      api.all('strategies'),
      card ? api.cardDetails(card.id) : Promise.resolve(null),
    ]);
    const contact = full ? await api.get('contacts', full.contact_id) : null;
    return { boards, stages, labels, catalog, strategies, card: full, contact };
  }, [api, card?.id]);
  return (
    <Modal
      open
      title={card ? 'Editar card' : 'Novo card'}
      description="Uma pessoa pode ter vários cards. O acompanhamento é registrado separadamente em cada um."
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <QueryState query={details} />
      {details.data && (
        <CardFields
          data={details.data}
          boardId={boardId}
          onClose={onClose}
          onSaved={onSaved}
          save={save}
        />
      )}
    </Modal>
  );
}
function CardFields({
  data,
  boardId,
  onClose,
  onSaved,
  save,
}: {
  data: {
    boards: BoardRow[];
    stages: StageRow[];
    labels: LabelRow[];
    catalog: CatalogRow[];
    strategies: import('../../data/backend').StrategyRow[];
    card: CardRow | null;
    contact: ContactRow | null;
  };
  boardId: string;
  onClose: () => void;
  onSaved: () => void;
  save: ReturnType<typeof useSave>;
}) {
  const { api, can } = useOperational(),
    c = data.card,
    readOnly = !can(c ? 'cards.edit' : 'cards.create'),
    initialBoard = c?.board_id || boardId;
  const [form, setForm] = useState({
      contact_id: c?.contact_id || '',
      board_id: initialBoard,
      stage_id:
        c?.stage_id ||
        data.stages
          .filter((s) => s.board_id === initialBoard)
          .sort((a, b) => a.position - b.position)[0]?.id ||
        '',
      title: c?.title || '',
      price: ((c?.value_cents || 0) / 100).toFixed(2),
      strategy_id: c?.strategy_id || '',
      source: c?.source || '',
      follow_up_at: datetimeLocal(c?.follow_up_at || null),
      is_closed: c?.is_closed || false,
      label_ids: c?.label_ids || [],
      catalog_ids: c?.catalog_ids || [],
    }),
    [contacts, setContacts] = useState(data.contact ? [data.contact] : []),
    [labels, setLabels] = useState(data.labels),
    [catalog, setCatalog] = useState(data.catalog),
    [adding, setAdding] = useState<{ kind: 'contact' | 'label' | 'catalog'; name: string } | null>(
      null,
    );
  const stages = data.stages
    .filter((s) => s.board_id === form.board_id)
    .sort((a, b) => a.position - b.position);
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (readOnly) return;
          void save.run(async () => {
            if (!form.contact_id) throw Error('Selecione um contato.');
            const { price, ...values } = form;
            await api.saveCard(
              {
                ...values,
                value_cents: cents(price),
                strategy_id: form.strategy_id || null,
                follow_up_at: fromLocal(form.follow_up_at),
              },
              c?.id,
              c?.row_version,
            );
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={readOnly || save.busy || save.uncertain}>
          <RecordPicker
            label="Contato"
            items={contacts.map((c) => ({ id: c.id, label: c.name, detail: c.phone }))}
            value={form.contact_id ? [form.contact_id] : []}
            onChange={(ids) => setForm({ ...form, contact_id: ids[0] || '' })}
            load={async (search, page) => {
              const r = await api.list('contacts', page, 25, {}, search);
              setContacts((old) => [
                ...old,
                ...r.rows.filter((c) => !old.some((x) => x.id === c.id)),
              ]);
              return {
                ...r,
                rows: r.rows.map((c) => ({ id: c.id, label: c.name, detail: c.phone })),
              };
            }}
            onCreate={
              can('contacts.create') ? (name) => setAdding({ kind: 'contact', name }) : undefined
            }
            createLabel="Cadastrar novo contato"
          />
          <label className="form-row">
            Título da oportunidade
            <Input
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="form-row">
              Funil
              <select
                value={form.board_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    board_id: e.target.value,
                    stage_id:
                      data.stages
                        .filter((s) => s.board_id === e.target.value)
                        .sort((a, b) => a.position - b.position)[0]?.id || '',
                  })
                }
              >
                {data.boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Etapa
              <select
                required
                value={form.stage_id}
                onChange={(e) => setForm({ ...form, stage_id: e.target.value })}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Valor estimado (R$)
              <CurrencyInput
                required
                value={form.price}
                onValueChange={(price) => setForm({ ...form, price })}
              />
            </label>
            <label className="form-row">
              Estratégia de origem
              <select
                value={form.strategy_id}
                onChange={(e) => setForm({ ...form, strategy_id: e.target.value })}
              >
                <option value="">Sem estratégia</option>
                {data.strategies
                  .filter((s) => s.active || s.id === form.strategy_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {!s.active ? ' · Inativa' : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <RecordPicker
            label="Etiquetas"
            multiple
            max={3}
            items={labels.map((l) => ({
              id: l.id,
              label: l.name,
              color: l.color,
              disabled: !l.active,
            }))}
            value={form.label_ids}
            onChange={(label_ids) => setForm({ ...form, label_ids })}
            onCreate={
              can('labels.create') ? (name) => setAdding({ kind: 'label', name }) : undefined
            }
            createLabel="Cadastrar nova etiqueta"
          />
          <RecordPicker
            label="Serviços e produtos de interesse"
            multiple
            items={catalog.map((i) => ({
              id: i.id,
              label: i.name,
              detail: currency(i.value_cents) + (!i.active ? ' · Inativo' : ''),
              disabled: !i.active,
            }))}
            value={form.catalog_ids}
            onChange={(catalog_ids) => setForm({ ...form, catalog_ids })}
            onCreate={
              can('catalog.create') ? (name) => setAdding({ kind: 'catalog', name }) : undefined
            }
            createLabel="Cadastrar serviço ou produto"
          />
          <label className="form-row">
            Origem / observação da oportunidade
            <Input
              maxLength={255}
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
            />
          </label>
          <label className="form-row">
            Próximo retorno combinado (horário de Brasília)
            <Input
              type="datetime-local"
              value={form.follow_up_at}
              onChange={(e) => setForm({ ...form, follow_up_at: e.target.value })}
            />
          </label>
          <label className="operational-check">
            <input
              type="checkbox"
              checked={form.is_closed}
              onChange={(e) => setForm({ ...form, is_closed: e.target.checked })}
            />
            Card encerrado
          </label>
          <p className="small-note">
            Cards encerrados e retornos futuros ficam fora dos alertas. Mudar de etapa registra a
            movimentação no histórico.
          </p>
        </fieldset>
        {readOnly ? (
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : (
          <SaveActions save={save} onClose={onClose} label="Salvar card" />
        )}
      </form>
      {adding?.kind === 'contact' && (
        <ContactDialog
          name={adding.name}
          onClose={() => setAdding(null)}
          onSaved={(row) => {
            setContacts((old) => [...old, row]);
            setForm((f) => ({ ...f, contact_id: row.id }));
            setAdding(null);
          }}
        />
      )}
      {adding?.kind === 'label' && (
        <LabelDialog
          name={adding.name}
          onClose={() => setAdding(null)}
          onSaved={(row) => {
            setLabels((old) => [...old, row]);
            setForm((f) => ({ ...f, label_ids: [...f.label_ids, row.id] }));
            setAdding(null);
          }}
        />
      )}
      {adding?.kind === 'catalog' && (
        <CatalogDialog
          name={adding.name}
          onClose={() => setAdding(null)}
          onSaved={(row) => {
            setCatalog((old) => [...old, row]);
            setForm((f) => ({ ...f, catalog_ids: [...f.catalog_ids, row.id] }));
            setAdding(null);
          }}
        />
      )}
    </>
  );
}

function DeleteCardDialog({
  card,
  onClose,
  onSaved,
}: {
  card: CardRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave();
  return (
    <Modal
      open
      title="Excluir card?"
      description="O card sairá do funil e o histórico de atendimento será preservado."
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            await api.deleteCard(card.id, card.row_version);
            onSaved();
          });
        }}
      >
        <p>{card.title || 'Card selecionado'}</p>
        <SaveActions save={save} onClose={onClose} label="Confirmar exclusão" />
      </form>
    </Modal>
  );
}
