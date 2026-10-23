import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { invalidateWarehouseProjections } from '../../app/query-invalidation';
import { useSession } from '../../app/session-context';
import type { WarehouseHandoffCommandInput } from '../../api/contracts/warehouse-api';

export function useWarehouseQueue(warehouseId = 'all') {
  const api = useApi();
  const actorId = useSession().session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.warehouseQueue(actorId, warehouseId),
    queryFn: () => api.warehouse.listQueue({ actorId, ...(warehouseId !== 'all' ? { warehouseId } : {}) }),
    enabled: Boolean(actorId),
  });
}

export function useWarehouseQueueMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const actorId = useSession().session?.profileId ?? '';
  const onSettled = async (_result?: { toolUnitId?: string }) => {
    await invalidateWarehouseProjections(queryClient);
  };
  const withActor = <T extends object>(input: T) => ({ ...input, actorId });
  const approveRequest = useMutation({
    mutationFn: (input: Omit<WarehouseHandoffCommandInput, 'actorId'>) =>
      api.warehouse.approveRequest(withActor(input)),
    onSettled,
  });
  const acceptReturn = useMutation({
    mutationFn: (input: Omit<WarehouseHandoffCommandInput, 'actorId'>) => api.warehouse.acceptReturn(withActor(input)),
    onSettled,
  });
  const declineQueueItem = useMutation({
    mutationFn: (input: Omit<WarehouseHandoffCommandInput, 'actorId'>) =>
      api.warehouse.declineQueueItem(withActor(input)),
    onSettled,
  });
  return { approveRequest, acceptReturn, declineQueueItem };
}
