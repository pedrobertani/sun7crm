import { afterEach, describe, expect, it } from 'vitest';
import { changeAffects, hasChangeConnection, setChangeConnection } from './data-changes';

describe('Invalidação por empresa e recurso', () => {
  afterEach(() => {
    setChangeConnection('company:a', false);
    setChangeConnection('admin', false);
    setChangeConnection('user:u', false);
  });
  it('um contato atualiza carteira, funil e dashboard, preservando outra empresa e tarefas independentes', () => {
    const resources = new Set<'contacts'>(['contacts']);
    for (const page of ['/app', '/app/contatos', '/app/funil'])
      expect(changeAffects(`workspace:a:${page}`, 'company:a', resources)).toBe(true);
    expect(changeAffects('workspace:b:/app/contatos', 'company:a', resources)).toBe(false);
    expect(changeAffects('workspace:a:/app/etiquetas', 'company:a', resources)).toBe(false);
    expect(changeAffects('billing:a', 'company:a', resources)).toBe(false);
  });
  it('um pagamento atualiza o plano correspondente e não o de outra empresa', () => {
    expect(changeAffects('billing:a', 'company:a', new Set(['billing']))).toBe(true);
    expect(changeAffects('billing:b', 'company:a', new Set(['billing']))).toBe(false);
    expect(changeAffects('billing:all', 'admin', new Set(['billing']))).toBe(true);
  });
  it('avisos individuais não invalidam consultas de outro usuário nem a carteira inteira', () => {
    expect(changeAffects('notifications:u', 'user:u', new Set(['notifications']))).toBe(true);
    expect(changeAffects('notifications:other', 'user:u', new Set(['notifications']))).toBe(false);
    expect(changeAffects('workspace:a:/app', 'user:u', new Set(['notifications']))).toBe(false);
  });
  it('o fallback depende do canal do contexto correto e volta após a desconexão', () => {
    setChangeConnection('company:a', true);
    expect(hasChangeConnection('workspace:a:/app')).toBe(true);
    expect(hasChangeConnection('workspace:b:/app')).toBe(false);
    expect(hasChangeConnection('billing:a')).toBe(true);
    setChangeConnection('company:a', false);
    expect(hasChangeConnection('billing:a')).toBe(false);
    setChangeConnection('admin', true);
    expect(hasChangeConnection('billing:all')).toBe(true);
  });
});
