import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';
import type {
  DismissDuplicateInput,
  MergeDuplicateInput,
  ResolveCustodyMismatchInput,
} from '../../api/contracts/reconciliation-api';
import { invalidateReconciliationProjections } from '../../app/query-invalidation';

export function useReconciliation() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  const issues = useQuery({
    queryKey: queryKeys.reconciliation(actorId),
    queryFn: () => api.reconciliation.listIssues({ actorId }),
    enabled: Boolean(actorId),
  });
  const useReconciliationMutation = <T extends { actorId: string }>(fn: (input: T) => Promise<unknown>) =>
    useMutation({
      mutationFn: (input: Omit<T, 'actorId'>) => fn({ ...input, actorId } as T),
      onSuccess: async () => invalidateReconciliationProjections(queryClient),
    });
  const dismissDuplicate = useReconciliationMutation<DismissDuplicateInput>((input) =>
    api.reconciliation.dismissDuplicate(input),
  );
  const mergeDuplicate = useReconciliationMutation<MergeDuplicateInput>((input) =>
    api.reconciliation.mergeDuplicate(input),
  );
  const resolveCustodyMismatch = useReconciliationMutation<ResolveCustodyMismatchInput>((input) =>
    api.reconciliation.resolveCustodyMismatch(input),
  );
  return { ...issues, dismissDuplicate, mergeDuplicate, resolveCustodyMismatch, actorId };
}
