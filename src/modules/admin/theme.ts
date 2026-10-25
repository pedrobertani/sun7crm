import type { CSSProperties } from 'react';

/** Identidade do painel da plataforma, independente dos temas de cada empresa. */
export const ADMIN_THEME = {
  colorScheme: 'dark',
  '--primary': '#e3bc5d',
  '--soft': '#292416',
  '--primary-soft': '#292416',
  '--canvas': '#0c0d0b',
  '--surface': '#161714',
  '--ink': '#f2f0e8',
  '--text': '#f2f0e8',
  '--muted': '#acafa4',
  '--line': '#30322c',
  '--accent-brand': '#e3bc5d',
  '--color-primary': '#e3bc5d',
  '--color-primary-foreground': '#18150d',
  '--color-background': '#161714',
  '--color-foreground': '#f2f0e8',
  '--color-muted-foreground': '#acafa4',
  '--color-input': '#3b3e34',
  '--color-ring': '#e3bc5d',
  '--color-accent': '#292416',
  '--color-accent-foreground': '#f0cb75',
  '--color-border': '#30322c',
} as CSSProperties;

export const ADMIN_CHART_COLORS = ['#e3bc5d', '#a68d50', '#727b67', '#c0c6b6'];
