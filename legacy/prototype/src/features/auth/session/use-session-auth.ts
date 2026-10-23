import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '../../../api/api-context';
import { queryKeys } from '../../../api/query-keys';

export function useSessionAuth(profileId: string | null, restoreNonce: number) {
  const api = useApi();
  const restore = useQuery({
    queryKey: queryKeys.authSession(profileId ?? 'anonymous', restoreNonce),
    queryFn: () => api.auth.restoreSession(profileId!),
    enabled: Boolean(profileId),
    retry: false,
  });
  const signIn = useMutation({ mutationFn: (nextProfileId: string) => api.auth.signInAs(nextProfileId) });
  const signOut = useMutation({ mutationFn: () => api.auth.signOut() });
  return { restore, signIn, signOut };
}
