import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import './experience/tokens.css';
import './kit/globals.css';
import './kit/controls.css';

type Theme = 'light' | 'dark';
const AppearanceContext = createContext<{ theme: Theme; toggleTheme(): void } | null>(null);

// The design tokens live on the document root for every screen, account pages included,
// so portalled popovers and sheets share the active appearance.
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return localStorage.getItem('nelson.appearance') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add('experience');
    root.dataset.theme = theme;
    return () => {
      root.classList.remove('experience');
      delete root.dataset.theme;
    };
  }, [theme]);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('nelson.appearance', next);
    } catch {
      /* Appearance storage is optional. */
    }
  };
  return <AppearanceContext.Provider value={{ theme, toggleTheme }}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const appearance = useContext(AppearanceContext);
  if (!appearance) throw new Error('useAppearance must be used inside AppearanceProvider.');
  return appearance;
}
