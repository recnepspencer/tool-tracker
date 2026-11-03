import { errorMessage, type Model } from './client';
import type { JobsState, ParticipationState } from './jobs-state';
import { Button, OverlayDialog, Switch, TextAreaField } from './kit';

type Props = {
  state: Pick<JobsState, 'participationFor' | 'assignments' | 'requests'>;
  participation: ParticipationState;
  job: Model<'JobView'>;
  compact?: boolean;
};

/**
 * Demo `MyJobsPage` switch. Direct mode toggles at once; approval mode and a
 * pending request open the note dialog; disabled mode tells the person who to ask.
 */
export function JobParticipation({ state, participation, job, compact = false }: Props) {
  const { own, pending, mode, open, ready } = state.participationFor(job);
  if (!ready || (!open && !own)) return null;
  const busy =
    participation.direct.isPending ||
    participation.request.isPending ||
    state.assignments.isFetching ||
    state.requests.isFetching;
  const description = pending
    ? 'Request pending'
    : mode === 'disabled'
      ? `Ask a manager to ${own ? 'remove' : 'add'} you`
      : own
        ? 'On this job'
        : 'Not on this job';
  return (
    <Switch
      label={job.name}
      description={compact ? undefined : description}
      compact={compact}
      checked={pending ? pending.intent === 'join' : !!own}
      disabled={busy || (mode === 'disabled' && !pending) || (!open && !own)}
      onCheckedChange={() => {
        if (pending || mode === 'approval_required') participation.ask({ job, own, pending });
        else participation.direct.mutate({ job, own });
      }}
    />
  );
}

/** Live-only note dialog for approval-mode participation, in the demo `job-dialog` idiom. */
export function ParticipationDialog({ participation }: { participation: ParticipationState }) {
  const { target, note, setNote, request, close } = participation;
  if (!target) return null;
  const { job, own, pending } = target;
  const title = pending ? 'Withdraw your request?' : `Request to ${own ? 'leave' : 'join'} ${job.name}`;
  return (
    <OverlayDialog label={title} onClose={close} showCloseButton panelClassName="admin-dialog job-dialog">
      <h2>{title}</h2>
      <p className="jobs-muted">
        {pending
          ? `Your request to ${pending.intent} ${job.name} is waiting for a manager. Withdrawing it closes the request.`
          : `A manager approves ${own ? 'leaving' : 'joining'} this job. Your tools stay with you either way.`}
      </p>
      <form
        className="job-form"
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate(target);
        }}
      >
        <TextAreaField label="Note" hint="Optional" value={note} onChange={setNote} maxLength={2000} />
        {request.error && (
          <p className="form-error" role="alert">
            {errorMessage(request.error)}
          </p>
        )}
        <div className="job-dialog-actions">
          <Button type="button" variant="secondary" disabled={request.isPending} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={request.isPending}>
            {request.isPending ? 'Sending…' : pending ? 'Withdraw request' : 'Send request'}
          </Button>
        </div>
      </form>
    </OverlayDialog>
  );
}
