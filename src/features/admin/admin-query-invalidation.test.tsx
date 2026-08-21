import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { AppRoutes } from '../../app/app-routes';
import { useApi } from '../../api/api-context';
import { useSession } from '../../app/session-context';
import { createMemorySessionStore, renderApp } from '../../test/render-app';
import { useToolDetail } from '../tool-detail/use-tool-detail';
import { useAdminMutations } from './use-admin-people';
import { useAdminPerson } from './use-admin-people';
import { useAdminWarehouseMutations } from './use-admin-warehouses';
import { useAdminSummary } from '../admin-dashboard/use-admin-summary';

function MutationHarness() {
  const { invite } = useAdminMutations();
  return (
    <button
      onClick={() =>
        void invite.mutateAsync({
          name: 'Jamie Park',
          email: 'jamie@nelson.test',
          title: 'Estimator',
          role: 'worker',
          homeWarehouseId: 'north-yard',
        })
      }
    >
      Run admin invite
    </button>
  );
}

function WarehouseMutationHarness() {
  const { update } = useAdminWarehouseMutations();
  return (
    <button
      onClick={() =>
        void update.mutateAsync({
          warehouseId: 'north-yard',
          name: 'North Yard Renamed',
          address: '1420 Kerr Ave',
          managerId: 'sam-ochoa',
        })
      }
    >
      Rename north yard
    </button>
  );
}

function ProjectionProbe() {
  const summary = useAdminSummary();
  const person = useAdminPerson('casey-reed');
  const detail = useToolDetail('TL-101');
  const { session } = useSession();
  return (
    <output>
      <span data-testid="probe-summary-warehouse">{summary.data?.warehouses[0]?.name}</span>
      <span data-testid="probe-person-warehouse">{person.data?.homeWarehouse}</span>
      <span data-testid="probe-tool-warehouse">{detail.data?.originWarehouse.name}</span>
      <span data-testid="probe-session-warehouse">{session?.homeWarehouse}</span>
    </output>
  );
}

function InactiveProjectionProbe() {
  const api = useApi();
  const summary = useQuery({
    queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
    queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
  });
  const people = useQuery({
    queryKey: queryKeys.adminPeople('sam-ochoa'),
    queryFn: () => api.admin.listPeople({ actorId: 'sam-ochoa' }),
  });
  const person = useQuery({
    queryKey: queryKeys.adminPerson('sam-ochoa', 'casey-reed'),
    queryFn: () => api.admin.getPerson({ actorId: 'sam-ochoa', personId: 'casey-reed' }),
  });
  const warehouses = useQuery({
    queryKey: queryKeys.adminWarehouses('sam-ochoa'),
    queryFn: () => api.admin.listWarehouses({ actorId: 'sam-ochoa' }),
  });
  const tools = useQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() });
  const catalog = useQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() });
  const activity = useQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() });
  const pending = useQuery({
    queryKey: queryKeys.pendingHandoffs('ray-torres'),
    queryFn: () => api.custody.listPendingHandoffs('ray-torres'),
  });
  const targets = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
  });
  const detail = useQuery({
    queryKey: queryKeys.toolDetail('TL-101'),
    queryFn: () => api.tools.getToolDetail('TL-101'),
  });
  return (
    <output data-testid="inactive-projections">
      {JSON.stringify({
        summary: summary.data?.warehouses[0]?.name,
        people: people.data?.find((person) => person.id === 'casey-reed')?.homeWarehouse,
        person: person.data?.homeWarehouse,
        warehouses: warehouses.data?.[0]?.name,
        tools: tools.data?.find((tool) => tool.id === 'TL-101')?.holder,
        catalog: catalog.data?.[0]?.warehouses[0]?.name,
        activity: activity.data?.[0]?.warehouseName,
        pending: pending.data?.[0]?.from,
        targets: targets.data?.[0]?.name,
        detail: detail.data?.originWarehouse.name,
      })}
    </output>
  );
}

function InactiveProjectionHarness({ onReady }: { onReady(): void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
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
        queryKey: queryKeys.adminPerson('sam-ochoa', 'casey-reed'),
        queryFn: () => api.admin.getPerson({ actorId: 'sam-ochoa', personId: 'casey-reed' }),
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
        queryKey: queryKeys.toolDetail('TL-101'),
        queryFn: () => api.tools.getToolDetail('TL-101'),
      }),
    ]).then(onReady);
  }, [api, onReady, queryClient]);
  return mounted ? (
    <InactiveProjectionProbe />
  ) : (
    <button onClick={() => setMounted(true)}>Mount inactive projections</button>
  );
}

describe('admin TanStack invalidation', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/people';
  });

  it('refetches active and inactive admin projections after one successful command', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    const calls = { people: 0, summary: 0 };
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        listPeople: async (input: { actorId: string }) => {
          calls.people += 1;
          return baseApi.admin.listPeople(input);
        },
        getSummary: async (input: { actorId: string }) => {
          calls.summary += 1;
          return baseApi.admin.getSummary(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <MutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'People' })).toBeInTheDocument();
    const beforePeople = calls.people;
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Control room' })).toBeInTheDocument();
    const beforeSummary = calls.summary;
    await user.click(screen.getByRole('button', { name: 'Run admin invite' }));
    await waitFor(() => {
      expect(calls.people).toBeGreaterThan(beforePeople);
      expect(calls.summary).toBeGreaterThan(beforeSummary);
    });
    expect(database.read().users.some((person) => person.email === 'jamie@nelson.test')).toBe(true);
    await user.click(screen.getByRole('link', { name: 'People' }));
    expect(await screen.findByText('Jamie Park')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByText('Invited Jamie Park')).toBeInTheDocument();
  });

  it('refetches person, detail, summary, and session warehouse projections after a rename', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const api = createMockApi(database);
    renderApp(
      <>
        <AppRoutes />
        <WarehouseMutationHarness />
        <ProjectionProbe />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await screen.findByRole('heading', { name: 'People' });
    await waitFor(() => {
      expect(screen.getByTestId('probe-summary-warehouse')).toHaveTextContent('North Yard');
      expect(screen.getByTestId('probe-person-warehouse')).toHaveTextContent('North Yard');
      expect(screen.getByTestId('probe-tool-warehouse')).toHaveTextContent('North Yard');
      expect(screen.getByTestId('probe-session-warehouse')).toHaveTextContent('North Yard');
    });
    await user.click(screen.getByRole('button', { name: 'Rename north yard' }));
    await waitFor(() => {
      expect(screen.getByTestId('probe-summary-warehouse')).toHaveTextContent('North Yard Renamed');
      expect(screen.getByTestId('probe-person-warehouse')).toHaveTextContent('North Yard Renamed');
      expect(screen.getByTestId('probe-tool-warehouse')).toHaveTextContent('North Yard Renamed');
      expect(screen.getByTestId('probe-session-warehouse')).toHaveTextContent('North Yard Renamed');
    });
  });

  it('refetches the full inactive admin and worker projection fanout before remount', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
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
    };
    const api = {
      ...baseApi,
      admin: {
        ...baseApi.admin,
        getSummary: async (input: { actorId: string }) => {
          calls.summary += 1;
          return baseApi.admin.getSummary(input);
        },
        listPeople: async (input: { actorId: string }) => {
          calls.people += 1;
          return baseApi.admin.listPeople(input);
        },
        getPerson: async (input: { actorId: string; personId: string }) => {
          calls.person += 1;
          return baseApi.admin.getPerson(input);
        },
        listWarehouses: async (input: { actorId: string }) => {
          calls.warehouses += 1;
          return baseApi.admin.listWarehouses(input);
        },
      },
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
      custody: {
        ...baseApi.custody,
        listPendingHandoffs: async (profileId: string) => {
          calls.pending += 1;
          return baseApi.custody.listPendingHandoffs(profileId);
        },
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          calls.targets += 1;
          return baseApi.custody.listTransferTargets(input);
        },
      },
    };
    let ready = false;
    renderApp(
      <>
        <InactiveProjectionHarness onReady={() => (ready = true)} />
        <WarehouseMutationHarness />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    await waitFor(() => expect(ready).toBe(true));
    const before = { ...calls };
    await user.click(screen.getByRole('button', { name: 'Rename north yard' }));
    await waitFor(() => {
      expect(calls.summary).toBeGreaterThan(before.summary);
      expect(calls.people).toBeGreaterThan(before.people);
      expect(calls.person).toBeGreaterThan(before.person);
      expect(calls.warehouses).toBeGreaterThan(before.warehouses);
      expect(calls.tools).toBeGreaterThan(before.tools);
      expect(calls.catalog).toBeGreaterThan(before.catalog);
      expect(calls.activity).toBeGreaterThan(before.activity);
      expect(calls.pending).toBeGreaterThan(before.pending);
      expect(calls.targets).toBeGreaterThan(before.targets);
      expect(calls.detail).toBeGreaterThan(before.detail);
    });
    await user.click(screen.getByRole('button', { name: 'Mount inactive projections' }));
    expect(await screen.findByTestId('inactive-projections')).toHaveTextContent('North Yard Renamed');
  });
});
