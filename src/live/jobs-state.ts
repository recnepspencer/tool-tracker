import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { api, requestKey, result, type Model } from './client';
import { collect, usePeople } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { text } from './ui';

export function useJobsPageState() {
  const c = useCompany();
  const location = useListLocation();
  const search = location.params.get('search') ?? '';
  const archived = location.params.get('archived') === 'true';
  const history = location.params.get('history') === 'true';
  const completed = location.params.get('completed') === 'true';
  const selectedId = location.params.get('job') ?? '';
  const dialog = location.params.get('dialog') ?? '';
  const people = usePeople({ enabled: c.can('jobs.assign') });
  const jobs = useQuery({
    queryKey: [c.company_id, 'jobs', archived],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/jobs', {
            params: { path: c.path, query: { offset, archived } },
          })
          .then(result),
      ),
  });
  const projects = useQuery({
    queryKey: [c.company_id, 'projects'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/projects', {
            params: { path: c.path, query: { offset } },
          })
          .then(result),
      ),
  });
  const policy = useQuery({
    queryKey: [c.company_id, 'participation-policy'],
    queryFn: () =>
      api.GET('/api/companies/{company_id}/job-participation-policy', { params: { path: c.path } }).then(result),
  });
  const assignments = useQuery({
    queryKey: [c.company_id, 'assignments', 'current'],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/assignments', {
            params: { path: c.path, query: { offset } },
          })
          .then(result),
      ),
  });
  const roster = useQuery({
    queryKey: [c.company_id, 'assignments', selectedId, 'history'],
    enabled: !!selectedId && history,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/assignments', {
            params: { path: c.path, query: { offset, job_id: selectedId, current: false } },
          })
          .then(result),
      ),
  });
  const requests = useQuery({
    queryKey: [c.company_id, 'participation', completed],
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/job-participation-requests', {
            params: { path: c.path, query: { offset, pending: !completed } },
          })
          .then(result),
      ),
  });
  const selected = jobs.data?.find((job) => job.id === selectedId);
  const currentFor = (id: string) => assignments.data?.filter((assignment) => assignment.job_id === id) ?? [];
  return {
    c,
    search,
    archived,
    history,
    completed,
    dialog,
    selected,
    jobs,
    projects,
    policy,
    people,
    assignments,
    requests,
    currentFor,
    roster: history ? roster : { ...assignments, data: currentFor(selectedId) },
    visible: jobs.data?.filter((job) =>
      `${job.number} ${job.name} ${job.project_name} ${job.project_number}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
    setSearch: (value: string) => location.update('search', value),
    setArchived: (value: boolean) => location.update('archived', value ? 'true' : ''),
    setHistory: (value: boolean) => location.update('history', value ? 'true' : ''),
    setCompleted: (value: boolean) => location.update('completed', value ? 'true' : ''),
    select: (id: string) => location.update('job', id),
    open: (value: string) => location.update('dialog', value),
  };
}

export function useParticipationCommand(job: Model<'JobView'>, own: Model<'AssignmentView'> | undefined) {
  const c = useCompany();
  const staged = useRef<{ fingerprint: string; key: string } | null>(null);
  return async (form: FormData) => {
    const body = {
      intent: own ? ('leave' as const) : ('join' as const),
      assignment_id: own?.id ?? null,
      reason: text(form, 'reason'),
    };
    const fingerprint = JSON.stringify(body);
    if (staged.current?.fingerprint !== fingerprint) staged.current = { fingerprint, key: requestKey() };
    const command = staged.current;
    await api.POST('/api/companies/{company_id}/jobs/{job_id}/participation', {
      params: { path: { ...c.path, job_id: job.id } },
      body: { ...body, request_key: command.key },
    });
    if (staged.current === command) staged.current = null;
  };
}

export function useJobMembershipSwitch(job: Model<'JobView'>, own: Model<'AssignmentView'> | undefined) {
  const submit = useParticipationCommand(job, own);
  const c = useCompany();
  const cache = useQueryClient();
  return useMutation({
    mutationFn: () => submit(new FormData()),
    onSuccess: () => cache.invalidateQueries({ queryKey: [c.company_id] }),
  });
}
export type JobsState = ReturnType<typeof useJobsPageState>;
