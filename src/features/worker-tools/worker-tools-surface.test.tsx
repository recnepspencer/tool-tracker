import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseTransferDestination } from '../../test/choose-field-option';

describe('worker tools surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  it('keeps warehouse requests distinct from person-to-person transfers', async () => {
    renderApp(<AppRoutes />, { sessionStore: createMemorySessionStore('ray-torres') });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    const pendingRequest = screen.getByRole('article', { name: 'Bandsaw pending handoff' });
    expect(within(pendingRequest).getByText('Bandsaw')).toBeInTheDocument();
    expect(within(pendingRequest).getByText('Request')).toBeInTheDocument();
    expect(within(pendingRequest).getByText('Requested from North Yard')).toBeInTheDocument();
    expect(within(pendingRequest).getByRole('button', { name: 'Review request' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfer Hammer drill unit TL-101' }).closest('article')).toHaveClass(
      'worker-tool-row--checked-out',
    );
    expect(
      screen.getByRole('button', { name: 'Transfer Fish tape, 240 ft unit TL-104' }).closest('article'),
    ).toHaveClass('worker-tool-row--damaged');
  });

  it('shows incoming and editable outgoing demo transfers', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    renderApp(<AppRoutes />, {
      api: createMockApi(database),
      sessionStore: createMemorySessionStore('ray-torres'),
    });
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();

    const outgoing = screen.getByRole('article', { name: 'Klein 10" pump pliers pending handoff' });
    expect(within(outgoing).getByText('Outgoing')).toBeInTheDocument();
    expect(within(outgoing).getByText('To Eli Warren')).toBeInTheDocument();
    await user.click(within(outgoing).getByRole('button', { name: 'Edit transfer' }));
    const outgoingDialog = await screen.findByRole('dialog', {
      name: 'Klein 10" pump pliers transfer review',
    });
    expect(within(outgoingDialog).getByText('Outgoing transfer')).toBeInTheDocument();
    expect(within(outgoingDialog).getByText('Awaiting acceptance')).toBeInTheDocument();
    expect(within(outgoingDialog).getByText(/Photos are optional/)).toBeInTheDocument();
    await chooseTransferDestination(user, outgoingDialog, 'warehouse', /South Shop Warehouse/);
    const note = within(outgoingDialog).getByPlaceholderText('e.g. reason for the transfer');
    await user.clear(note);
    await user.type(note, 'Use at the south shop');
    await user.click(within(outgoingDialog).getByRole('switch', { name: /Add an optional photo/ }));
    await user.click(within(outgoingDialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Klein 10/ })).not.toBeInTheDocument());
    expect(database.read().handoffs.find((handoff) => handoff.id === 'HO-DEMO-OUT')).toMatchObject({
      to: { type: 'warehouse', warehouseId: 'south-shop' },
      evidence: { note: 'Use at the south shop' },
    });
    expect(
      database.read().handoffs.find((handoff) => handoff.id === 'HO-DEMO-OUT')?.evidence?.mockPhoto,
    ).toBeUndefined();
    expect(
      within(screen.getByRole('article', { name: 'Klein 10" pump pliers pending handoff' })).getByText('To South Shop'),
    ).toBeInTheDocument();

    const incoming = screen.getByRole('article', { name: 'Cord reel, 100 ft pending handoff' });
    expect(within(incoming).getByText('Incoming')).toBeInTheDocument();
    expect(within(incoming).getByText('From Eli Warren')).toBeInTheDocument();
    await user.click(within(incoming).getByRole('button', { name: 'Review' }));
    const incomingDialog = await screen.findByRole('dialog', { name: 'Cord reel, 100 ft transfer review' });
    expect(within(incomingDialog).getByText('Incoming transfer')).toBeInTheDocument();
    expect(within(incomingDialog).getByText('Needs your acceptance')).toBeInTheDocument();
    expect(within(incomingDialog).getByRole('button', { name: 'Accept — take custody' })).toBeInTheDocument();
    expect(within(incomingDialog).getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(within(incomingDialog).getByRole('switch', { name: /Add an optional photo/ })).toBeInTheDocument();
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
    expect(await screen.findByRole('article', { name: 'Bandsaw pending handoff' })).toBeInTheDocument();
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
