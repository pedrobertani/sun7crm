import { describe, expect, it } from 'vitest';
import { supabaseOrigin } from './public-config';
import { contentSecurityPolicy } from './security-policy';

describe('Política de segurança do build', () => {
  it('restringe scripts e conexões ao aplicativo e ao projeto de autenticação', () => {
    const policy = contentSecurityPolicy();
    const directives = Object.fromEntries(
      policy.split('; ').map((item) => {
        const [name, ...values] = item.split(' ');
        return [name, values];
      }),
    );
    expect(directives['script-src']).toEqual(["'self'"]);
    expect(directives['script-src-attr']).toEqual(["'none'"]);
    expect(directives['connect-src']).toEqual([
      "'self'",
      'https://oduhbimlxnuyqliayvpl.supabase.co',
      'wss://oduhbimlxnuyqliayvpl.supabase.co',
    ]);
    for (const directive of ['object-src', 'base-uri', 'frame-src', 'worker-src'])
      expect(directives[directive]).toEqual(["'none'"]);
    // Essas diretivas exigem cabeçalhos HTTP, não funcionam em meta.
    expect(directives['frame-ancestors']).toBeUndefined();
    expect(directives['report-uri']).toBeUndefined();
    expect(policy).not.toContain("'unsafe-eval'");
  });
  it('acompanha o projeto configurado e permite desenvolvimento local', () => {
    expect(contentSecurityPolicy('https://fixture.supabase.co/')).toContain(
      "connect-src 'self' https://fixture.supabase.co wss://fixture.supabase.co",
    );
    expect(supabaseOrigin('http://127.0.0.1:54321/')).toBe('http://127.0.0.1:54321');
  });
  it.each([
    'https://example.invalid;script-src',
    'https://*.example.invalid',
    'http://remote.example.invalid',
    'javascript:alert(1)',
    'https://user:password@example.invalid',
    'https://example.invalid/path',
    'https://example.invalid/?key=value',
    'https://example.invalid/#fragment',
    'https://example.invalid/; script-src *',
    'https://example.invalid/" onload="alert(1)',
  ])('recusa configuração que possa ampliar ou injetar uma política: %s', (url) => {
    expect(() => contentSecurityPolicy(url)).toThrow();
  });
});
