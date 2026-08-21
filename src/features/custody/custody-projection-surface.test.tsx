import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { QueryProjectionProbe } from '../../test/QueryProjectionProbe';
import { useCustodyMutations } from './use-custody-mutations';

function ConditionMutationHarness() {
  const mutations = useCustodyMutations();
  return (
    <button
      type="button"
      onClick={() =>
        void mutations.reportToolCondition.mutateAsync({
          toolUnitId: 'TL-101',
          actorId: 'ray-torres',
          condition: 'damaged',
        })
      }
    >
      Run damage
    </button>
  );
}

describe('custody projection refresh surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/checkout';
  });

  it('invalidates every pending profile and renders request evidence without moving custody', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    const baseApi = createMockApi(database);
    const calls = {
      tools: 0,
      catalog: 0,
      detail: 0,
      activity: 0,
      adminSummary: 0,
      pending: 0,
      pendingByProfile: {} as Record<string, number>,
      targets: 0,
    };
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        listTools: async () => {
          calls.tools += 1;
          return baseApi.tools.listTools();
        },
        listCatalog: async () => {
          calls.catalog += 1;
          return baseApi.tools.listCatalog();
        },
        getToolDetail: async (toolUnitId: string) => {
          calls.detail += 1;
          return baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      activity: {
        ...baseApi.activity,
        listActivity: async () => {
          calls.activity += 1;
          return baseApi.activity.listActivity();
        },
      },
      admin: {
        ...baseApi.admin,
        getSummary: async () => {
          calls.adminSummary += 1;
          return baseApi.admin.getSummary({ actorId: 'sam-ochoa' });
        },
      },
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: async (profileId: string) => {
          calls.pending += 1;
          calls.pendingByProfile[profileId] = (calls.pendingByProfile[profileId] ?? 0) + 1;
          return baseApi.custody.listPendingHandoffs(profileId);
        },
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          calls.targets += 1;
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(
      <>
        <AppRoutes />
        <QueryProjectionProbe toolUnitId="TL-105" pendingProfileId="sam-ochoa" />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('projection-probe')).toHaveTextContent('ready'));
    await user.click(screen.getByRole('link', { name: 'Browse checkout catalog' }));
    await user.click(await screen.findByRole('button', { name: 'Inspect Rotary hammer' }));
    const detail = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(detail).getByRole('button', { name: 'Request from North Yard' }));
    await user.type(within(detail).getByPlaceholderText('Add context for the record'), 'Tomorrow job');
    await user.click(within(detail).getByRole('switch', { name: 'Attach a mock photo to this record' }));
    const beforeCalls = { ...calls, pendingByProfile: { ...calls.pendingByProfile } };
    const beforeProjection = { ...screen.getByTestId('projection-probe').dataset };
    await user.click(within(detail).getByRole('button', { name: 'Confirm' }));
    expect(await within(detail).findByText('Request sent to the warehouse.')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.tools).toBeGreaterThan(beforeCalls.tools);
      expect(calls.catalog).toBeGreaterThan(beforeCalls.catalog);
      expect(calls.detail).toBeGreaterThan(beforeCalls.detail);
      expect(calls.activity).toBeGreaterThan(beforeCalls.activity);
      expect(calls.adminSummary).toBeGreaterThan(beforeCalls.adminSummary);
      expect(calls.pendingByProfile['ray-torres']).toBeGreaterThan(beforeCalls.pendingByProfile['ray-torres']);
      expect(calls.pendingByProfile['sam-ochoa']).toBeGreaterThan(beforeCalls.pendingByProfile['sam-ochoa']);
      expect(calls.targets).toBeGreaterThan(beforeCalls.targets);
      const projection = screen.getByTestId('projection-probe').dataset;
      expect(Number(projection.pendingCount)).toBe(Number(beforeProjection.pendingCount) + 1);
      expect(Number(projection.secondaryPendingCount)).toBe(Number(beforeProjection.secondaryPendingCount));
      expect(Number(projection.activityCount)).toBeGreaterThan(Number(beforeProjection.activityCount));
    });
    expect(database.read().custody.find((record) => record.toolUnitId === 'TL-105')?.holder).toEqual({
      type: 'warehouse',
      warehouseId: 'north-yard',
    });
    expect(await api.custody.listPendingHandoffs('ray-torres')).toEqual(
      expect.arrayContaining([expect.objectContaining({ evidence: { note: 'Tomorrow job', mockPhoto: true } })]),
    );
  });

  it('refreshes catalog, detail, activity, admin flags, and tools after condition reporting', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
    const baseApi = createMockApi(database);
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
    }));
    await baseApi.custody.startTransfer({
      toolUnitId: 'TL-101',
      actorId: 'ray-torres',
      to: { type: 'worker', userId: 'jordan-lee' },
    });
    const calls = {
      tools: 0,
      catalog: 0,
      detail: 0,
      activity: 0,
      adminSummary: 0,
      pending: 0,
      pendingByProfile: {} as Record<string, number>,
      targets: 0,
    };
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        listTools: async () => {
          calls.tools += 1;
          return baseApi.tools.listTools();
        },
        listCatalog: async () => {
          calls.catalog += 1;
          return baseApi.tools.listCatalog();
        },
        getToolDetail: async (toolUnitId: string) => {
          calls.detail += 1;
          return baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      activity: {
        ...baseApi.activity,
        listActivity: async () => {
          calls.activity += 1;
          return baseApi.activity.listActivity();
        },
      },
      admin: {
        ...baseApi.admin,
        getSummary: async () => {
          calls.adminSummary += 1;
          return baseApi.admin.getSummary({ actorId: 'sam-ochoa' });
        },
      },
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: async (profileId: string) => {
          calls.pending += 1;
          calls.pendingByProfile[profileId] = (calls.pendingByProfile[profileId] ?? 0) + 1;
          return baseApi.custody.listPendingHandoffs(profileId);
        },
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          calls.targets += 1;
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    window.location.hash = '#/worker/tools';
    renderApp(
      <>
        <AppRoutes />
        <QueryProjectionProbe toolUnitId="TL-101" pendingProfileId="jordan-lee" />
        <ConditionMutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('projection-probe')).toHaveTextContent('ready'));
    const beforeCalls = { ...calls, pendingByProfile: { ...calls.pendingByProfile } };
    const beforeProjection = { ...screen.getByTestId('projection-probe').dataset };
    await user.click(screen.getByRole('button', { name: 'Run damage' }));
    await waitFor(() => {
      expect(calls.tools).toBeGreaterThan(beforeCalls.tools);
      expect(calls.catalog).toBeGreaterThan(beforeCalls.catalog);
      expect(calls.detail).toBeGreaterThan(beforeCalls.detail);
      expect(calls.activity).toBeGreaterThan(beforeCalls.activity);
      expect(calls.adminSummary).toBeGreaterThan(beforeCalls.adminSummary);
      expect(calls.pendingByProfile['ray-torres']).toBeGreaterThan(beforeCalls.pendingByProfile['ray-torres']);
      expect(calls.pendingByProfile['jordan-lee']).toBeGreaterThan(beforeCalls.pendingByProfile['jordan-lee']);
      expect(calls.targets).toBeGreaterThan(beforeCalls.targets);
      const projection = screen.getByTestId('projection-probe').dataset;
      expect(projection.workerToolStatus).toBe('damaged');
      expect(projection.catalogStatus).toBe('damaged');
      expect(projection.detailCondition).toBe('damaged');
      expect(projection.detailStatus).toBe('damaged');
      expect(Number(projection.adminFlaggedCount)).toBe(Number(beforeProjection.adminFlaggedCount) + 1);
      expect(Number(projection.activityCount)).toBeGreaterThan(Number(beforeProjection.activityCount));
      expect(Number(projection.pendingCount)).toBe(Number(beforeProjection.pendingCount) - 1);
      expect(Number(projection.secondaryPendingCount)).toBe(0);
      expect(Number(projection.targetCount)).toBeGreaterThan(0);
    });
    expect(database.read().conditionReports).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-101', condition: 'damaged' })]),
    );
    expect(database.read().handoffs).toEqual(
      expect.arrayContaining([expect.objectContaining({ toolUnitId: 'TL-101', status: 'cancelled' })]),
    );
  });
});
