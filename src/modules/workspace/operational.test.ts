import { describe, it, expect } from 'vitest';
import { financialIntent } from './RealAmbassadors';
import { removedStageTarget } from './RealKanban';
import { cents, datetimeLocal, fromLocal } from './operational';
import type { StageRow } from '../../data/backend';
describe('Integração operacional', () => {
  const stages = ['A', 'B', 'C'].map((name, position) => ({
    id: name,
    name,
    position,
    board_id: 'board',
    company_id: 'company',
  })) as StageRow[];
  it('mostra o mesmo destino que o banco ao remover etapas, mesmo com reordenação', () => {
    expect(removedStageTarget(stages, [stages[2], stages[0]], 'B')?.id).toBe('A');
    expect(removedStageTarget(stages, [stages[2], stages[1]], 'A')?.id).toBe('B');
    expect(removedStageTarget(stages, [{ id: 'nova', name: 'Nova' }], 'C')?.id).toBe('nova');
  });
  it('congela os dados de uma solicitação financeira sem compartilhar listas editáveis', () => {
    const form = { amount: 15000, items: ['item-a'] },
      intent = financialIntent(form);
    form.amount = 20000;
    form.items.push('item-b');
    expect(intent.payload).toEqual({ amount: 15000, items: ['item-a'] });
    expect(intent.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(financialIntent(form).requestId).not.toBe(intent.requestId);
  });
  it('mantém centavos exatos e recusa notação exponencial, valores negativos e excesso', () => {
    expect(cents('189.90')).toBe(18990);
    expect(cents('0.01')).toBe(1);
    for (const invalid of ['-1', '1e3', '12.999', '21474836.48', ''])
      expect(() => cents(invalid)).toThrow();
  });
  it('converte o retorno combinado pelo horário de Brasília, sem depender do fuso do dispositivo', () => {
    expect(fromLocal('2026-10-25T09:30')).toBe('2026-10-25T12:30:00.000Z');
    expect(datetimeLocal('2026-10-25T12:30:00.000Z')).toBe('2026-10-25T09:30');
    expect(fromLocal('')).toBeNull();
  });
});
