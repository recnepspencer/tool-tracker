import type { Model } from './client';
import { useId } from 'react';
import { Field, text } from './ui';

export function AssetDetailsFields({ asset }: { asset?: Model<'AssetView'> }) {
  const notesId = useId();
  return (
    <>
      <Field label="Serial number" name="serial" defaultValue={asset?.serial_number ?? ''} maxLength={120} />
      <div className="asset-purchase-price">
        <Field
          label="Purchase price"
          name="price"
          type="number"
          inputMode="decimal"
          min="0"
          max="9999999999.99"
          step="0.01"
          defaultValue={asset?.acquisition_cost ?? ''}
        />
        <Field
          label="Currency"
          name="currency"
          defaultValue={asset?.acquisition_currency || 'USD'}
          pattern="[A-Za-z]{3}"
          maxLength={3}
          placeholder="USD"
        />
      </div>
      <Field label="Purchase date" name="purchased" type="date" defaultValue={asset?.acquisition_date ?? ''} />
      <div className="field">
        <label htmlFor={notesId}>Notes</label>
        <textarea id={notesId} name="notes" defaultValue={asset?.notes ?? ''} maxLength={4000} rows={3} />
      </div>
    </>
  );
}

export function assetDetailsInput(form: FormData) {
  const price = text(form, 'price');
  return {
    serial_number: text(form, 'serial') || null,
    acquisition_cost: price || null,
    acquisition_currency: price ? text(form, 'currency').toUpperCase() : '',
    acquisition_date: text(form, 'purchased') || null,
    notes: text(form, 'notes'),
  };
}

export function purchasePrice(asset: Model<'AssetView'>) {
  return asset.acquisition_cost === null
    ? 'Not recorded'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: asset.acquisition_currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(asset.acquisition_cost));
}
