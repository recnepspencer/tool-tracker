import { onlineManager, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppearanceProvider } from './appearance';
import { isNetworkFailure } from './client';
import { keepSavedRecords, showSavedRecords } from './query-persistence';
import { SessionProvider } from './session';

// Weak signal drops requests; retry reads a few times with backoff while the
// device believes it is online. Server decisions (4xx) are final.
const retry = (count: number, error: unknown) => navigator.onLine && count < 3 && isNetworkFailure(error);
const retryDelay = (attempt: number) => Math.min(1_000 * 2 ** attempt, 8_000);

// The query library assumes it starts online. An app opened without signal
// would then never see the connection return, and saved records would stay.
onlineManager.setOnline(navigator.onLine);

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const created = new QueryClient({
      queryCache: new QueryCache({
        // A connection failure never replaces records with an error screen: the
        // records already on screen stay, or the saved ones appear, and the
        // connection notice says how old they are. Server errors still surface.
        onError: (error, query) => {
          if (!isNetworkFailure(error)) return;
          if (query.state.data === undefined) void showSavedRecords(query);
          // Stale until a refresh succeeds, so reconnecting brings them up to date.
          else query.setState({ status: 'success', error: null, isInvalidated: true });
        },
      }),
      defaultOptions: {
        // 'always' lets requests try on flaky signal instead of pausing, but it also
        // turns off refreshing when the connection returns; turn that back on.
        queries: { staleTime: 15_000, retry, retryDelay, networkMode: 'always', refetchOnReconnect: true },
        mutations: { retry: false, networkMode: 'always' },
      },
    });
    // Subscribed before any screen mounts, so the first requests are covered.
    keepSavedRecords(created);
    return created;
  });
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
