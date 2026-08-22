import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { renderApp, createMemorySessionStore } from '../../test/render-app';
import userEvent from '@testing-library/user-event';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/query-keys';
import { chooseFieldOption } from '../../test/choose-field-option';

function InvalidateWarehouseScopes() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() =>
        void queryClient.invalidateQueries({
          queryKey: queryKeys.warehouseScopes('sam-ochoa'),
          refetchType: 'all',
        })
      }
    >
      Refresh warehouse scopes
    </button>
  );
}

afterEach(() => {
  onlineManager.setOnline(true);
  cleanup();
});

describe('warehouse scope failure surfaces', () => {
  it('surfaces queue scope failure and keeps decisions blocked', async () => {
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listScopes: async () => {
          throw new Error('scopes offline');
        },
      },
    };
    window.location.hash = '#/admin/operations/queue';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(
      await screen.findByText('Warehouse scopes could not be loaded. Decisions are paused until it recovers.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    screen.getAllByRole('button', { name: /Review request/ }).forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('fails closed instead of silently offering an all-warehouses inventory view', async () => {
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listScopes: async () => {
          throw new Error('scopes offline');
        },
      },
    };
    window.location.hash = '#/admin/operations/inventory';
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(
      await screen.findByText(
        'Warehouse scopes could not be loaded. Inventory filters are unavailable until it recovers.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Warehouse' })).not.toBeInTheDocument();
  });

  it('blocks warehouse stocking while cached scope authority is paused offline', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/admin/operations/inventory';
    renderApp(
      <>
        <AppRoutes />
        <InvalidateWarehouseScopes />
      </>,
      { api: createMockApi(), sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await user.click(await screen.findByRole('button', { name: 'Add tool' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add tools to inventory' });
    await user.type(screen.getByLabelText('Tool name'), 'Paused stock');
    await chooseFieldOption(user, screen.getByRole('combobox', { name: 'Category' }), 'Power tools');
    const submit = within(dialog).getByRole('button', { name: 'Add tool' });
    expect(submit).toBeEnabled();

    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh warehouse scopes' }));
    await waitFor(() => expect(submit).toBeDisabled());
    expect(dialog).toBeInTheDocument();
  });
});
