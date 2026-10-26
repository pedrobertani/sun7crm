import { describe, it, expect } from 'vitest';
import { CRM_THEMES, themePalette, resolveTheme, colorContrast, themeStyle } from './themes';
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
  it('garante contraste mínimo de 4,5:1 em ações, títulos e textos de cada identidade', () => {
    for (const theme of CRM_THEMES) {
      const t = themePalette(theme.value);
      expect(
        colorContrast(t.primaryForeground, t.primary),
        theme.value + ' botão',
      ).toBeGreaterThanOrEqual(4.5);
      for (const surface of [t.surface, t.canvas, t.chrome, t.raised]) {
        expect(colorContrast(t.primary, surface), theme.value + ' título').toBeGreaterThanOrEqual(
          4.5,
        );
        expect(colorContrast(t.ink, surface), theme.value + ' texto').toBeGreaterThanOrEqual(4.5);
        expect(colorContrast(t.muted, surface), theme.value + ' legenda').toBeGreaterThanOrEqual(
          4.5,
        );
      }
      expect(colorContrast(t.primary, t.soft), theme.value + ' seleção').toBeGreaterThanOrEqual(
        4.5,
      );
      const border = themeStyle(theme.value)[
        '--control-border' as keyof ReturnType<typeof themeStyle>
      ] as string;
      expect(colorContrast(border, t.raised), theme.value + ' controle').toBeGreaterThanOrEqual(3);
    }
  });
  it('reserva preto e dourado ao SUN7 e mantém as outras identidades distintas', () => {
    const sun7 = themePalette('sun7');
    expect(sun7.colorScheme).toBe('dark');
    expect(sun7.canvas).toBe('#101010');
    expect(sun7.primary).toBe('#fdd158');
    expect(new Set(CRM_THEMES.map((t) => themePalette(t.value).primary)).size).toBe(
      CRM_THEMES.length,
    );
    for (const theme of CRM_THEMES.filter((t) => t.value !== 'sun7')) {
      expect(themeStyle(theme.value).colorScheme).toBe('light');
      expect(themeStyle(theme.value)['--surface' as keyof ReturnType<typeof themeStyle>]).toBe(
        '#ffffff',
      );
    }
  });
  it('usa os mesmos tokens em menus, gráficos e modais', () => {
    expect(themeStyle('rose')['--primary' as keyof ReturnType<typeof themeStyle>]).toBe(
      themePalette('rose').chart[0],
    );
    expect(resolveTheme('desconhecido', 'aesthetic').value).toBe('sun7');
  });
});
