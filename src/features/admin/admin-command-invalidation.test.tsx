import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { useApi } from '../../api/api-context';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { useAdminMutations } from './use-admin-people';

type Command = 'suspend' | 'remove';

function AdminCommandHarness({ command }: { command: Command }) {
  const mutations = useAdminMutations();
  return (
    <button
      onClick={() =>
        void (command === 'suspend'
          ? mutations.setAccess.mutateAsync({ personId: 'avery-cole', access: 'suspended' })
          : mutations.remove.mutateAsync({ personId: 'avery-cole', reason: 'Contract ended' }))
      }
    >
      Run {command}
    </button>
  );
}

function PrefetchFanout({ onReady }: { onReady(): void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
        queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminPeople('sam-ochoa'),
        queryFn: () => api.admin.listPeople({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminPerson('sam-ochoa', 'avery-cole'),
        queryFn: () => api.admin.getPerson({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminWarehouses('sam-ochoa'),
        queryFn: () => api.admin.listWarehouses({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.pendingHandoffs('ray-torres'),
        queryFn: () => api.custody.listPendingHandoffs('ray-torres'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
        queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-115'),
        queryFn: () => api.tools.getToolDetail('TL-115'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.demoProfiles,
        queryFn: () => api.auth.listDemoProfiles(),
      }),
    ]).then(onReady);
  }, [api, onReady, queryClient]);
  return null;
}

function CommandProjectionProbe() {
  const api = useApi();
  const people = useQuery({
    queryKey: queryKeys.adminPeople('sam-ochoa'),
    queryFn: () => api.admin.listPeople({ actorId: 'sam-ochoa' }),
  });
  const person = useQuery({
    queryKey: queryKeys.adminPerson('sam-ochoa', 'avery-cole'),
    queryFn: () => api.admin.getPerson({ actorId: 'sam-ochoa', personId: 'avery-cole' }),
  });
  const summary = useQuery({
    queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
    queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
  });
  const pending = useQuery({
    queryKey: queryKeys.pendingHandoffs('avery-cole'),
    queryFn: () => api.custody.listPendingHandoffs('avery-cole'),
  });
  const targets = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
  });
  const projectedPerson = people.data?.find((candidate) => candidate.id === 'avery-cole');
  return (
    <output data-testid="command-projections">
      <span data-testid="command-lifecycle">{projectedPerson?.lifecycle}</span>
      <span data-testid="command-detail-lifecycle">{person.data?.lifecycle}</span>
      <span data-testid="command-held-tools">{person.data?.heldTools.length}</span>
      <span data-testid="command-summary-checked-out">{summary.data?.checkedOut}</span>
      <span data-testid="command-pending">{pending.data?.length}</span>
      <span data-testid="command-target-present">
        {String(targets.data?.some((target) => target.type === 'worker' && target.userId === 'avery-cole'))}
      </span>
    </output>
  );
}

describe('admin command invalidation fanout', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
  });

  it.each(['suspend', 'remove'] as const)('refetches active and inactive projections after %s', async (command) => {
    const user = userEvent.setup();
    const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
    database.update((state) => {
      state.custody = state.custody.map((record) =>
        record.toolUnitId === 'TL-115'
          ? { ...record, holder: { type: 'worker', userId: 'avery-cole' }, sinceAt: '2026-08-01T12:00:00Z' }
          : record,
      );
      state.handoffs.push({
        id: 'HO-2',
        kind: 'transfer',
        toolUnitId: 'TL-115',
        from: { type: 'worker', userId: 'avery-cole' },
        to: { type: 'warehouse', warehouseId: 'north-yard' },
        requestedBy: 'avery-cole',
        requestedAt: '2026-08-18T10:00:00Z',
        status: 'pending',
      });
      return state;
    });
    const baseApi = createMockApi(database);
    const calls = {
      summary: 0,
      people: 0,
      person: 0,
      warehouses: 0,
      tools: 0,
      catalog: 0,
      activity: 0,
      pending: 0,
      targets: 0,
      detail: 0,
      demoProfiles: 0,
    };
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        getSummary: async (input: { actorId: string }) => (calls.summary++, baseApi.admin.getSummary(input)),
        listPeople: async (input: { actorId: string }) => (calls.people++, baseApi.admin.listPeople(input)),
        getPerson: async (input: { actorId: string; personId: string }) => (
          calls.person++,
          baseApi.admin.getPerson(input)
        ),
        listWarehouses: async (input: { actorId: string }) => (calls.warehouses++, baseApi.admin.listWarehouses(input)),
      },
      tools: {
        ...baseApi.tools,
        listTools: async () => (calls.tools++, baseApi.tools.listTools()),
        listCatalog: async () => (calls.catalog++, baseApi.tools.listCatalog()),
        getToolDetail: async (toolUnitId: string) => (calls.detail++, baseApi.tools.getToolDetail(toolUnitId)),
      },
      activity: { ...baseApi.activity, listActivity: async () => (calls.activity++, baseApi.activity.listActivity()) },
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: async (profileId: string) => (
          calls.pending++,
          baseApi.custody.listPendingHandoffs(profileId)
        ),
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => (
          calls.targets++,
          baseApi.custody.listTransferTargets(input)
        ),
      },
      auth: {
        ...baseApi.auth,
        listDemoProfiles: async () => (calls.demoProfiles++, baseApi.auth.listDemoProfiles()),
      },
    };
    let ready = false;
    renderApp(
      <>
        <PrefetchFanout onReady={() => (ready = true)} />
        <AdminCommandHarness command={command} />
        <CommandProjectionProbe />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await waitFor(() => expect(ready).toBe(true));
    await waitFor(() => {
      expect(screen.getByTestId('command-lifecycle')).toHaveTextContent('active');
      expect(screen.getByTestId('command-detail-lifecycle')).toHaveTextContent('active');
      expect(screen.getByTestId('command-held-tools')).toHaveTextContent('1');
      expect(screen.getByTestId('command-pending')).toHaveTextContent('1');
      expect(screen.getByTestId('command-target-present')).toHaveTextContent('true');
    });
    const before = { ...calls };
    await user.click(screen.getByRole('button', { name: 'Run ' + command }));
    await waitFor(() => {
      Object.keys(calls).forEach((key) => {
        expect(calls[key as keyof typeof calls]).toBeGreaterThan(before[key as keyof typeof before]);
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('command-lifecycle')).toHaveTextContent(
        command === 'suspend' ? 'suspended' : 'removed',
      );
      expect(screen.getByTestId('command-detail-lifecycle')).toHaveTextContent(
        command === 'suspend' ? 'suspended' : 'removed',
      );
      expect(screen.getByTestId('command-held-tools')).toHaveTextContent(command === 'suspend' ? '1' : '0');
      expect(screen.getByTestId('command-summary-checked-out')).toHaveTextContent(command === 'suspend' ? '6' : '5');
      expect(screen.getByTestId('command-pending')).toHaveTextContent('0');
      expect(screen.getByTestId('command-target-present')).toHaveTextContent('false');
    });
  });
});
