import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, result } from './client';
import { collect } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { useRegistrationPolicy } from './registration-policy';
import { useCategoryOptions } from './catalog-state';

export function useSettingsPageState() {
  const c = useCompany();
  const cache = useQueryClient();
  const refresh = () => cache.invalidateQueries({ queryKey: ['session'] });
  const company = useQuery({
    queryKey: [c.company_id, 'company-profile'],
    queryFn: () => api.GET('/api/companies/{company_id}', { params: { path: c.path } }).then(result),
  });
  const { policy: tools } = useRegistrationPolicy();
  const categories = useCategoryOptions({ enabled: c.can('catalog.manage') });
  const location = useListLocation();
  const categoryArchived = location.params.get('categories') === 'archived';
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
    categories,
    categoryArchived,
    visibleCategories: categories.data?.filter((category) => Boolean(category.archived_at) === categoryArchived),
    setCategoryArchived: (value: boolean) => location.update('categories', value ? 'archived' : ''),
  };
}
export type SettingsState = ReturnType<typeof useSettingsPageState>;
export function useActivityPageState() {
  const c = useCompany();
  const { params, update, offset, setOffset } = useListLocation();
  const search = params.get('search') ?? '';
  const rawKind = params.get('kind');
  const kind =
    rawKind === 'custody' || rawKind === 'request' || rawKind === 'flag' || rawKind === 'admin' ? rawKind : 'all';
  const warehouse = params.get('warehouse') ?? '';
  const mine = params.get('mine') === 'true';
  const warehouses = useQuery({
    queryKey: [c.company_id, 'warehouses'],
    queryFn: () =>
      collect((offset) =>
        api.GET('/api/companies/{company_id}/warehouses', { params: { path: c.path, query: { offset } } }).then(result),
      ),
  });
  const activity = useQuery({
    queryKey: [c.company_id, 'activity', offset, search, kind, warehouse, mine],
    queryFn: () =>
      api
        .GET('/api/companies/{company_id}/activity', {
          params: {
            path: c.path,
            query: { offset, limit: 30, search, kind, ...(warehouse ? { warehouse_id: warehouse } : {}), mine },
          },
        })
        .then(result),
  });

  return { c, offset, setOffset, activity, search, kind, warehouse, mine, warehouses, update };
}
export function useDirectoryPageState() {
  const c = useCompany();
  const searchLocation = useListLocation();
  const search = searchLocation.params.get('search') ?? '';
  const job = searchLocation.params.get('job') ?? '';
  const setSearch = (value: string) => searchLocation.update('search', value);
  const setJob = (value: string) => searchLocation.update('job', value);
  const jobs = useQuery({
    queryKey: [c.company_id, 'jobs', false],
    queryFn: () =>
      collect((offset) =>
        api.GET('/api/companies/{company_id}/jobs', { params: { path: c.path, query: { offset } } }).then(result),
      ),
  });
  const directory = useQuery({
    queryKey: [c.company_id, 'directory', search, job],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/directory', {
            params: {
              path: c.path,
              query: { offset, search, ...(job === 'none' ? { unassigned: true } : job ? { job_id: job } : {}) },
            },
          })
          .then(result),
      ),
  });

  return { c, search, setSearch, directory, job, setJob, jobs };
}
