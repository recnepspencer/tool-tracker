import { errorMessage, type Model } from './client';
import { useJobMembershipSwitch, useParticipationCommand, type JobsState } from './jobs-state';
import { Field, Form, human, Notice } from './ui';

type Props = {
  state: Pick<JobsState, 'c' | 'policy' | 'assignments' | 'requests'>;
  job: Model<'JobView'>;
  own: Model<'AssignmentView'> | undefined;
};

export function JobParticipation({ state, job, own }: Props) {
  const submit = useParticipationCommand(job, own);
  const { c, policy, assignments, requests } = state;
  const mode = own ? policy.data?.self_leave_mode : policy.data?.self_join_mode;
  if (
    !c.can('jobs.participate') ||
    !mode ||
    job.archived_at ||
    (!own && !['active', 'planned'].includes(job.status)) ||
    !assignments.data ||
    !requests.data
  )
    return null;
  if (mode === 'disabled')
    return <p className="job-policy-hint">Ask a manager to {own ? 'remove you from' : 'add you to'} this job.</p>;
  if (mode === 'direct') return <JobMembershipSwitch state={state} job={job} own={own} />;
  return (
    <Form label={`Request to ${own ? 'leave' : 'join'} job`} submit={submit}>
      <details>
        <summary>Add a note</summary>
        <Field label="Participation note" name="reason" maxLength={2000} />
      </details>
    </Form>
  );
}

function JobMembershipSwitch({ state, job, own }: Props) {
  const mutation = useJobMembershipSwitch(job, own);
  const compact = state.c.can('jobs.manage');
  return (
    <div className={`job-membership${compact ? ' job-membership--compact' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-label={job.name}
        aria-checked={!!own}
        aria-busy={mutation.isPending}
        disabled={mutation.isPending || state.assignments.isFetching || state.requests.isFetching}
        onClick={() => mutation.mutate()}
        className="job-membership-switch"
      >
        {!compact && (
          <span className="job-switch-copy">
            <strong>{job.name}</strong>
            <small>{own ? `On this job · ${human(own.responsibility)}` : 'Not on this job'}</small>
          </span>
        )}
        <span className="job-switch-track" aria-hidden="true">
          <span />
        </span>
      </button>
      {mutation.error && <Notice error>{errorMessage(mutation.error)}</Notice>}
    </div>
  );
}
