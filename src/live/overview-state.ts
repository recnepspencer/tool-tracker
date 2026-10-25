import { useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { useCompany } from './session';

export function useOverview() {
  const company = useCompany();
  const summary = useQuery({
    queryKey: [company.company_id, 'summary'],
    queryFn: ({ signal }) =>
      api
        .GET('/api/companies/{company_id}/summary', {
          params: { path: company.path },
          signal,
        })
        .then(result),
  });
  return { company, summary };
}
