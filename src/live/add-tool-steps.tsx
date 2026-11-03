import type { ReactNode, RefObject } from 'react';

/** The demo's `MockPhotoCapture`, backed by a real camera/library file input. */
export function AddToolCaptureStep({
  active,
  inputRef,
  error,
  onPhoto,
  onSkip,
  onClose,
}: {
  active: boolean;
  inputRef: RefObject<HTMLInputElement>;
  error: string;
  onPhoto(file: File | undefined): void;
  onSkip(): void;
  onClose(): void;
}) {
  return (
    <div className="worker-add-step worker-add-capture-step" aria-hidden={!active} {...(!active ? { inert: '' } : {})}>
      <AddToolHeader onClose={onClose}>
        <span>Add tool</span>
      </AddToolHeader>
      <div className="worker-camera-card" role="group" aria-label="Tool photo">
        <div className="worker-camera-focus-frame" aria-hidden="true">
          <span className="worker-corner worker-corner--top-left" />
          <span className="worker-corner worker-corner--top-right" />
          <span className="worker-corner worker-corner--bottom-left" />
          <span className="worker-corner worker-corner--bottom-right" />
          <span className="worker-camera-label">Tool photo</span>
        </div>
        <span className="worker-camera-instruction">Take a photo or choose one from this device</span>
      </div>
      <div className="worker-shutter-wrap">
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          aria-label="Choose a tool photo"
          tabIndex={-1}
          onChange={(event) => {
            onPhoto(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="worker-shutter"
          aria-label="Take or choose a tool photo"
          onClick={() => inputRef.current?.click()}
        >
          <span className="worker-shutter-ring" aria-hidden="true" />
          <span className="worker-shutter-core" aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="worker-add-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="text-button" onClick={onSkip}>
        Continue without a photo
      </button>
    </div>
  );
}

export function AddToolHeader({ children, onClose }: { children: ReactNode; onClose(): void }) {
  return (
    <div className="worker-add-step-header">
      {children}
      <button type="button" className="worker-close-button" aria-label="Close add tool" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
