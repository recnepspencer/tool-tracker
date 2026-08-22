import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { TextAreaField } from '../../components/ui/TextField';
import type { ReconciliationIssueView } from '../../domain/reconciliation';
import type { ReconciliationController } from './use-reconciliation-controller';
import { RadioInput } from '../../components/ui/TextField';

export function MergeRecordsDialog({
  issue,
  controller,
}: {
  issue: Extract<ReconciliationIssueView, { kind: 'duplicate-tool-record' }>;
  controller: ReconciliationController;
}) {
  const [survivorToolUnitId, setSurvivorToolUnitId] = useState(issue.candidateToolUnitIds[0]);
  return (
    <OverlayDialog
      label="Review reconciliation issue"
      onClose={controller.close}
      panelClassName="admin-dialog reconciliation-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Duplicate record</span>
        <h2>Choose the record to keep</h2>
        <p>The other record will be archived. Review both before merging.</p>
      </div>
      <div className="reconciliation-survivor-choice" role="radiogroup" aria-label="Record to keep">
        {issue.candidateToolUnitIds.map((unitId, index) => (
          <label key={unitId} className={survivorToolUnitId === unitId ? 'is-selected' : undefined}>
            <RadioInput
              name="survivor-record"
              value={unitId}
              checked={survivorToolUnitId === unitId}
              onChange={() => setSurvivorToolUnitId(unitId)}
            />
            <span>
              <strong>{issue.candidateNames[index]}</strong>
              <small>
                {unitId} · revision {issue.candidateRevisions[index]}
              </small>
              <small>{survivorToolUnitId === unitId ? 'Keep this record' : 'Archive this record'}</small>
            </span>
          </label>
        ))}
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
        <Button onClick={() => controller.merge(issue, survivorToolUnitId)} disabled={controller.busy}>
          Keep selected record
        </Button>
      </div>
    </OverlayDialog>
  );
}
