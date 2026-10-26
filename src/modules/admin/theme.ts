import type { CSSProperties } from 'react';

/** Identidade do painel da plataforma, independente dos temas de cada empresa. */
export const ADMIN_THEME = {
  colorScheme: 'dark',
  '--primary': '#f5f5f5',
  '--soft': '#292929',
  '--primary-soft': '#292929',
  '--canvas': '#101010',
  '--surface': '#191919',
  '--ink': '#f5f5f5',
  '--text': '#f5f5f5',
  '--muted': '#b8b8b8',
  '--line': '#3a3a3a',
  '--accent-brand': '#f5f5f5',
  '--color-primary': '#f5f5f5',
  '--color-primary-foreground': '#171717',
  '--color-background': '#191919',
  '--color-foreground': '#f5f5f5',
  '--color-muted-foreground': '#b8b8b8',
  '--color-input': '#484848',
  '--color-ring': '#f5f5f5',
  '--color-accent': '#292929',
  '--color-accent-foreground': '#f5f5f5',
  '--color-border': '#3a3a3a',
} as CSSProperties;

export const ADMIN_CHART_COLORS = ['#f5f5f5', '#b8b8b8', '#858585', '#d5d5d5'];
