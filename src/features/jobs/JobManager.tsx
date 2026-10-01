import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import type { JobView } from '../../api/contracts/jobs-api';
import { useJobs, useJobMutation, useForemen } from './use-jobs';
import { Link } from 'react-router-dom';
import './jobs.css';

export function JobManager() {
  const query = useJobs();
  const foremen = useForemen();
  const mutation = useJobMutation();
  const [filter, setFilter] = useState('active');
  const [editing, setEditing] = useState<JobView | 'new' | null>(null);
  const [name, setName] = useState('');
  const [archiving, setArchiving] = useState<JobView | null>(null);
  const [roster, setRoster] = useState<JobView | null>(null);
  const blocked = mutation.isPending || query.isFetching || query.isPaused || query.isPending || query.isError;
  const jobs = (query.data ?? []).filter((job) => Boolean(job.archivedAt) === (filter === 'archived'));
  const close = () => {
    if (!mutation.isPending) {
      setEditing(null);
      setArchiving(null);
      mutation.reset();
    }
  };
  const save = async () => {
    if (!editing) return;
    try {
      await mutation.mutateAsync(
        editing === 'new'
          ? { action: 'create', name }
          : { action: 'rename', name, jobId: editing.id, expectedRevision: editing.revision },
      );
      setEditing(null);
    } catch {
      /* The dialog retains the input and displays the mutation error. */
    }
  };
  const error = mutation.error && (
    <p className="form-error" role="alert">
      {mutation.error.message}
    </p>
  );
  return (
    <SurfaceCard className="settings-card jobs-manager">
      <div className="settings-card-heading">
        <h2>Jobs</h2>
        <Button
          onClick={() => {
            mutation.reset();
            setName('');
            setEditing('new');
          }}
          disabled={blocked}
        >
          <Plus aria-hidden="true" /> Add job
        </Button>
      </div>
      <p className="jobs-muted">Foremen choose their own jobs. Archive completed jobs to keep their history.</p>
      <SelectField
        label="Job status"
        value={filter}
        onChange={setFilter}
        searchable={false}
        compact
        options={[
          { value: 'active', label: 'Active jobs' },
          { value: 'archived', label: 'Archived jobs' },
        ]}
      />
      {query.isPending ? (
        <LoadingState label="Loading jobs…" />
      ) : query.isError ? (
        <ErrorState message="Jobs could not be loaded." onRetry={() => void query.refetch()} />
      ) : (
        <div className="jobs-list">
          {!jobs.length && (
            <p className="jobs-muted">
              {filter === 'active' ? 'No active jobs. Add a job to get started.' : 'No archived jobs.'}
            </p>
          )}
          {jobs.map((job) => (
            <div className="job-row" key={job.id}>
              <div className="job-row-copy">
                <strong>{job.name}</strong>
                {job.archivedAt ? (
                  <small>Archived</small>
                ) : (
                  <button
                    className="job-members-link"
                    type="button"
                    onClick={() => setRoster(job)}
                    aria-label={`View foremen on ${job.name}`}
                  >
                    {job.memberCount} {job.memberCount === 1 ? 'foreman' : 'foremen'}
                  </button>
                )}
              </div>
              <div className="job-row-actions">
                <Button
                  variant="ghost"
                  disabled={blocked}
                  onClick={() => {
                    mutation.reset();
                    setName(job.name);
                    setEditing(job);
                  }}
                  aria-label={`Rename ${job.name}`}
                >
                  Rename
                </Button>
                <Button
                  variant="secondary"
                  disabled={blocked}
                  aria-label={`${job.archivedAt ? 'Restore' : 'Archive'} ${job.name}`}
                  onClick={() => {
                    mutation.reset();
                    if (job.archivedAt)
                      mutation.mutate({ action: 'restore', jobId: job.id, expectedRevision: job.revision });
                    else setArchiving(job);
                  }}
                >
                  {job.archivedAt ? 'Restore' : 'Archive'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!editing && !archiving && error}
      {roster && (
        <OverlayDialog
          label={`Foremen on ${roster.name}`}
          onClose={() => setRoster(null)}
          showCloseButton
          panelClassName="admin-dialog job-dialog"
        >
          <h2>{roster.name}</h2>
          <p className="jobs-muted">Current foremen</p>
          {foremen.isPending ? (
            <LoadingState label="Loading foremen…" />
          ) : foremen.isError ? (
            <ErrorState message="Foremen could not be loaded." onRetry={() => void foremen.refetch()} />
          ) : (
            <div className="job-roster">
              {foremen.data
                .filter((foreman) => foreman.jobs.some((job) => job.id === roster.id))
                .map((foreman) => (
                  <Link key={foreman.id} to={`/admin/people/${foreman.id}`} onClick={() => setRoster(null)}>
                    <strong>{foreman.name}</strong>
                    <span>{foreman.tools.length} tools in custody</span>
                  </Link>
                ))}
              {!roster.memberCount && <p className="jobs-muted">No foremen have joined this job yet.</p>}
            </div>
          )}
        </OverlayDialog>
      )}
      {editing && (
        <OverlayDialog
          label={editing === 'new' ? 'Add job' : 'Rename job'}
          onClose={close}
          showCloseButton
          panelClassName="admin-dialog job-dialog"
        >
          <h2>{editing === 'new' ? 'Add job' : 'Rename job'}</h2>
          <form
            className="job-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <TextField
              label="Job name"
              value={name}
              onChange={setName}
              required
              disabled={mutation.isPending}
              placeholder="e.g. Riverside · Lighting"
            />
            {error}
            <div className="job-dialog-actions">
              <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={blocked || !name.trim()}>
                {mutation.isPending ? 'Saving…' : editing === 'new' ? 'Add job' : 'Save'}
              </Button>
            </div>
          </form>
        </OverlayDialog>
      )}
      {archiving && (
        <OverlayDialog label="Archive job" onClose={close} showCloseButton panelClassName="admin-dialog job-dialog">
          <h2>Archive {archiving.name}?</h2>
          <p className="jobs-muted">
            This closes current assignments and removes the job from foremen’s current jobs. Job history is kept.
            Restoring it lets foremen join again.
          </p>
          {error}
          <div className="job-dialog-actions">
            <Button variant="secondary" disabled={mutation.isPending} onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={blocked}
              onClick={() =>
                void mutation
                  .mutateAsync({ action: 'archive', jobId: archiving.id, expectedRevision: archiving.revision })
                  .then(() => setArchiving(null))
                  .catch(() => undefined)
              }
            >
              {mutation.isPending ? 'Archiving…' : 'Archive job'}
            </Button>
          </div>
        </OverlayDialog>
      )}
    </SurfaceCard>
  );
}
