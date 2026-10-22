import { describe, it, expect } from 'vitest';
import { createSeed } from '../data/seed';
import {
  addStage,
  removeStage,
  moveOpportunity,
  stageNameError,
  visibleContacts,
} from './operations';
import type { Session } from './types';
const manager: Session = { role: 'manager', companyId: 'aurora', memberId: 'aurora-manager' };
describe('isolamento da prévia e funil', () => {
  it('mantém contatos de outra empresa fora da visão do gestor', () => {
    const d = createSeed();
    expect(visibleContacts(d, manager).every((c) => c.companyId === 'aurora')).toBe(true);
    expect(visibleContacts(d, { ...manager, role: 'admin' })).toHaveLength(0);
  });
  it('vendedor vê apenas contatos sob sua responsabilidade', () => {
    const d = createSeed();
    d.contacts[0].ownerId = 'aurora-manager';
    expect(
      visibleContacts(d, { ...manager, role: 'seller', memberId: 'aurora-seller' }).some(
        (c) => c.id === d.contacts[0].id,
      ),
    ).toBe(false);
  });
  it('não aceita movimentação de outra empresa ou para etapa de outro quadro', () => {
    const d = createSeed();
    const foreign = d.opportunities.find((o) => o.companyId === 'casa')!;
    const own = d.opportunities.find((o) => o.companyId === 'aurora')!;
    expect(() => moveOpportunity(d, manager, foreign.id, foreign.stageId)).toThrow();
    expect(() => moveOpportunity(d, manager, own.id, 'casa-leads-0')).toThrow();
  });
  it('recepção não movimenta oportunidades', () => {
    const d = createSeed();
    const o = d.opportunities[0];
    expect(() => moveOpportunity(d, { ...manager, role: 'reception' }, o.id, o.stageId)).toThrow();
  });
  it('vendedor não movimenta contato de outro responsável', () => {
    const d = createSeed();
    d.contacts[0].ownerId = 'aurora-manager';
    const o = d.opportunities[0];
    expect(() =>
      moveOpportunity(
        d,
        { ...manager, role: 'seller', memberId: 'aurora-seller' },
        o.id,
        o.stageId,
      ),
    ).toThrow();
  });
  it('movimenta preservando o contato, a origem e as demais oportunidades', () => {
    const d = createSeed();
    const o = d.opportunities[0];
    const moved = moveOpportunity(d, manager, o.id, 'aurora-leads-1');
    expect(moved.opportunities[0]).toEqual({ ...o, stageId: 'aurora-leads-1' });
    expect(moved.contacts).toBe(d.contacts);
    expect(moved.opportunities[1]).toBe(d.opportunities[1]);
  });
  it('renomear uma etapa não exige trocar o ID', () => {
    const d = createSeed();
    const b = d.boards[0];
    expect(stageNameError(b.stages, ' Lead NOVO ')).not.toBe('');
    expect(stageNameError(b.stages, 'Lead novo', b.stages[0].id)).toBe('');
  });
  it('transfere cartões antes de remover etapa e preserva outros quadros', () => {
    const d = createSeed();
    const b = d.boards[0];
    const [old, target] = b.stages;
    const result = removeStage(b, d.opportunities, old.id, target.id);
    expect(result.board.stages.some((s) => s.id === old.id)).toBe(false);
    expect(
      result.opportunities.filter((o) => o.boardId === b.id).some((o) => o.stageId === old.id),
    ).toBe(false);
    expect(result.opportunities.find((o) => o.companyId === 'casa')).toEqual(
      d.opportunities.find((o) => o.companyId === 'casa'),
    );
  });
  it('exige destino válido ao remover etapa e não remove a última', () => {
    const d = createSeed(),
      b = d.boards[0];
    expect(() => removeStage(b, d.opportunities, b.stages[0].id, b.stages[0].id)).toThrow();
    expect(() =>
      removeStage({ ...b, stages: [b.stages[0]] }, d.opportunities, b.stages[0].id, 'qualquer'),
    ).toThrow();
  });
  it('aplica o limite provisório de etapas', () => {
    const d = createSeed();
    const board = {
      ...d.boards[0],
      stages: Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: 'Etapa ' + i })),
    };
    expect(() => addStage(board, { id: 'extra', name: 'Mais uma' })).toThrow();
    expect(
      addStage(d.boards[0], { id: 'extra', name: ' Em negociação ' }).stages.at(-1)?.name,
    ).toBe('Em negociação');
  });
});
