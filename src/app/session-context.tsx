import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthSession } from '../domain/auth';
import { browserSessionStore, type SessionStore } from '../api/auth/session-store';
import { queryKeys } from '../api/query-keys';
import { useSessionAuth } from '../features/auth/session/use-session-auth';

interface SessionContextValue {
  session: AuthSession | null;
  status: 'loading' | 'anonymous' | 'authenticated';
  restoreError: string | null;
  signIn(profileId: string): Promise<void>;
  signOut(): void;
  retryRestore(): void;
  signInPending: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  children: ReactNode;
  sessionStore?: SessionStore;
}

export function SessionProvider({ children, sessionStore = browserSessionStore }: SessionProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<SessionContextValue['status']>('loading');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [authGeneration, setAuthGeneration] = useState(0);
  const [transitionPending, setTransitionPending] = useState(false);
  const authGenerationRef = useRef(0);
  const transitionSequenceRef = useRef(0);
  const transitionQueueRef = useRef(Promise.resolve());
  const queryClient = useQueryClient();
  const storedProfileId = sessionStore.read();
  const { restore, signIn: signInMutation, signOut: signOutMutation } = useSessionAuth(storedProfileId, restoreNonce);
  const beginTransition = useCallback(() => {
    const nextGeneration = authGenerationRef.current + 1;
    authGenerationRef.current = nextGeneration;
    setAuthGeneration(nextGeneration);
    return nextGeneration;
  }, []);
  const enqueueTransition = useCallback(<T,>(operation: () => Promise<T>) => {
    const sequence = transitionSequenceRef.current + 1;
    transitionSequenceRef.current = sequence;
    setTransitionPending(true);
    const queued = transitionQueueRef.current.then(operation, operation);
    transitionQueueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    void queued.then(
      () => {
        if (transitionSequenceRef.current === sequence) setTransitionPending(false);
      },
      () => {
        if (transitionSequenceRef.current === sequence) setTransitionPending(false);
      },
    );
    return queued;
  }, []);
  const clearRestoreQueries = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: queryKeys.authSessionRoot });
    queryClient.removeQueries({ queryKey: queryKeys.authSessionRoot });
  }, [queryClient]);

  useEffect(() => {
    if (authGeneration !== authGenerationRef.current || storedProfileId !== sessionStore.read()) return;
    if (!storedProfileId) {
      if (session) return;
      setSession(null);
      setRestoreError(null);
      setStatus('anonymous');
      return;
    }
    if (restore.isPending) {
      if (!session) setStatus('loading');
      return;
    }
    if (restore.isError) {
      if (session) return;
      setSession(null);
      setRestoreError('Your saved demo session could not be restored. Choose a profile to continue.');
      setStatus('anonymous');
      return;
    }
    const restored = restore.data ?? null;
    setSession(restored);
    setRestoreError(null);
    if (!restored) sessionStore.clear();
    setStatus(restored ? 'authenticated' : 'anonymous');
  }, [authGeneration, restore.data, restore.isError, restore.isPending, session, sessionStore, storedProfileId]);

  const signIn = useCallback(
    async (profileId: string) => {
      const generation = beginTransition();
      await enqueueTransition(async () => {
        await clearRestoreQueries();
        const next = await signInMutation.mutateAsync(profileId);
        if (generation !== authGenerationRef.current) return;
        sessionStore.write(next.profileId);
        setRestoreNonce((value) => value + 1);
        setRestoreError(null);
        setSession(next);
        setStatus('authenticated');
      });
    },
    [beginTransition, clearRestoreQueries, enqueueTransition, sessionStore, signInMutation],
  );

  const signOut = useCallback(() => {
    beginTransition();
    void enqueueTransition(async () => {
      sessionStore.clear();
      setSession(null);
      setRestoreError(null);
      setRestoreNonce((value) => value + 1);
      setStatus('anonymous');
      await clearRestoreQueries();
      await signOutMutation.mutateAsync().catch(() => undefined);
    }).catch(() => undefined);
  }, [beginTransition, clearRestoreQueries, enqueueTransition, sessionStore, signOutMutation]);

  const retryRestore = useCallback(() => {
    beginTransition();
    setRestoreNonce((value) => value + 1);
  }, [beginTransition]);

  const value = useMemo(
    () => ({
      session,
      status,
      restoreError,
      signIn,
      signOut,
      retryRestore,
      signInPending: signInMutation.isPending || transitionPending,
    }),
    [session, status, restoreError, signIn, signOut, retryRestore, signInMutation.isPending, transitionPending],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
