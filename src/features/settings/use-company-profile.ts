import { useQuery } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';

export function useCompanyProfile() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.companyProfile,
    queryFn: () => api.settings.getCompany({ actorId }),
    enabled: Boolean(actorId),
  });
}
