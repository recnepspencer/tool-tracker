import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage, type Model } from './client';
import { JobDialogs, ProjectList } from './job-dialogs';
import { JobParticipation, ParticipationDialog } from './job-participation';
import { JobRequests } from './job-requests';
import { JobRoster } from './job-roster';
import { jobStatusLabel } from './jobs-labels';
import {
  useJobsPageState,
  useParticipation,
  useRequestReview,
  type JobsState,
  type ParticipationState,
} from './jobs-state';
import { Button, ErrorState, LoadingState, PageHeading, SelectField, SurfaceCard, TextField } from './kit';

export function JobsPage({ embedded = false }: { embedded?: boolean }) {
  const state = useJobsPageState();
  const participation = useParticipation();
  const review = useRequestReview();
  const { c, variant, selected, select } = state;
  const overlays = (
    <>
      {selected && <JobRoster state={state} job={selected} onClose={() => select('')} />}
      <JobDialogs state={state} />
      <ParticipationDialog participation={participation} />
    </>
  );
  if (embedded)
    return (
      <>
        <JobManager state={state} participation={participation} embedded />
        {overlays}
      </>
    );
  if (variant === 'switches')
    return (
      <>
        <MyJobs state={state} participation={participation} />
        {overlays}
      </>
    );
  return (
    <div className="page-content jobs-page">
      <PageHeading
        title="Jobs"
        description={
          c.can('jobs.manage') ? 'Manage jobs, people and their responsibilities.' : 'View jobs and assigned people.'
        }
      />
      <div className="settings-grid">
        <JobManager state={state} participation={participation} />
        {c.can('jobs.assign') && <JobRequests state={state} review={review} />}
        {c.can('jobs.manage') && <ProjectList state={state} />}
      </div>
      {overlays}
    </div>
  );
}

/** Demo `MyJobsPage`: one switch per job the person can join. */
function MyJobs({ state, participation }: { state: JobsState; participation: ParticipationState }) {
  const { jobs, assignments, requests, policy, search, setSearch, visible, participationFor } = state;
  const queries = [jobs, assignments, requests, policy];
  const failed = queries.find((query) => query.isError);
  const choosable = (job: Model<'JobView'>) => {
    const { own, open } = participationFor(job);
    return !!own || open;
  };
  const all = jobs.data?.filter(choosable) ?? [];
  const shown = visible?.filter(choosable) ?? [];
  const error = participation.direct.error;
  return (
    <div className="page-content jobs-page">
      <PageHeading
        title="My jobs"
        description="Choose all the jobs you’re working on. Your tools stay with you when your jobs change."
      />
      <TextField
        label="Search jobs"
        type="search"
        compact
        value={search}
        onChange={setSearch}
        placeholder="Search jobs"
      />
      {error && (
        <p className="form-error" role="alert">
          {errorMessage(error)}
        </p>
      )}
      <span className="sr-only" role="status">
        {participation.saved}
      </span>
      {failed ? (
        <ErrorState
          message={`Your jobs could not be loaded. ${errorMessage(failed.error)}`}
          onRetry={() => queries.forEach((query) => void query.refetch())}
        />
      ) : queries.some((query) => query.isPending) ? (
        <LoadingState label="Loading your jobs…" />
      ) : !all.length ? (
        <p className="jobs-muted">No active jobs yet. An administrator can add them in Settings.</p>
      ) : !shown.length ? (
        <p className="jobs-muted">No jobs match your search.</p>
      ) : (
        <SurfaceCard className="job-selection">
          {shown.map((job) => (
            <JobParticipation key={job.id} state={state} participation={participation} job={job} />
          ))}
        </SurfaceCard>
      )}
    </div>
  );
}

/** Demo `JobManager` card. */
function JobManager({
  state,
  participation,
  embedded = false,
}: {
  state: JobsState;
  participation: ParticipationState;
  embedded?: boolean;
}) {
  const { c, jobs, visible, assignments, policy, search, setSearch, archived, setArchived, open, restore } = state;
  const manages = c.can('jobs.manage');
  const headingId = embedded ? 'settings-jobs-heading' : 'jobs-manager-heading';
  const loadError = [assignments.error, policy.error].find(Boolean);
  return (
    <section className="surface-card settings-card jobs-manager" aria-labelledby={headingId}>
      <div className="settings-card-heading">
        <h2 id={headingId}>Jobs</h2>
        {manages && (
          <Button onClick={() => open('new-job')}>
            <Plus aria-hidden="true" /> Add job
          </Button>
        )}
      </div>
      <p className="jobs-muted">
        {policy.data?.self_join_mode === 'disabled'
          ? 'Managers assign people to jobs. Archive completed jobs to keep their history.'
          : 'Foremen choose their own jobs. Archive completed jobs to keep their history.'}
      </p>
      <TextField
        label="Search jobs"
        type="search"
        compact
        value={search}
        onChange={setSearch}
        placeholder="Search jobs"
      />
      <SelectField
        label="Job status"
        value={archived ? 'archived' : 'active'}
        onChange={(value) => setArchived(value === 'archived')}
        searchable={false}
        compact
        options={[
          { value: 'active', label: 'Active jobs' },
          { value: 'archived', label: 'Archived jobs' },
        ]}
      />
      {loadError && (
        <p className="form-error" role="alert">
          {errorMessage(loadError)}
        </p>
      )}
      {jobs.isPending ? (
        <LoadingState label="Loading jobs…" />
      ) : jobs.isError ? (
        <ErrorState
          message={`Jobs could not be loaded. ${errorMessage(jobs.error)}`}
          onRetry={() => void jobs.refetch()}
        />
      ) : (
        <div className="jobs-list">
          {!visible?.length && (
            <p className="jobs-muted">
              {search
                ? 'No jobs match your search.'
                : archived
                  ? 'No archived jobs.'
                  : manages
                    ? 'No active jobs. Add a job to get started.'
                    : 'No active jobs yet.'}
            </p>
          )}
          {visible?.map((job) => (
            <JobRow key={job.id} job={job} state={state} participation={participation} embedded={embedded} />
          ))}
        </div>
      )}
      {restore.error && (
        <p className="form-error" role="alert">
          {errorMessage(restore.error)}
        </p>
      )}
      {participation.direct.error && (
        <p className="form-error" role="alert">
          {errorMessage(participation.direct.error)}
        </p>
      )}
      <span className="sr-only" role="status">
        {participation.saved}
      </span>
      {embedded && (
        <Link className="text-link" to="/app/jobs">
          All jobs, projects & requests
        </Link>
      )}
    </section>
  );
}

function JobRow({
  job,
  state,
  participation,
  embedded,
}: {
  job: Model<'JobView'>;
  state: JobsState;
  participation: ParticipationState;
  embedded: boolean;
}) {
  const { c, currentFor, participationFor, select, open, restore } = state;
  const current = currentFor(job.id);
  const { own, pending } = participationFor(job);
  const manages = c.can('jobs.manage');
  // The row's participation switch has no visible label, so the details say where you stand.
  const details = [
    job.number,
    job.project_name,
    job.status === 'active' ? '' : jobStatusLabel[job.status],
    pending ? 'Request pending' : !embedded && own ? "You're on this job" : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article className="job-row" aria-label={job.name}>
      <div className="job-row-copy">
        <strong>{job.name}</strong>
        <small>{details}</small>
        <button
          className="job-members-link"
          type="button"
          onClick={() => select(job.id)}
          aria-label={`View people on ${job.name}`}
        >
          {job.archived_at ? 'View history' : `${current.length} ${current.length === 1 ? 'person' : 'people'}`}
        </button>
      </div>
      <div className="job-row-actions">
        {!embedded && <JobParticipation state={state} participation={participation} job={job} compact />}
        {manages && (
          <>
            <Button variant="ghost" onClick={() => open(`edit-job:${job.id}`)} aria-label={`Edit ${job.name}`}>
              Edit
            </Button>
            <Button
              variant="secondary"
              disabled={restore.isPending}
              aria-label={`${job.archived_at ? 'Restore' : 'Archive'} ${job.name}`}
              onClick={() => (job.archived_at ? restore.mutate(job) : open(`archive:${job.id}`))}
            >
              {job.archived_at ? 'Restore' : 'Archive'}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
