import { themePalette, themeStyle } from '../lib/themes';

export function ThemePreview({ theme }: { theme: string }) {
  const palette = themePalette(theme);
  return (
    <section
      className="themed-workspace theme-preview"
      aria-label="Prévia do tema"
      data-theme={palette.value}
      data-color-scheme={palette.colorScheme}
      style={themeStyle(theme)}
    >
      <h3>{palette.label}</h3>
      <p>Prévia das cores. Salve a identidade para aplicar à empresa.</p>
      <div className="theme-preview-samples" aria-hidden="true">
        <span className="theme-preview-primary">Ação principal</span>
        <span className="theme-preview-secondary">Ação secundária</span>
      </div>
    </section>
  );
}
