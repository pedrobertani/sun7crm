import type { CSSProperties } from 'react';
import type { Template } from '../domain/types';
// Opções e cores de origem reaproveitadas de lib/studio-themes.ts do StudioPro.
export const CRM_THEMES = [
  { value: 'sun7', label: 'SUN7CRM', colors: ['#236d62', '#65a398', '#f6f8fa'] },
  { value: 'blue', label: 'Azul', colors: ['#315ba2', '#88a8d6', '#f5f7fb'] },
  { value: 'original', label: 'Nude', colors: ['#b86f5c', '#c7a447', '#fcfaf7'] },
  { value: 'neutral', label: 'Neutro', colors: ['#334155', '#94a3b8', '#f8fafc'] },
  { value: 'elegant', label: 'Elegante', colors: ['#7c5c20', '#d6b96b', '#faf7f0'] },
  { value: 'rose', label: 'Rosé', colors: ['#b65f73', '#e8b4c0', '#fff7f8'] },
  { value: 'barber', label: 'Clássico', colors: ['#1f3a3d', '#b48645', '#f3f0e9'] },
] as const;
export type CrmTheme = (typeof CRM_THEMES)[number]['value'];
function rgb(hex: string) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
export function mixWithWhite(hex: string, fraction: number) {
  return (
    '#' +
    rgb(hex)
      .map((v) =>
        Math.round(v + (255 - v) * fraction)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function luminance(hex: string) {
  return rgb(hex)
    .map((v) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrastOnWhite(hex: string) {
  return 1.05 / (luminance(hex) + 0.05);
}
function accessiblePrimary(hex: string) {
  let next = hex;
  while (contrastOnWhite(next) < 4.5) {
    next =
      '#' +
      rgb(next)
        .map((v) =>
          Math.floor(v * 0.96)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('');
  }
  return next;
}
export function resolveTheme(value?: string, template: Template = 'aesthetic') {
  return (
    CRM_THEMES.find((t) => t.value === value) ||
    CRM_THEMES.find((t) => t.value === (template === 'generic' ? 'blue' : 'sun7'))!
  );
}
export function themePalette(value?: string, template: Template = 'aesthetic') {
  const theme = resolveTheme(value, template);
  const primary = accessiblePrimary(theme.colors[0]);
  return {
    ...theme,
    primary,
    soft: mixWithWhite(primary, 0.92),
    chart: [primary, mixWithWhite(primary, 0.32), mixWithWhite(primary, 0.65), theme.colors[1]],
  };
}
export function themeStyle(value?: string, template: Template = 'aesthetic'): CSSProperties {
  const t = themePalette(value, template);
  return {
    '--primary': t.primary,
    '--soft': t.soft,
    '--canvas': t.colors[2],
    '--accent-brand': t.colors[1],
    '--color-primary': t.primary,
    '--color-ring': t.primary,
    '--color-accent': t.soft,
    '--color-accent-foreground': t.primary,
  } as CSSProperties;
}
