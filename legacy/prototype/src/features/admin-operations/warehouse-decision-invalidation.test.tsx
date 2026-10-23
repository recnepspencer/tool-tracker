import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { WarehousePrefetchHarness } from './test-support/warehouse-projection-harness';

describe('warehouse decision invalidation', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/flagged';
  });

  it('refetches the warehouse projections after a force return', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    const calls = { inventory: 0, queue: 0, summary: 0, scopes: 0 };
    let holdInventory = false;
    let releaseInventory: (() => void) | undefined;
    let returnCalls = 0;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        returnTool: async (input: Parameters<typeof baseApi.warehouse.returnTool>[0]) => {
          returnCalls += 1;
          return baseApi.warehouse.returnTool(input);
        },
        listInventory: async (input: Parameters<typeof baseApi.warehouse.listInventory>[0]) => {
          calls.inventory += 1;
          if (holdInventory) {
            holdInventory = false;
            return new Promise<Awaited<ReturnType<typeof baseApi.warehouse.listInventory>>>((resolve) => {
              releaseInventory = () => resolve(baseApi.warehouse.listInventory(input));
            });
          }
          return baseApi.warehouse.listInventory(input);
        },
        listQueue: async (input: Parameters<typeof baseApi.warehouse.listQueue>[0]) => {
          calls.queue += 1;
          return baseApi.warehouse.listQueue(input);
        },
        getSummary: async (input: Parameters<typeof baseApi.warehouse.getSummary>[0]) => {
          calls.summary += 1;
          return baseApi.warehouse.getSummary(input);
        },
        listScopes: async (input: Parameters<typeof baseApi.warehouse.listScopes>[0]) => {
          calls.scopes += 1;
          return baseApi.warehouse.listScopes(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <WarehousePrefetchHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Damaged & lost' })).toBeInTheDocument();
    await screen.findByTestId('warehouse-prefetch-ready');
    const before = { ...calls };
    holdInventory = true;
    const row = screen.getByText('Fish tape, 240 ft').closest('article');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Force return' }));
    await waitFor(() =>
      expect(database.read().custody.find((record) => record.toolUnitId === 'TL-104')?.holder.type).toBe('warehouse'),
    );
    await waitFor(() => expect(releaseInventory).toBeDefined());
    expect(screen.getByTestId('warehouse-decision-pending')).toHaveTextContent('Saving warehouse decision');
    const staleButton = within(row as HTMLElement).getByRole('button', { name: 'Force return' });
    expect(staleButton).toBeDisabled();
    await user.click(staleButton);
    expect(returnCalls).toBe(1);
    releaseInventory?.();
    await waitFor(() =>
      expect(screen.getByTestId('warehouse-decision-pending')).not.toHaveTextContent('Saving warehouse decision'),
    );
    await waitFor(() => {
      expect(calls.inventory).toBeGreaterThan(before.inventory);
      expect(calls.queue).toBeGreaterThan(before.queue);
      expect(calls.summary).toBeGreaterThan(before.summary);
      expect(calls.scopes).toBeGreaterThan(before.scopes);
    });
  });

  it('refetches the warehouse projections after decommissioning a unit', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    const calls = { inventory: 0, queue: 0, summary: 0, scopes: 0 };
    let holdInventory = false;
    let releaseInventory: (() => void) | undefined;
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listInventory: async (input: Parameters<typeof baseApi.warehouse.listInventory>[0]) => {
          calls.inventory += 1;
          if (holdInventory) {
            holdInventory = false;
            return new Promise<Awaited<ReturnType<typeof baseApi.warehouse.listInventory>>>((resolve) => {
              releaseInventory = () => resolve(baseApi.warehouse.listInventory(input));
            });
          }
          return baseApi.warehouse.listInventory(input);
        },
        listQueue: async (input: Parameters<typeof baseApi.warehouse.listQueue>[0]) => {
          calls.queue += 1;
          return baseApi.warehouse.listQueue(input);
        },
        getSummary: async (input: Parameters<typeof baseApi.warehouse.getSummary>[0]) => {
          calls.summary += 1;
          return baseApi.warehouse.getSummary(input);
        },
        listScopes: async (input: Parameters<typeof baseApi.warehouse.listScopes>[0]) => {
          calls.scopes += 1;
          return baseApi.warehouse.listScopes(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <WarehousePrefetchHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Damaged & lost' })).toBeInTheDocument();
    await screen.findByTestId('warehouse-prefetch-ready');
    const before = { ...calls };
    holdInventory = true;
    const row = screen.getByText('Cable cutter').closest('article');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Decommission' }));
    const dialog = await screen.findByRole('dialog', { name: /Decommission Cable cutter/i });
    await user.click(within(dialog).getByRole('button', { name: 'Decommission' }));
    await waitFor(() => expect(database.read().units.find((unit) => unit.id === 'TL-111')?.lifecycle).toBe('archived'));
    await waitFor(() => expect(releaseInventory).toBeDefined());
    expect(screen.getByTestId('warehouse-decision-pending')).toHaveTextContent('Saving warehouse decision');
    expect(screen.getByRole('dialog', { name: /Decommission Cable cutter/i })).toBeInTheDocument();
    releaseInventory?.();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Decommission Cable cutter/i })).not.toBeInTheDocument(),
    );
    await waitFor(() => {
      expect(calls.inventory).toBeGreaterThan(before.inventory);
      expect(calls.queue).toBeGreaterThan(before.queue);
      expect(calls.summary).toBeGreaterThan(before.summary);
      expect(calls.scopes).toBeGreaterThan(before.scopes);
    });
  });

  it('refetches tool details after a committed command returns an invalid receipt', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    const calls = { details: 0 };
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        getToolDetail: async (toolUnitId: string) => {
          if (toolUnitId === 'TL-104') calls.details += 1;
          return baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      warehouse: {
        ...baseApi.warehouse,
        returnTool: async (input: Parameters<typeof baseApi.warehouse.returnTool>[0]) => {
          await baseApi.warehouse.returnTool(input);
          throw new Error('Invalid API response: return receipt');
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <WarehousePrefetchHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Damaged & lost' })).toBeInTheDocument();
    await screen.findByTestId('warehouse-prefetch-ready');
    const before = calls.details;
    const row = screen.getByText('Fish tape, 240 ft').closest('article');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Force return' }));
    await waitFor(() =>
      expect(database.read().custody.find((record) => record.toolUnitId === 'TL-104')?.holder.type).toBe('warehouse'),
    );
    await waitFor(() => expect(calls.details).toBeGreaterThan(before));
  });
});
