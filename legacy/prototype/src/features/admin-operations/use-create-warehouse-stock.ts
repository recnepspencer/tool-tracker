import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import type { CreateToolInput } from '../../api/contracts/tools-api';
import { invalidateToolProjections } from '../../app/query-invalidation';

export function useCreateWarehouseStock() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CreateToolInput) => api.tools.createTool(command),
    onSuccess: () => invalidateToolProjections(queryClient),
  });
}
