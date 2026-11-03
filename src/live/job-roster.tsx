import { Link } from 'react-router-dom';
import { api, errorMessage, type Model } from './client';
import { formatRange } from './format';
import { JobForm } from './job-form';
import { options, responsibilityLabel } from './jobs-labels';
import type { JobsState } from './jobs-state';
import { Button, ErrorState, LoadingState, OverlayDialog, SelectField } from './kit';
import { Field, text } from './ui';

/** Demo job roster `OverlayDialog`, with the live assignment history and assign form. */
export function JobRoster({
  state,
  job,
  onClose,
}: {
  state: Pick<JobsState, 'c' | 'roster' | 'history' | 'setHistory' | 'people' | 'ending' | 'setEnding'>;
  job: Model<'JobView'>;
  onClose: () => void;
}) {
  const { c, roster, history, setHistory, people, ending, setEnding } = state;
  const assignable = !job.archived_at && ['planned', 'active'].includes(job.status);
  const assignHeading = `assign-${job.id}`;
  return (
    <OverlayDialog
      label={`People on ${job.name}`}
      onClose={onClose}
      showCloseButton
      panelClassName="admin-dialog job-dialog"
    >
      <h2>{job.name}</h2>
      <p className="jobs-muted">
        {job.number} · {job.project_name}
      </p>
      <SelectField
        label="Assignments"
        compact
        searchable={false}
        value={history ? 'history' : 'current'}
        onChange={(value) => setHistory(value === 'history')}
        options={[
          { value: 'current', label: 'Current people' },
          { value: 'history', label: 'Assignment history' },
        ]}
      />
      {roster.isPending ? (
        <LoadingState label="Loading people…" />
      ) : roster.isError ? (
        <ErrorState
          message={`People on this job could not be loaded. ${errorMessage(roster.error)}`}
          onRetry={() => void roster.refetch()}
        />
      ) : (
        <div className="job-roster">
          {!roster.data?.length && (
            <p className="jobs-muted">{history ? 'No assignment history.' : 'No one is on this job yet.'}</p>
          )}
          {roster.data?.map((assignment) => (
            <article
              className="job-row"
              key={assignment.id}
              aria-label={`${assignment.member_name} ${assignment.responsibility}`}
            >
              <div className="job-row-copy">
                <strong>
                  {c.can('people.manage') ? (
                    <Link to={`/app/people?person=${assignment.membership_id}`} onClick={onClose}>
                      {assignment.member_name}
                    </Link>
                  ) : (
                    assignment.member_name
                  )}
                </strong>
                <small>
                  {responsibilityLabel[assignment.responsibility]} ·{' '}
                  {formatRange(assignment.starts_at, assignment.ends_at)}
                </small>
                <small>Assigned by {assignment.assigned_by_name}</small>
                {assignment.ends_at && (
                  <small>
                    {assignment.ended_by_name ? `Ended by ${assignment.ended_by_name}` : 'End actor not recorded'}
                    {assignment.end_reason ? ` · “${assignment.end_reason}”` : ''}
                  </small>
                )}
                {ending?.id === assignment.id && (
                  <JobForm
                    label="End assignment"
                    busyLabel="Ending…"
                    onDone={() => setEnding(null)}
                    onCancel={() => setEnding(null)}
                    submit={(form) =>
                      api.POST('/api/companies/{company_id}/assignments/{assignment_id}/end', {
                        params: { path: { ...c.path, assignment_id: assignment.id } },
                        body: { expected_revision: job.revision, note: text(form, 'note') },
                      })
                    }
                  >
                    <Field label="Reason" name="note" required maxLength={2000} />
                  </JobForm>
                )}
              </div>
              {c.can('jobs.assign') && !assignment.ends_at && ending?.id !== assignment.id && (
                <div className="job-row-actions">
                  <Button
                    variant="ghost"
                    aria-label={`End ${assignment.member_name}’s assignment`}
                    onClick={() => setEnding(assignment)}
                  >
                    End
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {c.can('jobs.assign') && assignable && (
        <section aria-labelledby={assignHeading}>
          <h3 id={assignHeading}>Assign a person</h3>
          <p className="jobs-muted">Changing responsibility closes the previous assignment and keeps its history.</p>
          {people.isError && (
            <p className="form-error" role="alert">
              People could not be loaded. {errorMessage(people.error)}
            </p>
          )}
          <JobForm
            label="Assign"
            onDone={(form) => form.reset()}
            disabled={!people.data}
            submit={(form) =>
              api.POST('/api/companies/{company_id}/jobs/{job_id}/assignments', {
                params: { path: { ...c.path, job_id: job.id } },
                body: {
                  expected_revision: job.revision,
                  membership_id: text(form, 'member'),
                  responsibility: text(form, 'responsibility') as Model<'AssignmentView'>['responsibility'],
                  reason: text(form, 'reason'),
                },
              })
            }
          >
            <SelectField
              label="Person"
              name="member"
              required
              placeholder="Choose a person"
              options={(people.data ?? []).map((person) => ({ value: person.id, label: person.preferred_name }))}
            />
            <SelectField
              label="Responsibility"
              name="responsibility"
              searchable={false}
              defaultValue="crew"
              options={options(responsibilityLabel)}
            />
            <Field label="Reason" name="reason" required maxLength={2000} />
          </JobForm>
        </section>
      )}
      {!assignable && (
        <p className="jobs-muted">This job is closed or archived. Its assignment history remains available.</p>
      )}
    </OverlayDialog>
  );
}
