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
    await user.click(row as HTMLElement);
    const drawer = await screen.findByRole('dialog', { name: 'Rotary hammer details' });
    expect(within(drawer).getByText('TL-105')).toBeInTheDocument();
    expect(within(drawer).getByText('North Yard', { selector: 'strong' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Mark damaged' }));
    const dialog = await screen.findByRole('dialog', { name: /Mark damaged: Rotary hammer/i });
    await user.type(within(dialog).getByRole('textbox', { name: 'Evidence note' }), 'Cracked housing');
    await user.click(within(dialog).getByRole('button', { name: 'Mark damaged' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Mark damaged: Rotary hammer/i })).not.toBeInTheDocument(),
    );
    expect(database.read().units.find((unit) => unit.id === 'TL-105')?.condition).toBe('damaged');
    expect(database.read().conditionReports.at(-1)).toMatchObject({
      toolUnitId: 'TL-105',
      reporterId: 'sam-ochoa',
      condition: 'damaged',
      reportedAt: '2026-08-20T09:00:00-06:00',
      evidence: { note: 'Cracked housing' },
    });
  });

  it('exposes and records lost as a first-class inventory action', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-20T09:30:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    await user.click(screen.getByText('Rotary hammer').closest('tr') as HTMLElement);
    const drawer = await screen.findByRole('dialog', { name: 'Rotary hammer details' });
    expect(within(drawer).getByRole('button', { name: 'Mark lost' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Mark lost' }));
    const dialog = await screen.findByRole('dialog', { name: /Mark lost: Rotary hammer/i });
    expect(within(dialog).getByRole('heading', { name: 'Mark lost' })).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: 'Condition' })).toHaveTextContent('Lost');
    await user.type(within(dialog).getByRole('textbox', { name: 'Evidence note' }), 'Unable to locate');
    await user.click(within(dialog).getByRole('button', { name: 'Mark lost' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Mark lost: Rotary hammer/i })).not.toBeInTheDocument(),
    );
    expect(database.read().units.find((unit) => unit.id === 'TL-105')?.condition).toBe('lost');
    expect(database.read().conditionReports.at(-1)).toMatchObject({
      toolUnitId: 'TL-105',
      reporterId: 'sam-ochoa',
      condition: 'lost',
      reportedAt: '2026-08-20T09:30:00-06:00',
      evidence: { note: 'Unable to locate' },
    });
  });

  it('keeps checked-out custody and condition actions visible in equal rows', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-20T10:00:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    await user.click(screen.getByText('Fluke 87V multimeter').closest('tr') as HTMLElement);
    const drawer = await screen.findByRole('dialog', { name: 'Fluke 87V multimeter details' });
    const rows = drawer.querySelectorAll('.inventory-drawer__action-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Force return' })).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: 'Mark damaged' })).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByRole('button', { name: 'Mark lost' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Decommission tool' })).not.toBeInTheDocument();

    await user.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Mark lost' }));
    const dialog = await screen.findByRole('dialog', { name: /Mark lost: Fluke 87V multimeter/i });
    await user.click(within(dialog).getByRole('button', { name: 'Mark lost' }));
    await waitFor(() => expect(database.read().units.find((unit) => unit.id === 'TL-102')?.condition).toBe('lost'));
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-102')?.holder).toEqual({
      type: 'worker',
      userId: 'ray-torres',
    });
  });
});
