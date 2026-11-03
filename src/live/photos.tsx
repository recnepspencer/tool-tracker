import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Check, X } from 'lucide-react';
import { api, result } from './client';
import { cx } from './kit';
import { Field } from './ui';
export const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];

/** The server accepts JPEG, PNG and WebP photos up to 8 MB. */
export function checkPhoto(file: File) {
  if (file.type && !photoTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose a photo under 8 MB.');
}

export async function uploadPhoto(
  company_id: string,
  f: FormData,
  purpose: 'registration' | 'incident' | 'handoff' | 'service' | 'reconciliation',
) {
  const file = f.get('photo');
  if (!(file instanceof File) || !file.size) return null;
  checkPhoto(file);
  return result(
    await api.POST('/api/companies/{company_id}/files', {
      params: { path: { company_id } },
      body: { file: '', purpose },
      bodySerializer: () => {
        const body = new FormData();
        body.set('file', file);
        body.set('purpose', purpose);
        return body;
      },
    }),
  ).id;
}
/** Legacy native file field; custody flows use CustodyEvidenceFields instead. */
export function PhotoField() {
  return (
    <Field
      label="Photo (optional, up to 8 MB)"
      name="photo"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
    />
  );
}

type EvidenceContext = 'transfer' | 'review' | 'request' | 'condition' | 'loss';
const notePlaceholders: Record<EvidenceContext, string> = {
  transfer: 'e.g. battery is in the case',
  review: 'e.g. left it on the bench',
  request: 'Add context for the record',
  condition: 'Add context for the record',
  loss: 'Add context for the record',
};
const photoHints: Record<EvidenceContext, string> = {
  transfer: 'Show its condition at handoff',
  review: 'Condition, damage, where you left it',
  request: 'Show its condition at handoff',
  condition: 'Show the current condition clearly',
  loss: 'Optional supporting photo',
};

/**
 * The demo's custody note and photo picker, owned by the surrounding form: it
 * submits `note` and `photo` (read with useStagedPhoto) and clears on reset.
 */
export function CustodyEvidenceFields({
  context = 'request',
  noteName = 'note',
  noteLabel = 'Note',
  notePlaceholder,
  noteRequired = false,
  showPhoto = true,
  noteMaxLength = 2000,
  className,
}: {
  context?: EvidenceContext;
  noteName?: string;
  noteLabel?: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  showPhoto?: boolean;
  noteMaxLength?: number;
  className?: string;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const reset = () => setFileName(null);
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, []);
  return (
    <div className={cx('custody-evidence-fields', className)}>
      <Field
        label={noteLabel}
        hint={noteRequired ? undefined : 'optional'}
        name={noteName}
        required={noteRequired}
        maxLength={noteMaxLength}
        placeholder={notePlaceholder ?? notePlaceholders[context]}
      />
      {showPhoto && (
        <div className={fileName ? 'custody-photo-picker custody-photo-picker--selected' : 'custody-photo-picker'}>
          <input
            ref={input}
            id={inputId}
            className="visually-hidden"
            name="photo"
            type="file"
            accept={photoTypes.join(',')}
            capture="environment"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
          <label className="custody-photo-picker__select" htmlFor={inputId}>
            <span className="custody-photo-picker__icon" aria-hidden="true">
              {fileName ? <Check /> : <Camera />}
            </span>
            <span>
              <strong>{fileName ? 'Photo attached' : 'Add photo'}</strong>
              <small>{fileName ?? photoHints[context]}</small>
            </span>
          </label>
          {fileName ? (
            <button
              type="button"
              className="custody-photo-picker__remove"
              aria-label="Remove attached photo"
              onClick={() => {
                if (input.current) input.current.value = '';
                setFileName(null);
              }}
            >
              <X />
            </button>
          ) : (
            <span className="custody-photo-picker__optional">Optional</span>
          )}
        </div>
      )}
    </div>
  );
}
