import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { TextAreaField } from '../../components/ui/TextField';
import type { WarehouseQueueItemView } from '../../domain/read-models/warehouse-operations';

const actionLabel = (item: WarehouseQueueItemView) => (item.kind === 'request' ? 'Release to worker' : 'Accept return');

export function WarehouseQueueReviewDialog({
  review,
  note,
  busy,
  decisionError,
  onNoteChange,
  onClose,
  onResolve,
}: {
  review: WarehouseQueueItemView;
  note: string;
  busy: boolean;
  decisionError?: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onResolve: (decision: 'approve' | 'decline') => void;
}) {
  return (
    <OverlayDialog label={`Review ${review.toolName}`} onClose={onClose} panelClassName="operations-dialog">
      <div className="dialog-heading">
        <span className="eyebrow">{review.kind === 'request' ? 'Release request' : 'Accept return'}</span>
        <h2>{review.toolName}</h2>
        <p>
          {review.from.name} → {review.to.name} · {review.warehouseName}
        </p>
      </div>
      <TextAreaField
        label="Decision note"
        value={note}
        onChange={onNoteChange}
        placeholder="Optional context for the audit trail"
      />
      {decisionError && (
        <p className="form-error" role="alert">
          <span>The queue decision failed. Your note is still here; try again.</span> <span>{decisionError}</span>
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onResolve('decline')}>
          Decline
        </Button>
        <Button disabled={busy} onClick={() => onResolve('approve')}>
          {busy ? 'Saving…' : actionLabel(review)}
        </Button>
      </div>
    </OverlayDialog>
  );
}
