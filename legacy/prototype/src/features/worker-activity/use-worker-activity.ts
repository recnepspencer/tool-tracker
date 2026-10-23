import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';

export const workerActivityQueryKey = queryKeys.activity;

export function useWorkerActivity() {
  const api = useApi();
  return useQuery({ queryKey: workerActivityQueryKey, queryFn: () => api.activity.listActivity() });
}
