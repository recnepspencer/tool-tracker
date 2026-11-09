import { errorMessage, type Model } from './client';
import { ArchiveJobDialog, JobDialog } from './job-dialogs';
import { JobParticipation, ParticipationDialog } from './job-participation';
import { JobRequests, RequestHistoryLink } from './job-requests';
import {
  useJobsPageState,
  useParticipation,
  useRequestReview,
  type JobsState,
  type ParticipationState,
} from './jobs-state';
import {
  ArchivableList,
  Button,
  DirectoryToolbar,
  ErrorState,
  LoadingState,
  PageHeading,
  RecordList,
  SurfaceCard,
  TextField,
} from './kit';

export function JobsPage() {
  const state = useJobsPageState();
  const participation = useParticipation();
  return (
    <>
      {state.variant === 'switches' ? (
        <MyJobs state={state} participation={participation} />
      ) : (
        <JobDirectory state={state} participation={participation} />
      )}
      <ParticipationDialog participation={participation} />
    </>
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
        <p className="jobs-muted">No active jobs yet. An administrator can add them on the Jobs page.</p>
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

/** Jobs as the Warehouses page lays them out: search, one row per job, and archived jobs one tap away. */
function JobDirectory({ state, participation }: { state: JobsState; participation: ParticipationState }) {
  const review = useRequestReview();
  const { c, jobs, visible = [], archived, selected, creating } = state;
  const manages = c.can('jobs.manage');
  if (jobs.isPending && !jobs.data) return <LoadingState label="Loading jobs…" />;
  if (!jobs.data)
    return (
      <ErrorState
        message={`Jobs could not be loaded. ${errorMessage(jobs.error)}`}
        onRetry={() => void jobs.refetch()}
      />
    );
  return (
    <div className="page-content">
      <PageHeading
        title="Jobs"
        description={
          manages
            ? 'Add jobs, see who is on them, and archive them when the work is done.'
            : 'Jobs and the people on them.'
        }
        action={manages ? <Button onClick={() => state.select('new')}>Add job</Button> : undefined}
      >
        {c.can('jobs.assign') && <RequestHistoryLink state={state} />}
      </PageHeading>
      {jobs.isError && <ErrorState message="Jobs could not be refreshed." onRetry={() => void jobs.refetch()} />}
      {c.can('jobs.assign') && <JobRequests state={state} review={review} />}
      <DirectoryToolbar
        searchLabel="Search jobs"
        searchPlaceholder="Search jobs…"
        search={state.search}
        onSearchChange={state.setSearch}
      />
      <ArchivableList archived={archived} noun="jobs" onArchivedChange={state.setArchived}>
        <RecordList
          label={archived ? 'Archived jobs' : 'Jobs'}
          items={visible.map((job) => ({
            id: job.id,
            title: job.name,
            detail: jobSummary(state, job),
            label: `Open ${job.name}`,
          }))}
          empty={
            jobs.data.length
              ? 'No jobs match this search.'
              : archived
                ? 'No archived jobs.'
                : manages
                  ? 'No jobs yet. Add one to start assigning people.'
                  : 'No active jobs yet.'
          }
          onSelect={state.select}
        />
      </ArchivableList>
      {manages && creating && <JobDialog state={state} participation={participation} />}
      {selected && !state.confirmingArchive && (
        <JobDialog key={selected.id} job={selected} state={state} participation={participation} />
      )}
      {selected && state.confirmingArchive && <ArchiveJobDialog job={selected} state={state} />}
    </div>
  );
}

/** The job number, how many people are on it, and where you stand on it. */
function jobSummary(state: JobsState, job: Model<'JobView'>) {
  const people = state.currentFor(job.id).length;
  const { own, pending } = state.participationFor(job);
  return [
    job.number,
    job.archived_at ? '' : `${people} ${people === 1 ? 'person' : 'people'}`,
    pending ? 'Request pending' : own ? "You're on this job" : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
