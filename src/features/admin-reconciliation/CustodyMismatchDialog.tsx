import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { TextAreaField } from '../../components/ui/TextField';
import type { ReconciliationIssueView } from '../../domain/reconciliation';
import type { ReconciliationController } from './use-reconciliation-controller';

export function CustodyMismatchDialog({
  issue,
  controller,
}: {
  issue: Extract<ReconciliationIssueView, { kind: 'custody-mismatch' }>;
  controller: ReconciliationController;
}) {
  return (
    <OverlayDialog
      label="Review reconciliation issue"
      onClose={controller.close}
      panelClassName="admin-dialog reconciliation-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Custody mismatch</span>
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
      <div className="reconciliation-choice">
        <Button
          variant={controller.decision === 'accept-observed' ? 'secondary' : 'ghost'}
          onClick={() => controller.setDecision('accept-observed')}
        >
          Accept observed custody
        </Button>
        <Button
          variant={controller.decision === 'keep-recorded' ? 'secondary' : 'ghost'}
          onClick={() => controller.setDecision('keep-recorded')}
        >
          Keep recorded custody
        </Button>
      </div>
      <div className="dialog-actions">
        <Button variant="ghost" onClick={controller.close} disabled={controller.busy}>
          Cancel
        </Button>
        <Button onClick={() => controller.resolveMismatch(issue)} disabled={controller.busy}>
          Resolve mismatch
        </Button>
      </div>
    </OverlayDialog>
  );
}
