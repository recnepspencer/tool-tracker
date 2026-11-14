import type { Model } from './client';
import { Button, OverlayDialog, TextAreaField } from './kit';
import { useQueueDecision, useQueuePermissions } from './operations-state';
import type { QueueEntry } from './queue-groups';

const handoffOutcomes: Record<Model<'HandoffView'>['status'], string> = {
  pending: '',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/**
 * A return, pickup or transfer with its note. Accept and decline belong to the receiver; the
 * sender may cancel; a manager answering for the tool may stop it with a reason. A pickup's
 * requester may also withdraw the request it fulfils.
 */
export function HandoffReviewDialog({
  handoff,
  asset,
  entry,
  pickupRequest,
  toolName,
  onClose,
}: {
  handoff: Model<'HandoffView'>;
  asset: Model<'AssetView'> | undefined;
  entry: QueueEntry | undefined;
  pickupRequest: Model<'RequestView'> | undefined;
  toolName: string;
  onClose(): void;
}) {
  const decision = useQueueDecision();
  const permissions = useQueuePermissions();
  const { receiving, cancelling, voidAllowed } = permissions.handoff(handoff, asset);
  const withdraw = !!pickupRequest && permissions.request(pickupRequest).withdraw;
  const isReturn = !!handoff.destination_warehouse_id;
  const noun = handoff.tool_request_id ? 'pickup' : isReturn ? 'return' : 'transfer';
  const decide = (action: 'accept' | 'decline' | 'cancel' | 'void') => {
    if (action === 'void' && !decision.note.trim()) {
      decision.setError(`Add a note saying why you're stopping this ${noun}.`);
      return;
    }
    void decision.decideHandoff(handoff, action, onClose);
  };
  const status = entry?.status || handoffOutcomes[handoff.status];
  return (
    <OverlayDialog
      label={`Review ${toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading queue-dialog-heading">
        <h2>{toolName}</h2>
        <p>{entry?.title ?? `${handoff.proposed_by_name} sent the ${toolName} to ${handoff.destination_name}`}</p>
        {status && <p className="queue-dialog-status">{status}</p>}
        {handoff.note && <p className="queue-row__note">“{handoff.note}”</p>}
        {handoff.resolution_note && <p className="queue-row__note">“{handoff.resolution_note}”</p>}
      </div>
      {(receiving || cancelling || voidAllowed || withdraw) && (
        <TextAreaField
          label="Note"
          hint={voidAllowed && !receiving && !cancelling ? 'Required to stop it' : undefined}
          value={decision.note}
          onChange={decision.setNote}
          placeholder="Optional"
          maxLength={2000}
        />
      )}
      {decision.error && (
        <p className="form-error" role="alert">
          {decision.error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        {withdraw && pickupRequest && (
          <Button
            variant="ghost"
            disabled={decision.busy}
            onClick={() => void decision.decideRequest(pickupRequest, 'withdraw', onClose)}
          >
            Withdraw request
          </Button>
        )}
        {cancelling && (
          <Button variant="ghost" disabled={decision.busy} onClick={() => decide('cancel')}>
            Cancel {noun}
          </Button>
        )}
        {voidAllowed && !cancelling && !receiving && (
          <Button variant="danger" disabled={decision.busy} onClick={() => decide('void')}>
            Stop {noun}
          </Button>
        )}
        {receiving && (
          <>
            <Button variant="secondary" disabled={decision.busy} onClick={() => decide('decline')}>
              Decline
            </Button>
            <Button disabled={decision.busy} onClick={() => decide('accept')}>
              {decision.busy ? 'Saving…' : isReturn ? 'Accept return' : 'Accept'}
            </Button>
          </>
        )}
      </div>
    </OverlayDialog>
  );
}
