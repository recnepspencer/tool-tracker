import { ChevronRight } from 'lucide-react';
import { errorMessage, type Model } from './client';
import { formatStamp, initials } from './format';
import { requestStatusLabel } from './jobs-labels';
import type { JobsState, RequestReviewState } from './jobs-state';
import { Avatar, Button, ErrorState, LoadingState, OverlayDialog, Section, SurfaceCard, TextAreaField } from './kit';

type Request = Model<'ParticipationView'>;

/** Decided requests stay one tap away, with the page's other links under its heading. */
export function RequestHistoryLink({ state }: { state: Pick<JobsState, 'completed' | 'setCompleted'> }) {
  const { completed, setCompleted } = state;
  return (
    <div className="related-links">
      <button type="button" className="related-link" onClick={() => setCompleted(!completed)}>
        {completed ? 'Hide request history' : 'Request history'}
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Requests to join or leave a job, as their own section above the jobs. The section appears only
 * while someone is waiting or the history is open.
 */
export function JobRequests({
  state,
  review,
}: {
  state: Pick<JobsState, 'c' | 'requests' | 'completed'>;
  review: RequestReviewState;
}) {
  const { c, requests, completed } = state;
  const busy = review.decide.isPending;
  const waiting = !completed && requests.data?.length;
  const shown = completed || waiting || requests.isError || review.decide.isError;
  return (
    <>
      {shown ? (
        <Section title="Participation requests">
          {review.decide.isError && !review.review && (
            <p className="form-error" role="alert">
              {errorMessage(review.decide.error)}
            </p>
          )}
          <SurfaceCard className="queue-card">
            {requests.isPending ? (
              <LoadingState label="Loading participation requests…" />
            ) : requests.isError ? (
              <ErrorState
                message={`Participation requests could not be loaded. ${errorMessage(requests.error)}`}
                onRetry={() => void requests.refetch()}
              />
            ) : (
              <section className="operations-queue-group">
                <div className="operations-queue-group__heading">
                  <h3>{completed ? 'Request history' : 'Waiting for a decision'}</h3>
                  <span>{requests.data.length}</span>
                </div>
                {requests.data.length ? (
                  <div className="queue-list">
                    {requests.data.map((request) => (
                      <RequestItem key={request.id} request={request} c={c} busy={busy} review={review} />
                    ))}
                  </div>
                ) : (
                  <p className="admin-empty">
                    {completed ? 'No decided requests yet.' : 'No one is waiting on a decision.'}
                  </p>
                )}
              </section>
            )}
          </SurfaceCard>
        </Section>
      ) : null}
      {review.review && <RequestReviewDialog review={review} />}
    </>
  );
}

function RequestItem({
  request,
  c,
  busy,
  review,
}: {
  request: Request;
  c: JobsState['c'];
  busy: boolean;
  review: RequestReviewState;
}) {
  const pending = request.status === 'pending';
  const decides = pending && c.can('jobs.assign');
  const withdraws = pending && c.can('jobs.participate') && request.membership_id === c.membership_id;
  const verb = request.intent === 'join' ? 'join' : 'leave';
  const body = (
    <>
      <Avatar tone="neutral" size="small" initials={initials(request.member_name)} />
      <span className="queue-item__body">
        <span className="queue-item__heading">
          <span>
            <span className="eyebrow">
              Request to {verb}
              {pending ? '' : ` · ${requestStatusLabel[request.status]}`}
            </span>
            <strong className="queue-item__name">{request.job_name}</strong>
          </span>
          <time className="queue-item__time" dateTime={request.requested_at}>
            {formatStamp(request.requested_at)}
          </time>
        </span>
        <span className="queue-item__person">
          <strong>{request.member_name}</strong> · {request.job_number}
        </span>
        {request.reason && <span className="queue-item__note">“{request.reason}”</span>}
        {request.decided_by_name && (
          <span className="queue-item__route">
            {requestStatusLabel[request.status]} by {request.decided_by_name}
            {request.decided_at ? ` · ${formatStamp(request.decided_at)}` : ''}
            {request.decision_note ? ` · “${request.decision_note}”` : ''}
          </span>
        )}
        {pending && request.approval_blocked_reason && (
          <span className="queue-item__route">
            {request.approval_blocked_reason} Reject or withdraw this request to close it.
          </span>
        )}
      </span>
    </>
  );
  return (
    <article className="queue-item" aria-label={`${request.member_name} ${request.intent} ${request.job_name}`}>
      {decides ? (
        <button
          type="button"
          className="queue-item__open"
          disabled={busy}
          onClick={() => review.open(request)}
          aria-label={`Review ${request.member_name}’s request to ${verb} ${request.job_name}`}
        >
          {body}
          <span className="queue-item__review">
            <span className="queue-item__review-label">Review</span>
            <ChevronRight aria-hidden="true" />
          </span>
        </button>
      ) : (
        <div className="queue-item__open">{body}</div>
      )}
      {(decides || withdraws) && (
        <div className="queue-item__decisions">
          {withdraws && (
            <Button variant="ghost" disabled={busy} onClick={() => review.resolve(request, 'withdraw')}>
              Withdraw
            </Button>
          )}
          {decides && (
            <>
              <Button
                variant="secondary"
                disabled={busy}
                aria-label={`Reject ${request.member_name}’s request`}
                onClick={() => review.resolve(request, 'reject')}
              >
                Reject
              </Button>
              {!request.approval_blocked_reason && (
                <Button
                  disabled={busy}
                  aria-label={`Approve ${request.member_name}’s request`}
                  onClick={() => review.resolve(request, 'approve')}
                >
                  Approve
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Demo `WarehouseQueueReviewDialog`, for a participation request. */
function RequestReviewDialog({ review }: { review: RequestReviewState }) {
  const { review: request, note, setNote, decide, resolve, close } = review;
  if (!request) return null;
  const verb = request.intent === 'join' ? 'join' : 'leave';
  return (
    <OverlayDialog
      label={`Review ${request.member_name}’s request`}
      onClose={close}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Request to {verb}</span>
        <h2>{request.job_name}</h2>
        <p>
          {request.member_name} · {request.job_number}
        </p>
      </div>
      {request.reason && <p className="jobs-muted">“{request.reason}”</p>}
      <TextAreaField
        label="Decision note"
        value={note}
        onChange={setNote}
        maxLength={2000}
        placeholder="Optional context for the audit trail"
      />
      {decide.isError && (
        <p className="form-error" role="alert">
          <span>The decision failed. Your note is still here; try again.</span>{' '}
          <span>{errorMessage(decide.error)}</span>
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button variant="secondary" disabled={decide.isPending} onClick={() => resolve(request, 'reject', note)}>
          Reject
        </Button>
        {!request.approval_blocked_reason && (
          <Button disabled={decide.isPending} onClick={() => resolve(request, 'approve', note)}>
            {decide.isPending ? 'Saving…' : 'Approve'}
          </Button>
        )}
      </div>
    </OverlayDialog>
  );
}
