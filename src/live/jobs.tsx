import { useJobsPageState, type JobsState } from './jobs-state';
import { JobDialogs, ProjectList } from './job-dialogs';
import { JobRequests } from './job-requests';
import { JobParticipation } from './job-participation';
import { JobRoster } from './job-roster';
import { errorMessage, type Model } from './client';
import { Badge, Empty, Field, human, Loading, Notice } from './ui';

export function JobsPage() {
  const state = useJobsPageState();
  const { c, jobs, visible, assignments, policy, search, setSearch, archived, setArchived, open, selected, select } =
    state;
  const manages = c.can('jobs.manage');
  return (
    <div className="jobs-workspace">
      <header className="page-heading">
        <div>
          <h1>{manages || !c.can('jobs.participate') ? 'Jobs' : 'My jobs'}</h1>
          <p>
            {manages
              ? 'Manage jobs, people and their responsibilities.'
              : c.can('jobs.participate')
                ? 'Choose all the jobs you’re working on. Your tools stay with you when jobs change.'
                : 'View jobs and assigned people.'}
          </p>
        </div>
        {manages && (
          <div className="job-row-actions">
            <button onClick={() => open('new-project')}>Add project</button>
            <button className="primary" onClick={() => open('new-job')}>
              Add job
            </button>
          </div>
        )}
      </header>
      <div className="toolbar">
        <Field
          label="Search jobs"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search jobs"
        />
        <label className="check">
          <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
          Show archived jobs
        </label>
      </div>
      {(jobs.isPending || assignments.isPending || policy.isPending) && <Loading />}
      {[jobs.error, assignments.error, policy.error].filter(Boolean).map((error, index) => (
        <Notice key={index} error>
          {errorMessage(error)}
        </Notice>
      ))}
      <div className="job-selection">
        {visible?.map((job) => (
          <JobRow key={job.id} job={job} state={state} />
        ))}
        {visible?.length === 0 && (
          <Empty>
            {search ? 'No jobs match your search.' : archived ? 'No archived jobs.' : 'No active jobs yet.'}
          </Empty>
        )}
      </div>
      <JobRequests state={state} />
      {manages && <ProjectList state={state} />}
      {selected && <JobRoster state={state} job={selected} onClose={() => select('')} />}
      <JobDialogs state={state} />
    </div>
  );
}
function JobRow({ job, state }: { job: Model<'JobView'>; state: JobsState }) {
  const { c, currentFor, requests, select, open, policy, assignments } = state;
  const current = currentFor(job.id);
  const own = current.find((assignment) => assignment.membership_id === c.membership_id);
  const pending = requests.data?.find(
    (request) => request.job_id === job.id && request.membership_id === c.membership_id && request.status === 'pending',
  );
  const mode = own ? policy.data?.self_leave_mode : policy.data?.self_join_mode;
  const fullSwitch =
    !c.can('jobs.manage') &&
    c.can('jobs.participate') &&
    mode === 'direct' &&
    !pending &&
    !job.archived_at &&
    (own || ['active', 'planned'].includes(job.status)) &&
    !!assignments.data &&
    !!requests.data;
  return (
    <article className={`job-row${fullSwitch ? ' job-row--switch' : ''}`} aria-label={job.name}>
      {!fullSwitch && (
        <div className="job-row-copy">
          <strong>{job.name}</strong>
          <small>
            {job.number} · {job.project_number} / {job.project_name}
          </small>
          <div className="job-row-status">
            <Badge>{job.archived_at ? 'Archived' : human(job.status)}</Badge>
            {own && <span>On this job · {human(own.responsibility)}</span>}
          </div>
        </div>
      )}
      <div className="job-row-actions">
        <button className="text-button" onClick={() => select(job.id)} aria-label={`View people on ${job.name}`}>
          {current.length} {current.length === 1 ? 'person' : 'people'}
        </button>
        {pending ? (
          <p className="muted" role="status">
            {pending.intent === 'join' ? 'Join' : 'Leave'} awaiting approval
          </p>
        ) : (
          <JobParticipation state={state} job={job} own={own} />
        )}
        {c.can('jobs.manage') && (
          <>
            <button onClick={() => open(`edit-job:${job.id}`)} aria-label={`Edit ${job.name}`}>
              Edit
            </button>
            <button
              onClick={() => open(`${job.archived_at ? 'restore' : 'archive'}:${job.id}`)}
              aria-label={`${job.archived_at ? 'Restore' : 'Archive'} ${job.name}`}
            >
              {job.archived_at ? 'Restore' : 'Archive'}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
