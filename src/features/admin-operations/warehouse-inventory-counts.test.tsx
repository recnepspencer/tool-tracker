import { cleanup, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('warehouse inventory count semantics', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/inventory';
  });

  it('keeps active inventory counts separate from archived rows', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-105' ? { ...unit, lifecycle: 'archived' } : unit)),
    }));
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(screen.getByText('19 of 19 tools · All warehouses')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('Rotary hammer')).not.toBeInTheDocument();
    const individualRows = screen.getAllByRole('button', { name: /^Open .*, TL-\d+$/ }).length;
    const groupedUnits = screen
      .getAllByRole('button', { name: /^Expand .*, \d+ tools$/ })
      .reduce((total, group) => total + Number(group.getAttribute('aria-label')?.match(/(\d+) tools$/)?.[1] ?? 0), 0);
    expect(individualRows + groupedUnits).toBe(19);
  });

  it('keeps the warehouse summary archive count separate from active inventory', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-105' ? { ...unit, lifecycle: 'archived' } : unit)),
    }));
    const api = createMockApi(database);
    await expect(api.warehouse.getSummary({ actorId: 'sam-ochoa' })).resolves.toMatchObject({
      inventoryCount: 19,
      archivedCount: 1,
    });
  });
});
