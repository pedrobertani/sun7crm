import type { CSSProperties } from 'react';
import type { Template } from '../domain/types';
// Opções e cores de origem reaproveitadas de lib/studio-themes.ts do StudioPro.
export const CRM_THEMES = [
  { value: 'sun7', label: 'SUN7CRM', colors: ['#fdd158', '#c69a3d', '#101010'] },
  { value: 'blue', label: 'Azul', colors: ['#315ba2', '#88a8d6', '#f5f7fb'] },
  { value: 'original', label: 'Nude', colors: ['#b86f5c', '#d9b2a7', '#fcfaf7'] },
  { value: 'neutral', label: 'Neutro', colors: ['#334155', '#94a3b8', '#f8fafc'] },
  { value: 'elegant', label: 'Elegante', colors: ['#7c5c20', '#d6b96b', '#faf7f0'] },
  { value: 'rose', label: 'Rosé', colors: ['#b65f73', '#e8b4c0', '#fff7f8'] },
  { value: 'barber', label: 'Clássico', colors: ['#1f3a3d', '#809899', '#f3f0e9'] },
] as const;
export type CrmTheme = (typeof CRM_THEMES)[number]['value'];
export const CHART_COLORS = [1, 2, 3, 4].map((index) => `var(--chart-${index})`);
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
export function colorContrast(foreground: string, background: string) {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function accessiblePrimary(hex: string, canvas: string, minimum = 4.5) {
  let next = hex;
  while (
    [canvas, '#ffffff', '#f5f5f5', mixWithWhite(next, 0.92)].some(
      (surface) => colorContrast(next, surface) < minimum,
    )
  ) {
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
  const dark = theme.value === 'sun7';
  const primary = dark ? theme.colors[0] : accessiblePrimary(theme.colors[0], theme.colors[2]);
  return {
    ...theme,
    colorScheme: dark ? ('dark' as const) : ('light' as const),
    primary,
    primaryForeground: dark ? '#171717' : '#ffffff',
    soft: dark ? '#2c2618' : mixWithWhite(primary, 0.92),
    canvas: theme.colors[2],
    surface: dark ? '#191919' : '#ffffff',
    chrome: dark ? '#101010' : '#ffffff',
    raised: dark ? '#252525' : '#f5f5f5',
    ink: dark ? '#f5f5f5' : '#242424',
    muted: dark ? '#b8b8b8' : '#626262',
    line: dark ? '#404040' : '#dedede',
    controlBorder: dark ? '#808080' : '#878787',
    controlHover: dark ? '#363636' : mixWithWhite(primary, 0.92),
    danger: dark ? '#ffb8bf' : '#a52338',
    dangerSurface: dark ? '#382126' : '#fcecee',
    dangerBorder: dark ? '#c16a75' : '#b54b58',
    temperatureHot: dark ? '#c77b5b' : '#95412b',
    temperatureWarm: dark ? '#ae8b3e' : '#795b15',
    temperatureCold: dark ? '#6a92bb' : '#315ba2',
    shadowColor: dark ? '#00000066' : '#0000001a',
    chart: dark
      ? [primary, '#d9a93c', '#ad8129', '#f7e2a8']
      : [
          primary,
          accessiblePrimary(mixWithWhite(primary, 0.15), theme.colors[2], 3),
          accessiblePrimary(mixWithWhite(primary, 0.3), theme.colors[2], 3),
          '#' +
            rgb(primary)
              .map((v) =>
                Math.floor(v * 0.72)
                  .toString(16)
                  .padStart(2, '0'),
              )
              .join(''),
        ],
  };
}
export function themeStyle(value?: string, template: Template = 'aesthetic'): CSSProperties {
  const t = themePalette(value, template);
  return {
    colorScheme: t.colorScheme,
    '--scheme': t.colorScheme,
    '--primary': t.primary,
    '--primary-foreground': t.primaryForeground,
    '--soft': t.soft,
    '--primary-soft': t.soft,
    '--canvas': t.canvas,
    '--surface': t.surface,
    '--card': t.surface,
    '--chrome': t.chrome,
    '--raised': t.raised,
    '--ink': t.ink,
    '--text': t.ink,
    '--heading': t.primary,
    '--muted': t.muted,
    '--line': t.line,
    '--border': t.line,
    '--control-border': t.controlBorder,
    '--control-hover': t.controlHover,
    '--danger': t.danger,
    '--danger-surface': t.dangerSurface,
    '--danger-border': t.dangerBorder,
    '--temperature-hot': t.temperatureHot,
    '--temperature-warm': t.temperatureWarm,
    '--temperature-cold': t.temperatureCold,
    '--shadow-color': t.shadowColor,
    '--overlay': '#00000080',
    '--chart-1': t.chart[0],
    '--chart-2': t.chart[1],
    '--chart-3': t.chart[2],
    '--chart-4': t.chart[3],
    '--accent-brand': t.primary,
    '--color-primary': t.primary,
    '--color-primary-foreground': t.primaryForeground,
    '--color-background': t.surface,
    '--color-foreground': t.ink,
    '--color-muted-foreground': t.muted,
    '--color-input': t.line,
    '--color-ring': t.primary,
    '--color-accent': t.soft,
    '--color-accent-foreground': t.primary,
    '--color-border': t.line,
    '--color-secondary': t.raised,
    '--color-secondary-foreground': t.ink,
    '--color-destructive': t.danger,
    '--color-destructive-foreground': t.dangerSurface,
  } as CSSProperties;
}
