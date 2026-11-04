import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PasswordInput } from './password-input';

describe('Campo com botão mostrar senha', () => {
  it('inicia oculto e mantém autocomplete, identificação e valores de senha', () => {
    const html = renderToStaticMarkup(
      <PasswordInput name="password" id="password" value="minhaSenha!" autoComplete="current-password" readOnly />,
    );
    expect(html).toContain('type="password"');
    expect(html).toContain('value="minhaSenha!"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain('aria-label="Mostrar senha"');
    expect(html).toContain('type="button"');
  });
  it('respeita disabled, sem permitir mostrar senha em campo indisponível', () => {
    const html = renderToStaticMarkup(<PasswordInput disabled value="" onChange={() => {}} />);
    expect(html.match(/disabled=""/g)?.length).toBe(2);
  });
});
