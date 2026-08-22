import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

const duplicateCard = () => screen.getByText('Hammer drill · TL-101').closest('.surface-card') as HTMLElement;

function RefreshReconciliationAuthority() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.reconciliationRoot, refetchType: 'all' })}
    >
      Refresh reconciliation authority
    </button>
  );
}

describe('reconciliation surface', () => {
  beforeEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/reconciliation';
  });

  afterEach(() => {
    onlineManager.setOnline(true);
    cleanup();
  });

  it('merges the seeded duplicate through TanStack invalidation and removes the resolved card', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    await user.click(within(duplicateCard()).getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review reconciliation issue' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Evidence note' }), 'Verified duplicate');
    await user.click(within(dialog).getByRole('button', { name: 'Keep selected record' }));
    await waitFor(() => expect(screen.queryByText('Hammer drill · TL-101')).not.toBeInTheDocument());
    expect(database.read().units.find((unit) => unit.id === 'TL-103')?.lifecycle).toBe('archived');
    expect(database.read().events.at(-1)).toMatchObject({ action: 'Merged TL-103 into TL-101' });
  });

  it('keeps mismatch evidence local and resolves the recorded holder choice', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const before = database.read();
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    const mismatchCard = await screen.findByText('Rotary hammer');
    await user.click(
      within(mismatchCard.closest('.surface-card') as HTMLElement).getByRole('button', { name: 'Review' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Review reconciliation issue' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep recorded custody' }));
    await user.type(within(dialog).getByRole('textbox', { name: 'Evidence note' }), 'Scan not trusted');
    await user.click(within(dialog).getByRole('button', { name: 'Resolve mismatch' }));
    await waitFor(() => expect(screen.queryByText('Rotary hammer')).not.toBeInTheDocument());
    expect(database.read().custody).toEqual(before.custody);
  });

  it('fails closed with a retry surface when the worklist query errors', async () => {
    const baseApi = createMockApi();
    let attempts = 0;
    const api = {
      ...baseApi,
      reconciliation: {
        ...baseApi.reconciliation,
        listIssues: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('reconciliation offline');
          return baseApi.reconciliation.listIssues({ actorId: 'sam-ochoa' });
        },
      },
    };
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('worklist could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
  });

  it('blocks reconciliation decisions while the authoritative worklist is paused offline', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let mergeCalls = 0;
    const api = {
      ...baseApi,
      reconciliation: {
        ...baseApi.reconciliation,
        mergeDuplicate: async (input: Parameters<typeof baseApi.reconciliation.mergeDuplicate>[0]) => {
          mergeCalls += 1;
          return baseApi.reconciliation.mergeDuplicate(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <RefreshReconciliationAuthority />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    await user.click(within(duplicateCard()).getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review reconciliation issue' });
    const merge = within(dialog).getByRole('button', { name: 'Keep selected record' });
    onlineManager.setOnline(false);
    await user.click(screen.getByRole('button', { name: 'Refresh reconciliation authority' }));
    await waitFor(() => expect(merge).toBeDisabled());
    await user.click(merge);
    expect(mergeCalls).toBe(0);
  });

  it('disables duplicate merge submissions until the command settles', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let calls = 0;
    let release: (() => void) | undefined;
    const api = {
      ...baseApi,
      reconciliation: {
        ...baseApi.reconciliation,
        mergeDuplicate: async (input: Parameters<typeof baseApi.reconciliation.mergeDuplicate>[0]) => {
          calls += 1;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          return baseApi.reconciliation.mergeDuplicate(input);
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    await user.click(within(duplicateCard()).getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review reconciliation issue' });
    const merge = within(dialog).getByRole('button', { name: 'Keep selected record' });
    await user.click(merge);
    await waitFor(() => expect(calls).toBe(1));
    expect(merge).toBeDisabled();
    await user.click(merge);
    expect(calls).toBe(1);
    release?.();
    await waitFor(() => expect(screen.queryByText('Hammer drill · TL-101')).not.toBeInTheDocument());
  });

  it('preserves reconciliation evidence when a merge command fails', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    const api = {
      ...baseApi,
      reconciliation: {
        ...baseApi.reconciliation,
        mergeDuplicate: async () => {
          throw new Error('merge conflict');
        },
      },
    };
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    await user.click(within(duplicateCard()).getByRole('button', { name: 'Review' }));
    const dialog = await screen.findByRole('dialog', { name: 'Review reconciliation issue' });
    const note = within(dialog).getByRole('textbox', { name: 'Evidence note' });
    await user.type(note, 'Keep this proof');
    await user.click(within(dialog).getByRole('button', { name: 'Keep selected record' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('merge conflict');
    expect(note).toHaveValue('Keep this proof');
    expect(screen.getByRole('dialog', { name: 'Review reconciliation issue' })).toBeInTheDocument();
  });
});
