import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { queryKeys } from '../../api/query-keys';

function QueueRefetchButton() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseQueueRoot, refetchType: 'all' })}
    >
      Refresh queue
    </button>
  );
}

describe('warehouse queue draft safety', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/queue';
  });

  it('preserves the review draft when a queue decision fails', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        approveRequest: async () => {
          throw new Error('queue offline');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await screen.findByRole('heading', { name: 'Queue' });
    await user.click(
      within(screen.getByText('Bandsaw').closest('article')!).getByRole('button', {
        name: 'Review request for Bandsaw',
      }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Review Bandsaw' });
    const note = within(dialog).getByLabelText('Decision note');
    await user.type(note, 'Retry after connectivity returns');
    await user.click(within(dialog).getByRole('button', { name: 'Release to worker' }));
    expect(
      await screen.findByText('The queue decision failed. Your note is still here; try again.'),
    ).toBeInTheDocument();
    expect(
      within(await screen.findByRole('dialog', { name: 'Review Bandsaw' })).getByLabelText('Decision note'),
    ).toHaveValue('Retry after connectivity returns');
  });

  it('closes a review when a failed decision refresh reveals that the handoff is gone', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let queueReads = 0;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listQueue: async (input: Parameters<typeof baseApi.warehouse.listQueue>[0]) => {
          queueReads += 1;
          return queueReads === 1 ? baseApi.warehouse.listQueue(input) : [];
        },
        approveRequest: async () => {
          throw new Error('handoff already resolved');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    await screen.findByRole('heading', { name: 'Queue' });
    await user.click(
      within(screen.getByText('Bandsaw').closest('article')!).getByRole('button', {
        name: 'Review request for Bandsaw',
      }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Review Bandsaw' });
    await user.click(within(dialog).getByRole('button', { name: 'Release to worker' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Review Bandsaw' })).not.toBeInTheDocument());
    expect(queueReads).toBeGreaterThan(1);
  });

  it('disables every queue decision while an open review refetch is unresolved', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let queueReads = 0;
    let releaseQueue: ((value: Awaited<ReturnType<typeof baseApi.warehouse.listQueue>>) => void) | undefined;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listQueue: async (input: Parameters<typeof baseApi.warehouse.listQueue>[0]) => {
          queueReads += 1;
          if (queueReads === 1) return baseApi.warehouse.listQueue(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.warehouse.listQueue>>>((resolve) => {
            releaseQueue = resolve;
          });
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <QueueRefetchButton />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await screen.findByRole('heading', { name: 'Queue' });
    await user.click(
      within(screen.getByText('Bandsaw').closest('article')!).getByRole('button', {
        name: 'Review request for Bandsaw',
      }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Review Bandsaw' });
    await user.click(screen.getByRole('button', { name: 'Refresh queue' }));
    await waitFor(() => expect(queueReads).toBeGreaterThan(1));
    expect(within(dialog).getByRole('button', { name: /Saving…|Release to worker/ })).toBeDisabled();
    releaseQueue?.(await baseApi.warehouse.listQueue({ actorId: 'sam-ochoa' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Release to worker' })).toBeEnabled());
  });
});
