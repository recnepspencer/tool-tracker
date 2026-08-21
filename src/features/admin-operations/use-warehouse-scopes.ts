import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';

export function useWarehouseScopes() {
  const api = useApi();
  const actorId = useSession().session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.warehouseScopes(actorId),
    queryFn: () => api.warehouse.listScopes({ actorId }),
    enabled: Boolean(actorId),
  });
}
