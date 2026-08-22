import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { WarehousePrefetchHarness, WarehouseProjectionToggle } from './test-support/warehouse-projection-harness';

describe('warehouse operations surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/queue';
  });

  it('reviews the seeded request through the query boundary and updates inventory', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-19T09:00:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Queue' })).toBeInTheDocument();
    expect(screen.getByText('Bandsaw')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review Bandsaw' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.type(within(dialog).getByLabelText('Decision note'), 'Approved for the morning crew');
    await user.click(within(dialog).getByRole('button', { name: 'Release to worker' }));
    await waitFor(() => expect(screen.queryByText('Bandsaw')).not.toBeInTheDocument());
    await user.click(screen.getByRole('link', { name: 'Operations' }));
    expect(await screen.findByRole('heading', { name: 'Queue' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Operations' }));
    await waitFor(() =>
      expect(database.read().handoffs.find((handoff) => handoff.id === 'HO-1')?.status).toBe('accepted'),
    );
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-108')).toMatchObject({
      holder: { type: 'worker', userId: 'ray-torres' },
    });
    window.location.hash = '#/admin/operations/inventory';
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    const row = screen.getByText('Bandsaw').closest('tr');
    expect(row).toHaveTextContent('Ray Torres');
  });

  it('refetches active and inactive warehouse projections after a decision', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-19T09:00:00-06:00' });
    const baseApi = createMockApi(database);
    const calls = {
      queue: 0,
      inventory: 0,
      summary: 0,
      scopes: 0,
      tools: 0,
      catalog: 0,
      activity: 0,
      adminSummary: 0,
      people: 0,
      person: 0,
      warehouses: 0,
      pending: 0,
      targets: 0,
      detail: 0,
    };
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        listQueue: async (input: Parameters<typeof baseApi.warehouse.listQueue>[0]) => {
          calls.queue += 1;
          return baseApi.warehouse.listQueue(input);
        },
        listInventory: async (input: Parameters<typeof baseApi.warehouse.listInventory>[0]) => {
          calls.inventory += 1;
          return baseApi.warehouse.listInventory(input);
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
      tools: {
        ...baseApi.tools,
        listTools: async () => (calls.tools++, baseApi.tools.listTools()),
        listCatalog: async () => (calls.catalog++, baseApi.tools.listCatalog()),
        getToolDetail: async (toolUnitId: string) => (calls.detail++, baseApi.tools.getToolDetail(toolUnitId)),
      },
      activity: {
        ...baseApi.activity,
        listActivity: async () => (calls.activity++, baseApi.activity.listActivity()),
      },
      admin: {
        ...baseApi.admin,
        getSummary: async (input: { actorId: string }) => (calls.adminSummary++, baseApi.admin.getSummary(input)),
        listPeople: async (input: { actorId: string }) => (calls.people++, baseApi.admin.listPeople(input)),
        getPerson: async (input: { actorId: string; personId: string }) => (
          calls.person++,
          baseApi.admin.getPerson(input)
        ),
        listWarehouses: async (input: { actorId: string }) => (calls.warehouses++, baseApi.admin.listWarehouses(input)),
      },
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: async (profileId: string) => (
          calls.pending++,
          baseApi.custody.listPendingHandoffs(profileId)
        ),
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => (
          calls.targets++,
          baseApi.custody.listTransferTargets(input)
        ),
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <WarehousePrefetchHarness />
        <WarehouseProjectionToggle />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Queue' })).toBeInTheDocument();
    await screen.findByTestId('warehouse-prefetch-ready');
    await waitFor(() => {
      expect(screen.getByTestId('warehouse-probe-tool-holder')).toHaveTextContent('North Yard');
      expect(screen.getByTestId('warehouse-probe-summary-checked-out')).toHaveTextContent('8');
      expect(screen.getByTestId('warehouse-probe-pending')).toHaveTextContent('3');
    });
    await user.click(screen.getByRole('button', { name: 'Disable projection probes' }));
    expect(screen.queryByTestId('warehouse-projection-probe')).not.toBeInTheDocument();
    const before = { ...calls };
    const release = screen.getByRole('button', { name: 'Release to worker' });
    await waitFor(() => expect(release).toBeEnabled());
    await user.click(release);
    const dialog = await screen.findByRole('dialog', { name: 'Review Bandsaw' });
    await user.click(within(dialog).getByRole('button', { name: 'Release to worker' }));
    await waitFor(() => {
      expect(calls.queue).toBeGreaterThan(before.queue);
      expect(calls.inventory).toBeGreaterThan(before.inventory);
      expect(calls.summary).toBeGreaterThan(before.summary);
      expect(calls.scopes).toBeGreaterThan(before.scopes);
      expect(calls.tools).toBeGreaterThan(before.tools);
      expect(calls.catalog).toBeGreaterThan(before.catalog);
      expect(calls.activity).toBeGreaterThan(before.activity);
      expect(calls.adminSummary).toBeGreaterThan(before.adminSummary);
      expect(calls.people).toBeGreaterThan(before.people);
      expect(calls.person).toBeGreaterThan(before.person);
      expect(calls.warehouses).toBeGreaterThan(before.warehouses);
      expect(calls.pending).toBeGreaterThan(before.pending);
      expect(calls.targets).toBeGreaterThan(before.targets);
      expect(calls.detail).toBeGreaterThan(before.detail);
    });
    await user.click(screen.getByRole('button', { name: 'Enable projection probes' }));
    await waitFor(() => {
      expect(screen.getByTestId('warehouse-probe-tool-holder')).toHaveTextContent('Ray Torres');
      expect(screen.getByTestId('warehouse-probe-catalog-checked-out')).toHaveTextContent('1');
      expect(screen.getByTestId('warehouse-probe-activity')).toHaveTextContent('true');
      expect(screen.getByTestId('warehouse-probe-summary-checked-out')).toHaveTextContent('9');
      expect(screen.getByTestId('warehouse-probe-ray-held-tools')).toHaveTextContent('8');
      expect(screen.getByTestId('warehouse-probe-person-held-tools')).toHaveTextContent('8');
      expect(screen.getByTestId('warehouse-probe-north-out')).toHaveTextContent('5');
      expect(screen.getByTestId('warehouse-probe-pending')).toHaveTextContent('2');
      expect(screen.getByTestId('warehouse-probe-targets')).not.toHaveTextContent('0');
      expect(screen.getByTestId('warehouse-probe-detail-holder')).toHaveTextContent('Ray Torres');
    });
    window.location.hash = '#/admin/operations/inventory';
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByText('Bandsaw').closest('tr')).toHaveTextContent('Ray Torres');
  });

  it('keeps loading, error, empty, and responsive filter states explicit', async () => {
    const user = userEvent.setup();
    const pendingApi = {
      ...createMockApi(),
      warehouse: { ...createMockApi().warehouse, listInventory: async () => await new Promise<never>(() => {}) },
    };
    window.location.hash = '#/admin/operations/inventory';
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading warehouse inventory');
    cleanup();
    const errorApi = {
      ...createMockApi(),
      warehouse: {
        ...createMockApi().warehouse,
        listInventory: async () => {
          throw new Error('offline');
        },
      },
    };
    renderApp(<AppRoutes />, { api: errorApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('warehouse inventory could not be loaded');
    cleanup();
    const emptyApi = {
      ...createMockApi(),
      warehouse: { ...createMockApi().warehouse, listInventory: async () => [] },
    };
    renderApp(<AppRoutes />, { api: emptyApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByText('No tools match this inventory view.')).toBeInTheDocument();
    cleanup();
    window.location.hash = '#/admin/operations/inventory';
    renderApp(<AppRoutes />, { api: createMockApi(), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Flagged 2' }));
    expect(screen.getByText('Cable cutter')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'All 20' }));
    const search = screen.getByRole('searchbox', { name: 'Search inventory' });
    await user.type(search, 'Bandsaw');
    expect(screen.getByText('Bandsaw')).toBeInTheDocument();
    expect(screen.queryByText('Cable cutter')).not.toBeInTheDocument();
    const warehouse = screen.getByRole('combobox', { name: 'Warehouse' });
    await user.click(warehouse);
    await user.click(screen.getByRole('option', { name: 'South Shop' }));
    expect(screen.getByRole('combobox', { name: 'Warehouse' })).toHaveValue('South Shop');
  });

  it('keeps queue summary failure truthful and exercises production filters', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const summaryErrorApi = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        getSummary: async () => {
          throw new Error('summary offline');
        },
      },
    };
    renderApp(<AppRoutes />, {
      api: summaryErrorApi,
      sessionStore: createMemorySessionStore('sam-ochoa'),
    });
    expect(await screen.findByRole('heading', { name: 'Queue' })).toBeInTheDocument();
    expect(
      await screen.findByText('The queue summary could not be refreshed. Queue decisions remain available.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release to worker' })).toBeEnabled();
    cleanup();

    window.location.hash = '#/admin/operations/queue';
    renderApp(<AppRoutes />, { api: baseApi, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('tab', { name: 'Requests 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Returns 0' }));
    expect(screen.getByText('Nothing waiting in this view. Requests and returns land here.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'All waiting 1' }));
    const warehouse = screen.getByRole('combobox', { name: 'Warehouse' });
    await user.click(warehouse);
    await user.click(screen.getByRole('option', { name: 'South Shop' }));
    expect(screen.getByRole('combobox', { name: 'Warehouse' })).toHaveValue('South Shop');
  });
});
