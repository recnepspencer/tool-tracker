import { api, errorMessage, type Model } from './client';
import { JobParticipation } from './job-participation';
import { JobPeople } from './job-roster';
import type { JobsState, ParticipationState } from './jobs-state';
import { Button, OverlayDialog } from './kit';
import { CommandError, CommandForm } from './settings-command';
import { Field, text } from './ui';

type Job = Model<'JobView'>;

/** One dialog per job, as on Warehouses: its details, the people on it, and archiving. */
export function JobDialog({
  job,
  state,
  participation,
}: {
  job?: Job;
  state: JobsState;
  participation: ParticipationState;
}) {
  const { c, archive } = state;
  const manages = c.can('jobs.manage');
  const close = () => state.select('');
  return (
    <OverlayDialog
      label={job ? job.name : 'Add job'}
      onClose={close}
      panelClassName="admin-dialog"
      showCloseButton
      page={!!job}
    >
      <div className="dialog-heading">
        <h2>{job ? (manages ? 'Edit job' : job.name) : 'Add a job'}</h2>
        {job && <p>{job.number}</p>}
      </div>
      {manages && (
        <CommandForm
          label={job ? 'Save job' : 'Add job'}
          onCancel={close}
          onDone={close}
          submit={(form) => {
            const fields = { number: text(form, 'number'), name: text(form, 'name') };
            return job
              ? api.POST('/api/companies/{company_id}/jobs/{job_id}/update', {
                  params: { path: { ...c.path, job_id: job.id } },
                  body: { ...fields, expected_revision: job.revision, archived: Boolean(job.archived_at) },
                })
              : api.POST('/api/companies/{company_id}/jobs', { params: { path: c.path }, body: fields });
          }}
        >
          <Field label="Job number" name="number" defaultValue={job?.number} required maxLength={50} />
          <Field
            label="Job name"
            name="name"
            defaultValue={job?.name}
            required
            maxLength={200}
            placeholder="e.g. Riverside lighting"
          />
        </CommandForm>
      )}
      {job && <JobParticipation state={state} participation={participation} job={job} />}
      {job && participation.direct.error && (
        <p className="form-error" role="alert">
          {errorMessage(participation.direct.error)}
        </p>
      )}
      {job && <JobPeople state={state} job={job} onClose={close} />}
      {job && manages && (
        <div className="admin-danger-zone">
          <span className="eyebrow">Job status</span>
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
      )}
    </OverlayDialog>
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
        <span className="eyebrow">Jobs</span>
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
