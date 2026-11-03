import type { Model } from './client';
import { Button, Callout, OverlayDialog, TextAreaField } from './kit';
import { useQueueDecision, useQueuePermissions, type QueueItem } from './operations-state';

/** Demo WarehouseQueueReviewDialog for a tool request, with the live withdraw option. */
export function RequestReviewDialog({
  request,
  item,
  onClose,
}: {
  request: Model<'RequestView'>;
  item: QueueItem | undefined;
  onClose(): void;
}) {
  const decision = useQueueDecision();
  const allowed = useQueuePermissions().request(request);
  const toolName = item?.toolName ?? 'Tool';
  const open = request.status === 'pending' || request.status === 'approved';
  const decide = (action: 'approve' | 'reject' | 'withdraw') => void decision.decideRequest(request, action, onClose);
  return (
    <OverlayDialog
      label={`Review ${toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">{item?.eyebrow ?? 'Release request'}</span>
        <h2>{toolName}</h2>
        <p>
          {item?.from ?? 'Warehouse'} → {request.requester_name}
        </p>
        {request.note && <p className="queue-item__note">“{request.note}”</p>}
        {request.decision_note && <p className="queue-item__note">“{request.decision_note}”</p>}
      </div>
      {!request.requester_eligible && open && (
        <Callout
          tone="amber"
          eyebrow="Requester access"
          title="This person no longer has equipment access"
          description="An authorized manager can decline the request."
        />
      )}
      {(allowed.approve || allowed.reject || allowed.withdraw) && (
        <TextAreaField
          label="Decision note"
          value={decision.note}
          onChange={decision.setNote}
          placeholder="Optional context for the audit trail"
          maxLength={2000}
        />
      )}
      {decision.error && (
        <p className="form-error" role="alert">
          <span>The queue decision failed. Your note is still here; try again.</span> <span>{decision.error}</span>
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
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
            {decision.busy ? 'Saving…' : 'Release to worker'}
          </Button>
        )}
      </div>
    </OverlayDialog>
  );
}
