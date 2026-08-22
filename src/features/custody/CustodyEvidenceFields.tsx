import { useEffect, useId, useRef } from 'react';
import { Camera, Check, X } from 'lucide-react';
import { PhotoFileInput, TextField } from '../../components/ui/TextField';
import type { CustodyPhotoEvidence } from '../../domain/evidence';

export interface CustodyEvidenceDraft {
  note: string;
  photo: CustodyPhotoEvidence | null;
}

interface CustodyEvidenceFieldsProps extends CustodyEvidenceDraft {
  onNoteChange(note: string): void;
  onPhotoChange(photo: CustodyPhotoEvidence | null): void;
  onPhotoBusyChange?(busy: boolean): void;
  className?: string;
  context?: 'transfer' | 'review' | 'request' | 'condition';
  notePlaceholder?: string;
  showPhoto?: boolean;
}

export function CustodyEvidenceFields({
  note,
  photo,
  onNoteChange,
  onPhotoChange,
  onPhotoBusyChange = () => undefined,
  className = '',
  context = 'request',
  notePlaceholder,
  showPhoto = true,
}: CustodyEvidenceFieldsProps) {
  const inputId = useId();
  const activeReader = useRef<FileReader | null>(null);
  const readVersion = useRef(0);
  const photoBusyChange = useRef(onPhotoBusyChange);
  photoBusyChange.current = onPhotoBusyChange;
  const cancelPhotoRead = () => {
    readVersion.current += 1;
    activeReader.current?.abort();
    activeReader.current = null;
    onPhotoBusyChange(false);
  };
  useEffect(
    () => () => {
      readVersion.current += 1;
      activeReader.current?.abort();
      activeReader.current = null;
      photoBusyChange.current(false);
    },
    [],
  );
  const resolvedNotePlaceholder =
    notePlaceholder ??
    (context === 'transfer'
      ? 'e.g. battery is in the case'
      : context === 'review'
        ? 'e.g. left it on the bench'
        : 'Add context for the record');
  const photoHint =
    context === 'review'
      ? 'Condition, damage, where you left it'
      : context === 'condition'
        ? 'Show the current condition clearly'
        : 'Show its condition at handoff';
  return (
    <div className={`custody-evidence-fields ${className}`.trim()}>
      <TextField
        label="Note"
        hint="optional"
        value={note}
        onChange={onNoteChange}
        placeholder={resolvedNotePlaceholder}
      />
      {showPhoto ? (
        <div className={`custody-photo-picker${photo ? ' custody-photo-picker--selected' : ''}`}>
          <PhotoFileInput
            id={inputId}
            onSelect={(file) => {
              const version = readVersion.current + 1;
              readVersion.current = version;
              activeReader.current?.abort();
              const reader = new FileReader();
              activeReader.current = reader;
              onPhotoBusyChange(true);
              reader.addEventListener('load', () => {
                if (version === readVersion.current && typeof reader.result === 'string') {
                  onPhotoChange({ fileName: file.name, src: reader.result });
                }
              });
              reader.addEventListener('loadend', () => {
                if (version !== readVersion.current) return;
                activeReader.current = null;
                onPhotoBusyChange(false);
              });
              reader.readAsDataURL(file);
            }}
          />
          <label className="custody-photo-picker__select" htmlFor={inputId}>
            <span className="custody-photo-picker__icon" aria-hidden="true">
              {photo ? <Check /> : <Camera />}
            </span>
            <span>
              <strong>{photo ? 'Photo attached' : 'Add photo'}</strong>
              <small>{photo ? photo.fileName : photoHint}</small>
            </span>
          </label>
          {photo ? (
            <button
              type="button"
              className="custody-photo-picker__remove"
              aria-label="Remove attached photo"
              onClick={() => {
                cancelPhotoRead();
                onPhotoChange(null);
              }}
            >
              <X />
            </button>
          ) : (
            <span className="custody-photo-picker__optional">Optional</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
