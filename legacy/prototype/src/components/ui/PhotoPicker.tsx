import { useEffect, useId, useRef } from 'react';
import { Camera, Check, X } from 'lucide-react';
import type { CustodyPhotoEvidence } from '../../domain/evidence';
import { PhotoFileInput } from './TextField';
import './PhotoPicker.css';

export function PhotoPicker({
  photo,
  hint,
  idleLabel = 'Add photo',
  selectedLabel = 'Photo attached',
  preview = false,
  onPhotoChange,
  onBusyChange = () => undefined,
}: {
  photo: CustodyPhotoEvidence | null;
  hint: string;
  idleLabel?: string;
  selectedLabel?: string;
  preview?: boolean;
  onPhotoChange(photo: CustodyPhotoEvidence | null): void;
  onBusyChange?(busy: boolean): void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeReader = useRef<FileReader | null>(null);
  const readVersion = useRef(0);
  const busyChange = useRef(onBusyChange);
  busyChange.current = onBusyChange;

  const cancelPhotoRead = () => {
    readVersion.current += 1;
    activeReader.current?.abort();
    activeReader.current = null;
    onBusyChange(false);
  };

  useEffect(
    () => () => {
      readVersion.current += 1;
      activeReader.current?.abort();
      activeReader.current = null;
      busyChange.current(false);
    },
    [],
  );

  return (
    <div className={`photo-picker${photo ? ' photo-picker--selected' : ''}`}>
      <PhotoFileInput
        id={inputId}
        inputRef={inputRef}
        onSelect={(file) => {
          const version = readVersion.current + 1;
          readVersion.current = version;
          activeReader.current?.abort();
          const reader = new FileReader();
          activeReader.current = reader;
          onBusyChange(true);
          reader.addEventListener('load', () => {
            if (version === readVersion.current && typeof reader.result === 'string') {
              onPhotoChange({ fileName: file.name, src: reader.result });
            }
          });
          reader.addEventListener('loadend', () => {
            if (version !== readVersion.current) return;
            activeReader.current = null;
            onBusyChange(false);
          });
          reader.readAsDataURL(file);
        }}
      />
      <label
        className="photo-picker__select"
        htmlFor={inputId}
        onClick={() => {
          if (inputRef.current) inputRef.current.value = '';
        }}
      >
        <span className={`photo-picker__visual${photo && preview ? ' photo-picker__visual--preview' : ''}`}>
          {photo && preview ? (
            <img src={photo.src} alt="Selected tool" />
          ) : photo ? (
            <Check aria-hidden="true" />
          ) : (
            <Camera aria-hidden="true" />
          )}
        </span>
        <span className="photo-picker__copy">
          <strong>{photo ? selectedLabel : idleLabel}</strong>
          <small>{photo ? photo.fileName : hint}</small>
        </span>
      </label>
      {photo ? (
        <button
          type="button"
          className="photo-picker__remove"
          aria-label="Remove attached photo"
          onClick={() => {
            cancelPhotoRead();
            if (inputRef.current) inputRef.current.value = '';
            onPhotoChange(null);
          }}
        >
          <X aria-hidden="true" />
        </button>
      ) : (
        <span className="photo-picker__optional">Optional</span>
      )}
    </div>
  );
}
