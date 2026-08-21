import { Button } from '../../components/ui/Button';
import { TextAreaField, TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import type { ToolDraft } from './add-tool-types';
import type { ToolCategoryView } from '../../domain/read-models/settings';

interface ToolDetailsFormProps {
  draft: ToolDraft;
  error: string | null;
  busy: boolean;
  onUpdate(key: keyof ToolDraft, value: string): void;
  onBack(): void;
  onSave(): void;
  categories: readonly ToolCategoryView[];
}

export function ToolDetailsForm({ draft, error, busy, onUpdate, onBack, onSave, categories }: ToolDetailsFormProps) {
  return (
    <div className="add-tool-details">
      <TextField
        label="Tool name"
        value={draft.name}
        onChange={(value) => onUpdate('name', value)}
        autoFocus
        required
      />
      <div className="add-tool-fields">
        <TextField label="Brand" hint="optional" value={draft.brand} onChange={(value) => onUpdate('brand', value)} />
        <TextField label="Model" hint="optional" value={draft.model} onChange={(value) => onUpdate('model', value)} />
      </div>
      <SelectField
        label="Category"
        value={draft.categoryId}
        onChange={(value) => onUpdate('categoryId', value)}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
        placeholder="Choose a category"
        required
      />
      <TextField
        label="Home warehouse"
        value={draft.warehouseId}
        onChange={(value) => onUpdate('warehouseId', value)}
        placeholder="north-yard"
        required
      />
      <div className="add-tool-fields">
        <TextField
          label="Serial"
          hint="optional"
          value={draft.serial}
          onChange={(value) => onUpdate('serial', value)}
        />
        <TextField label="Price" hint="optional" value={draft.price} onChange={(value) => onUpdate('price', value)} />
      </div>
      <TextAreaField
        label="Note"
        hint="optional"
        value={draft.note}
        onChange={(value) => onUpdate('note', value)}
        placeholder="Condition or context"
      />
      {error ? (
        <p className="add-tool-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="add-tool-actions">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" disabled={busy} onClick={onSave}>
          {busy ? 'Adding…' : 'Add to my tools'}
        </Button>
      </div>
    </div>
  );
}
