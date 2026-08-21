import { cleanup, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('worker tools surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  it('renders the seeded pending handoff beside Ray’s tools', async () => {
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(screen.getByText('Bandsaw')).toBeInTheDocument();
    expect(screen.getByText('North Yard → Ray Torres')).toBeInTheDocument();
  });

  it('excludes another worker’s custody from the authenticated Ray surface', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-101' ? { ...record, holder: { type: 'worker', userId: 'jordan-lee' } } : record,
      ),
    }));
    renderApp(<AppRoutes />, {
      api: createMockApi(database),
      sessionStore: createMemorySessionStore('ray-torres'),
    });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open details for Hammer drill unit TL-101' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open details for Hammer drill unit TL-103' })).toBeInTheDocument();
  });

  it('isolates pending-handoff loading and error states', async () => {
    const baseApi = createMockApi();
    let resolvePending: (handoffs: Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>) => void = () =>
      undefined;
    const pendingPromise = new Promise<Awaited<ReturnType<typeof baseApi.custody.listPendingHandoffs>>>((resolve) => {
      resolvePending = resolve;
    });
    let requestedProfile: string | undefined;
    const pendingApi = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: (profileId: string) => {
          requestedProfile = profileId;
          return pendingPromise;
        },
      },
    };
    renderApp(<AppRoutes />, { api: pendingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    expect(screen.getByText('Checking pending handoffs…')).toBeInTheDocument();
    expect(requestedProfile).toBe('ray-torres');
    resolvePending(await baseApi.custody.listPendingHandoffs('ray-torres'));
    expect(await screen.findByText('Bandsaw')).toBeInTheDocument();
    cleanup();
    const rejectingApi = {
      ...baseApi,
      custody: { ...baseApi.custody, listPendingHandoffs: async () => Promise.reject(new Error('pending offline')) },
    };
    window.location.hash = '#/worker/tools';
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Pending handoffs could not be loaded'));
  });
});
