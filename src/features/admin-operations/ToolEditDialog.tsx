import { useState } from 'react';
import type { UpdateToolInput } from '../../api/contracts/tools-api';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { Button } from '../../components/ui/Button';
import { OverlayDialog } from '../../components/ui/OverlayDialog';
import { TextAreaField, TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { useToolCategories } from '../settings/use-tool-categories';

type EditInput = Omit<
  UpdateToolInput,
  'actorId' | 'toolUnitId' | 'expectedRevision' | 'expectedStatus' | 'expectedHolder'
>;

const imageKeyFromSrc = (src: string) => src.split('/').pop() ?? '';

export function ToolEditDialog({
  item,
  busy,
  error,
  onClose,
  onSave,
}: {
  item: WarehouseInventoryItemView;
  busy: boolean;
  error?: string;
  onClose(): void;
  onSave(input: EditInput): void;
}) {
  const categories = useToolCategories();
  const [name, setName] = useState(item.toolName);
  const [brand, setBrand] = useState(item.brand);
  const [model, setModel] = useState(item.model);
  const [categoryId, setCategoryId] = useState(item.categoryId);
  const [serial, setSerial] = useState(item.serial ?? '');
  const [price, setPrice] = useState(item.price ?? '');
  const [note, setNote] = useState('');
  return (
    <OverlayDialog
      label={`Edit ${item.toolName}`}
      onClose={onClose}
      panelClassName="admin-dialog operations-dialog"
      showCloseButton
    >
      <div className="dialog-heading">
        <span className="eyebrow">Inventory decision</span>
        <h2>Edit tool</h2>
        <p>Update the canonical record without changing custody or warehouse responsibility.</p>
      </div>
      <div className="operations-form">
        <TextField label="Name" value={name} onChange={setName} />
        <TextField label="Brand" value={brand} onChange={setBrand} />
        <TextField label="Model" value={model} onChange={setModel} />
        <SelectField
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={(categories.data ?? []).map((option) => ({ value: option.id, label: option.name }))}
          placeholder="Choose a category"
          disabled={categories.isPending || categories.isError}
          required
        />
        <TextField label="Serial" value={serial} onChange={setSerial} />
        <TextField label="Price" value={price} onChange={setPrice} />
        <TextAreaField label="Evidence note" value={note} onChange={setNote} rows={2} />
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
          disabled={
            busy ||
            categories.isPending ||
            categories.isError ||
            !categories.data?.some((item) => item.id === categoryId)
          }
          onClick={() =>
            onSave({
              definition: { name, brand, model, categoryId, imageKey: imageKeyFromSrc(item.imageSrc) },
              ...(serial.trim() ? { serial } : {}),
              ...(price.trim() ? { price } : {}),
              ...(note.trim() ? { evidence: { note } } : {}),
            })
          }
        >
          Save changes
        </Button>
      </div>
    </OverlayDialog>
  );
}
