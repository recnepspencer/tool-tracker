export type Theme = 'dark' | 'light';

export interface ThemeStore {
  read(): Theme;
  write(theme: Theme): void;
}

export const browserThemeStore: ThemeStore = {
  read: () => {
    try {
      return localStorage.getItem('nelson-demo-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  },
  write: (theme) => {
    try {
      localStorage.setItem('nelson-demo-theme', theme);
    } catch {
      // A storage-restricted browser still gets the selected in-memory theme.
    }
  },
};
