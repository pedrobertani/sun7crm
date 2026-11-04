import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const account = readFileSync(new URL('./RealAccess.tsx', import.meta.url), 'utf8');
const login = readFileSync(new URL('../public/Login.tsx', import.meta.url), 'utf8');

describe('Navegação entre demonstração pública e conta autenticada', () => {
  it('mantém o convite à demo somente na área pública de entrada', () => {
    expect(login).toContain('to="/demo"');
    expect(account).not.toContain('to="/demo"');
    expect(account).not.toMatch(/demonstração fictícia|testes internos|documentos de homologação/i);
  });
  it('preserva a confirmação individual de documentos da conta real', () => {
    expect(account).toContain("gate.pending.map((doc) => ({ kind: doc.kind, version: doc.version }))");
    expect(account).toContain('Li e aceito os Termos de Uso apresentados.');
    expect(account).toContain('Li e tomei ciência da Política de Privacidade apresentada.');
  });
});
