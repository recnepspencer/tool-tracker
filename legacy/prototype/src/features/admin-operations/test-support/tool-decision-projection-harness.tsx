import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/query-keys';
import { useApi } from '../../../api/api-context';
import { useToolDecisionMutations } from '../use-tool-decisions';

export function ToolDecisionProjectionProbe() {
  const api = useApi();
  const tools = useQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() });
  const catalog = useQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() });
  const activity = useQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() });
  const inventory = useQuery({
    queryKey: queryKeys.warehouseInventory('sam-ochoa', 'all', true),
    queryFn: () => api.warehouse.listInventory({ actorId: 'sam-ochoa', includeArchived: true }),
  });
  const summary = useQuery({
    queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
    queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
  });
  const detail = useQuery({
    queryKey: queryKeys.toolDetail('TL-111'),
    queryFn: () => api.tools.getToolDetail('TL-111'),
  });
  const targets = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-111'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-111' }),
  });
  const cable = tools.data?.find((tool) => tool.id === 'TL-111');
  const cableDefinition = catalog.data?.find((item) => item.id === 'def-cable-cutter');
  return (
    <output data-testid="decision-probe">
      <span data-testid="decision-probe-status">{cable?.status ?? ''}</span>
      <span data-testid="decision-probe-catalog-lost">{cableDefinition?.lostCount ?? ''}</span>
      <span data-testid="decision-probe-inventory-condition">
        {inventory.data?.find((item) => item.toolUnitId === 'TL-111')?.condition ?? ''}
      </span>
      <span data-testid="decision-probe-flagged">{summary.data?.flagged ?? ''}</span>
      <span data-testid="decision-probe-event">
        {String(activity.data?.some((event) => event.toolUnitId === 'TL-111' && event.action.includes('Restored')))}
      </span>
      <span data-testid="decision-probe-detail-condition">{detail.data?.condition ?? ''}</span>
      <span data-testid="decision-probe-transfer-targets">{targets.data?.length ?? ''}</span>
    </output>
  );
}

export function ToolDecisionProjectionHarness() {
  const api = useApi();
  const queryClient = useQueryClient();
  const mutation = useToolDecisionMutations();
  const [ready, setReady] = useState(false);
  const [probe, setProbe] = useState(true);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'pending' | 'settled'>('idle');
  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouseInventory('sam-ochoa', 'all', true),
        queryFn: () => api.warehouse.listInventory({ actorId: 'sam-ochoa', includeArchived: true }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
        queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-111'),
        queryFn: () => api.tools.getToolDetail('TL-111'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transferTargets('ray-torres', 'TL-111'),
        queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-111' }),
      }),
    ]).then(() => setReady(true));
  }, [api, queryClient]);
  if (!ready) return null;
  const restoreProbe = () => {
    setRestoreStatus('pending');
    void mutation.restoreTool
      .mutateAsync({
        toolUnitId: 'TL-111',
        expectedRevision: 1,
        expectedHolder: { type: 'warehouse', warehouseId: 'riverside-depot' },
      })
      .then(() => setRestoreStatus('settled'))
      .catch(() => setRestoreStatus('settled'));
  };
  return (
    <>
      <button type="button" onClick={() => setProbe((value) => !value)}>
        {probe ? 'Disable decision probes' : 'Enable decision probes'}
      </button>
      <button type="button" onClick={restoreProbe}>
        Restore decision probe
      </button>
      <span data-testid="decision-probe-restore-status">{restoreStatus}</span>
      {probe && <ToolDecisionProjectionProbe />}
    </>
  );
}
