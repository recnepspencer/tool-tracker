import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ResolveCustodyMismatchInput } from '../../api/contracts/reconciliation-api';
import { createMockApi } from '../../api/mock/create-mock-api';
import { createMockDatabase } from '../../api/mock/mock-database';
import { queryKeys } from '../../api/query-keys';
import { AppRoutes } from '../../app/app-routes';
import { useApi } from '../../api/api-context';
import { useReconciliation } from './use-reconciliation';
import { createMemorySessionStore, renderApp } from '../../test/render-app';

function TransferTargetProbe() {
  const api = useApi();
  const queryClient = useQueryClient();
  const active = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-105'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-105' }),
  });
  const [inactiveReady, setInactiveReady] = useState(false);
  useEffect(() => {
    void queryClient
      .prefetchQuery({
        queryKey: queryKeys.transferTargets('ray-torres', 'TL-101'),
        queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-101' }),
      })
      .then(() => setInactiveReady(true));
  }, [api, queryClient]);
  return <output data-testid="target-ready">{active.isSuccess && inactiveReady ? 'ready' : 'loading'}</output>;
}

function ProjectionProbe() {
  const api = useApi();
  const tools = useQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() });
  const catalog = useQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() });
  const activity = useQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() });
  const audit = useQuery({
    queryKey: queryKeys.adminAudit('sam-ochoa'),
    queryFn: () => api.admin.listAuditLog({ actorId: 'sam-ochoa' }),
  });
  const summary = useQuery({
    queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
    queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
  });
  const detail = useQuery({
    queryKey: queryKeys.toolDetail('TL-105'),
    queryFn: () => api.tools.getToolDetail('TL-105'),
  });
  const inventory = useQuery({
    queryKey: queryKeys.warehouseInventory('sam-ochoa', 'south-shop', false),
    queryFn: () =>
      api.warehouse.listInventory({ actorId: 'sam-ochoa', warehouseId: 'south-shop', includeArchived: false }),
  });
  const tool = tools.data?.find((candidate) => candidate.id === 'TL-105');
  const rotary = catalog.data?.find((candidate) => candidate.id === 'def-rotary-hammer');
  return (
    <output data-testid="reconciliation-projections">
      {JSON.stringify({
        toolHolder: tool?.holder.name,
        catalogWarehouse: rotary?.units.find((unit) => unit.id === 'TL-105')?.warehouseId,
        detailHolder: detail.data?.tool.holder.name,
        activity: activity.data?.some((event) => event.action === 'Accepted observed custody for TL-105'),
        audit: audit.data?.some((event) => event.action === 'Accepted observed custody for TL-105'),
        summarySouthStock: summary.data?.warehouses.find((warehouse) => warehouse.id === 'south-shop')?.tools,
        inventorySouth: inventory.data?.some((item) => item.toolUnitId === 'TL-105'),
      })}
    </output>
  );
}

function ResolveHarness({
  input,
  beforeCommand,
}: {
  input: Omit<ResolveCustodyMismatchInput, 'actorId'>;
  beforeCommand(): void;
}) {
  const { resolveCustodyMismatch } = useReconciliation();
  const [settled, setSettled] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          beforeCommand();
          void resolveCustodyMismatch.mutateAsync(input).then(() => setSettled(true));
        }}
      >
        Resolve mismatch
      </button>
      <output data-testid="resolve-state">{settled ? 'settled' : 'pending'}</output>
    </>
  );
}

describe('reconciliation invalidation surface', () => {
  beforeEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/admin/reconciliation';
  });

  it('refetches active and inactive transfer-target projections and awaits the held refetch', async () => {
    const user = userEvent.setup();
    const database = createMockDatabase();
    const baseApi = createMockApi(database);
    const mismatch = database.read().reconciliationIssues.find((issue) => issue.kind === 'custody-mismatch');
    if (!mismatch || mismatch.kind !== 'custody-mismatch') throw new Error('missing mismatch fixture');
    const unit = database.read().units.find((candidate) => candidate.id === mismatch.toolUnitId);
    const custody = database.read().custody.find((record) => record.toolUnitId === mismatch.toolUnitId);
    if (!unit || !custody) throw new Error('missing mismatch state');
    const beforeSouthStock = database
      .read()
      .custody.filter(
        (record) => record.holder.type === 'warehouse' && record.holder.warehouseId === 'south-shop',
      ).length;
    const calls: Record<string, number> = {};
    let holdNext = false;
    let release: (() => void) | undefined;
    const api = {
      ...baseApi,
      custody: {
        ...baseApi.custody,
        listTransferTargets: async (input: { actorId: string; toolUnitId: string }) => {
          calls[input.toolUnitId] = (calls[input.toolUnitId] ?? 0) + 1;
          const result = await baseApi.custody.listTransferTargets(input);
          if (holdNext) {
            holdNext = false;
            await new Promise<void>((resolve) => {
              release = resolve;
            });
          }
          return result;
        },
      },
    };
    const input: Omit<ResolveCustodyMismatchInput, 'actorId'> = {
      issueId: mismatch.id,
      expectedIssueRevision: mismatch.revision,
      toolUnitId: mismatch.toolUnitId,
      expectedToolRevision: unit.revision ?? 1,
      expectedRecordedHolder: custody.holder,
      decision: 'accept-observed',
    };
    renderApp(
      <>
        <AppRoutes />
        <TransferTargetProbe />
        <ProjectionProbe />
        <ResolveHarness input={input} beforeCommand={() => (holdNext = true)} />
      </>,
      { api, sessionStore: createMemorySessionStore('sam-ochoa') },
    );
    expect(await screen.findByRole('heading', { name: 'Reconciliation' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('target-ready')).toHaveTextContent('ready'));
    const beforeActive = calls['TL-105'] ?? 0;
    const beforeInactive = calls['TL-101'] ?? 0;
    await user.click(screen.getByRole('button', { name: 'Resolve mismatch' }));
    await waitFor(() => {
      expect(calls['TL-105']).toBeGreaterThan(beforeActive);
      expect(calls['TL-101']).toBeGreaterThan(beforeInactive);
    });
    expect(screen.getByTestId('resolve-state')).toHaveTextContent('pending');
    release?.();
    await waitFor(() => expect(screen.getByTestId('resolve-state')).toHaveTextContent('settled'));
    await waitFor(() => {
      const projections = screen.getByTestId('reconciliation-projections');
      expect(projections).toHaveTextContent('"toolHolder":"South Shop"');
      expect(projections).toHaveTextContent('"catalogWarehouse":"south-shop"');
      expect(projections).toHaveTextContent('"detailHolder":"South Shop"');
      expect(projections).toHaveTextContent('"activity":true');
      expect(projections).toHaveTextContent('"audit":true');
      expect(projections).toHaveTextContent('"summarySouthStock":' + (beforeSouthStock + 1));
      expect(projections).toHaveTextContent('"inventorySouth":true');
    });
  });
});
