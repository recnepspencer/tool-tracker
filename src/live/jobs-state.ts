import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { api, requestKey, result, type Model } from './client';
import { collect, usePeople } from './data';
import { useListLocation } from './list-location';
import { useCompany } from './session';
import { useCommand } from './settings-command-state';

type Job = Model<'JobView'>;
type Assignment = Model<'AssignmentView'>;
type Request = Model<'ParticipationView'>;
type Mode = Model<'ParticipationPolicyView'>['self_join_mode'];

export type JobTab = 'people' | 'tools' | 'requests' | 'details';

export function useJobsPageState() {
  const c = useCompany();
  const location = useListLocation();
  const { params } = location;
  // Anyone who staffs jobs gets the job directory; field crews get only their own on/off list.
  const staffs = c.can('jobs.assign') || c.can('jobs.manage');
  const participates = c.can('jobs.participate');
  const view: 'all' | 'mine' = !staffs || (participates && params.get('view') === 'mine') ? 'mine' : 'all';
  const search = params.get('search') ?? '';
  const archived = view === 'all' && params.get('archived') === 'true';
  const history = params.get('history') === 'true';
  const completed = params.get('completed') === 'true';
  const selectedId = staffs ? (params.get('job') ?? '') : '';
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  // The people checklist opens over the job, and closing it goes back to the job.
  const [staffing, setStaffing] = useState(false);
  const archive = useCommand();
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
  // Who used to be on the job: every assignment on it, of which the ended ones are shown.
  const past = useQuery({
    queryKey: [c.company_id, 'assignments', selectedId, 'history'],
    enabled: !!selectedId && selectedId !== 'new' && history,
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/assignments', {
            params: { path: c.path, query: { offset, job_id: selectedId, current: false } },
          })
          .then(result),
      ).then((items) => items.filter((assignment) => assignment.ends_at)),
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
  // The tools on a job are the tools its people hold right now.
  const tools = useQuery({
    queryKey: [c.company_id, 'directory', '', selectedId],
    enabled: !!selectedId && selectedId !== 'new' && c.can('tools.read'),
    queryFn: () =>
      collect((offset) =>
        api
          .GET('/api/companies/{company_id}/directory', {
            params: { path: c.path, query: { offset, job_id: selectedId } },
          })
          .then(result),
      ),
  });
  const selected = jobs.data?.find((job) => job.id === selectedId);
  const currentFor = (id: string) => assignments.data?.filter((assignment) => assignment.job_id === id) ?? [];
  const waitingFor = (id: string) =>
    requests.data?.filter((request) => request.job_id === id && request.status === 'pending') ?? [];
  const participationFor = (job: Job) => {
    const own = currentFor(job.id).find((assignment) => assignment.membership_id === c.membership_id);
    const pending = requests.data?.find(
      (request) =>
        request.job_id === job.id && request.membership_id === c.membership_id && request.status === 'pending',
    );
    const mode: Mode | undefined = own ? policy.data?.self_leave_mode : policy.data?.self_join_mode;
    const open = !job.archived_at;
    const ready = participates && !!mode && !!assignments.data && !!requests.data;
    return { own, pending, mode, open, ready };
  };
  const waiting = selected && c.can('jobs.assign') ? waitingFor(selected.id) : [];
  const tabParam = params.get('tab') as JobTab | null;
  const tabs: JobTab[] = [
    'people',
    ...(c.can('tools.read') ? (['tools'] as const) : []),
    ...(waiting.length ? (['requests'] as const) : []),
    ...(c.can('jobs.manage') ? (['details'] as const) : []),
  ];
  const tab: JobTab = tabParam && tabs.includes(tabParam) ? tabParam : 'people';
  return {
    c,
    view,
    staffs,
    participates,
    search,
    archived,
    history,
    completed,
    selected,
    creating: selectedId === 'new',
    jobs,
    policy,
    people,
    assignments,
    requests,
    past,
    tools,
    tab,
    tabs,
    waiting,
    currentFor,
    waitingFor,
    participationFor,
    visible: jobs.data?.filter((job) => job.name.toLowerCase().includes(search.trim().toLowerCase())),
    setView: (value: 'all' | 'mine') => {
      location.update('job', '');
      location.update('archived', '');
      location.update('view', value === 'mine' ? 'mine' : '');
    },
    setSearch: (value: string) => location.update('search', value),
    setArchived: (value: boolean) => location.update('archived', value ? 'true' : ''),
    setHistory: (value: boolean) => location.update('history', value ? 'true' : ''),
    setCompleted: (value: boolean) => location.update('completed', value ? 'true' : ''),
    setTab: (value: JobTab) => {
      location.update('history', '');
      location.update('tab', value === 'people' ? '' : value);
    },
    staffing,
    setStaffing,
    select: (id: string) => {
      setConfirmingArchive(false);
      setStaffing(false);
      archive.reset();
      // Each job opens on its people, not the section the last one was showing.
      location.update('history', '');
      location.update('tab', '');
      location.update('job', id);
    },
    confirmingArchive,
    archive,
    startArchive: () => {
      archive.reset();
      setConfirmingArchive(true);
    },
    cancelArchive: () => setConfirmingArchive(false),
    // Archiving takes everyone off the job, so it asks first; restoring does not.
    setJobArchived: (job: Job, value: boolean) =>
      void archive.run(
        () =>
          api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
            params: { path: { ...c.path, job_id: job.id } },
            body: { expected_revision: job.revision, name: job.name, archived: value },
          }),
        () => {
          setConfirmingArchive(false);
          location.update('job', '');
        },
      ),
  };
}
export type JobsState = ReturnType<typeof useJobsPageState>;

/**
 * The jobs a person can switch on or off, theirs first. The order is taken once, when their jobs
 * first load, so a row stays under the finger when it is switched instead of jumping to the top.
 */
export function useMyJobs(state: Pick<JobsState, 'jobs' | 'visible' | 'participationFor'>) {
  const first = useRef<Set<string> | null>(null);
  const choosable = (job: Job) => {
    const { own, pending, open } = state.participationFor(job);
    return !!own || !!pending || open;
  };
  const all = state.jobs.data?.filter(choosable) ?? [];
  const mine = (job: Job) => {
    const { own, pending } = state.participationFor(job);
    return !!own || pending?.intent === 'join';
  };
  if (!first.current && all.length && all.every((job) => state.participationFor(job).ready))
    first.current = new Set(all.filter(mine).map((job) => job.id));
  const rank = (job: Job) => ((first.current ? first.current.has(job.id) : mine(job)) ? 0 : 1);
  const shown = (state.visible ?? [])
    .filter(choosable)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return { all, shown };
}

export type ParticipationTarget = { job: Job; own?: Assignment; pending?: Request };

/**
 * Self-service participation, straight from the job's row. The server applies the company's rule:
 * a direct change lands at once, an approval change waits as a request the person can cancel.
 */
export function useParticipation() {
  const c = useCompany();
  const cache = useQueryClient();
  const staged = useRef<{ fingerprint: string; key: string } | null>(null);
  const [saved, setSaved] = useState('');
  const change = useMutation({
    mutationFn: async ({ job, own, pending }: ParticipationTarget) => {
      if (pending) {
        await api.POST('/api/companies/{company_id}/job-participation-requests/{request_id}/{action}', {
          params: { path: { ...c.path, request_id: pending.id, action: 'withdraw' } },
          body: { expected_revision: pending.revision, note: '' },
        });
        return null;
      }
      const body = { intent: own ? ('leave' as const) : ('join' as const), assignment_id: own?.id ?? null, reason: '' };
      // A retried command keeps its request key so the server can deduplicate it.
      const fingerprint = JSON.stringify({ job: job.id, ...body });
      if (staged.current?.fingerprint !== fingerprint) staged.current = { fingerprint, key: requestKey() };
      const command = staged.current;
      const response = await api
        .POST('/api/companies/{company_id}/jobs/{job_id}/participation', {
          params: { path: { ...c.path, job_id: job.id } },
          body: { ...body, request_key: command.key },
        })
        .then(result);
      if (staged.current === command) staged.current = null;
      return response;
    },
    onMutate: () => setSaved(''),
    // A refusal is often a rule a manager just changed, so fetch the rules again and redraw the row.
    onError: () => cache.invalidateQueries({ queryKey: [c.company_id, 'participation-policy'] }),
    onSuccess: (response, { job, own, pending }) => {
      setSaved(
        pending
          ? `Cancelled your request for ${job.name}`
          : response?.status === 'pending'
            ? `Asked to ${own ? 'leave' : 'join'} ${job.name}`
            : `${own ? 'Left' : 'Joined'} ${job.name}`,
      );
      return cache.invalidateQueries({ queryKey: [c.company_id] });
    },
  });
  return {
    saved,
    change,
    /** The job whose change is on its way, so only that row waits. */
    busyJob: change.isPending ? change.variables?.job.id : undefined,
  };
}
export type ParticipationState = ReturnType<typeof useParticipation>;

/**
 * The manager's checklist for one job: who is ticked now, and the adds and removes one Save applies.
 */
export function useStaffing(job: Job, current: Assignment[], onDone: () => void) {
  const c = useCompany();
  const cache = useQueryClient();
  const initial = new Set(current.map((assignment) => assignment.membership_id));
  const [chosen, setChosen] = useState(initial);
  const [search, setSearch] = useState('');
  const added = [...chosen].filter((id) => !initial.has(id));
  const removed = [...initial].filter((id) => !chosen.has(id));
  const save = useMutation({
    mutationFn: () =>
      api
        .POST('/api/companies/{company_id}/jobs/{job_id}/members', {
          params: { path: { ...c.path, job_id: job.id } },
          body: { expected_revision: job.revision, membership_ids: [...chosen], note: '' },
        })
        .then(result),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [c.company_id] });
      onDone();
    },
  });
  return {
    chosen,
    search,
    setSearch,
    added,
    removed,
    changed: added.length + removed.length > 0,
    toggle: (id: string) =>
      setChosen((before) => {
        const next = new Set(before);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    save,
  };
}
export type StaffingState = ReturnType<typeof useStaffing>;

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
