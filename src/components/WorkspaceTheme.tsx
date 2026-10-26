import type { ReactNode } from 'react';
import type { Template } from '../domain/types';
import { resolveTheme, themeStyle } from '../lib/themes';
import { ThemeProvider } from './theme-provider';

/** Share one complete palette between the workspace and its portal dialogs. */
export function WorkspaceTheme({
  theme,
  template,
  className = '',
  children,
}: {
  theme?: string;
  template?: Template;
  className?: string;
  children: ReactNode;
}) {
  const colors = themeStyle(theme, template);
  return (
    <ThemeProvider style={colors}>
      <div
        className={`layout themed-workspace ${className}`}
        data-theme={resolveTheme(theme, template).value}
        data-color-scheme={colors.colorScheme}
        style={colors}
      >
        {children}
      </div>
    </ThemeProvider>
  );
}
