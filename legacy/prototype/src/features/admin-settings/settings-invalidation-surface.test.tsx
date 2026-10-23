import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { AppRoutes } from '../../app/app-routes';
import { useApi } from '../../api/api-context';
import { useSettingsMutations } from './use-settings-mutations';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

function SettingsFanoutHarness({ beforeCommand }: { beforeCommand(): void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { renameCategory } = useSettingsMutations();
  const [ready, setReady] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
        queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminAudit('sam-ochoa'),
        queryFn: () => api.admin.listAuditLog({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-101'),
        queryFn: () => api.tools.getToolDetail('TL-101'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouseInventory('sam-ochoa', 'north-yard', false),
        queryFn: () =>
          api.warehouse.listInventory({ actorId: 'sam-ochoa', warehouseId: 'north-yard', includeArchived: false }),
      }),
    ]).then(() => setReady(true));
  }, [api, queryClient]);
  if (!ready) return <output data-testid="settings-fanout-ready">loading</output>;
  const labels = [
    queryClient
      .getQueryData<Array<{ id: string; category: string }>>(queryKeys.tools)
      ?.find((tool) => tool.id === 'TL-101')?.category,
    queryClient
      .getQueryData<Array<{ id: string; category: string }>>(queryKeys.catalog)
      ?.find((item) => item.id === 'def-hammer-drill')?.category,
    queryClient.getQueryData<{ tool: { category: string } }>(queryKeys.toolDetail('TL-101'))?.tool.category,
    queryClient
      .getQueryData<Array<{ toolUnitId: string; category: string }>>(
        queryKeys.warehouseInventory('sam-ochoa', 'north-yard', false),
      )
      ?.find((item) => item.toolUnitId === 'TL-101')?.category,
  ]
    .filter(Boolean)
    .join('|');
  return (
    <>
      <button
        onClick={() => {
          beforeCommand();
          void renameCategory
            .mutateAsync({ categoryId: 'category-power-tools', expectedRevision: 1, name: 'Power equipment' })
            .then(() => setSettled(true));
        }}
      >
        Rename category through fanout
      </button>
      <output data-testid="settings-fanout-state">{settled ? 'settled' : 'pending'}</output>
      <output data-testid="settings-fanout-labels">{labels}</output>
    </>
  );
}

describe('settings invalidation surface', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/settings';
  });

  it('refetches inactive tool, catalog, activity, audit, summary, detail, and inventory projections before settling', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    const calls: Record<string, number> = {};
    let holdNextCatalog = false;
    let releaseCatalog: (() => void) | undefined;
    const count = (key: string) => {
      calls[key] = (calls[key] ?? 0) + 1;
    };
    const api = {
      ...baseApi,
      tools: {
        ...baseApi.tools,
        listTools: async () => {
          count('tools');
          return baseApi.tools.listTools();
        },
        listCatalog: async () => {
          count('catalog');
          const result = await baseApi.tools.listCatalog();
          if (holdNextCatalog) {
            holdNextCatalog = false;
            await new Promise<void>((resolve) => {
              releaseCatalog = resolve;
            });
          }
          return result;
        },
        getToolDetail: async (toolUnitId: string) => {
          count('detail');
          return baseApi.tools.getToolDetail(toolUnitId);
        },
      },
      activity: {
        ...baseApi.activity,
        listActivity: async () => {
          count('activity');
          return baseApi.activity.listActivity();
        },
      },
      admin: {
        ...baseApi.admin,
        getSummary: async (input: { actorId: string }) => {
          count('summary');
          return baseApi.admin.getSummary(input);
        },
        listAuditLog: async (input: { actorId: string }) => {
          count('audit');
          return baseApi.admin.listAuditLog(input);
        },
      },
      warehouse: {
        ...baseApi.warehouse,
        listInventory: async (input: { actorId: string; warehouseId?: string; includeArchived: boolean }) => {
          count('inventory');
          return baseApi.warehouse.listInventory(input);
        },
      },
    };
    renderApp(
      <>
        <AppRoutes />
        <SettingsFanoutHarness beforeCommand={() => (holdNextCatalog = true)} />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rename category through fanout' })).toBeInTheDocument(),
    );
    const before = { ...calls };
    await user.click(screen.getByRole('button', { name: 'Rename category through fanout' }));
    await waitFor(() => {
      expect(database.read().categories.find((category) => category.id === 'category-power-tools')?.name).toBe(
        'Power equipment',
      );
      expect(calls.tools).toBeGreaterThan(before.tools ?? 0);
      expect(calls.catalog).toBeGreaterThan(before.catalog ?? 0);
      expect(calls.activity).toBeGreaterThan(before.activity ?? 0);
      expect(calls.audit).toBeGreaterThan(before.audit ?? 0);
      expect(calls.summary).toBeGreaterThan(before.summary ?? 0);
      expect(calls.detail).toBeGreaterThan(before.detail ?? 0);
      expect(calls.inventory).toBeGreaterThan(before.inventory ?? 0);
    });
    expect(screen.getByTestId('settings-fanout-state')).toHaveTextContent('pending');
    releaseCatalog?.();
    await waitFor(() => expect(screen.getByTestId('settings-fanout-state')).toHaveTextContent('settled'));
    expect(screen.getByTestId('settings-fanout-labels')).toHaveTextContent('Power equipment');
  });
});
