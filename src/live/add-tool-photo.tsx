import { useId, useRef } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Camera, X } from 'lucide-react';
import { cx } from './kit';
import { photoTypes } from './photos';

/*
 * Tapping Add tool opens the camera in the same tap, while the form opens
 * behind it. The picker belongs to the page that holds the link (the form is a
 * lazily loaded route that is not mounted yet), so the chosen photo waits here
 * until the form takes it.
 */
let pendingPhoto: File | null = null;
let receiver: ((file: File) => void) | null = null;

function handOver(file: File) {
  if (receiver) receiver(file);
  else pendingPhoto = file;
}

/** Lets the open add-tool form take a photo picked from the Add tool link. */
export function receiveLaunchPhoto(onPhoto: (file: File) => void) {
  receiver = onPhoto;
  if (pendingPhoto) {
    const file = pendingPhoto;
    pendingPhoto = null;
    onPhoto(file);
  }
  return () => {
    if (receiver === onPhoto) receiver = null;
    pendingPhoto = null;
  };
}

/** The Add tool entry point: opens the form and, in the same tap, the camera. */
export function AddToolLink({ onClick, ...props }: LinkProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Link
        {...props}
        onClick={(event) => {
          onClick?.(event);
          // A modified click opens a new tab instead of the form here.
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;
          pendingPhoto = null;
          input.current?.click();
        }}
      />
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept={photoTypes.join(',')}
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) handOver(file);
        }}
      />
    </>
  );
}

/** The add-tool form's photo row: take or replace the photo, or remove it. */
export function AddToolPhotoRow({
  preview,
  fileName,
  error,
  onPhoto,
  onRemove,
}: {
  preview: string;
  fileName: string;
  error: string;
  onPhoto(file: File): void;
  onRemove(): void;
}) {
  const inputId = useId();
  const detail = preview ? fileName || 'Photo attached' : 'Take one or choose from this device';
  return (
    <>
      <div className={cx('custody-photo-picker', preview && 'custody-photo-picker--selected')}>
        <input
          id={inputId}
          className="visually-hidden"
          type="file"
          accept={photoTypes.join(',')}
          capture="environment"
          aria-label="Tool photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onPhoto(file);
          }}
        />
        <label className="custody-photo-picker__select" htmlFor={inputId}>
          <span className="custody-photo-picker__icon worker-add-photo__thumb">
            {preview ? <img src={preview} alt="Selected tool" /> : <Camera aria-hidden="true" />}
          </span>
          <span>
            <strong>{preview ? 'Replace photo' : 'Take photo'}</strong>
            <small>{detail}</small>
          </span>
        </label>
        {preview ? (
          <button type="button" className="custody-photo-picker__remove" aria-label="Remove photo" onClick={onRemove}>
            <X />
          </button>
        ) : (
          <span className="custody-photo-picker__optional">Optional</span>
        )}
      </div>
      {error && (
        <p className="worker-add-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
