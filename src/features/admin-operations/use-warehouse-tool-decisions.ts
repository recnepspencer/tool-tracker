import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import type { WarehouseToolCommandInput } from '../../api/contracts/warehouse-api';
import { invalidateWarehouseProjections } from '../../app/query-invalidation';
import { useSession } from '../../app/session-context';

export function useWarehouseToolDecisionMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const actorId = useSession().session?.profileId ?? '';
  const onSettled = async (_result?: { toolUnitId?: string }) => {
    await invalidateWarehouseProjections(queryClient);
  };
  const withActor = <T extends object>(input: T) => ({ ...input, actorId });
  const returnTool = useMutation({
    mutationFn: (input: Omit<WarehouseToolCommandInput, 'actorId'>) => api.warehouse.returnTool(withActor(input)),
    onSettled,
  });
  const decommissionTool = useMutation({
    mutationFn: (input: Omit<WarehouseToolCommandInput, 'actorId'>) => api.warehouse.decommissionTool(withActor(input)),
    onSettled,
  });
  return { returnTool, decommissionTool };
}
