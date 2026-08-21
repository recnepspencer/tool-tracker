interface MockPhotoCaptureProps {
  onCapture(): void;
  onClose(): void;
  active: boolean;
}

export function MockPhotoCapture({ onCapture, onClose, active }: MockPhotoCaptureProps) {
  return (
    <div className="worker-add-step worker-add-capture-step" aria-hidden={!active}>
      <div className="worker-add-step-header">
        <span>Add tool</span>
        <button type="button" className="worker-close-button" aria-label="Close add tool" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="worker-camera-card" role="img" aria-label="Tool photo capture frame">
        <div className="worker-camera-focus-frame" aria-hidden="true">
          <span className="worker-corner worker-corner--top-left" />
          <span className="worker-corner worker-corner--top-right" />
          <span className="worker-corner worker-corner--bottom-left" />
          <span className="worker-corner worker-corner--bottom-right" />
          <span className="worker-camera-label">Tool photo</span>
        </div>
        <span className="worker-camera-instruction">Fill the frame with the tool</span>
      </div>
      <div className="worker-shutter-wrap">
        <button type="button" className="worker-shutter" aria-label="Capture photo" onClick={onCapture}>
          <span className="worker-shutter-ring" aria-hidden="true" />
          <span className="worker-shutter-core" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
