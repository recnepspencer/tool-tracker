import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { useApi } from '../../api/api-context';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { openFieldOptions } from '../../test/choose-field-option';
import { useAdminWarehouseMutations } from './use-admin-warehouses';
import { useAdminSummary } from '../admin-dashboard/use-admin-summary';
import { useAdminWarehouses } from './use-admin-warehouses';

function CreateWarehouseHarness() {
  const { create } = useAdminWarehouseMutations();
  return (
    <button
      onClick={() =>
        void create.mutateAsync({
          name: 'West Annex',
          address: '9 Line Ave',
          managerId: 'morgan-price',
        })
      }
    >
      Create west annex
    </button>
  );
}

function ActiveWarehouseProjectionProbe() {
  const api = useApi();
  const summary = useAdminSummary();
  const warehouses = useAdminWarehouses();
  const targets = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
  });
  return (
    <output data-testid="created-active-projections">
      <span data-testid="created-summary">
        {summary.data?.warehouses.some((warehouse) => warehouse.name === 'West Annex') ? 'West Annex' : ''}
      </span>
      <span data-testid="created-warehouses">
        {warehouses.data?.some((warehouse) => warehouse.name === 'West Annex') ? 'West Annex' : ''}
      </span>
      <span data-testid="created-target">{String(targets.data?.some((target) => target.name === 'West Annex'))}</span>
    </output>
  );
}

function InactiveWarehouseProjectionProbe({ onReady }: { onReady(): void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
        queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminWarehouses('sam-ochoa'),
        queryFn: () => api.admin.listWarehouses({ actorId: 'sam-ochoa' }),
      }),
    ]).then(onReady);
  }, [api, onReady, queryClient]);
  const warehouses = useQuery({
    queryKey: queryKeys.adminWarehouses('sam-ochoa'),
    queryFn: () => api.admin.listWarehouses({ actorId: 'sam-ochoa' }),
    enabled: mounted,
  });
  if (!mounted) return <button onClick={() => setMounted(true)}>Mount created warehouse probe</button>;
  return (
    <output data-testid="created-inactive-warehouse">
      {warehouses.data?.some((warehouse) => warehouse.name === 'West Annex') ? 'West Annex' : ''}
    </output>
  );
}

describe('admin warehouse creation projections', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/people';
  });

  it('propagates a created warehouse through summary, choices, transfer targets, and inactive remounts', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const api = createMockApi(database);
    let ready = false;
    renderApp(
      <>
        <AppRoutes />
        <CreateWarehouseHarness />
        <ActiveWarehouseProjectionProbe />
        <InactiveWarehouseProjectionProbe onReady={() => (ready = true)} />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await waitFor(() => expect(ready).toBe(true));
    await user.click(screen.getByRole('button', { name: 'Create west annex' }));
    await waitFor(() => {
      expect(screen.getByTestId('created-summary')).toHaveTextContent('West Annex');
      expect(screen.getByTestId('created-warehouses')).toHaveTextContent('West Annex');
      expect(screen.getByTestId('created-target')).toHaveTextContent('true');
    });
    await user.click(screen.getByRole('button', { name: 'Invite person' }));
    const dialog = await screen.findByRole('dialog', { name: 'Invite a person' });
    const warehouseOptions = await openFieldOptions(
      user,
      within(dialog).getByRole('combobox', { name: 'Home warehouse' }),
    );
    expect(within(warehouseOptions).getByRole('option', { name: 'West Annex' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Mount created warehouse probe' }));
    expect(await screen.findByTestId('created-inactive-warehouse')).toHaveTextContent('West Annex');
  });
});
