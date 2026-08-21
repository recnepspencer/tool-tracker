import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('admin activity surface', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/activity';
  });

  it('renders newest-first audit history and filters by tool/action text', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    const rows = screen.getAllByRole('article');
    expect(rows[0]).toHaveTextContent('Bandsaw');
    const search = screen.getByRole('searchbox', { name: 'Search audit log' });
    await user.type(search, 'Fish tape');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article')).toHaveTextContent('Fish tape, 240 ft');
  });

  it('filters audit history by semantic kind and warehouse', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(screen.getByRole('option', { name: 'Requests' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article')).toHaveTextContent('Requested a bandsaw handoff');
    expect(screen.queryByText('Reported a tool damaged')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(screen.getByRole('option', { name: 'Everything' }));
    await user.click(screen.getByRole('combobox', { name: 'Warehouse' }));
    await user.click(screen.getByRole('option', { name: 'North Yard' }));
    expect(screen.getByText('Requested a bandsaw handoff')).toBeInTheDocument();
    expect(screen.getByText('Added a tool to inventory')).toBeInTheDocument();
    expect(screen.queryByText('Reviewed Riverside Depot inventory')).not.toBeInTheDocument();
  });

  it('fails closed with retry when the audit query is unavailable', async () => {
    const baseApi = createMockApi();
    let attempts = 0;
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listAuditLog: async (input: { actorId: string }) => {
          attempts += 1;
          if (attempts === 1) throw new Error('audit offline');
          return baseApi.admin.listAuditLog(input);
        },
      },
    };
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { api, sessionStore: createMemorySessionStore('sam-ochoa') });
    expect(await screen.findByRole('alert')).toHaveTextContent('audit log could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Audit log' })).toBeInTheDocument());
  });
});
