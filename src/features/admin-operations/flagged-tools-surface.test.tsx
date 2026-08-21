import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '../../app/app-routes';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('flagged tools route', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/operations/flagged';
  });

  it('uses the warehouse inventory query and exposes lifecycle-safe restore/edit actions', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-20T09:00:00-06:00' });
    renderApp(<AppRoutes />, { api: createMockApi(database), sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Flagged tools' })).toBeInTheDocument();
    expect(screen.getByText('Cable cutter')).toBeInTheDocument();
    expect(screen.getByText('Fish tape, 240 ft')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Restore to stock' })[0]);
    await waitFor(() => expect(screen.queryByText('Cable cutter')).not.toBeInTheDocument());
    expect(database.read().units.find((unit) => unit.id === 'TL-111')?.condition).toBe('serviceable');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit Fish tape/i });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
