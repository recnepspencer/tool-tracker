import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api, requestKey, result, type Model } from './client';
import { collect, usePeople } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';

type Job = Model<'JobView'>;
type Assignment = Model<'AssignmentView'>;
type Request = Model<'ParticipationView'>;

export function useJobsPageState() {
  const c = useCompany();
  const location = useListLocation();
  const cache = useQueryClient();
  // Field members get the demo's "My jobs" switch list. Anyone who manages or
  // assigns work, or can only read jobs, gets the job manager card.
  const variant: 'switches' | 'manager' =
    c.can('jobs.participate') && !c.can('jobs.manage') && !c.can('jobs.assign') ? 'switches' : 'manager';
  const search = location.params.get('search') ?? '';
  const archived = variant === 'manager' && location.params.get('archived') === 'true';
  const history = location.params.get('history') === 'true';
  const completed = location.params.get('completed') === 'true';
  const selectedId = location.params.get('job') ?? '';
  const dialog = location.params.get('dialog') ?? '';
  const [ending, setEnding] = useState<Assignment | null>(null);
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
    enabled: variant === 'manager',
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
  // Restore runs straight from the row, as in the demo; archive asks first.
  const restore = useMutation({
    mutationFn: (job: Job) =>
      api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
        params: { path: { ...c.path, job_id: job.id } },
        body: { expected_revision: job.revision, name: job.name, status: job.status, archived: false },
      }),
    onSuccess: () => cache.invalidateQueries({ queryKey: [c.company_id] }),
  });
  const selected = jobs.data?.find((job) => job.id === selectedId);
  const currentFor = (id: string) => assignments.data?.filter((assignment) => assignment.job_id === id) ?? [];
  const participationFor = (job: Job) => {
    const own = currentFor(job.id).find((assignment) => assignment.membership_id === c.membership_id);
    const pending = requests.data?.find(
      (request) =>
        request.job_id === job.id && request.membership_id === c.membership_id && request.status === 'pending',
    );
    const mode = own ? policy.data?.self_leave_mode : policy.data?.self_join_mode;
    const open = !job.archived_at && (!!own || ['active', 'planned'].includes(job.status));
    const ready = c.can('jobs.participate') && !!mode && !!assignments.data && !!requests.data;
    return { own, pending, mode, open, ready };
  };
  return {
    c,
    variant,
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
    restore,
    ending,
    setEnding,
    currentFor,
    participationFor,
    roster: history ? roster : { ...assignments, data: currentFor(selectedId) },
    visible: jobs.data?.filter((job) =>
      `${job.number} ${job.name} ${job.project_name} ${job.project_number}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ),
    setSearch: (value: string) => location.update('search', value),
    setArchived: (value: boolean) => location.update('archived', value ? 'true' : ''),
    setHistory: (value: boolean) => location.update('history', value ? 'true' : ''),
    setCompleted: (value: boolean) => location.update('completed', value ? 'true' : ''),
    select: (id: string) => {
      setEnding(null);
      location.update('job', id);
    },
    open: (value: string) => {
      restore.reset();
      location.update('dialog', value);
    },
  };
}
export type JobsState = ReturnType<typeof useJobsPageState>;

type ParticipationTarget = { job: Job; own?: Assignment; pending?: Request };

/**
 * Self-service participation. Direct mode toggles straight from the switch;
 * approval mode (and withdrawing a pending request) goes through a small note dialog.
 */
export function useParticipation() {
  const c = useCompany();
  const cache = useQueryClient();
  const staged = useRef<{ fingerprint: string; key: string } | null>(null);
  const [saved, setSaved] = useState('');
  const [target, setTarget] = useState<ParticipationTarget | null>(null);
  const [note, setNote] = useState('');
  const submit = async ({ job, own }: ParticipationTarget, reason: string) => {
    const body = { intent: own ? ('leave' as const) : ('join' as const), assignment_id: own?.id ?? null, reason };
    // A retried command keeps its request key so the server can deduplicate it.
    const fingerprint = JSON.stringify({ job: job.id, ...body });
    if (staged.current?.fingerprint !== fingerprint) staged.current = { fingerprint, key: requestKey() };
    const command = staged.current;
    await api.POST('/api/companies/{company_id}/jobs/{job_id}/participation', {
      params: { path: { ...c.path, job_id: job.id } },
      body: { ...body, request_key: command.key },
    });
    if (staged.current === command) staged.current = null;
  };
  const refresh = () => cache.invalidateQueries({ queryKey: [c.company_id] });
  const direct = useMutation({
    mutationFn: (value: ParticipationTarget) => submit(value, ''),
    onMutate: () => setSaved(''),
    onSuccess: (_, value) => {
      setSaved(`${value.own ? 'Left' : 'Joined'} ${value.job.name}`);
      return refresh();
    },
  });
  const request = useMutation({
    mutationFn: async (value: ParticipationTarget) => {
      if (!value.pending) return submit(value, note.trim());
      await api.POST('/api/companies/{company_id}/job-participation-requests/{request_id}/{action}', {
        params: { path: { ...c.path, request_id: value.pending.id, action: 'withdraw' } },
        body: { expected_revision: value.pending.revision, note: note.trim() },
      });
    },
    onMutate: () => setSaved(''),
    onSuccess: (_, value) => {
      setSaved(
        value.pending
          ? `Withdrew your request for ${value.job.name}`
          : `Asked to ${value.own ? 'leave' : 'join'} ${value.job.name}`,
      );
      setTarget(null);
      setNote('');
      return refresh();
    },
  });
  return {
    saved,
    direct,
    request,
    target,
    note,
    setNote,
    ask: (value: ParticipationTarget) => {
      request.reset();
      setNote('');
      setTarget(value);
    },
    close: () => {
      if (!request.isPending) setTarget(null);
    },
  };
}
export type ParticipationState = ReturnType<typeof useParticipation>;

type Decision = 'approve' | 'reject' | 'withdraw';

/** Participation request decisions, from the queue row or the review dialog. */
export function useRequestReview() {
  const c = useCompany();
  const cache = useQueryClient();
  const [review, setReview] = useState<Request | null>(null);
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: ({ request, action, note }: { request: Request; action: Decision; note: string }) =>
      api.POST('/api/companies/{company_id}/job-participation-requests/{request_id}/{action}', {
        params: { path: { ...c.path, request_id: request.id, action } },
        body: { expected_revision: request.revision, note: note.trim() },
      }),
    onSuccess: () => {
      setReview(null);
      setNote('');
      return cache.invalidateQueries({ queryKey: [c.company_id] });
    },
  });
  return {
    review,
    note,
    setNote,
    decide,
    // Row buttons decide without a note; the review dialog passes its note.
    resolve: (request: Request, action: Decision, decisionNote = '') =>
      decide.mutate({ request, action, note: decisionNote }),
    open: (request: Request) => {
      decide.reset();
      setNote('');
      setReview(request);
    },
    close: () => {
      if (!decide.isPending) setReview(null);
    },
  };
}
export type RequestReviewState = ReturnType<typeof useRequestReview>;
