import type { Model } from './client';
import { Button, OverlayDialog, TextAreaField } from './kit';
import { useQueueDecision, useQueuePermissions } from './operations-state';
import type { QueueEntry } from './queue-groups';

const requestOutcomes: Record<Model<'RequestView'>['status'], string> = {
  pending: '',
  approved: 'Released, waiting for pickup',
  rejected: 'Declined',
  withdrawn: 'Withdrawn',
  fulfilled: 'Picked up',
};

/** A tool request with its note, and the release, decline and withdraw options the viewer has. */
export function RequestReviewDialog({
  request,
  entry,
  toolName,
  onClose,
}: {
  request: Model<'RequestView'>;
  entry: QueueEntry | undefined;
  toolName: string;
  onClose(): void;
}) {
  const decision = useQueueDecision();
  const allowed = useQueuePermissions().request(request);
  const open = request.status === 'pending' || request.status === 'approved';
  const decide = (action: 'approve' | 'reject' | 'withdraw') => void decision.decideRequest(request, action, onClose);
  const status = entry?.status || requestOutcomes[request.status];
  return (
    <OverlayDialog
      label={`Review ${toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading queue-dialog-heading">
        <h2>{toolName}</h2>
        <p>{entry?.title ?? `${request.requester_name} asked for the ${toolName}`}</p>
        {status && <p className="queue-dialog-status">{status}</p>}
        {request.note && <p className="queue-row__note">“{request.note}”</p>}
        {request.decision_note && <p className="queue-row__note">“{request.decision_note}”</p>}
      </div>
      {!request.requester_eligible && open && (
        <p className="queue-dialog-warning">
          {request.requester_name} can no longer take tools. You can still decline the request.
        </p>
      )}
      {(allowed.approve || allowed.reject || allowed.withdraw) && (
        <TextAreaField
          label="Note"
          value={decision.note}
          onChange={decision.setNote}
          placeholder="Optional"
          maxLength={2000}
        />
      )}
      {decision.error && (
        <p className="form-error" role="alert">
          <span>That didn't go through. Your note is still here; try again.</span> <span>{decision.error}</span>
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        {allowed.withdraw && (
          <Button variant="ghost" disabled={decision.busy} onClick={() => decide('withdraw')}>
            Withdraw request
          </Button>
        )}
        {allowed.reject && (
          <Button variant="secondary" disabled={decision.busy} onClick={() => decide('reject')}>
            Decline
          </Button>
        )}
        {allowed.approve && (
          <Button disabled={decision.busy} onClick={() => decide('approve')}>
            {decision.busy ? 'Saving…' : 'Release'}
          </Button>
        )}
      </div>
    </OverlayDialog>
  );
}
