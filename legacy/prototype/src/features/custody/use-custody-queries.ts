import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../app/session-context';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';

export function usePendingHandoffs(profileId?: string) {
  const api = useApi();
  const { session } = useSession();
  const effectiveProfileId = profileId ?? session?.profileId ?? null;
  return useQuery({
    queryKey: queryKeys.pendingHandoffs(effectiveProfileId ?? 'anonymous'),
    queryFn: () => api.custody.listPendingHandoffs(effectiveProfileId!),
    enabled: Boolean(effectiveProfileId),
  });
}

export function useTransferTargets(actorId: string | null, toolUnitId: string | null, handoffId?: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.transferTargets(actorId ?? 'none', toolUnitId ?? 'none', handoffId),
    queryFn: () => api.custody.listTransferTargets({ actorId: actorId!, toolUnitId: toolUnitId!, handoffId }),
    enabled: Boolean(actorId && toolUnitId),
  });
}
