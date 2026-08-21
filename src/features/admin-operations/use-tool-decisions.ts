import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import type { FlagToolInput, RestoreToolInput, UpdateToolInput } from '../../api/contracts/tools-api';
import { invalidateToolProjections } from '../../app/query-invalidation';
import { useSession } from '../../app/session-context';

export function useToolDecisionMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const actorId = useSession().session?.profileId ?? '';
  const onSettled = async () => invalidateToolProjections(queryClient);
  const updateTool = useMutation({
    mutationFn: (input: Omit<UpdateToolInput, 'actorId'>) => api.tools.updateTool({ ...input, actorId }),
    onSettled,
  });
  const flagTool = useMutation({
    mutationFn: (input: Omit<FlagToolInput, 'actorId'>) => api.tools.flagTool({ ...input, actorId }),
    onSettled,
  });
  const restoreTool = useMutation({
    mutationFn: (input: Omit<RestoreToolInput, 'actorId'>) => api.tools.restoreTool({ ...input, actorId }),
    onSettled,
  });
  return { updateTool, flagTool, restoreTool };
}
