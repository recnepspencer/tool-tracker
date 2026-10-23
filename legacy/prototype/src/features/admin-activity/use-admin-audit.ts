import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';

export function useAdminAudit() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.adminAudit(actorId),
    queryFn: () => api.admin.listAuditLog({ actorId }),
    enabled: Boolean(actorId),
  });
}
