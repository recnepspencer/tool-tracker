import { useState } from 'react';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField, TextField } from '../../components/ui/TextField';
import type { ToolCategoryView } from '../../domain/read-models/settings';
import type { ToolDraft } from './add-tool-types';

interface ToolDetailsFormProps {
  draft: ToolDraft;
  error: string | null;
  busy: boolean;
  categories: readonly ToolCategoryView[];
  warehouses: readonly { id: string; name: string }[];
  uploading: boolean;
  uploadProgress: number;
  active: boolean;
  onUpdate(key: keyof ToolDraft, value: string): void;
  onRetake(): void;
  onClose(): void;
  onSave(): void;
}

export function ToolDetailsForm({
  draft,
  error,
  busy,
  categories,
  warehouses,
  uploading,
  uploadProgress,
  active,
  onUpdate,
  onRetake,
  onClose,
  onSave,
}: ToolDetailsFormProps) {
  const [optionalOpen, setOptionalOpen] = useState(false);

  return (
    <div className="worker-add-step worker-add-details-step" aria-hidden={!active}>
      <div className="worker-add-step-header">
        <button type="button" className="worker-retake-button" onClick={onRetake}>
          ‹&nbsp; Retake
        </button>
        <div className="worker-details-header-right">
          <span className="worker-add-step-label">Tool details</span>
          <button type="button" className="worker-close-button" aria-label="Close add tool" onClick={onClose}>
            ×
          </button>
        </div>
      </div>
      <div className="worker-details-scroll">
        <div className={`worker-upload-tile${uploading ? ' worker-upload-tile--uploading' : ''}`}>
          <span className="worker-camera-label">Tool photo</span>
          {uploading ? <span className="worker-upload-sweep" aria-hidden="true" /> : null}
          <span className="worker-upload-chip">
            <span className={`worker-upload-dot${uploading ? ' worker-upload-dot--blink' : ''}`} />
            {uploading ? `Uploading ${uploadProgress}%` : 'Photo saved'}
          </span>
          <span className="worker-upload-progress">
            <span style={{ width: `${uploadProgress}%` }} />
          </span>
        </div>

        <div className="worker-form-stack">
          <FormCard
            label="Tool name"
            tag="Required"
            value={draft.name}
            placeholder="Name this tool"
            onChange={(value) => onUpdate('name', value)}
          />
          <FormCard
            label="Brand"
            tag="Optional"
            value={draft.brand}
            placeholder="Who makes it?"
            onChange={(value) => onUpdate('brand', value)}
          />
          <FormCard
            label="Model"
            tag="Optional"
            value={draft.model}
            placeholder="Model or size"
            onChange={(value) => onUpdate('model', value)}
          />
        </div>

        <SelectField
          className="worker-select-field"
          label="Category"
          hint="required"
          value={draft.categoryId}
          onChange={(value) => onUpdate('categoryId', value)}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          placeholder="Select a category"
          required
          searchable={false}
          presentation="sheet"
        />
        <SelectField
          className="worker-select-field"
          label="Home warehouse"
          hint="required"
          value={draft.warehouseId}
          onChange={(value) => onUpdate('warehouseId', value)}
          options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))}
          placeholder="Select a warehouse"
          required
          searchable={false}
          presentation="sheet"
        />

        <button
          type="button"
          className={`worker-optional-toggle${optionalOpen ? ' worker-optional-toggle--open' : ''}`}
          aria-expanded={optionalOpen}
          onClick={() => setOptionalOpen((current) => !current)}
        >
          <span>Serial, price, notes</span>
          <span aria-hidden="true">⌄</span>
        </button>
        {optionalOpen ? (
          <div className="worker-form-stack worker-optional-fields">
            <FormCard
              label="Serial"
              tag="Optional"
              value={draft.serial}
              placeholder="Serial number"
              onChange={(value) => onUpdate('serial', value)}
            />
            <FormCard
              label="Price"
              tag="Optional"
              value={draft.price}
              placeholder="Replacement value"
              onChange={(value) => onUpdate('price', value)}
            />
            <TextAreaField
              className="worker-add-field"
              label="Note"
              hint="optional"
              value={draft.note}
              onChange={(value) => onUpdate('note', value)}
              placeholder="Condition or context"
              rows={3}
            />
          </div>
        ) : null}
        {error ? (
          <p className="worker-add-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="worker-add-scroll-spacer" />
      </div>

      <div className="worker-add-footer">
        <button type="button" className="worker-primary-button" disabled={busy} onClick={onSave}>
          {busy ? 'Adding…' : 'Add to my tools'}
        </button>
        <p>You become the holder of record</p>
      </div>
    </div>
  );
}

function FormCard({
  label,
  tag,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  tag: string;
  value: string;
  placeholder: string;
  onChange(value: string): void;
}) {
  return (
    <TextField
      className="worker-add-field"
      label={label}
      hint={tag.toLowerCase()}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
