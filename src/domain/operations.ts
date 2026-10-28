import type { Board, Session, Snapshot, Stage, Opportunity } from './types';
import { normalize } from '../lib/format';
import { PROVISIONAL_MAX_STAGES } from './config';
import { highImpactStage } from '../modules/goals/stageOutcome';
export function canManage(session: Session) {
  return session.role === 'manager';
}
export function visibleContacts(data: Snapshot, session: Session) {
  return data.contacts.filter(
    (c) =>
      session.role !== 'admin' &&
      c.companyId === session.companyId &&
      (session.role !== 'seller' || c.ownerId === session.memberId),
  );
}
export function stageNameError(stages: Stage[], name: string, ignoreId?: string) {
  if (!name.trim()) return 'Informe o nome da etapa.';
  if (name.trim().length > 50) return 'Use até 50 caracteres.';
  if (stages.some((s) => s.id !== ignoreId && normalize(s.name) === normalize(name)))
    return 'Já existe uma etapa com esse nome.';
  return '';
}
export function addStage(board: Board, stage: Stage): Board {
  if (board.stages.length >= PROVISIONAL_MAX_STAGES) throw Error('Limite de 10 etapas atingido.');
  const error = stageNameError(board.stages, stage.name);
  if (error) throw Error(error);
  return { ...board, stages: [...board.stages, { ...stage, name: stage.name.trim() }] };
}
export function removeStage(board: Board, opps: Opportunity[], id: string, targetId: string) {
  if (board.stages.length <= 1) throw Error('Mantenha pelo menos uma etapa.');
  if (
    !board.stages.some((s) => s.id === id) ||
    !board.stages.some((s) => s.id === targetId) ||
    id === targetId
  )
    throw Error('Escolha outra etapa de destino.');
  if (highImpactStage(board.stages.find(s=>s.id===id)?.name||'')==='sale' &&
    opps.some(o=>o.boardId===board.id&&o.stageId===id&&o.confirmedSaleAt)) {
    throw Error('Não é possível excluir uma etapa que contém vendas confirmadas.');
  }
  return {
    board: { ...board, stages: board.stages.filter((s) => s.id !== id) },
    opportunities: opps.map((o) =>
      o.boardId === board.id && o.stageId === id ? { ...o, stageId: targetId } : o,
    ),
  };
}
export function moveOpportunity(
  data: Snapshot,
  session: Session,
  id: string,
  stageId: string,
): Snapshot {
  if (session.role === 'admin' || session.role === 'reception')
    throw Error('Este perfil não movimenta oportunidades.');
  const opp = data.opportunities.find((o) => o.id === id && o.companyId === session.companyId);
  if (!opp) throw Error('Oportunidade não encontrada.');
  if (!visibleContacts(data, session).some((c) => c.id === opp.contactId))
    throw Error('Você não tem acesso a este contato.');
  const board = data.boards.find((b) => b.id === opp.boardId && b.companyId === session.companyId);
  if (!board?.stages.some((s) => s.id === stageId)) throw Error('Etapa inválida para este quadro.');
  return {
    ...data,
    opportunities: data.opportunities.map((o) => o.id !== id ? o : {
      ...o,stageId,
      ...(o.confirmedSaleAt?{
        confirmedSaleAt:undefined,confirmedSaleOwnerId:undefined,confirmedSaleCents:undefined,
      }:{}),
    }),
  };
}

export function saveCard(data: Snapshot, session: Session, card: Opportunity): Snapshot {
  if (!['manager', 'seller'].includes(session.role)) throw Error('Este perfil não edita cards.');
  if (
    card.companyId !== session.companyId ||
    !visibleContacts(data, session).some((c) => c.id === card.contactId)
  )
    throw Error('Contato indisponível.');
  const previous = data.opportunities.find((o) => o.id === card.id);
  if (
    previous &&
    (previous.companyId !== session.companyId ||
      !visibleContacts(data, session).some((c) => c.id === previous.contactId))
  )
    throw Error('Card indisponível.');
  const board = data.boards.find((b) => b.id === card.boardId && b.companyId === session.companyId);
  if (!board?.stages.some((s) => s.id === card.stageId)) throw Error('Etapa inválida.');
  if (!Number.isSafeInteger(card.value) || card.value < 0) throw Error('Valor inválido.');
  if (new Set(card.labelIds || []).size > 3) throw Error('Use no máximo 3 etiquetas por card.');
  if (
    (card.labelIds || []).some(
      (id) => !(data.labels || []).some((l) => l.id === id && l.companyId === session.companyId),
    )
  )
    throw Error('Etiqueta inválida.');
  if (
    card.strategyId &&
    !data.strategies.some((s) => s.id === card.strategyId && s.companyId === session.companyId)
  )
    throw Error('Estratégia inválida.');
  if (
    (card.catalogIds || []).some(
      (id) =>
        !(data.catalog || []).some(
          (i) =>
            i.id === id &&
            i.companyId === session.companyId &&
            (i.active || previous?.catalogIds?.includes(id)),
        ),
    )
  )
    throw Error('Item de catálogo indisponível.');
  return {
    ...data,
    opportunities: previous
      ? data.opportunities.map((o) => (o.id === card.id ? card : o))
      : [...data.opportunities, card],
  };
}
