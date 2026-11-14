import { useEffect, useId, useRef, useState } from 'react';
import { Camera, Check, X } from 'lucide-react';
import { api, result } from './client';
import { cx } from './kit';
import { Field } from './ui';
export const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];

const SERVER_LIMIT = 8 * 1024 * 1024;
// Camera originals can exceed the server limit; the browser shrinks them first.
const SOURCE_LIMIT = 40 * 1024 * 1024;
const MAX_EDGE = 1600;
const KEEP_BYTES = 600 * 1024;

/** Accept camera originals up to 40 MB; uploads are downscaled to fit the server's 8 MB limit. */
export function checkPhoto(file: File) {
  if (file.type && !photoTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  if (file.size > SOURCE_LIMIT) throw new Error('Choose a photo under 40 MB.');
}

/**
 * Field crews upload over weak signal, and phone cameras produce several
 * megabytes per photo. Downscale to 1600px JPEG before upload, which also
 * applies EXIF rotation and drops location metadata. Small photos, and any
 * browser that cannot decode the file, keep the original bytes.
 */
export async function preparePhoto(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size <= KEEP_BYTES) return file;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) return file;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

export async function uploadPhoto(
  company_id: string,
  f: FormData,
  purpose: 'registration' | 'incident' | 'handoff' | 'service' | 'reconciliation',
) {
  const original = f.get('photo');
  if (!(original instanceof File) || !original.size) return null;
  checkPhoto(original);
  const file = await preparePhoto(original);
  if (file.size > SERVER_LIMIT) throw new Error('This photo is too large to upload. Try a smaller photo.');
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
      label="Photo (optional)"
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
