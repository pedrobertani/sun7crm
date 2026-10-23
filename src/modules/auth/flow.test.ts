import { describe, expect, it } from 'vitest';
import { legalReadiness, passwordValidation } from './flow';

const required = [
  { kind: 'terms' as const, version: 'published-v1' },
  { kind: 'privacy' as const, version: 'published-v1' },
];
const published = required.map((entry) => ({
  ...entry,
  body: 'Texto publicado',
  content_sha256: 'a'.repeat(64),
  published_at: '2026-10-23T20:00:00Z',
}));

describe('Primeiro acesso', () => {
  it('bloqueia senhas fracas e divergentes', () => {
    expect(passwordValidation('fraca', 'fraca')).not.toBeNull();
    expect(passwordValidation('SenhaBastanteLonga!', 'OutraSenhaBastanteLonga!')).not.toBeNull();
    expect(passwordValidation('SenhaBastanteLonga!', 'SenhaBastanteLonga!')).toBeNull();
  });
  it('não libera sistema sem documentos finais de ambas as categorias', () => {
    expect(legalReadiness([], [], []).ready).toBe(false);
    expect(legalReadiness(required, published.slice(0, 1), []).ready).toBe(false);
    expect(legalReadiness(required, published.map((doc) => ({ ...doc, content_sha256: '' })), []).ready).toBe(false);
  });
  it('exige aceite individual das duas versões atuais', () => {
    expect(legalReadiness(required, published, []).accepted).toBe(false);
    expect(legalReadiness(required, published, required.slice(0, 1)).accepted).toBe(false);
    expect(legalReadiness(required, published, required).accepted).toBe(true);
    expect(legalReadiness(required, published, [
      {kind: 'terms', version: 'old'},
      required[1],
    ]).accepted).toBe(false);
  });
});
