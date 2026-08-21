import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { TextAreaField } from '../../components/ui/TextField';
import type { ReconciliationIssueView } from '../../domain/reconciliation';
import type { ReconciliationController } from './use-reconciliation-controller';

export function MergeRecordsDialog({
  issue,
  controller,
}: {
  issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>;
  controller: ReconciliationController;
}) {
  return (
    <OverlayDialog label="Review reconciliation issue" onClose={controller.close}>
      <div className="dialog-heading">
        <span className="eyebrow">Duplicate record</span>
        <h2>Record a decision</h2>
      </div>
      <TextAreaField
        label="Evidence note"
        value={controller.note}
        onChange={controller.setNote}
        rows={3}
        placeholder="What evidence supports this decision?"
      />
      {controller.commandError && (
        <p className="form-error" role="alert">
          {controller.commandError}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={controller.close} disabled={controller.busy}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => controller.dismiss(issue)} disabled={controller.busy}>
          Dismiss
        </Button>
        <Button onClick={() => controller.merge(issue)} disabled={controller.busy}>
          Merge records
        </Button>
      </div>
    </OverlayDialog>
  );
}
