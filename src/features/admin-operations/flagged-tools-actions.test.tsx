import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { queryKeys } from '../../api/query-keys';

function RefreshInventoryButton() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventoryRoot })}
    >
      Refresh inventory authority
    </button>
  );
}

describe('flagged tool decision actions', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/flagged';
  });

  it('saves an edit through the canonical definition authority', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Flagged tools' })).toBeInTheDocument();
    const row = screen.getByText('Fish tape, 240 ft').closest('article');
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Fish tape/i });
    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Fish tape — serviced');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Edit Fish tape/i })).not.toBeInTheDocument());
    expect(database.read().definitions.find((definition) => definition.id === 'def-fish-tape')?.name).toBe(
      'Fish tape — serviced',
    );
    expect(database.read().events.at(-1)).toMatchObject({ toolUnitId: 'TL-104', kind: 'admin' });
  });

  it('force-returns a worker-held flagged unit with an auditable receipt', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Flagged tools' })).toBeInTheDocument();
    const row = screen.getByText('Fish tape, 240 ft').closest('article');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Force return' }));
    await waitFor(() =>
      expect(database.read().custody.find((record) => record.toolUnitId === 'TL-104')?.holder.type).toBe('warehouse'),
    );
    expect(screen.getByText('Fish tape, 240 ft')).toBeInTheDocument();
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-104')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'riverside-depot',
    });
    expect(database.read().events.at(-1)).toMatchObject({
      toolUnitId: 'TL-104',
      kind: 'custody',
      actorId: 'sam-ochoa',
    });
  });

  it('decommissions a warehouse-held flagged unit and preserves its history', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Flagged tools' })).toBeInTheDocument();
    const row = screen.getByText('Cable cutter').closest('article');
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Decommission' }));
    const dialog = await screen.findByRole('dialog', { name: /Decommission Cable cutter/i });
    await user.type(within(dialog).getByRole('textbox', { name: 'Reason or evidence note' }), 'Beyond repair');
    await user.click(within(dialog).getByRole('button', { name: 'Decommission' }));
    await waitFor(() => expect(screen.queryByText('Cable cutter')).not.toBeInTheDocument());
    expect(database.read().units.find((unit) => unit.id === 'TL-111')?.lifecycle).toBe('archived');
    expect(database.read().events.at(-1)).toMatchObject({
      toolUnitId: 'TL-111',
      kind: 'admin',
      evidence: { note: 'Beyond repair' },
    });
  });

  it('keeps an edit draft mounted when its command fails', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        updateTool: async () => {
          throw new Error('edit unavailable');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const row = await screen.findByText('Fish tape, 240 ft');
    await user.click(within(row.closest('article') as HTMLElement).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Fish tape/i });
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('edit unavailable')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Edit Fish tape/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('keeps a decommission draft mounted when its command fails', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      warehouse: {
        ...baseApi.warehouse,
        decommissionTool: async () => {
          throw new Error('decommission unavailable');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    const row = await screen.findByText('Cable cutter');
    await user.click(within(row.closest('article') as HTMLElement).getByRole('button', { name: 'Decommission' }));
    const dialog = await screen.findByRole('dialog', { name: /Decommission Cable cutter/i });
    await user.click(within(dialog).getByRole('button', { name: 'Decommission' }));
    expect(await screen.findByText('decommission unavailable')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Decommission Cable cutter/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Decommission' })).toBeEnabled();
  });

  it('closes an edit draft when a refetch reveals a newer revision', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(
      <>
        <AppRoutes />
        <RefreshInventoryButton />
      </>,
      { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    const row = await screen.findByText('Fish tape, 240 ft');
    await user.click(within(row.closest('article') as HTMLElement).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('dialog', { name: /Edit Fish tape/i })).toBeInTheDocument();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-104' ? { ...unit, revision: 2 } : unit)),
    }));
    await user.click(screen.getByRole('button', { name: 'Refresh inventory authority' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Edit Fish tape/i })).not.toBeInTheDocument());
  });
});
