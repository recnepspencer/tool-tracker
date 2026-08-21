import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('tool decision invalidation completion', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/inventory';
  });

  it('keeps the flag decision pending until the active inventory refetch completes', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    let inventoryReads = 0;
    let releaseInventory: ((value: Awaited<ReturnType<typeof baseApi.warehouse.listInventory>>) => void) | undefined;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listInventory: async (input: Parameters<typeof baseApi.warehouse.listInventory>[0]) => {
          inventoryReads += 1;
          if (inventoryReads === 1) return baseApi.warehouse.listInventory(input);
          return new Promise<Awaited<ReturnType<typeof baseApi.warehouse.listInventory>>>((resolve) => {
            releaseInventory = resolve;
          });
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    const row = screen.getByText(/TL-101/).closest('tr');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Flag' }));
    const dialog = await screen.findByRole('dialog', { name: /Flag Hammer drill/i });
    await user.click(within(dialog).getByRole('button', { name: 'Flag tool' }));
    await waitFor(() => expect(inventoryReads).toBeGreaterThan(1));
    expect(
      within(await screen.findByRole('dialog', { name: /Flag Hammer drill/i })).getByRole('button', {
        name: 'Flag tool',
      }),
    ).toBeDisabled();
    releaseInventory?.(await baseApi.warehouse.listInventory({ actorId: 'sam-ochoa', includeArchived: true }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Flag Hammer drill/i })).not.toBeInTheDocument());
  });
});
