import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceTheme } from './WorkspaceTheme';
import { ThemePreview } from './ThemePreview';
import { useThemeStyle } from './theme-provider';
import { AccountMenu } from './AccountMenu';
import { CRM_THEMES } from '../lib/themes';

function PortalPalette() {
  const colors = useThemeStyle();
  return <section aria-label="Cores do modal" style={colors} />;
}

describe('Identidade aplicada ao painel', () => {
  it('troca a paleta do painel e a paleta recebida pelos modais com a seleção da empresa', () => {
    const html = (theme: string) =>
      renderToStaticMarkup(
        <WorkspaceTheme theme={theme}>
          <h1>Contatos</h1>
          <PortalPalette />
        </WorkspaceTheme>,
      );
    const sun7 = html('sun7');
    const blue = html('blue');
    const rose = html('rose');
    expect(sun7).toContain('data-color-scheme="dark"');
    expect(sun7).toContain('--heading:#fdd158');
    expect(blue).toContain('data-color-scheme="light"');
    expect(blue).toContain('--primary:#315ba2');
    expect(rose).not.toEqual(blue);
    for (const rendered of [blue, rose]) {
      expect(rendered).not.toContain('#fdd158');
      expect(rendered).not.toContain('color-scheme:dark');
    }
    // The portal consumer receives the complete selected palette, not root defaults.
    expect(blue.match(/--primary:#315ba2/g)).toHaveLength(2);
    expect(blue.match(/--color-primary-foreground:#ffffff/g)).toHaveLength(2);
  });
  it('permite comparar as identidades antes de salvar e mantém Plano fora da conta de funcionário', () => {
    for (const theme of CRM_THEMES) {
      const preview = renderToStaticMarkup(<ThemePreview theme={theme.value} />);
      expect(preview).toContain(`data-theme="${theme.value}"`);
      expect(preview).toContain(theme.label);
    }
    const account = (plan?: string) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <AccountMenu
            name="QA"
            role={plan ? 'Gestor' : 'Funcionário'}
            plan={plan}
            onLogout={() => {}}
          />
        </MemoryRouter>,
      );
    expect(account('/app/plano')).toContain('href="/app/plano"');
    expect(account()).not.toContain('href="/app/plano"');
    expect(account()).toContain('Menu do usuário');
  });
});
