import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';

export const toolDetailQueryKey = queryKeys.toolDetail;

export function useToolDetail(toolUnitId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: toolDetailQueryKey(toolUnitId ?? 'none'),
    queryFn: () => api.tools.getToolDetail(toolUnitId as string),
    enabled: Boolean(toolUnitId),
  });
}
