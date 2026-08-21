import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_KEY } from '../api/auth/session-store';
import { createMockApi } from '../api/mock/create-mock-api';
import { queryKeys } from '../api/query-keys';
import { AppRoutes } from './app-routes';
import { useSession } from './session-context';
import { createMemorySessionStore, renderApp } from '../test/render-app';

function SessionProbe() {
  const { session, signIn, signInPending } = useSession();
  const queryClient = useQueryClient();
  return (
    <>
      <button type="button" onClick={() => void signIn('sam-ochoa')}>
        Probe sign in as Sam
      </button>
      <button
        type="button"
        onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.authSessionRoot, refetchType: 'all' })}
      >
        Revalidate session
      </button>
      <span data-testid="session-title">{session?.title ?? 'anonymous'}</span>
      <span data-testid="sign-in-pending">{String(signInPending)}</span>
    </>
  );
}

describe('session boundary', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/login';
  });

  it('signs out, clears persistence, and cannot restore the old profile after remount', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const signOut = vi.fn(baseApi.auth.signOut);
    const api = { ...baseApi, auth: { ...baseApi.auth, signOut } };
    renderApp(<AppRoutes />, { api });
    await user.click(await screen.findByRole('button', { name: 'Enter as Ray' }));
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('ray-torres');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    cleanup();
    renderApp(<AppRoutes />);
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
  });

  it('restores valid persisted identity and rejects unknown persisted identity', async () => {
    const validStore = createMemorySessionStore('sam-ochoa');
    window.location.hash = '#/admin/dashboard';
    renderApp(<AppRoutes />, { sessionStore: validStore });
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();

    cleanup();
    const invalidStore = createMemorySessionStore('missing-profile');
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { sessionStore: invalidStore });
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/login');
    expect(invalidStore.value).toBeNull();
  });

  it('turns a restore failure into a retryable recovery state', async () => {
    const api = createMockApi();
    let restoreAttempts = 0;
    const failingApi = {
      ...api,
      auth: {
        ...api.auth,
        restoreSession: async (profileId: string) => {
          restoreAttempts += 1;
          if (restoreAttempts === 1) throw new Error('offline');
          return api.auth.restoreSession(profileId);
        },
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: failingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be restored');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Retry restore' }));
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(restoreAttempts).toBe(2);
  });

  it('does not let a post-sign-in restore failure overwrite the explicit session', async () => {
    const user = userEvent.setup();
    const api = createMockApi();
    const sessionStore = createMemorySessionStore();
    let restoreAttempts = 0;
    let rejectRestore: ((reason?: unknown) => void) | undefined;
    let rejectionSettled = false;
    const restoreSession = vi.fn(async (profileId: string) => {
      restoreAttempts += 1;
      if (restoreAttempts === 1) {
        return new Promise<Awaited<ReturnType<typeof api.auth.restoreSession>>>((_, reject) => {
          rejectRestore = (reason) => {
            rejectionSettled = true;
            reject(reason);
          };
        });
      }
      return api.auth.restoreSession(profileId);
    });
    const guardedApi = { ...api, auth: { ...api.auth, restoreSession } };
    renderApp(<AppRoutes />, { api: guardedApi, sessionStore });
    await user.click(await screen.findByRole('button', { name: 'Enter as Ray' }));
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await waitFor(() => expect(restoreSession).toHaveBeenCalledTimes(1));
    rejectRestore?.(new Error('restore raced with sign-in'));
    await waitFor(() => expect(rejectionSettled).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(sessionStore.value).toBe('ray-torres');
    expect(screen.getByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    cleanup();
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: guardedApi, sessionStore });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(sessionStore.value).toBe('ray-torres');
    expect(restoreSession).toHaveBeenCalledTimes(2);
  });

  it('logs out an active session when authoritative restore revokes it', async () => {
    const api = createMockApi();
    let restoreAttempts = 0;
    const restoreSession = vi.fn(async (profileId: string) => {
      restoreAttempts += 1;
      if (restoreAttempts === 1) return api.auth.restoreSession(profileId);
      return null;
    });
    const sessionStore = createMemorySessionStore('ray-torres');
    renderApp(
      <>
        <AppRoutes />
        <SessionProbe />
      </>,
      { api: { ...api, auth: { ...api.auth, restoreSession } }, sessionStore },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Revalidate session' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    expect(sessionStore.value).toBeNull();
    expect(screen.getByTestId('session-title')).toHaveTextContent('anonymous');
  });

  it('keeps a fresh explicit sign-in ahead of a late restore response', async () => {
    const api = createMockApi();
    const oldSession = { ...(await api.auth.restoreSession('ray-torres'))!, title: 'Old session' };
    const freshSession = { ...oldSession, title: 'Fresh sign-in' };
    let restoreAttempts = 0;
    let releaseRestore: (() => void) | undefined;
    const restoreSession = vi.fn(async () => {
      restoreAttempts += 1;
      if (restoreAttempts === 1) return oldSession;
      if (restoreAttempts === 2) {
        return new Promise<typeof oldSession>((resolve) => {
          releaseRestore = () => resolve(oldSession);
        });
      }
      return freshSession;
    });
    const signInAs = vi.fn(async () => freshSession);
    const user = userEvent.setup();
    renderApp(
      <>
        <AppRoutes />
        <SessionProbe />
      </>,
      {
        api: { ...api, auth: { ...api.auth, restoreSession, signInAs } },
        sessionStore: createMemorySessionStore('ray-torres'),
      },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(screen.getByTestId('session-title')).toHaveTextContent('Old session');
    await user.click(screen.getByRole('button', { name: 'Revalidate session' }));
    await waitFor(() => expect(restoreSession).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Probe sign in as Sam' }));
    await waitFor(() => expect(signInAs).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('session-title')).toHaveTextContent('Fresh sign-in');
    releaseRestore?.();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(screen.getByTestId('session-title')).toHaveTextContent('Fresh sign-in');
  });

  it('serializes sign-in behind a pending sign-out', async () => {
    const api = createMockApi();
    let releaseSignOut: (() => void) | undefined;
    const signOut = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseSignOut = resolve;
        }),
    );
    const signInAs = vi.fn(api.auth.signInAs);
    const user = userEvent.setup();
    renderApp(
      <>
        <AppRoutes />
        <SessionProbe />
      </>,
      {
        api: { ...api, auth: { ...api.auth, signOut, signInAs } },
        sessionStore: createMemorySessionStore('ray-torres'),
      },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Probe sign in as Sam' }));
    expect(signInAs).not.toHaveBeenCalled();
    expect(screen.getByTestId('sign-in-pending')).toHaveTextContent('true');
    releaseSignOut?.();
    await waitFor(() => expect(signInAs).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
  });
});
