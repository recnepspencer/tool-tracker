import { useRef } from 'react';
import { PhotoFileInput } from '../../components/ui/TextField';

interface MockPhotoCaptureProps {
  onCapture(photoDataUrl: string): void;
  onClose(): void;
  active: boolean;
}

export function MockPhotoCapture({ onCapture, onClose, active }: MockPhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectPhoto = (file: File) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') onCapture(reader.result);
    });
    reader.readAsDataURL(file);
  };
  return (
    <div className="worker-add-step worker-add-capture-step" aria-hidden={!active} {...(!active ? { inert: '' } : {})}>
      <div className="worker-add-step-header">
        <span>Add tool</span>
        <button type="button" className="worker-close-button" aria-label="Close add tool" onClick={onClose}>
          ×
        </button>
      </div>
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
        <PhotoFileInput inputRef={inputRef} ariaLabel="Choose a tool photo" onSelect={selectPhoto} />
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
    </div>
  );
}
