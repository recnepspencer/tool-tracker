import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { errorMessage, type Model } from './client';
import { formatDate, formatRange, initials } from './format';
import { useStaffing, type JobsState } from './jobs-state';
import { Avatar, Button, ErrorState, LoadingState, OverlayDialog, TextField } from './kit';

type Job = Model<'JobView'>;
type Assignment = Model<'AssignmentView'>;

/** Who is on the job now, with the way to change that, and who used to be on it one tap away. */
export function JobPeople({
  state,
  job,
  onLeave,
}: {
  state: Pick<JobsState, 'c' | 'assignments' | 'currentFor' | 'history' | 'setHistory' | 'past' | 'setStaffing'>;
  job: Job;
  onLeave: () => void;
}) {
  const { c, assignments, history, setHistory, past } = state;
  const current = state.currentFor(job.id);
  const staffs = c.can('jobs.assign') && !job.archived_at;
  const name = (assignment: Assignment) =>
    c.can('people.manage') ? (
      <Link to={`/app/people?person=${assignment.membership_id}`} onClick={onLeave}>
        {assignment.member_name}
      </Link>
    ) : (
      assignment.member_name
    );
  return (
    <>
      {staffs ? (
        <Button variant="secondary" fullWidth onClick={() => state.setStaffing(true)}>
          Edit people
        </Button>
      ) : null}
      {assignments.isPending ? (
        <LoadingState label="Loading people…" />
      ) : assignments.isError ? (
        <ErrorState
          message={`People on this job could not be loaded. ${errorMessage(assignments.error)}`}
          onRetry={() => void assignments.refetch()}
        />
      ) : current.length ? (
        <ul className="job-list" aria-label="Who’s on this job">
          {current.map((assignment) => (
            <li className="job-list__row" key={assignment.id}>
              <Avatar tone="neutral" size="small" initials={initials(assignment.member_name)} />
              <span className="job-list__copy">
                <strong>{name(assignment)}</strong>
                <span>Since {formatDate(assignment.starts_at)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="jobs-muted">
          {job.archived_at ? 'This job is archived, so no one is on it.' : 'No one is on this job yet.'}
        </p>
      )}
      <button type="button" className="archived-toggle" onClick={() => setHistory(!history)}>
        {history ? 'Hide past people' : 'Show past people'}
      </button>
      {history ? (
        past.isPending ? (
          <LoadingState label="Loading past people…" />
        ) : past.isError ? (
          <ErrorState
            message={`Past people could not be loaded. ${errorMessage(past.error)}`}
            onRetry={() => void past.refetch()}
          />
        ) : past.data.length ? (
          <ul className="job-list" aria-label="Past people">
            {past.data.map((assignment) => (
              <li className="job-list__row" key={assignment.id}>
                <Avatar tone="neutral" size="small" initials={initials(assignment.member_name)} />
                <span className="job-list__copy">
                  <strong>{name(assignment)}</strong>
                  <span>{formatRange(assignment.starts_at, assignment.ends_at)}</span>
                  <span>
                    {assignment.ended_by_name ? `Taken off by ${assignment.ended_by_name}` : 'Taken off'}
                    {assignment.end_reason ? ` · “${assignment.end_reason}”` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="jobs-muted">No one has come off this job yet.</p>
        )
      ) : null}
    </>
  );
}

/**
 * Everyone in the company as one checklist, ticked for whoever is on the job now.
 * One Save puts the ticked people on and takes the unticked ones off.
 */
export function StaffingDialog({ state, job }: { state: JobsState; job: Job }) {
  const { chosen, search, setSearch, added, removed, changed, toggle, save } = useStaffing(
    job,
    state.currentFor(job.id),
    () => state.setStaffing(false),
  );
  const close = () => {
    if (!save.isPending) state.setStaffing(false);
  };
  const needle = search.trim().toLowerCase();
  const people = state.people.data ?? [];
  const shown = people.filter((person) => person.preferred_name.toLowerCase().includes(needle));
  const summary = [added.length ? `${added.length} to add` : '', removed.length ? `${removed.length} to take off` : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <OverlayDialog
      label={`People on ${job.name}`}
      onClose={close}
      panelClassName="admin-dialog staffing-dialog"
      showCloseButton
      page
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (changed) save.mutate();
        }}
      >
        <div className="dialog-heading">
          <h2>People on {job.name}</h2>
        </div>
        <TextField
          label="Search people"
          type="search"
          compact
          value={search}
          onChange={setSearch}
          placeholder="Search people"
        />
        <p className="staffing-summary" role="status">
          {summary || `${chosen.size} ${chosen.size === 1 ? 'person' : 'people'} on this job`}
        </p>
        {state.people.isPending ? (
          <LoadingState label="Loading people…" />
        ) : state.people.isError ? (
          <ErrorState
            message={`People could not be loaded. ${errorMessage(state.people.error)}`}
            onRetry={() => void state.people.refetch()}
          />
        ) : shown.length ? (
          <ul className="staffing-list" aria-label="People">
            {shown.map((person) => (
              <li key={person.id}>
                <label className="staffing-row">
                  <input
                    type="checkbox"
                    className="staffing-row__input"
                    aria-label={person.preferred_name}
                    checked={chosen.has(person.id)}
                    disabled={save.isPending}
                    onChange={() => toggle(person.id)}
                  />
                  <span className="staffing-row__mark" aria-hidden="true">
                    <Check />
                  </span>
                  <Avatar tone="neutral" size="small" initials={initials(person.preferred_name)} />
                  <span className="staffing-row__copy">
                    <strong>{person.preferred_name}</strong>
                    {person.title ? <span>{person.title}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="jobs-muted">{people.length ? 'No one matches this search.' : 'No active people yet.'}</p>
        )}
        {save.error ? (
          <p className="form-error" role="alert">
            {errorMessage(save.error)}
          </p>
        ) : null}
        <div className="dialog-actions">
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={!changed || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </OverlayDialog>
  );
}
