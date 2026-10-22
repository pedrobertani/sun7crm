import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
const ThemeContext = createContext<CSSProperties>({});
export function ThemeProvider({ style, children }: { style: CSSProperties; children: ReactNode }) {
  return <ThemeContext.Provider value={style}>{children}</ThemeContext.Provider>;
}
export const useThemeStyle = () => useContext(ThemeContext);
