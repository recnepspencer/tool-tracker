import { QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, PropsWithChildren } from 'react';
import type { NelsonApi } from '../api/contracts';
import type { SessionStore } from '../api/auth/session-store';
import type { Theme, ThemeStore } from '../api/theme/theme-store';
import { AppProviders } from '../app/providers';

export const createMemorySessionStore = (
  initialProfileId: string | null = null,
): SessionStore & { value: string | null } => {
  let value = initialProfileId;
  return {
    get value() {
      return value;
    },
    read: () => value,
    write: (profileId) => {
      value = profileId;
    },
    clear: () => {
      value = null;
    },
  };
};

export const createMemoryThemeStore = (initialTheme: Theme = 'dark'): ThemeStore & { value: Theme } => {
  let value = initialTheme;
  return {
    get value() {
      return value;
    },
    read: () => value,
    write: (theme) => {
      value = theme;
    },
  };
};

export function renderApp(
  element: ReactElement,
  options: RenderOptions & {
    api?: NelsonApi;
    sessionStore?: SessionStore;
    themeStore?: ThemeStore;
  } = {},
) {
  const { api, sessionStore, themeStore, ...renderOptions } = options;
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <AppProviders api={api} sessionStore={sessionStore} themeStore={themeStore} queryClient={queryClient}>
      {children}
    </AppProviders>
  );
  return render(element, { wrapper, ...renderOptions });
}
