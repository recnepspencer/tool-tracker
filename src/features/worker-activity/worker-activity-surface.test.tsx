import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

describe('worker activity surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/activity';
  });

  it('renders semantically scoped activity filters', async () => {
    const user = userEvent.setup();
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Movement record' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mine' }));
    expect(screen.getByText('Requested a bandsaw handoff')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Warehouse' }));
    expect(screen.getByText('Added a tool to inventory')).toBeInTheDocument();
    expect(screen.queryByText('Reported a tool damaged')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Damage & loss' }));
    expect(screen.getByText('Marked a cable cutter lost')).toBeInTheDocument();
  });

  it('isolates activity loading, empty, and error states', async () => {
    const user = userEvent.setup();
    const baseApi = createMockApi();
    let resolveActivity: (events: Awaited<ReturnType<typeof baseApi.activity.listActivity>>) => void = () => undefined;
    const activityPromise = new Promise<Awaited<ReturnType<typeof baseApi.activity.listActivity>>>((resolve) => {
      resolveActivity = resolve;
    });
    const activityApi = { ...baseApi, activity: { listActivity: () => activityPromise } };
    renderApp(<AppRoutes />, { api: activityApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByText('Loading field activity…')).toBeInTheDocument();
    resolveActivity(await baseApi.activity.listActivity());
    expect(await screen.findByRole('heading', { name: 'Movement record' })).toBeInTheDocument();
    cleanup();
    const emptyMineApi = {
      ...baseApi,
      activity: {
        listActivity: async () => [
          {
            ...(await baseApi.activity.listActivity())[0],
            participantIds: [],
            scope: 'admin' as const,
          },
        ],
      },
    };
    window.location.hash = '#/worker/activity';
    renderApp(<AppRoutes />, { api: emptyMineApi, sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'Movement record' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mine' }));
    expect(screen.getByRole('heading', { name: 'No activity in this view.' })).toBeInTheDocument();
    cleanup();
    const rejectingApi = {
      ...baseApi,
      activity: { listActivity: async () => Promise.reject(new Error('activity offline')) },
    };
    renderApp(<AppRoutes />, { api: rejectingApi, sessionStore: createMemorySessionStore('ray-torres') });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Worker activity could not be loaded'));
  });
});
