import { Check } from 'lucide-react';
import { errorMessage, type Model } from './client';
import { useMyJobs, type JobsState, type ParticipationState } from './jobs-state';
import { Button, ErrorState, LoadingState, Switch, TextField } from './kit';

type Job = Model<'JobView'>;
type Rules = Model<'ParticipationPolicyView'>;

/** A sentence for the rules that keep someone from switching a job themselves, or nothing. */
function rulesHint(policy: Rules | undefined) {
  if (!policy) return '';
  const join = policy.self_join_mode === 'disabled';
  const leave = policy.self_leave_mode === 'disabled';
  if (join && leave) return 'A manager assigns jobs. Ask them to add you or take you off one.';
  if (join) return 'A manager adds you to jobs.';
  if (leave) return 'To come off a job, ask a manager.';
  return '';
}

/**
 * Every active job with one control for "I'm on this job". The company's rules decide the control:
 * a switch when people choose directly, "Ask to join" when a manager approves, and a plain tick
 * when only a manager can change it.
 */
export function MyJobsList({ state, participation }: { state: JobsState; participation: ParticipationState }) {
  const { jobs, assignments, requests, policy, search, setSearch } = state;
  const { all, shown } = useMyJobs(state);
  const queries = [jobs, assignments, requests, policy];
  const failed = queries.find((query) => query.isError);
  const hint = rulesHint(policy.data);
  return (
    <div className="my-jobs">
      {all.length > 8 || search ? (
        <TextField
          label="Search jobs"
          type="search"
          compact
          value={search}
          onChange={setSearch}
          placeholder="Search jobs"
        />
      ) : null}
      {participation.change.error && (
        <p className="form-error" role="alert">
          {errorMessage(participation.change.error)}
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
        <p className="jobs-muted">No active jobs yet.</p>
      ) : !shown.length ? (
        <p className="jobs-muted">No jobs match your search.</p>
      ) : (
        <ul className="my-jobs__list" aria-label="Jobs">
          {shown.map((job) => (
            <li key={job.id}>
              <JobToggle state={state} participation={participation} job={job} />
            </li>
          ))}
        </ul>
      )}
      {hint && all.length ? <p className="my-jobs__hint">{hint}</p> : null}
    </div>
  );
}

/** One job's "I'm on this job" control, as a full-width row. */
export function JobToggle({
  state,
  participation,
  job,
}: {
  state: Pick<JobsState, 'participationFor'>;
  participation: ParticipationState;
  job: Job;
}) {
  const { own, pending, mode, open, ready } = state.participationFor(job);
  if (!ready || (!open && !own && !pending)) return null;
  const busy = participation.busyJob === job.id;
  // One change at a time: every row waits while a change and the refresh after it are on their way.
  const settling = participation.change.isPending;
  const change = () => participation.change.mutate({ job, own, pending });
  if (pending)
    return (
      <div className="my-job">
        <span className="my-job__copy">
          <strong>{job.name}</strong>
          <span>{pending.intent === 'join' ? 'Asked to join' : 'Asked to leave'} · waiting for a manager</span>
        </span>
        <span className="my-job__requested">Requested</span>
        <Button
          variant="ghost"
          className="my-job__action"
          disabled={settling}
          aria-label={`Cancel your request for ${job.name}`}
          onClick={change}
        >
          {busy ? 'Cancelling…' : 'Cancel'}
        </Button>
      </div>
    );
  if (mode === 'direct')
    return (
      <Switch
        label={job.name}
        // The switch moves as soon as it is tapped; the list catches up when the server answers.
        checked={busy ? !own : !!own}
        disabled={settling}
        onCheckedChange={change}
      />
    );
  if (mode === 'approval_required')
    return (
      <div className="my-job">
        <span className="my-job__copy">
          <strong>{job.name}</strong>
          {own ? <span>You’re on this job</span> : null}
        </span>
        <Button
          variant="secondary"
          className="my-job__action"
          disabled={settling}
          aria-label={`${own ? 'Ask to leave' : 'Ask to join'} ${job.name}`}
          onClick={change}
        >
          {busy ? 'Sending…' : own ? 'Ask to leave' : 'Ask to join'}
        </Button>
      </div>
    );
  return (
    <div className="my-job my-job--fixed" aria-label={`${job.name}${own ? ', you’re on this job' : ''}`} role="group">
      <span className="my-job__copy">
        <strong>{job.name}</strong>
      </span>
      {own ? (
        <span className="my-job__on">
          <Check aria-hidden="true" />
          On this job
        </span>
      ) : null}
    </div>
  );
}
