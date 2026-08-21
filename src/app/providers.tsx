import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import type { NelsonApi } from '../api/contracts';
import { createMockApi } from '../api/mock/create-mock-api';
import { ApiProvider } from '../api/api-context';
import { browserSessionStore, type SessionStore } from '../api/auth/session-store';
import { browserThemeStore, type ThemeStore } from '../api/theme/theme-store';
import { ThemeProvider } from './theme-context';
import { SessionProvider } from './session-context';

export interface AppProvidersProps extends PropsWithChildren {
  api?: NelsonApi;
  sessionStore?: SessionStore;
  queryClient?: QueryClient;
  themeStore?: ThemeStore;
}

export function AppProviders({
  children,
  api,
  sessionStore = browserSessionStore,
  queryClient,
  themeStore = browserThemeStore,
}: AppProvidersProps) {
  const [defaultQueryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  const [defaultApi] = useState(() => createMockApi());

  return (
    <QueryClientProvider client={queryClient ?? defaultQueryClient}>
      <ApiProvider api={api ?? defaultApi}>
        <ThemeProvider themeStore={themeStore}>
          <SessionProvider sessionStore={sessionStore}>{children}</SessionProvider>
        </ThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
