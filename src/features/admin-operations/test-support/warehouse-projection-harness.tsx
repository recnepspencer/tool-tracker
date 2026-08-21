import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../api/query-keys';
import { useApi } from '../../../api/api-context';

export function WarehousePrefetchHarness() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouseQueue('sam-ochoa', 'all'),
        queryFn: () => api.warehouse.listQueue({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouseInventory('sam-ochoa', 'all', true),
        queryFn: () => api.warehouse.listInventory({ actorId: 'sam-ochoa', includeArchived: true }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouseOperationsSummary('sam-ochoa', 'all'),
        queryFn: () => api.warehouse.getSummary({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.warehouseScopes('sam-ochoa'),
        queryFn: () => api.warehouse.listScopes({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() }),
      queryClient.prefetchQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
        queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminPeople('sam-ochoa'),
        queryFn: () => api.admin.listPeople({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminPerson('sam-ochoa', 'ray-torres'),
        queryFn: () => api.admin.getPerson({ actorId: 'sam-ochoa', personId: 'ray-torres' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.adminWarehouses('sam-ochoa'),
        queryFn: () => api.admin.listWarehouses({ actorId: 'sam-ochoa' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.pendingHandoffs('ray-torres'),
        queryFn: () => api.custody.listPendingHandoffs('ray-torres'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.transferTargets('ray-torres', 'TL-108'),
        queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-108' }),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-108'),
        queryFn: () => api.tools.getToolDetail('TL-108'),
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.toolDetail('TL-104'),
        queryFn: () => api.tools.getToolDetail('TL-104'),
      }),
    ]).then(() => setReady(true));
  }, [api, queryClient]);
  return ready ? <output data-testid="warehouse-prefetch-ready">ready</output> : null;
}

export function WarehouseProjectionProbe() {
  const api = useApi();
  const tools = useQuery({ queryKey: queryKeys.tools, queryFn: () => api.tools.listTools() });
  const catalog = useQuery({ queryKey: queryKeys.catalog, queryFn: () => api.tools.listCatalog() });
  const activity = useQuery({ queryKey: queryKeys.activity, queryFn: () => api.activity.listActivity() });
  const summary = useQuery({
    queryKey: queryKeys.adminSummaryFor('sam-ochoa'),
    queryFn: () => api.admin.getSummary({ actorId: 'sam-ochoa' }),
  });
  const people = useQuery({
    queryKey: queryKeys.adminPeople('sam-ochoa'),
    queryFn: () => api.admin.listPeople({ actorId: 'sam-ochoa' }),
  });
  const person = useQuery({
    queryKey: queryKeys.adminPerson('sam-ochoa', 'ray-torres'),
    queryFn: () => api.admin.getPerson({ actorId: 'sam-ochoa', personId: 'ray-torres' }),
  });
  const warehouses = useQuery({
    queryKey: queryKeys.adminWarehouses('sam-ochoa'),
    queryFn: () => api.admin.listWarehouses({ actorId: 'sam-ochoa' }),
  });
  const pending = useQuery({
    queryKey: queryKeys.pendingHandoffs('ray-torres'),
    queryFn: () => api.custody.listPendingHandoffs('ray-torres'),
  });
  const targets = useQuery({
    queryKey: queryKeys.transferTargets('ray-torres', 'TL-108'),
    queryFn: () => api.custody.listTransferTargets({ actorId: 'ray-torres', toolUnitId: 'TL-108' }),
  });
  const detail = useQuery({
    queryKey: queryKeys.toolDetail('TL-108'),
    queryFn: () => api.tools.getToolDetail('TL-108'),
  });
  const tool = tools.data?.find((item) => item.id === 'TL-108');
  const bandsaw = catalog.data?.find((item) => item.id === 'def-bandsaw');
  const ray = people.data?.find((personView) => personView.id === 'ray-torres');
  const northYard = warehouses.data?.find((warehouse) => warehouse.id === 'north-yard');
  return (
    <output data-testid="warehouse-projection-probe">
      <span data-testid="warehouse-probe-tool-holder">{tool?.holder.name ?? ''}</span>
      <span data-testid="warehouse-probe-catalog-checked-out">{bandsaw?.checkedOutCount ?? ''}</span>
      <span data-testid="warehouse-probe-activity">
        {String(activity.data?.some((event) => event.toolUnitId === 'TL-108'))}
      </span>
      <span data-testid="warehouse-probe-summary-checked-out">{summary.data?.checkedOut ?? ''}</span>
      <span data-testid="warehouse-probe-ray-held-tools">{ray?.heldToolCount ?? ''}</span>
      <span data-testid="warehouse-probe-person-held-tools">{person.data?.heldTools.length ?? ''}</span>
      <span data-testid="warehouse-probe-north-out">{northYard?.out ?? ''}</span>
      <span data-testid="warehouse-probe-pending">{pending.data?.length ?? ''}</span>
      <span data-testid="warehouse-probe-targets">{targets.data?.length ?? ''}</span>
      <span data-testid="warehouse-probe-detail-holder">{detail.data?.tool.holder.name ?? ''}</span>
    </output>
  );
}

export function WarehouseProjectionToggle() {
  const [enabled, setEnabled] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        {enabled ? 'Disable projection probes' : 'Enable projection probes'}
      </button>
      {enabled && <WarehouseProjectionProbe />}
    </>
  );
}
