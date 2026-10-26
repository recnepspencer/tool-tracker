import { api, errorMessage, type Model } from './client';
import { RecordSheet } from './experience/RecordSheet';
import type { JobsState } from './jobs-state';
import { date, Empty, Field, Form, human, Loading, Notice, Section, Select, text } from './ui';

export function JobRoster({
  state,
  job,
  onClose,
}: {
  state: Pick<JobsState, 'c' | 'roster' | 'history' | 'setHistory' | 'people'>;
  job: Model<'JobView'>;
  onClose: () => void;
}) {
  const { c, roster, history, setHistory, people } = state;
  const assignable = !job.archived_at && ['planned', 'active'].includes(job.status);
  return (
    <RecordSheet title="Job details" onClose={onClose}>
      <h1>{job.name}</h1>
      <p className="muted">
        {job.number} · {job.project_name}
      </p>
      <Section title="People on this job">
        <label className="check">
          <input type="checkbox" checked={history} onChange={(event) => setHistory(event.target.checked)} />
          Assignment history
        </label>
        {roster.isPending && <Loading />}
        {roster.error && <Notice error>{errorMessage(roster.error)}</Notice>}
        {roster.data?.map((assignment) => (
          <article
            className="job-assignment"
            key={assignment.id}
            aria-label={`${assignment.member_name} ${assignment.responsibility}`}
          >
            <strong>{assignment.member_name}</strong>
            <p>
              {human(assignment.responsibility)} · {date(assignment.starts_at)} → {date(assignment.ends_at)}
            </p>
            <small>Assigned by {assignment.assigned_by_name}</small>
            {assignment.ends_at && (
              <>
                <p>{assignment.end_reason}</p>
                <small>
                  {assignment.ended_by_name ? `Ended by ${assignment.ended_by_name}` : 'End actor not recorded'}
                </small>
              </>
            )}
            {c.can('jobs.assign') && !assignment.ends_at && (
              <details>
                <summary>End assignment</summary>
                <Form
                  label="End assignment"
                  submit={(form) =>
                    api.POST('/api/companies/{company_id}/assignments/{assignment_id}/end', {
                      params: { path: { ...c.path, assignment_id: assignment.id } },
                      body: { expected_revision: job.revision, note: text(form, 'note') },
                    })
                  }
                >
                  <Field label="Reason" name="note" required maxLength={2000} />
                </Form>
              </details>
            )}
          </article>
        ))}
        {roster.data?.length === 0 && <Empty>{history ? 'No assignment history.' : 'No current assignments.'}</Empty>}
      </Section>
      {c.can('jobs.assign') && assignable && (
        <Section title="Assign a person">
          <p className="muted">Changing responsibility closes the previous assignment and preserves its history.</p>
          {people.error && <Notice error>{errorMessage(people.error)}</Notice>}
          <Form
            label="Save assignment"
            disabled={!people.data || !!people.error}
            submit={(form) =>
              api.POST('/api/companies/{company_id}/jobs/{job_id}/assignments', {
                params: { path: { ...c.path, job_id: job.id } },
                body: {
                  expected_revision: job.revision,
                  membership_id: text(form, 'member'),
                  responsibility: text(form, 'responsibility') as 'crew' | 'foreman' | 'supervisor',
                  reason: text(form, 'reason'),
                },
              })
            }
          >
            <Select label="Person" name="member">
              <option value="">Choose a person</option>
              {people.data?.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.preferred_name}
                </option>
              ))}
            </Select>
            <Select label="Responsibility" name="responsibility">
              <option value="crew">Crew</option>
              <option value="foreman">Foreman</option>
              <option value="supervisor">Supervisor</option>
            </Select>
            <Field label="Reason" name="reason" required maxLength={2000} />
          </Form>
        </Section>
      )}
      {!assignable && <Notice>This job is closed or archived. Its assignment history remains available.</Notice>}
    </RecordSheet>
  );
}
