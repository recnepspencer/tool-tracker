import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';

export function useWarehouseOperationsSummary(warehouseId = 'all') {
  const api = useApi();
  const actorId = useSession().session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.warehouseOperationsSummary(actorId, warehouseId),
    queryFn: () => api.warehouse.getSummary({ actorId, ...(warehouseId !== 'all' ? { warehouseId } : {}) }),
    enabled: Boolean(actorId),
  });
}
