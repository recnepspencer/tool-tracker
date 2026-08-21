import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';

export function useWarehouseInventory(warehouseId = 'all', includeArchived = false) {
  const api = useApi();
  const actorId = useSession().session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.warehouseInventory(actorId, warehouseId, includeArchived),
    queryFn: () =>
      api.warehouse.listInventory({ actorId, includeArchived, ...(warehouseId !== 'all' ? { warehouseId } : {}) }),
    enabled: Boolean(actorId),
  });
}
