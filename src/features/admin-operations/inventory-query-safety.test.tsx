import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { queryKeys } from '../../api/query-keys';

function RefreshButton({ queryKey }: { queryKey: readonly string[] }) {
  const queryClient = useQueryClient();
  return (
    <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey })}>
      Refresh authority
    </button>
  );
}

describe('warehouse inventory query safety', () => {
  beforeEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
  });

  it('blocks an open inventory flag dialog while the query is paused offline', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let flagCalls = 0;
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        flagTool: async (input: Parameters<typeof baseApi.tools.flagTool>[0]) => {
          flagCalls += 1;
          return baseApi.tools.flagTool(input);
        },
      },
    };
    window.location.hash = '#/admin/operations/inventory';
    renderApp(
      <>
        <AppRoutes />
        <RefreshButton queryKey={queryKeys.warehouseInventoryRoot} />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    const flagButton = (await screen.findAllByRole('button', { name: 'Flag' }))[0];
    await waitFor(() => expect(flagButton).toBeEnabled());
    await user.click(flagButton);
    const dialog = await screen.findByRole('dialog', { name: /Flag / });
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh authority' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Flag tool' })).toBeDisabled());
    await user.click(within(dialog).getByRole('button', { name: 'Flag tool' }));
    expect(flagCalls).toBe(0);
  });

  it('fails closed on cached flagged rows when inventory refresh errors', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let inventoryCalls = 0;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listInventory: async (input: Parameters<typeof baseApi.warehouse.listInventory>[0]) => {
          inventoryCalls += 1;
          if (inventoryCalls > 1) throw new Error('inventory offline');
          return baseApi.warehouse.listInventory(input);
        },
      },
    };
    window.location.hash = '#/admin/operations/flagged';
    renderApp(
      <>
        <AppRoutes />
        <RefreshButton queryKey={queryKeys.warehouseInventoryRoot} />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Flagged tools' })).toBeInTheDocument();
    const restore = await screen.findByRole('button', { name: 'Restore to stock' });
    await waitFor(() => expect(restore).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Refresh authority' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore to stock' })).toBeDisabled());
    expect(await screen.findByText('Flagged tools could not be refreshed.')).toBeInTheDocument();
  });

  it('removes cached flagged actions when warehouse scopes error', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let scopeCalls = 0;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listScopes: async (input: Parameters<typeof baseApi.warehouse.listScopes>[0]) => {
          scopeCalls += 1;
          if (scopeCalls > 1) throw new Error('scopes offline');
          return baseApi.warehouse.listScopes(input);
        },
      },
    };
    window.location.hash = '#/admin/operations/flagged';
    renderApp(
      <>
        <AppRoutes />
        <RefreshButton queryKey={queryKeys.warehouseScopesRoot} />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Flagged tools' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Restore to stock' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Refresh authority' }));
    expect(
      await screen.findByText('Warehouse scopes could not be loaded. Flagged actions are paused.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore to stock' })).not.toBeInTheDocument();
  });

  it('keeps a flag draft mounted when the command fails', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        flagTool: async () => {
          throw new Error('flag unavailable');
        },
      },
    };
    window.location.hash = '#/admin/operations/inventory';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    const flagButton = (await screen.findAllByRole('button', { name: 'Flag' }))[0];
    await user.click(flagButton);
    const dialog = await screen.findByRole('dialog', { name: /Flag / });
    await user.click(within(dialog).getByRole('button', { name: 'Flag tool' }));
    expect(await within(screen.getByRole('dialog', { name: /Flag / })).findByRole('alert')).toHaveTextContent(
      'flag unavailable',
    );
    expect(screen.getByRole('dialog', { name: /Flag / })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Flag tool' })).toBeEnabled();
  });
});
