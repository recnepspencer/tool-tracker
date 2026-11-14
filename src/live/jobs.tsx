import { errorMessage, type Model } from './client';
import { AddJobDialog, ArchiveJobDialog, JobSheet } from './job-dialogs';
import { MyJobsList } from './job-participation';
import { JobRequests, RequestHistoryLink } from './job-requests';
import { StaffingDialog } from './job-roster';
import { useJobsPageState, useParticipation, useRequestReview, type JobsState } from './jobs-state';
import { ArchivableList, Button, DirectoryToolbar, ErrorState, LoadingState, PageHeading, RecordList } from './kit';

export function JobsPage() {
  const state = useJobsPageState();
  const participation = useParticipation();
  if (!state.staffs)
    return (
      <div className="page-content jobs-page">
        <PageHeading title="My jobs" />
        <MyJobsList state={state} participation={participation} />
      </div>
    );
  const manages = state.c.can('jobs.manage');
  const mine = state.view === 'mine';
  return (
    <div className="page-content jobs-page">
      <PageHeading
        title="Jobs"
        action={manages && !mine ? <Button onClick={() => state.select('new')}>Add job</Button> : undefined}
      >
        {!mine && state.c.can('jobs.assign') ? <RequestHistoryLink state={state} /> : null}
      </PageHeading>
      {state.participates ? (
        <div className="segmented jobs-views" role="tablist" aria-label="Jobs">
          {(['all', 'mine'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={state.view === value}
              onClick={() => state.view !== value && state.setView(value)}
            >
              {value === 'all' ? 'All jobs' : 'My jobs'}
            </button>
          ))}
        </div>
      ) : null}
      {mine ? <MyJobsList state={state} participation={participation} /> : <JobDirectory state={state} />}
    </div>
  );
}

/** Every job, one row each, with archived jobs one tap away. A row opens the job's own page. */
function JobDirectory({ state }: { state: JobsState }) {
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
    <>
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
                  ? 'No jobs yet. Add one to start putting people on it.'
                  : 'No active jobs yet.'
          }
          onSelect={state.select}
        />
      </ArchivableList>
      {manages && creating && <AddJobDialog state={state} />}
      {selected && state.staffing && <StaffingDialog key={selected.id} state={state} job={selected} />}
      {selected && !state.staffing && !state.confirmingArchive && (
        <JobSheet key={selected.id} job={selected} state={state} review={review} />
      )}
      {selected && state.confirmingArchive && <ArchiveJobDialog job={selected} state={state} />}
    </>
  );
}

/** How many people are on it, anything waiting, and whether you're on it. */
function jobSummary(state: JobsState, job: Model<'JobView'>) {
  if (job.archived_at) return '';
  const people = state.currentFor(job.id).length;
  const waiting = state.c.can('jobs.assign') ? state.waitingFor(job.id).length : 0;
  const { own } = state.participationFor(job);
  return [
    `${people} ${people === 1 ? 'person' : 'people'}`,
    waiting ? `${waiting} waiting` : '',
    own ? 'You’re on it' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
