import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';

export const workerToolsQueryKey = queryKeys.tools;

export function useWorkerTools() {
  const api = useApi();
  return useQuery({ queryKey: workerToolsQueryKey, queryFn: () => api.tools.listTools() });
}
