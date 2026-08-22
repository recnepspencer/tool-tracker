import { useState } from 'react';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { TextAreaField } from '../../components/ui/TextField';

export function ToolDecommissionDialog({
  item,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  item: WarehouseInventoryItemView;
  busy: boolean;
  error?: string;
  onClose(): void;
  onConfirm(note?: string): void;
}) {
  const [note, setNote] = useState('');
  return (
    <OverlayDialog
      label={`Decommission ${item.toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Lifecycle decision</span>
        <h2>Decommission tool</h2>
        <p>This archives the unit while keeping its custody and audit history. Return it to a warehouse first.</p>
      </div>
      <TextAreaField label="Reason or evidence note" value={note} onChange={setNote} rows={3} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => onConfirm(note.trim() || undefined)}>
          Decommission
        </Button>
      </div>
    </OverlayDialog>
  );
}
