import { describe, it, expect } from 'vitest';
import { CRM_THEMES, themePalette, resolveTheme, contrastOnWhite, themeStyle } from './themes';
describe('paletas por empresa', () => {
  it('mantém a cor padrão para empresas existentes sem preferência salva', () => {
    expect(resolveTheme(undefined, 'aesthetic').value).toBe('sun7');
    expect(resolveTheme(undefined, 'generic').value).toBe('blue');
  });
  it('preserva a escolha de cores quando o template muda', () => {
    expect(resolveTheme('rose', 'aesthetic').value).toBe('rose');
    expect(resolveTheme('rose', 'generic').value).toBe('rose');
  });
  it('inclui as cinco opções do StudioPro e a identidade original do CRM', () => {
    expect(CRM_THEMES.map((t) => t.value)).toEqual([
      'sun7',
      'blue',
      'original',
      'neutral',
      'elegant',
      'rose',
      'barber',
    ]);
  });
  it('garante contraste mínimo de 4,5:1 nos botões com texto branco', () => {
    for (const theme of CRM_THEMES)
      expect(contrastOnWhite(themePalette(theme.value).primary)).toBeGreaterThanOrEqual(4.5);
  });
  it('usa os mesmos tokens em menus, gráficos e modais', () => {
    expect(themeStyle('rose')['--primary' as keyof ReturnType<typeof themeStyle>]).toBe(
      themePalette('rose').chart[0],
    );
    expect(resolveTheme('desconhecido', 'aesthetic').value).toBe('sun7');
  });
});
