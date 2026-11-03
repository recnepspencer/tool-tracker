import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppearanceProvider } from './appearance';
import { SessionProvider } from './session';
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: false, networkMode: 'always' },
          mutations: { retry: false, networkMode: 'always' },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <AppearanceProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </AppearanceProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
