import { useStageDrag } from '../../hooks/useStageDrag';
import { RecordTitle } from '../../components/RecordTitle';
import { recordWhatsappOpen } from '../../domain/contact-history';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { DemoContactHistory } from '../contacts/ContactHistory';
import { History } from 'lucide-react';
import { LabelsPicker } from '../catalog/LabelsPicker';
import { CatalogPicker } from '../catalog/CatalogPicker';
import { ContactPicker } from '../contacts/ContactPicker';
import { saveCard } from '../../domain/operations';
import { useNavigate } from 'react-router-dom';
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
  Empty,
  FormError,
  FormActions,
} from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { ConfirmKanbanMove, type ConfirmedMove } from '../goals/ConfirmKanbanMove';
import { highImpactStage } from '../goals/stageOutcome';
export function Kanban() {
  const { kind } = useParams();
  const [params, setParams] = useSearchParams();
  const period = readPeriod(params);
  const navigate = useNavigate();
  const boardKind: BoardKind =
    kind === 'clients' ? 'clients' : kind === 'leads' ? 'leads' : 'custom';
  const { data, session, update, notice } = useCrm();
  const boards = data.boards.filter((b) => b.companyId === session.companyId);
  const board =
    boards.find((b) => b.id === kind || (b.kind !== 'custom' && b.kind === boardKind)) || boards[0];
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardEditing, setBoardEditing] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [draggedStage, setDraggedStage] = useState<number | null>(null);
  const [card, setCard] = useState<Opportunity | null>(null);
  const labels = (data.labels || []).filter((l) => l.companyId === session.companyId);
  const strategies = data.strategies.filter((s) => s.companyId === session.companyId);
  const [query, setQuery] = useState('');
  const [historyId, setHistoryId] = useState('');
  const [managing, setManaging] = useState(false);
  const [stageName, setStageName] = useState('');
  const [renaming, setRenaming] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [pendingMove,setPendingMove]=useState<{card:Opportunity;targetId:string;kind:'sale'|'other'}|null>(null);
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
    const source=data.opportunities.find(o=>o.id===id&&o.companyId===session.companyId);
    const dest=board.stages.find(s=>s.id===stage);
    if(!source||!dest||source.stageId===stage)return;
    const kind=highImpactStage(dest.name);
    if(kind){setPendingMove({card:source,targetId:stage,kind});return;}
    if (update((d) => moveOpportunity(d, session, id, stage))) notice('Oportunidade movida.');
  }
  function confirmMove(result:ConfirmedMove) {
    if(!pendingMove)return;
    const {card,targetId}=pendingMove;
    const moved=update(d=>{
      const now=moveOpportunity(d,session,card.id,targetId);
      return {...now,opportunities:now.opportunities.map(o=>o.id!==card.id?o:{
        ...o,
        confirmedSaleAt:result.confirmed?new Date().toISOString():undefined,
        confirmedSaleOwnerId:result.confirmed?data.contacts.find(c=>c.id===o.contactId)?.ownerId:undefined,
        confirmedSaleCents:result.confirmed?result.amountCents:undefined,
        value:result.confirmed?result.amountCents:o.value,
      })};
    });
    if(moved) { setPendingMove(null);notice(result.confirmed?'Venda confirmada e medalhas atualizadas.':'Card movido.'); }
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
  const startStageDrag = useStageDrag((from, to) => {
    const stages = [...board.stages];
    const [moved] = stages.splice(from, 1);
    stages.splice(to, 0, moved);
    update((d) => ({
      ...d,
      boards: d.boards.map((b) => (b.id === board.id ? { ...b, stages } : b)),
    }));
  });
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
        title="Funil"
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
        {manager && (
          <Button
            variant="outline"
            onClick={() => {
              setBoardEditing(true);
              setBoardName(board.name || (board.kind === 'clients' ? 'Clientes' : 'Leads'));
              setBoardOpen(true);
            }}
          >
            Renomear funil
          </Button>
        )}
        {movable && (
          <Button
            onClick={() => {
              setError('');
              setCard({
                id: uid(),
                companyId: session.companyId,
                contactId: '',
                boardId: board.id,
                stageId: board.stages[0].id,
                value: 0,
                source: '',
                title: '',
                createdAt: new Date().toISOString(),
                labelIds: [],
                catalogIds: [],
              });
            }}
          >
            <Plus size={16} />
            Novo card
          </Button>
        )}
      </Heading>
      {(period.from || period.to) && (
        <AppliedFilter
          label={`Oportunidades criadas de ${period.from ? dateLabel(period.from) : 'qualquer data'} até ${period.to ? dateLabel(period.to) : 'hoje'}`}
          onClear={() => setParams({})}
        />
      )}
      <div className="kanban-toolbar">
        <div className="segmented">
          {boards.map((b) => (
            <Link
              key={b.id}
              className={b.id === board.id ? 'active' : ''}
              to={'/demo/funil/' + (b.kind === 'custom' ? b.id : b.kind)}
            >
              <LayoutGrid size={15} />
              {b.name || (b.kind === 'clients' ? 'Clientes' : 'Leads')}
            </Link>
          ))}
          {manager && (
            <Button
              variant="ghost"
              aria-label="Adicionar funil"
              onClick={() => {
                setBoardEditing(false);
                setBoardName('');
                setBoardOpen(true);
              }}
            >
              <Plus size={16} />
            </Button>
          )}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Buscar no quadro" />
        <span className="muted result-count">
          {opps.length} oportunidades · {currency(opps.reduce((s, o) => s + o.value, 0))}
        </span>
      </div>
      <div className="kanban-scroll" key={board.id}>
        <div className="kanban-board">
          {board.stages.map((stage) => {
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
                    <span className="stage-dot" />
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
                          <div className="card-labels">
                            {(o.labelIds || [])
                              .map((id) => labels.find((l) => l.id === id))
                              .filter((l) => !!l)
                              .map((l) => (
                                <span
                                  key={l.id}
                                  className="badge"
                                  style={{ border: '1px solid ' + l.color, color: l.color }}
                                >
                                  {l.name}
                                </span>
                              ))}
                          </div>
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
                        <RecordTitle title={c.name} onOpen={() => setSelected(o)} />
                        <p>
                          <RecordTitle
                            title={o.title || c.interests || 'Oportunidade'}
                            onOpen={() => setSelected(o)}
                          />
                        </p>
                        <strong className="opportunity-value">{currency(o.value)}</strong>
                        <div className="opportunity-quick-actions">
                          <button
                            type="button"
                            aria-label={'Histórico de ' + c.name}
                            title="Histórico do cliente"
                            onClick={() => setHistoryId(c.id)}
                          >
                            <History size={17} />
                          </button>
                          <WhatsAppButton
                            phone={c.phone}
                            name={c.name}
                            onOpen={() => update((d) => recordWhatsappOpen(d, session, c.id))}
                            compact
                          />
                        </div>
                        <div className="opportunity-footer">
                          <span className="badge gray">
                            {strategies.find((s) => s.id === o.strategyId)?.name ||
                              o.source ||
                              'Sem estratégia'}
                          </span>
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
      {pendingMove && <ConfirmKanbanMove
        key={pendingMove.card.id+'-'+pendingMove.targetId}
        contactName={data.contacts.find(c=>c.id===pendingMove.card.contactId)?.name||'Cliente'}
        fromStage={board.stages.find(x=>x.id===pendingMove.card.stageId)?.name||'Etapa anterior'}
        toStage={board.stages.find(x=>x.id===pendingMove.targetId)?.name||'Conclusão'}
        kind={pendingMove.kind}
        amountCents={pendingMove.card.value}
        onCancel={()=>setPendingMove(null)}
        onConfirm={confirmMove}
      />}
      {historyId && <DemoContactHistory contactId={historyId} onClose={() => setHistoryId('')} />}
      <Modal
        open={managing}
        onOpenChange={setManaging}
        title="Personalizar etapas"
        description="Arraste para ordenar ou use as setas. Até 10 etapas por funil."
      >
        <div className="stage-list">
          {board.stages.map((s, i) => (
            <div
              key={s.id}
              className="stage-row"
              data-stage-index={i}
              draggable
              onDragStart={() => setDraggedStage(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedStage === null || draggedStage === i) return;
                const stages = [...board.stages];
                const [moved] = stages.splice(draggedStage, 1);
                stages.splice(i, 0, moved);
                update((d) => ({
                  ...d,
                  boards: d.boards.map((b) => (b.id === board.id ? { ...b, stages } : b)),
                }));
                setDraggedStage(null);
              }}
              onDragEnd={() => setDraggedStage(null)}
            >
              <button
                type="button"
                className="stage-drag-handle"
                aria-label={'Arrastar etapa ' + s.name}
                onPointerDown={(e) => startStageDrag(e, i)}
              >
                <GripVertical size={16} />
              </button>

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
                    setTargetId(board.stages[i > 0 ? i - 1 : 1]?.id || '');
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
        description="Os cards voltam uma etapa. Ao excluir a primeira, vão para a próxima. Deseja continuar?"
      >
        <form onSubmit={deleteStage}>
          <p>
            Os cards serão transferidos para{' '}
            <strong>{board.stages.find((s) => s.id === targetId)?.name}</strong>.
          </p>
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
                    <small>Estratégia</small>
                    <strong>
                      {strategies.find((s) => s.id === selected.strategyId)?.name ||
                        'Não informada'}
                    </strong>
                  </div>
                  <div>
                    <small>Responsável</small>
                    <strong>
                      {data.members.find((m) => m.id === c.ownerId)?.name || 'Não definido'}
                    </strong>
                  </div>
                </div>
                <p className="small-note">{c.notes || 'Sem observações adicionais.'}</p>
                <div className="history-detail-actions">
                  <WhatsAppButton
                    phone={c.phone}
                    name={c.name}
                    onOpen={() => update((d) => recordWhatsappOpen(d, session, c.id))}
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHistoryId(c.id);
                      setSelected(null);
                    }}
                  >
                    <History size={16} />
                    Histórico do cliente
                  </Button>
                </div>
                {movable && (
                  <Button
                    onClick={() => {
                      setCard({ ...selected });
                      setSelected(null);
                      setError('');
                    }}
                  >
                    Editar card
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to="/demo/contatos">Abrir contatos</Link>
                </Button>
              </>
            ) : (
              <Empty title="Contato indisponível" description="Confira a empresa selecionada." />
            );
          })()}
      </Modal>
      <Modal
        open={boardOpen}
        onOpenChange={setBoardOpen}
        title={boardEditing ? 'Renomear funil' : 'Novo funil'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manager || !boardName.trim()) return;
            const id = uid();
            if (
              update((d) => ({
                ...d,
                boards: boardEditing
                  ? d.boards.map((b) => (b.id === board.id ? { ...b, name: boardName.trim() } : b))
                  : [
                      ...d.boards,
                      {
                        id,
                        companyId: session.companyId,
                        kind: 'custom',
                        name: boardName.trim(),
                        stages: [{ id: uid(), name: 'Entrada' }],
                      },
                    ],
              }))
            ) {
              setBoardOpen(false);
              if (!boardEditing) navigate('/demo/funil/' + id);
            }
          }}
        >
          <label className="form-row">
            Nome do funil
            <Input
              required
              maxLength={50}
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
            />
          </label>
          <FormActions onCancel={() => setBoardOpen(false)} />
        </form>
      </Modal>
      <Modal
        open={!!card}
        onOpenChange={(v) => !v && setCard(null)}
        title={data.opportunities.some((o) => o.id === card?.id) ? 'Editar card' : 'Novo card'}
        description="Uma pessoa pode ter vários cards, cada um com seu próprio andamento."
      >
        {card && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (update((d) => saveCard(d, session, card))) {
                setCard(null);
                notice('Card salvo.');
              }
            }}
          >
            <ContactPicker
              value={card.contactId}
              onChange={(id) => setCard({ ...card, contactId: id })}
            />
            <label className="form-row">
              Título da oportunidade
              <Input
                required
                maxLength={120}
                value={card.title || ''}
                onChange={(e) => setCard({ ...card, title: e.target.value })}
              />
            </label>
            <label className="form-row">
              Etapa
              <select
                value={card.stageId}
                onChange={(e) => setCard({ ...card, stageId: e.target.value })}
              >
                {board.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-row">
              Valor estimado (R$)
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={card.value / 100}
                onChange={(e) =>
                  setCard({ ...card, value: Math.round(Number(e.target.value) * 100) })
                }
              />
            </label>
            <label className="form-row">
              Estratégia de origem
              <select
                value={card.strategyId || ''}
                onChange={(e) => setCard({ ...card, strategyId: e.target.value })}
              >
                <option value="">Sem estratégia</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <LabelsPicker
              value={card.labelIds || []}
              onChange={(ids) => setCard({ ...card, labelIds: ids })}
            />
            <CatalogPicker
              value={card.catalogIds || []}
              onChange={(ids) => setCard({ ...card, catalogIds: ids })}
            />
            <FormError message={error} />
            <FormActions onCancel={() => setCard(null)} label="Salvar card" />
          </form>
        )}
      </Modal>
    </>
  );
}
