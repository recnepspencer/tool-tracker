import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import type { RequestToolInput } from '../../api/contracts/custody-api';
import { AppRoutes } from '../../app/app-routes';
import { queryKeys } from '../../api/query-keys';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { useCustodyMutations } from './use-custody-mutations';

function MutationHarness() {
  const mutations = useCustodyMutations();
  const queryClient = useQueryClient();
  const [pendingFetchStatus, setPendingFetchStatus] = useState('unknown');
  return (
    <div>
      <button
        type="button"
        onClick={() => void mutations.requestTool.mutateAsync({ toolUnitId: 'TL-105', actorId: 'ray-torres' })}
      >
        Run request
      </button>
      <button
        type="button"
        onClick={() =>
          setPendingFetchStatus(
            queryClient.getQueryState(queryKeys.pendingHandoffs('ray-torres'))?.fetchStatus ?? 'missing',
          )
        }
      >
        Read pending query status
      </button>
      <output aria-label="Pending query status">{pendingFetchStatus}</output>
    </div>
  );
}

describe('inactive pending action safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('refetches an inactive pending cache and disables stale handoff actions on remount', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    let resolveRequest: () => void = () => undefined;
    let resolvePending: (handoffs: Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>) => void = () =>
      undefined;
    let pendingCalls = 0;
    let requestStarted = false;
    let pendingRefetchStarted = false;
    let withdrawCalls = 0;
    const pendingRefetchPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>>(
      (resolve) => {
        resolvePending = resolve;
      },
    );
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        requestTool: async (input: RequestToolInput) => {
          requestStarted = true;
          const receipt = await baseApi.custody.requestTool(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.custody.requestTool>>>((resolve) => {
            resolveRequest = () => resolve(receipt);
          });
        },
        withdrawRequest: async (input: Parameters<typeof baseApi.custody.withdrawRequest>[0]) => {
          withdrawCalls += 1;
          return baseApi.custody.withdrawRequest(input);
        },
        listPendingHandoffs: async (profileId: string) => {
          pendingCalls += 1;
          if (!requestStarted) return baseApi.custody.listPendingHandoffs(profileId);
          if (!pendingRefetchStarted) {
            pendingRefetchStarted = true;
            return pendingRefetchPromise;
          }
          return baseApi.custody.listPendingHandoffs(profileId);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    const card = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(card).getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Withdraw request' })).toBeInTheDocument());
    expect(within(card).getByRole('button', { name: 'Withdraw request' })).not.toBeDisabled();
    window.location.hash = '#/worker/checkout';
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run request' }));
    await waitFor(() => expect(requestStarted).toBe(true));
    expect(database.read().handoffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-105' })]),
    );
    resolveRequest();
    await waitFor(() => expect(pendingCalls).toBeGreaterThanOrEqual(2));
    window.location.hash = '#/worker/tools';
    const remountedCard = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(remountedCard).getByRole('button', { name: 'Review' }));
    const unavailable = within(remountedCard).getByRole('button', { name: 'Unavailable' });
    expect(unavailable).toBeDisabled();
    fireEvent.click(unavailable);
    expect(withdrawCalls).toBe(0);
    resolvePending(await baseApi.custody.listPendingHandoffs('ray-torres'));
    await waitFor(() =>
      expect(within(remountedCard).getByRole('button', { name: 'Withdraw request' })).not.toBeDisabled(),
    );
    expect(screen.getAllByRole('article', { name: /pending handoff/i })).toHaveLength(4);
  });

  it('blocks cached pending actions when the authoritative refetch errors', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    let resolveRequest: () => void = () => undefined;
    let rejectPending: (reason?: unknown) => void = () => undefined;
    let requestStarted = false;
    let pendingRefetchStarted = false;
    let withdrawCalls = 0;
    const pendingRefetchPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>>(
      (_resolve, reject) => {
        rejectPending = reject;
      },
    );
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        requestTool: async (input: RequestToolInput) => {
          requestStarted = true;
          const receipt = await baseApi.custody.requestTool(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.custody.requestTool>>>((resolve) => {
            resolveRequest = () => resolve(receipt);
          });
        },
        withdrawRequest: async (input: Parameters<typeof baseApi.custody.withdrawRequest>[0]) => {
          withdrawCalls += 1;
          return baseApi.custody.withdrawRequest(input);
        },
        listPendingHandoffs: async (profileId: string) => {
          if (!requestStarted) return baseApi.custody.listPendingHandoffs(profileId);
          pendingRefetchStarted = true;
          return pendingRefetchPromise;
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    const card = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(card).getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Withdraw request' })).not.toBeDisabled());
    window.location.hash = '#/worker/checkout';
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run request' }));
    await waitFor(() => expect(requestStarted).toBe(true));
    expect(database.read().handoffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-105' })]),
    );
    resolveRequest();
    await waitFor(() => expect(pendingRefetchStarted).toBe(true));
    rejectPending(new Error('pending handoffs offline'));
    window.location.hash = '#/worker/tools';
    const remountedCard = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    expect(await screen.findByText('Pending handoffs could not be loaded.')).toBeInTheDocument();
    await user.click(within(remountedCard).getByRole('button', { name: 'Review' }));
    const unavailable = within(remountedCard).getByRole('button', { name: 'Unavailable' });
    expect(unavailable).toBeDisabled();
    fireEvent.click(unavailable);
    expect(withdrawCalls).toBe(0);
  });

  it('blocks cached pending actions while an invalidated query is paused offline', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    let resolveRequest: () => void = () => undefined;
    let resolvePending: (handoffs: Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>) => void = () =>
      undefined;
    let pendingCalls = 0;
    let requestStarted = false;
    let pendingRefetchStarted = false;
    let withdrawCalls = 0;
    const pendingRefetchPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>>(
      (resolve) => {
        resolvePending = resolve;
      },
    );
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        requestTool: async (input: RequestToolInput) => {
          requestStarted = true;
          const receipt = await baseApi.custody.requestTool(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.custody.requestTool>>>((resolve) => {
            resolveRequest = () => resolve(receipt);
          });
        },
        withdrawRequest: async (input: Parameters<typeof baseApi.custody.withdrawRequest>[0]) => {
          withdrawCalls += 1;
          return baseApi.custody.withdrawRequest(input);
        },
        listPendingHandoffs: async (profileId: string) => {
          pendingCalls += 1;
          if (!requestStarted) return baseApi.custody.listPendingHandoffs(profileId);
          if (!pendingRefetchStarted) {
            pendingRefetchStarted = true;
            return pendingRefetchPromise;
          }
          return baseApi.custody.listPendingHandoffs(profileId);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    const card = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(card).getByRole('button', { name: 'Review' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Withdraw request' })).not.toBeDisabled());
    window.location.hash = '#/worker/checkout';
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Run request' }));
    onlineManager.setOnline(false);
    await waitFor(() => expect(requestStarted).toBe(true));
    expect(database.read().handoffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-105' })]),
    );
    resolveRequest();
    await waitFor(async () => {
      await user.click(screen.getByRole('button', { name: 'Read pending query status' }));
      expect(screen.getByRole('status', { name: 'Pending query status' })).toHaveTextContent('paused');
    });
    window.location.hash = '#/worker/tools';
    const remountedCard = await screen.findByRole('article', { name: 'Bandsaw pending handoff' });
    await user.click(within(remountedCard).getByRole('button', { name: 'Review' }));
    const unavailable = within(remountedCard).getByRole('button', { name: 'Unavailable' });
    expect(unavailable).toBeDisabled();
    fireEvent.click(unavailable);
    expect(withdrawCalls).toBe(0);
    onlineManager.setOnline(true);
    await waitFor(() => expect(pendingCalls).toBeGreaterThanOrEqual(2));
    resolvePending(await baseApi.custody.listPendingHandoffs('ray-torres'));
    await waitFor(() =>
      expect(within(remountedCard).getByRole('button', { name: 'Withdraw request' })).not.toBeDisabled(),
    );
  });
});
