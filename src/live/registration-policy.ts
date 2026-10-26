import { useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { useCompany } from './session';

export function useRegistrationPolicy() {
  const c = useCompany();
  const policy = useQuery({
    queryKey: [c.company_id, 'registration-policy'],
    enabled: c.can('tools.register') || c.can('tools.manage_registration_policy'),
    queryFn: () =>
      api.GET('/api/companies/{company_id}/tool-registration-policy', { params: { path: c.path } }).then(result),
  });
  return {
    policy,
    canRegister:
      c.can('tools.register') && (c.can('tools.manage') || policy.data?.employee_tool_creation_enabled === true),
  };
}
