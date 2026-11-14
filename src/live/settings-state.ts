import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, result } from './client';
import { useCompany } from './session';
import { useRegistrationPolicy } from './registration-policy';
import { useCommand } from './settings-command-state';

export function useSettingsPageState() {
  const c = useCompany();
  const cache = useQueryClient();
  const refresh = () => cache.invalidateQueries({ queryKey: ['session'] });
  const company = useQuery({
    queryKey: [c.company_id, 'company-profile'],
    queryFn: () => api.GET('/api/companies/{company_id}', { params: { path: c.path } }).then(result),
  });
  const { policy: tools } = useRegistrationPolicy();
  const registration = useCommand();
  const jobs = useQuery({
    queryKey: [c.company_id, 'participation-policy'],
    queryFn: () =>
      api.GET('/api/companies/{company_id}/job-participation-policy', { params: { path: c.path } }).then(result),
  });

  return {
    c,
    tools,
    jobs,
    company,
    refresh,
    registration,
    /** The registration Switch saves on toggle with the policy revision it was rendered from. */
    setRegistration: (enabled: boolean) => {
      if (!tools.data) return;
      const revision = tools.data.revision;
      void registration.run(() =>
        api.POST('/api/companies/{company_id}/tool-registration-policy', {
          params: { path: c.path },
          body: { expected_revision: revision, employee_tool_creation_enabled: enabled },
        }),
      );
    },
  };
}
export type SettingsState = ReturnType<typeof useSettingsPageState>;
