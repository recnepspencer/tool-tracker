import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('inventory flag action', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/inventory';
  });

  it('records condition evidence through the inventory authority', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    const row = screen.getByText('Rotary hammer').closest('tr');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Flag' }));
    const dialog = await screen.findByRole('dialog', { name: /Flag Rotary hammer/i });
    await user.type(within(dialog).getByRole('textbox', { name: 'Evidence note' }), 'Cracked housing');
    await user.click(within(dialog).getByRole('button', { name: 'Flag tool' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Flag Rotary hammer/i })).not.toBeInTheDocument());
    expect(database.read().units.find((unit) => unit.id === 'TL-105')?.condition).toBe('damaged');
    expect(database.read().conditionReports.at(-1)).toMatchObject({
      toolUnitId: 'TL-105',
      reporterId: 'sam-ochoa',
      condition: 'damaged',
      reportedAt: '2026-08-20T09:00:00-06:00',
      evidence: { note: 'Cracked housing' },
    });
  });
});
