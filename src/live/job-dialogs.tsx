import { useId } from 'react';
import { api, type Model } from './client';
import { JobRequestsPanel } from './job-requests';
import { JobPeople } from './job-roster';
import { JobTools } from './job-tools';
import type { JobTab, JobsState, RequestReviewState } from './jobs-state';
import { Button, OverlayDialog } from './kit';
import { CommandError, CommandForm } from './settings-command';
import { Field, text } from './ui';

type Job = Model<'JobView'>;

const tabLabel: Record<JobTab, string> = {
  people: 'People',
  tools: 'Tools',
  requests: 'Requests',
  details: 'Details',
};

/** Naming a new job is all it takes to add one. */
export function AddJobDialog({ state }: { state: JobsState }) {
  const { c } = state;
  const close = () => state.select('');
  return (
    <OverlayDialog label="Add job" onClose={close} panelClassName="admin-dialog" showCloseButton>
      <div className="dialog-heading">
        <h2>Add a job</h2>
      </div>
      <CommandForm
        label="Add job"
        onCancel={close}
        onDone={close}
        submit={(form) =>
          api.POST('/api/companies/{company_id}/jobs', { params: { path: c.path }, body: { name: text(form, 'name') } })
        }
      >
        <Field label="Job name" name="name" required maxLength={200} placeholder="e.g. Riverside lighting" />
      </CommandForm>
    </OverlayDialog>
  );
}

/**
 * A job's own page: a short overview, then one section at a time — who is on it, the tools they
 * hold, requests waiting on a decision, and (for managers) its name and archiving.
 */
export function JobSheet({ job, state, review }: { job: Job; state: JobsState; review: RequestReviewState }) {
  const { c, tab, tabs, tools, waiting } = state;
  const ids = useId();
  const close = () => state.select('');
  const people = state.currentFor(job.id).length;
  const toolCount = tools.data?.reduce((total, person) => total + person.tools.length, 0);
  return (
    <OverlayDialog label={job.name} onClose={close} panelClassName="admin-dialog job-sheet" showCloseButton page>
      <header className="job-sheet__head">
        <h2>{job.name}</h2>
        {job.archived_at ? <span className="job-sheet__status">Archived</span> : null}
      </header>
      <dl className="job-facts" aria-label="Overview">
        <div>
          <dt>People</dt>
          <dd>{state.assignments.data ? people : '–'}</dd>
        </div>
        {c.can('tools.read') ? (
          <div>
            <dt>Tools</dt>
            <dd>{toolCount ?? '–'}</dd>
          </div>
        ) : null}
        {waiting.length ? (
          <div>
            <dt>Waiting</dt>
            <dd>{waiting.length}</dd>
          </div>
        ) : null}
      </dl>
      {tabs.length > 1 ? (
        <div className="segmented job-tabs" role="tablist" aria-label="Job sections">
          {tabs.map((value) => (
            <button
              key={value}
              id={`${ids}-${value}`}
              type="button"
              role="tab"
              aria-selected={tab === value}
              aria-controls={`${ids}-panel`}
              onClick={() => tab !== value && state.setTab(value)}
            >
              {tabLabel[value]}
              {value === 'requests' ? <span className="job-tabs__count">{waiting.length}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="job-panel"
        role={tabs.length > 1 ? 'tabpanel' : 'region'}
        id={`${ids}-panel`}
        aria-labelledby={tabs.length > 1 ? `${ids}-${tab}` : undefined}
        aria-label={tabs.length > 1 ? undefined : tabLabel[tab]}
      >
        {tab === 'people' && <JobPeople state={state} job={job} onLeave={close} />}
        {tab === 'tools' && <JobTools state={state} />}
        {tab === 'requests' && <JobRequestsPanel requests={waiting} c={c} review={review} />}
        {tab === 'details' && <JobDetails job={job} state={state} />}
      </div>
    </OverlayDialog>
  );
}

/** The job's name and whether it is still running. Managers only. */
function JobDetails({ job, state }: { job: Job; state: JobsState }) {
  const { c, archive } = state;
  return (
    <>
      <CommandForm
        label="Save name"
        saveWhenChanged
        submit={(form) =>
          api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
            params: { path: { ...c.path, job_id: job.id } },
            body: { name: text(form, 'name'), expected_revision: job.revision, archived: Boolean(job.archived_at) },
          })
        }
      >
        <Field label="Job name" name="name" defaultValue={job.name} required maxLength={200} />
      </CommandForm>
      <div className="job-archive">
        <p className="jobs-muted">
          {job.archived_at
            ? 'This job is archived. Restore it to put people back on it.'
            : 'When the work is done, archive the job. Everyone comes off it; its history and tools stay as they are.'}
        </p>
        {job.archived_at ? (
          <Button variant="secondary" disabled={archive.busy} onClick={() => state.setJobArchived(job, false)}>
            {archive.busy ? 'Restoring…' : 'Restore job'}
          </Button>
        ) : (
          <Button variant="secondary" onClick={state.startArchive}>
            Archive job
          </Button>
        )}
        <CommandError error={archive.error} />
      </div>
    </>
  );
}

export function ArchiveJobDialog({ job, state }: { job: Job; state: JobsState }) {
  const { archive } = state;
  return (
    <OverlayDialog
      label="Archive job"
      onClose={() => !archive.busy && state.cancelArchive()}
      panelClassName="admin-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <h2>Archive {job.name}?</h2>
        <p>
          Everyone comes off the job and waiting requests are turned down. Its history and tool custody are kept, and
          you can restore it from Archived.
        </p>
      </div>
      <CommandError error={archive.error} />
      <div className="dialog-actions">
        <Button variant="ghost" onClick={state.cancelArchive} disabled={archive.busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={() => state.setJobArchived(job, true)} disabled={archive.busy}>
          {archive.busy ? 'Archiving…' : 'Archive job'}
        </Button>
      </div>
    </OverlayDialog>
  );
}
