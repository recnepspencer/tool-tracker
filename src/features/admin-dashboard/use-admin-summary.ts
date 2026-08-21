import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';

export const adminSummaryRootQueryKey = queryKeys.adminSummary;
export const adminSummaryQueryKeyFor = (actorId: string) => queryKeys.adminSummaryFor(actorId);

export function useAdminSummary() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.adminSummaryFor(actorId),
    queryFn: () => api.admin.getSummary({ actorId }),
    enabled: Boolean(actorId),
  });
}
