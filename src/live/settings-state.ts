import { useQuery } from '@tanstack/react-query';
import { api, result } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';

export function useSettingsPageState() {
  const c = useCompany();
  const tools = useQuery({
    queryKey: [c.company_id, 'registration-policy'],
    enabled: c.can('tools.manage_registration_policy'),
    queryFn: () =>
      api.GET('/api/companies/{company_id}/tool-registration-policy', { params: { path: c.path } }).then(result),
  });
  const jobs = useQuery({
    queryKey: [c.company_id, 'participation-policy'],
    enabled: c.can('jobs.manage_policy'),
    queryFn: () =>
      api.GET('/api/companies/{company_id}/job-participation-policy', { params: { path: c.path } }).then(result),
  });

  return { c, tools, jobs };
}
export function useActivityPageState() {
  const c = useCompany();
  const { offset, setOffset } = useListLocation();
  const activity = useQuery({
    queryKey: [c.company_id, 'activity', offset],
    queryFn: () =>
      api
        .GET('/api/companies/{company_id}/activity', { params: { path: c.path, query: { offset, limit: 30 } } })
        .then(result),
  });

  return { c, offset, setOffset, activity };
}
export function useDirectoryPageState() {
  const c = useCompany();
  const searchLocation = useListLocation();
  const search = searchLocation.params.get('search') ?? '';
  const setSearch = (value: string) => searchLocation.update('search', value);
  const directory = useQuery({
    queryKey: [c.company_id, 'directory', search],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/directory', { params: { path: c.path, query: { offset, search } } })
          .then(result),
      ),
  });

  return { search, setSearch, directory };
}
