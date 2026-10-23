import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';
import { invalidateAdminProjections } from '../../app/query-invalidation';
import type { CreateWarehouseInput, UpdateWarehouseInput } from '../../api/contracts/admin-api';

export function useAdminWarehouses() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.adminWarehouses(actorId),
    queryFn: () => api.admin.listWarehouses({ actorId }),
    enabled: Boolean(actorId),
  });
}

export function useAdminWarehouseMutations() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  const queryClient = useQueryClient();
  const withActor = <T extends object>(input: T) => ({ ...input, actorId });
  const onSuccess = async () => {
    await invalidateAdminProjections(queryClient);
  };
  const create = useMutation({
    mutationFn: (input: Omit<CreateWarehouseInput, 'actorId'>) => api.admin.createWarehouse(withActor(input)),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: (input: Omit<UpdateWarehouseInput, 'actorId'>) => {
      return api.admin.updateWarehouse(withActor(input));
    },
    onSuccess,
  });
  return { create, update };
}
