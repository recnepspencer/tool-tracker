import { useId } from 'react';
import type { Model } from './client';
import { FieldGroup, FieldShell } from './kit';
import { Field, TextArea, text } from './ui';

/** Unit-level purchase and serial fields, form-owned, in the demo's field shells. Prices are US dollars. */
export function AssetDetailsFields({ asset }: { asset?: Model<'AssetView'> }) {
  const priceId = useId();
  return (
    <FieldGroup>
      <Field label="Serial number" name="serial" defaultValue={asset?.serial_number ?? ''} maxLength={120} />
      <FieldShell label="Purchase price" htmlFor={priceId}>
        <div className="field-control-row field-control-row--prefixed">
          <span className="field-prefix" aria-hidden="true">
            $
          </span>
          <input
            id={priceId}
            className="field-control"
            name="price"
            type="number"
            inputMode="decimal"
            min="0"
            max="9999999999.99"
            step="0.01"
            placeholder="0.00"
            defaultValue={asset?.acquisition_cost ?? ''}
          />
        </div>
      </FieldShell>
      <Field label="Purchase date" name="purchased" type="date" defaultValue={asset?.acquisition_date ?? ''} />
      <TextArea label="Notes" name="notes" defaultValue={asset?.notes ?? ''} maxLength={4000} rows={3} />
    </FieldGroup>
  );
}

export function assetDetailsInput(form: FormData) {
  return {
    serial_number: text(form, 'serial') || null,
    acquisition_cost: text(form, 'price') || null,
    acquisition_date: text(form, 'purchased') || null,
    notes: text(form, 'notes'),
  };
}

export function purchasePrice(asset: Model<'AssetView'>) {
  return asset.acquisition_cost === null
    ? 'Not recorded'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(asset.acquisition_cost));
}
