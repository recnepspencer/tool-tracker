import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, requestKey, result, type Model } from './client';
import { collect, useReferences } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';

export function useJobsPageState() {
  const c = useCompany();
  const refs = useReferences();
  const archivedLocation = useListLocation();
  const archived = archivedLocation.params.get('archived') === 'true';
  const setArchived = (value: boolean) => archivedLocation.update('archived', value ? 'true' : '');
  const jobs = useQuery({
    queryKey: [c.company_id, 'jobs', archived],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/jobs', { params: { path: c.path, query: { offset, archived } } })
          .then(result),
      ),
  });
  const projects = useQuery({
    queryKey: [c.company_id, 'projects'],
    queryFn: () =>
      collect((offset) =>
        api.GET('/api/companies/{company_id}/projects', { params: { path: c.path, query: { offset } } }).then(result),
      ),
  });
  const requests = useQuery({
    queryKey: [c.company_id, 'participation'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/job-participation-requests', {
            params: { path: c.path, query: { offset } },
          })
          .then(result),
      ),
  });

  return { c, refs, archived, setArchived, jobs, projects, requests };
}
export function useJobCardState({ job: j }: { job: Model<'JobView'> }) {
  const c = useCompany();
  const refs = useReferences();
  const historyLocation = useListLocation();
  const history = historyLocation.params.get('history') === 'true';
  const setHistory = (value: boolean) => historyLocation.update('history', value ? 'true' : '');
  const [key, setKey] = useState(requestKey);
  const policy = useQuery({
    queryKey: [c.company_id, 'participation-policy'],
    queryFn: () =>
      api.GET('/api/companies/{company_id}/job-participation-policy', { params: { path: c.path } }).then(result),
  });
  const assignments = useQuery({
    queryKey: [c.company_id, 'assignments', j.id, history],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/assignments', {
            params: { path: c.path, query: { offset, job_id: j.id, current: !history } },
          })
          .then(result),
      ),
  });
  const own = assignments.data?.find((a) => a.membership_id === c.membership_id && !a.ends_at);
  const mode = own ? policy.data?.self_leave_mode : policy.data?.self_join_mode;

  return { c, refs, history, setHistory, key, setKey, policy, assignments, own, mode };
}
