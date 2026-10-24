import { describe, it, expect } from 'vitest';
import { currentAcceptance, recordAcceptance, readAcceptances, LEGAL_KEY } from './legal';
import type { Session } from './types';
const session: Session = { role: 'manager', companyId: 'one', memberId: 'm1' };
const storage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) || null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};
describe('Aceite por pessoa e versão', () => {
  it('não registra sem as duas confirmações explícitas', () => {
    const s = storage();
    expect(() => recordAcceptance(s, [], session, true, false)).toThrow();
    expect(() => recordAcceptance(s, [], session, false, true)).toThrow();
    expect(readAcceptances(s)).toEqual([]);
  });
  it('persiste para a mesma pessoa sem estender a outra pessoa ou empresa', () => {
    const s = storage();
    const rows = recordAcceptance(s, [], session, true, true);
    expect(currentAcceptance(readAcceptances(s), session)).toBeTruthy();
    expect(currentAcceptance(rows, { ...session, memberId: 'm2' })).toBeUndefined();
    expect(currentAcceptance(rows, { ...session, companyId: 'two' })).toBeUndefined();
    expect(recordAcceptance(s, rows, session, true, true)).toHaveLength(1);
  });
  it('versão antiga ou armazenamento inválido não libera acesso', () => {
    const s = storage();
    const rows = recordAcceptance(s, [], session, true, true);
    expect(
      currentAcceptance(
        rows.map((r) => ({ ...r, privacyVersion: 'old' })),
        session,
      ),
    ).toBeUndefined();
    s.setItem(LEGAL_KEY, 'invalid');
    expect(readAcceptances(s)).toEqual([]);
  });
  it('falha ao gravar não produz um aceite em memória', () => {
    expect(() =>
      recordAcceptance(
        {
          setItem: () => {
            throw Error('Sem espaço');
          },
        },
        [],
        session,
        true,
        true,
      ),
    ).toThrow('Sem espaço');
  });
});
