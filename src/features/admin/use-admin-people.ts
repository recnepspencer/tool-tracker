import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { queryKeys } from '../../api/query-keys';
import { useSession } from '../../app/session-context';
import { invalidateAdminProjections } from '../../app/query-invalidation';
import type {
  InvitePersonInput,
  RemovePersonInput,
  SetPersonAccessInput,
  UpdatePersonRoleInput,
} from '../../api/contracts/admin-api';

export function useAdminPeople() {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.adminPeople(actorId),
    queryFn: () => api.admin.listPeople({ actorId }),
    enabled: Boolean(actorId),
  });
}

export function useAdminPerson(personId: string | undefined) {
  const api = useApi();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  return useQuery({
    queryKey: queryKeys.adminPerson(actorId, personId ?? ''),
    queryFn: () => api.admin.getPerson({ actorId, personId: personId! }),
    enabled: Boolean(actorId && personId),
  });
}

export function useAdminMutations() {
  const api = useApi();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const actorId = session?.profileId ?? '';
  const withActor = <T extends object>(input: T) => ({ ...input, actorId });
  const onSuccess = async () => {
    await invalidateAdminProjections(queryClient);
  };
  const invite = useMutation({
    mutationFn: (input: Omit<InvitePersonInput, 'actorId'>) => api.admin.invitePerson(withActor(input)),
    onSuccess,
  });
  const updateRole = useMutation({
    mutationFn: (input: Omit<UpdatePersonRoleInput, 'actorId'>) => api.admin.updatePersonRole(withActor(input)),
    onSuccess,
  });
  const setAccess = useMutation({
    mutationFn: (input: Omit<SetPersonAccessInput, 'actorId'>) => api.admin.setPersonAccess(withActor(input)),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: (input: Omit<RemovePersonInput, 'actorId'>) => api.admin.removePerson(withActor(input)),
    onSuccess,
  });
  return { invite, updateRole, setAccess, remove };
}
