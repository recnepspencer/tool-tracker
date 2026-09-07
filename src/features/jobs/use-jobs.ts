import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import type { JobVersionInput } from '../../api/contracts/jobs-api';
import { useSession } from '../../app/session-context';

export function useJobs() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.jobs(actorId),
    queryFn: () => api.jobs.list({ actorId }),
    enabled: Boolean(actorId),
  });
}

export function useForemen() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.foremen(actorId),
    queryFn: () => api.jobs.listForemen({ actorId }),
    enabled: Boolean(actorId),
  });
}

type JobCommand =
  | { action: 'create'; name: string }
  | (Omit<JobVersionInput, 'actorId'> &
      (
        | { action: 'rename'; name: string }
        | { action: 'archive' | 'restore' }
        | { action: 'membership'; joined: boolean }
      ));

export function useJobMutation() {
  const api = useApi();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const actorId = session?.profileId ?? '';
  return useMutation({
    mutationFn: (command: JobCommand) => {
      switch (command.action) {
        case 'create':
          return api.jobs.create({ actorId, name: command.name });
        case 'rename':
          return api.jobs.rename({ ...command, actorId });
        case 'archive':
          return api.jobs.archive({ ...command, actorId });
        case 'restore':
          return api.jobs.restore({ ...command, actorId });
        case 'membership':
          return api.jobs.setMembership({ ...command, actorId });
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.jobsRoot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.foremenRoot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditRoot }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
      ]);
    },
  });
}
