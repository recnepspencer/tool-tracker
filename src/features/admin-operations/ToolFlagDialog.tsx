import { useState } from 'react';
import type { FlagToolInput } from '../../api/contracts/tools-api';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextField';

type FlagInput = Omit<FlagToolInput, 'actorId' | 'toolUnitId' | 'expectedRevision' | 'expectedHolder'>;

export function ToolFlagDialog({
  item,
  initialCondition,
  busy,
  error,
  onClose,
  onSave,
}: {
  item: WarehouseInventoryItemView;
  initialCondition: 'damaged' | 'lost';
  busy: boolean;
  error?: string;
  onClose(): void;
  onSave(input: FlagInput): void;
}) {
  const [condition, setCondition] = useState<'damaged' | 'lost'>(initialCondition);
  const [note, setNote] = useState('');
  const actionLabel = condition === 'lost' ? 'Mark lost' : 'Mark damaged';
  return (
    <OverlayDialog
      label={`${actionLabel}: ${item.toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Inventory decision</span>
        <h2>{actionLabel}</h2>
        <p>
          {condition === 'lost'
            ? 'Record that this tool cannot be located without removing its custody history.'
            : 'Record the damage against the same tool-unit history used by worker reports.'}
        </p>
      </div>
      <div className="operations-form">
        <SelectField
          label="Condition"
          value={condition}
          onChange={(value) => setCondition(value as 'damaged' | 'lost')}
          options={[
            { value: 'damaged', label: 'Damaged' },
            { value: 'lost', label: 'Lost' },
          ]}
        />
        <TextAreaField label="Evidence note" value={note} onChange={setNote} rows={3} />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => onSave({ condition, ...(note.trim() ? { evidence: { note } } : {}) })}
        >
          {actionLabel}
        </Button>
      </div>
    </OverlayDialog>
  );
}
