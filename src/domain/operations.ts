import type { Board, Session, Snapshot, Stage, Opportunity } from './types';
import { normalize } from '../lib/format';
import { PROVISIONAL_MAX_STAGES } from './config';
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
  if (board.stages.length >= PROVISIONAL_MAX_STAGES)
    throw Error('Limite provisório de 10 etapas atingido.');
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
    opportunities: data.opportunities.map((o) => (o.id === id ? { ...o, stageId } : o)),
  };
}
