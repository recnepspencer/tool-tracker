import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../../api/api-context';
import { queryKeys } from '../../../api/query-keys';

export const demoProfilesQueryKey = queryKeys.demoProfiles;

export function useDemoProfiles() {
  const api = useApi();
  return useQuery({ queryKey: demoProfilesQueryKey, queryFn: () => api.auth.listDemoProfiles() });
}
