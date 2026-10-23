import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '../../api/api-context';
import { useSession } from '../../app/session-context';
import type {
  CreateCategoryInput,
  DeleteCategoryInput,
  RenameCategoryInput,
  UpdateCompanyInput,
} from '../../api/contracts/settings-api';
import { invalidateAllProjections, invalidateSettingsProjections } from '../../app/query-invalidation';

export function useSettingsMutations() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const actorId = session?.profileId ?? '';
  const useSettingsMutation = <T extends { actorId: string }>(fn: (input: T) => Promise<unknown>, all = false) =>
    useMutation({
      mutationFn: (input: Omit<T, 'actorId'>) => fn({ ...input, actorId } as T),
      onSuccess: async () => (all ? invalidateAllProjections(queryClient) : invalidateSettingsProjections(queryClient)),
    });
  const updateCompany = useSettingsMutation<UpdateCompanyInput>((input) => api.settings.updateCompany(input));
  const createCategory = useSettingsMutation<CreateCategoryInput>((input) => api.settings.createCategory(input));
  const renameCategory = useSettingsMutation<RenameCategoryInput>((input) => api.settings.renameCategory(input));
  const deleteCategory = useSettingsMutation<DeleteCategoryInput>((input) => api.settings.deleteCategory(input));
  const resetDemoData = useMutation({
    mutationFn: (confirmation: string) => api.settings.resetDemoData({ actorId, confirmation }),
    onMutate: async () => queryClient.cancelQueries(),
    onSuccess: async () => invalidateAllProjections(queryClient),
  });
  return { updateCompany, createCategory, renameCategory, deleteCategory, resetDemoData };
}

export type SettingsMutations = ReturnType<typeof useSettingsMutations>;
