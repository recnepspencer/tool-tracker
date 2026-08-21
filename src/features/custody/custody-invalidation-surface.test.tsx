import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { AppRoutes } from '../../app/app-routes';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { chooseFieldOption } from '../../test/choose-field-option';
import { QueryProjectionProbe } from '../../test/QueryProjectionProbe';

const createIncomingTransferScenario = async () => {
  const database = createMockDatabase({ clock: () => '2026-08-18T09:00:00-06:00' });
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
  const api = createMockApi(database);
  const first = await api.custody.startTransfer({
    toolUnitId: 'TL-101',
    actorId: 'ray-torres',
    to: { type: 'worker', userId: 'jordan-lee' },
  });
  await api.custody.acceptTransfer({ handoffId: first.handoffId!, toolUnitId: 'TL-101', actorId: 'jordan-lee' });
  await api.custody.startTransfer({
    toolUnitId: 'TL-101',
    actorId: 'jordan-lee',
    to: { type: 'worker', userId: 'ray-torres' },
  });
  return { database, api };
};

describe('custody command invalidation surfaces', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/worker/tools';
  });

  it('accepts an incoming transfer and refreshes tools and pending projections', async () => {
    const user = userEvent.setup();
    const { database, api: baseApi } = await createIncomingTransferScenario();
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
    renderApp(
      <>
        <AppRoutes />
        <QueryProjectionProbe toolUnitId="TL-101" pendingProfileId="sam-ochoa" />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    const card = await screen.findByRole('article', { name: 'Hammer drill pending handoff' });
    await waitFor(() => expect(screen.getByTestId('projection-probe')).toHaveTextContent('ready'));
    const beforeCalls = { ...calls, pendingByProfile: { ...calls.pendingByProfile } };
    const beforeProjection = { ...screen.getByTestId('projection-probe').dataset };
    expect(within(card).getByText('Jordan Lee → Ray Torres')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Review' }));
    await user.click(within(card).getByRole('button', { name: 'Accept — take custody' }));
    await waitFor(() =>
      expect(database.read().custody.find((record) => record.toolUnitId === 'TL-101')?.holder).toEqual({
        type: 'worker',
        userId: 'ray-torres',
      }),
    );
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
      expect(Number(projection.pendingCount)).toBe(Number(beforeProjection.pendingCount) - 1);
      expect(Number(projection.workerToolCount)).toBe(Number(beforeProjection.workerToolCount) + 1);
    });
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Hammer drill pending handoff' })).not.toBeInTheDocument(),
    );
  });

  it('refetches every active projection after a transfer command', async () => {
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
    renderApp(
      <>
        <AppRoutes />
        <QueryProjectionProbe toolUnitId="TL-101" pendingProfileId="sam-ochoa" />
      </>,
      { api, sessionStore: createMemorySessionStore('ray-torres') },
    );
    expect(await screen.findByRole('heading', { name: 'My tools' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('projection-probe')).toHaveTextContent('ready'));
    await user.click(screen.getByRole('button', { name: 'Open details for Hammer drill unit TL-101' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tool details' });
    await user.click(within(dialog).getByRole('button', { name: 'Transfer tool' }));
    await chooseFieldOption(user, within(dialog).getByRole('combobox', { name: 'Send to' }), /South Shop/);
    const beforeCalls = { ...calls, pendingByProfile: { ...calls.pendingByProfile } };
    const beforeProjection = { ...screen.getByTestId('projection-probe').dataset };
    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByText('Transfer started. Custody moves after acceptance.')).toBeInTheDocument();
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
      expect(Number(projection.activityCount)).toBeGreaterThan(Number(beforeProjection.activityCount));
      expect(Number(projection.adminRecentCount)).toBeGreaterThan(Number(beforeProjection.adminRecentCount));
      expect(Number(projection.targetCount)).toBeLessThan(Number(beforeProjection.targetCount));
      expect(projection.detailHolder).toBe(beforeProjection.detailHolder);
      expect(projection.toolCount).toBe(beforeProjection.toolCount);
      expect(projection.workerToolCount).toBe(beforeProjection.workerToolCount);
    });
  });
});
