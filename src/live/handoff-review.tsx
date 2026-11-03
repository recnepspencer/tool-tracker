import type { Model } from './client';
import { Button, OverlayDialog, TextAreaField } from './kit';
import { useQueueDecision, useQueuePermissions, type QueueItem } from './operations-state';

/**
 * Demo WarehouseQueueReviewDialog for a handoff. Accept and decline belong to
 * the receiver; the proposer may cancel; a responsible manager may void with a
 * recorded reason.
 */
export function HandoffReviewDialog({
  handoff,
  asset,
  item,
  onClose,
}: {
  handoff: Model<'HandoffView'>;
  asset: Model<'AssetView'> | undefined;
  item: QueueItem | undefined;
  onClose(): void;
}) {
  const decision = useQueueDecision();
  const { receiving, cancelling, voidAllowed } = useQueuePermissions().handoff(handoff, asset);
  const toolName = item?.toolName ?? asset?.name ?? 'Tool';
  const isReturn = item?.kind === 'return';
  const decide = (action: 'accept' | 'decline' | 'cancel' | 'void') => {
    if (action === 'void' && !decision.note.trim()) {
      decision.setError('Add a decision note explaining why this handoff is being voided.');
      return;
    }
    void decision.decideHandoff(handoff, action, onClose);
  };
  return (
    <OverlayDialog
      label={`Review ${toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">{item?.eyebrow ?? (isReturn ? 'Accept return' : 'Review handoff')}</span>
        <h2>{toolName}</h2>
        <p>
          {item?.from ?? handoff.proposed_by_name} → {handoff.destination_name}
        </p>
        {handoff.note && <p className="queue-item__note">“{handoff.note}”</p>}
        {handoff.resolution_note && <p className="queue-item__note">“{handoff.resolution_note}”</p>}
      </div>
      {(receiving || cancelling || voidAllowed) && (
        <TextAreaField
          label="Decision note"
          hint={voidAllowed ? 'Required to void' : undefined}
          value={decision.note}
          onChange={decision.setNote}
          placeholder="Optional context for the audit trail"
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
          Cancel
        </Button>
        {cancelling && (
          <Button variant="ghost" disabled={decision.busy} onClick={() => decide('cancel')}>
            Cancel my handoff
          </Button>
        )}
        {voidAllowed && (
          <Button variant="danger" disabled={decision.busy} onClick={() => decide('void')}>
            Void handoff
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
