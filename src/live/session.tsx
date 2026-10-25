import { useQuery, useQueryClient, type Query } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, result, type Model } from './client';

type Membership = Model<'MembershipView'>;
type Session = Model<'SessionView'>;
// Invitation previews are public token-scoped reads and remain mounted while
// someone switches accounts. Clear company data without detaching those observers.
const privateQuery = (query: Query) => !['session', 'invitation'].includes(String(query.queryKey[0]));
const Context = createContext<{
  session: Session | null | undefined;
  member: Membership | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<Session | null>;
  chooseCompany: (id: string) => void;
  logout: () => Promise<void>;
} | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [companyId, setCompanyId] = useState(() => {
    try {
      return sessionStorage.getItem('nelson.company') ?? '';
    } catch {
      return '';
    }
  });
  const query = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      try {
        return result(await api.GET('/api/me', { signal }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 0,
    refetchInterval: 60_000,
    retry: false,
    networkMode: 'always',
  });
  const { refetch } = query;
  useEffect(() => {
    const expire = () => {
      void cache.cancelQueries({ predicate: privateQuery });
      cache.removeQueries({ predicate: privateQuery });
      cache.setQueryData(['session'], null);
    };
    const channel = new BroadcastChannel('nelson-session');
    channel.onmessage = () => {
      expire();
      void refetch();
    };
    window.addEventListener('session-expired', expire);
    return () => {
      channel.close();
      window.removeEventListener('session-expired', expire);
    };
  }, [cache, refetch]);
  const refresh = async () => {
    await cache.cancelQueries({ predicate: privateQuery });
    cache.removeQueries({ predicate: privateQuery });
    const next = await query.refetch();
    if (next.error) throw next.error;
    const channel = new BroadcastChannel('nelson-session');
    channel.postMessage('changed');
    channel.close();
    return next.data ?? null;
  };
  const logout = async () => {
    await api.POST('/api/auth/sign-out');
    await cache.cancelQueries();
    cache.setQueryData(['session'], null);
    cache.removeQueries({ predicate: privateQuery });
    const channel = new BroadcastChannel('nelson-session');
    channel.postMessage('changed');
    channel.close();
  };
  const chooseCompany = (id: string) => {
    void cache.cancelQueries({ predicate: privateQuery });
    cache.removeQueries({ predicate: privateQuery });
    setCompanyId(id);
    try {
      sessionStorage.setItem('nelson.company', id);
    } catch {
      /* Storage is optional; membership remains server-owned. */
    }
  };
  const member = query.data?.memberships.find((m) => m.company_id === companyId) ?? query.data?.memberships[0];
  return (
    <Context.Provider
      value={{
        session: query.data,
        member,
        loading: query.isPending,
        error: query.error,
        refresh,
        chooseCompany,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing session provider');
  return value;
}

export function useCompany() {
  const { member } = useSession();
  if (!member) throw new Error('Choose a company first.');
  return {
    ...member,
    can: (capability: string) => member.capabilities.includes(capability),
    path: { company_id: member.company_id },
  };
}
