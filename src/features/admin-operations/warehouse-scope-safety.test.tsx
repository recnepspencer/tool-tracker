import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { renderApp, createMemorySessionStore } from '../../test/render-app';

afterEach(() => {
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
    expect(screen.getByRole('button', { name: 'Release to worker' })).toBeDisabled();
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
});
