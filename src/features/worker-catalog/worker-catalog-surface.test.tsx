import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('worker catalog surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/checkout';
  });

  it('searches, filters, switches catalog views, clears no-results, and opens complete detail', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    let filters = screen.getByRole('dialog', { name: 'Catalog filters' });
    expect(filters.closest('.worker-filter-layer')?.parentElement).toBe(document.body);
    expect(screen.getByAltText('Hammer drill product photo')).toHaveAttribute('loading', 'eager');
    expect(screen.getByAltText('Hammer drill product photo')).toHaveAttribute('fetchpriority', 'high');
    expect(within(filters).getByRole('button', { name: 'Available only' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(filters).getByRole('button', { name: 'Done' }));
    const filterButton = screen.getByRole('button', { name: 'Filter catalog' });
    await user.click(filterButton);
    filters = screen.getByRole('dialog', { name: 'Catalog filters' });
    await user.tab({ shift: true });
    expect(within(filters).getByRole('button', { name: 'Done' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Catalog filters' })).not.toBeInTheDocument();
    expect(filterButton).toHaveFocus();
    const hammerCard = screen.getByText('Hammer drill').closest('article') as HTMLElement;
    expect(hammerCard).toHaveAttribute('aria-label', 'Open Hammer drill');
    expect(within(hammerCard).queryByRole('button', { name: /Check out/ })).not.toBeInTheDocument();
    expect(within(hammerCard).queryByText('South Shop')).not.toBeInTheDocument();
    expect(within(hammerCard).queryByText('Riverside Depot')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Hammer drill' }));
    const requestDialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(requestDialog).getByRole('heading', { name: 'Request from South Shop' })).toBeInTheDocument();
    expect(requestDialog.querySelector('input[type="file"]')).not.toBeInTheDocument();
    await user.click(within(requestDialog).getByRole('combobox', { name: 'Warehouse' }));
    const warehouseOptions = screen.getByRole('dialog', { name: 'Choose Warehouse' });
    expect(within(warehouseOptions).getByRole('option', { name: /South Shop/ })).toBeInTheDocument();
    expect(within(warehouseOptions).getByRole('option', { name: /Riverside Depot/ })).toBeInTheDocument();
    await user.click(within(warehouseOptions).getByRole('option', { name: /Riverside Depot/ }));
    expect(await within(requestDialog).findByText('TL-118')).toBeInTheDocument();
    expect(within(requestDialog).getAllByText('Riverside Depot').length).toBeGreaterThan(0);
    await user.click(within(requestDialog).getByRole('button', { name: 'Close tool details' }));
    const search = screen.getByRole('searchbox', { name: 'Search tools' });
    await user.type(search, 'Bandsaw');
    expect(screen.getByRole('button', { name: 'Open Bandsaw' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check out/ })).not.toBeInTheDocument();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Filter catalog' }));
    filters = screen.getByRole('dialog', { name: 'Catalog filters' });
    await user.click(within(filters).getByRole('button', { name: 'Available only' }));
    await user.click(within(filters).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Open Rotary hammer' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter catalog' }));
    filters = screen.getByRole('dialog', { name: 'Catalog filters' });
    await user.click(within(filters).getByRole('button', { name: 'Ladders' }));
    await user.click(within(filters).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Open Extension ladder, 24 ft' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check out/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filter catalog' }));
    filters = screen.getByRole('dialog', { name: 'Catalog filters' });
    await user.click(within(filters).getByRole('button', { name: 'All categories' }));
    await user.click(within(filters).getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'List' }));
    expect(document.querySelector('.catalog-grid--list')).toBeInTheDocument();
    await user.type(search, 'no such tool');
    expect(await screen.findByRole('heading', { name: 'No tools match those filters.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.click(screen.getByRole('button', { name: 'Open Rotary hammer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(dialog).getByRole('heading', { name: 'Request from North Yard' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('North Yard')).toHaveLength(2);
    expect(within(dialog).getByText('Added a tool to inventory')).toBeInTheDocument();
  }, 15000);

  it('keeps checkout loading and rejection states explicit', async () => {
    const baseApi = createMockApi();
    let resolveCatalog: (catalog: Awaited<ReturnType<typeof baseApi.tools.listCatalog>>) => void = () => undefined;
    const catalogPromise = new Promise<Awaited<ReturnType<typeof baseApi.tools.listCatalog>>>((resolve) => {
      resolveCatalog = resolve;
    });
    const pendingApi = { ...baseApi, tools: { ...baseApi.tools, listCatalog: () => catalogPromise } };
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByText('Loading the checkout catalog…')).toBeInTheDocument();
    resolveCatalog(await baseApi.tools.listCatalog());
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    cleanup();
    const rejectingApi = {
      ...baseApi,
      tools: { ...baseApi.tools, listCatalog: async () => Promise.reject(new Error('catalog offline')) },
    };
    window.location.hash = '#/worker/checkout';
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('checkout catalog could not be loaded'));
  });

  it('keeps detail loading and rejection states truthful', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let resolveDetail: (detail: Awaited<ReturnType<typeof baseApi.tools.getToolDetail>>) => void = () => undefined;
    const detailPromise = new Promise<Awaited<ReturnType<typeof baseApi.tools.getToolDetail>>>((resolve) => {
      resolveDetail = resolve;
    });
    const pendingApi = { ...baseApi, tools: { ...baseApi.tools, getToolDetail: () => detailPromise } };
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog', { name: 'Catalog filters' })).getByRole('button', { name: 'Done' }),
    );
    await user.click(screen.getByRole('button', { name: 'Open Rotary hammer' }));
    expect(await screen.findByText('Loading tool details…')).toBeInTheDocument();
    resolveDetail(await baseApi.tools.getToolDetail('TL-105'));
    expect(await screen.findByText('Added a tool to inventory')).toBeInTheDocument();
    cleanup();
    const rejectingApi = {
      ...baseApi,
      tools: { ...baseApi.tools, getToolDetail: async () => Promise.reject(new Error('offline')) },
    };
    window.location.hash = '#/worker/checkout';
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Rotary hammer' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not be loaded'));
  });

  it('scopes a multi-unit card and opens the filtered unit independently', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const baseDetail = await baseApi.tools.getToolDetail('TL-101');
    const baseActivity = (await baseApi.activity.listActivity()).find((event) => event.toolUnitId === 'TL-105');
    expect(baseActivity).toBeDefined();
    const southDetail = {
      ...baseDetail,
      tool: {
        ...baseDetail.tool,
        id: 'TL-201',
        status: 'in-stock' as const,
        holder: { type: 'warehouse' as const, warehouseId: 'south-shop', name: 'South Shop' },
        serial: 'S-201',
        lastMoved: 'In stock since Aug 17',
        lastMovedAt: '2026-08-17T15:00:00Z',
      },
      originWarehouse: { id: 'south-shop', name: 'South Shop' },
      condition: 'serviceable' as const,
      lifecycle: 'active' as const,
      timeline: [
        {
          ...baseActivity!,
          id: 'EV-201',
          action: 'Received at South Shop',
          toolUnitId: 'TL-201',
          toolName: 'Hammer drill',
          imageSrc: './tool-images/hammer-drill.png',
          time: 'Aug 17, 2026, 11:00 AM',
          timestamp: '2026-08-17T11:00:00-06:00',
          warehouseId: 'south-shop',
          warehouseName: 'South Shop',
        },
      ],
    };
    const multiUnit = {
      id: 'def-hammer-drill',
      name: 'Hammer drill',
      brand: 'DeWalt',
      model: 'DCD996',
      category: 'Power tools',
      imageSrc: './tool-images/hammer-drill.png',
      unitIds: ['TL-101', 'TL-201'],
      units: [
        { id: 'TL-101', warehouseId: 'north-yard', status: 'checked-out' as const },
        { id: 'TL-201', warehouseId: 'south-shop', status: 'in-stock' as const },
      ],
      totalCount: 2,
      availableCount: 1,
      checkedOutCount: 1,
      damagedCount: 0,
      lostCount: 0,
      warehouses: [
        { id: 'north-yard', name: 'North Yard', unitCount: 1 },
        { id: 'south-shop', name: 'South Shop', unitCount: 1 },
      ],
    };
    const multiApi = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        listCatalog: async () => [multiUnit],
        getToolDetail: async (unitId: string) => (unitId === 'TL-201' ? southDetail : baseDetail),
      },
    };
    renderApp(<AppRoutes />, { api: multiApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Browse tools' })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog', { name: 'Catalog filters' })).getByRole('button', { name: 'Done' }),
    );
    expect(screen.queryByRole('button', { name: /Check out/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Hammer drill' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Filter catalog' }));
    const filters = screen.getByRole('dialog', { name: 'Catalog filters' });
    await user.click(within(filters).getByRole('button', { name: 'South Shop' }));
    await user.click(within(filters).getByRole('button', { name: 'Available only' }));
    await user.click(within(filters).getByRole('button', { name: 'Done' }));
    expect(screen.getByText('1 available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Hammer drill' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check out/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Hammer drill' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    expect(within(dialog).getAllByText('South Shop')).toHaveLength(2);
    expect(within(dialog).getByText('Serviceable')).toBeInTheDocument();
    expect(within(dialog).getByText('Active')).toBeInTheDocument();
    expect(within(dialog).getByText('Received at South Shop')).toBeInTheDocument();
    expect(within(dialog).getByText('TL-201')).toBeInTheDocument();
    expect(within(dialog).getByText('S-201')).toBeInTheDocument();
  });
});
