import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import type { NelsonApi } from '../../api/contracts';
import { renderApp } from '../../test/render-app';
import { queryKeys } from '../../api/query-keys';

function apiWithAuth(overrides: Partial<NelsonApi['auth']>): NelsonApi {
  const base = createMockApi();
  return { ...base, auth: { ...base.auth, ...overrides } };
}

function RefreshProfilesProbe() {
  const queryClient = useQueryClient();
  return (
    <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.demoProfiles })}>
      Refresh profiles
    </button>
  );
}

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('login query safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/login';
  });

  it('renders an explicit empty state and retries the shared query', async () => {
    const user = userEvent.setup();
    const listDemoProfiles = vi.fn().mockResolvedValue([]);
    renderApp(<AppRoutes />, { api: apiWithAuth({ listDemoProfiles }) });
    expect(await screen.findByText('No demo profiles are available.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload profiles' }));
    await waitFor(() => expect(listDemoProfiles).toHaveBeenCalledTimes(2));
  });

  it('keeps profile cards unavailable during an error and restores them after retry', async () => {
    const user = userEvent.setup();
    const base = createMockApi();
    let attempts = 0;
    const listDemoProfiles = vi.fn().mockImplementation(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('temporary');
      return base.auth.listDemoProfiles();
    });
    renderApp(<AppRoutes />, { api: apiWithAuth({ listDemoProfiles }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Demo profiles could not be loaded.');
    expect(screen.queryByRole('button', { name: 'Enter as Ray' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
  });

  it('removes stale cards while the shared profile query refetches', async () => {
    const user = userEvent.setup();
    const base = createMockApi();
    let calls = 0;
    let release: (() => void) | undefined;
    const listDemoProfiles = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 2)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return base.auth.listDemoProfiles();
    });
    renderApp(
      <>
        <AppRoutes />
        <RefreshProfilesProbe />
      </>,
      { api: apiWithAuth({ listDemoProfiles }) },
    );
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Refresh profiles' }));
    expect(await screen.findByText('Refreshing demo profiles…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enter as Ray' })).not.toBeInTheDocument();
    release?.();
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
  });

  it('removes cached cards during an errored refetch and restores them after retry', async () => {
    const user = userEvent.setup();
    const base = createMockApi();
    let calls = 0;
    const listDemoProfiles = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 2) throw new Error('temporary refetch failure');
      return base.auth.listDemoProfiles();
    });
    const signInAs = vi.fn(base.auth.signInAs);
    renderApp(
      <>
        <AppRoutes />
        <RefreshProfilesProbe />
      </>,
      { api: { ...base, auth: { ...base.auth, listDemoProfiles, signInAs } } },
    );
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Refresh profiles' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demo profiles could not be loaded.');
    expect(screen.queryByRole('button', { name: 'Enter as Ray' })).not.toBeInTheDocument();
    expect(signInAs).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
  });

  it('removes cached cards while an invalidated profile query is paused offline', async () => {
    const user = userEvent.setup();
    const base = createMockApi();
    const listDemoProfiles = vi.fn().mockResolvedValue(await base.auth.listDemoProfiles());
    const signInAs = vi.fn(base.auth.signInAs);
    renderApp(
      <>
        <AppRoutes />
        <RefreshProfilesProbe />
      </>,
      { api: { ...base, auth: { ...base.auth, listDemoProfiles, signInAs } } },
    );
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh profiles' }));
    expect(await screen.findByText('Demo profiles are waiting for the connection to return.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enter as Ray' })).not.toBeInTheDocument();
    expect(signInAs).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
  });

  it('disables every profile while one sign-in command is unsettled', async () => {
    const user = userEvent.setup();
    const api = createMockApi();
    let resolveSignIn: ((value: Awaited<ReturnType<typeof api.auth.signInAs>>) => void) | undefined;
    const signInAs = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<typeof api.auth.signInAs>>>((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    renderApp(<AppRoutes />, { api: { ...api, auth: { ...api.auth, signInAs } } });
    const ray = await screen.findByRole('button', { name: 'Enter as Ray' });
    const sam = screen.getByRole('button', { name: 'Enter as Sam' });
    await user.click(ray);
    expect(ray).toBeDisabled();
    expect(sam).toBeDisabled();
    expect(signInAs).toHaveBeenCalledTimes(1);
    resolveSignIn?.(await api.auth.signInAs('ray-torres'));
  });

  it('keeps the login surface paused and makes no profile call while offline', async () => {
    const user = userEvent.setup();
    const base = createMockApi();
    const listDemoProfiles = vi.fn().mockResolvedValue(await base.auth.listDemoProfiles());
    onlineManager.setOnline(false);
    renderApp(<AppRoutes />, { api: apiWithAuth({ listDemoProfiles }) });
    expect(await screen.findByText('Demo profiles are waiting for the connection to return.')).toBeInTheDocument();
    expect(screen.queryByText('Loading demo profiles…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(listDemoProfiles).not.toHaveBeenCalled();
    onlineManager.setOnline(true);
    expect(await screen.findByRole('button', { name: 'Enter as Ray' })).toBeEnabled();
    expect(listDemoProfiles).toHaveBeenCalled();
  });
});
