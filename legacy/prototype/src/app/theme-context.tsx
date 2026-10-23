import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { browserThemeStore, type Theme, type ThemeStore } from '../api/theme/theme-store';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme(): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps extends PropsWithChildren {
  themeStore?: ThemeStore;
}

export function ThemeProvider({ children, themeStore = browserThemeStore }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => themeStore.read());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    themeStore.write(theme);
  }, [theme, themeStore]);

  const toggleTheme = useCallback(() => setTheme((current) => (current === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
