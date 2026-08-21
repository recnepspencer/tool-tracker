import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/query-keys';
import { invalidateToolProjections } from '../../app/query-invalidation';

export const invalidateCustodyProjections = async (queryClient: QueryClient, _toolUnitId: string) => {
  await Promise.all([
    invalidateToolProjections(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingHandoffsRoot, refetchType: 'all' }),
  ]);
};
