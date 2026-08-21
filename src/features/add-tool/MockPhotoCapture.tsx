import { Button } from '../../components/ui/Button';

interface MockPhotoCaptureProps {
  captured: boolean;
  onCapture(): void;
  onContinue(): void;
}

export function MockPhotoCapture({ captured, onCapture, onContinue }: MockPhotoCaptureProps) {
  return (
    <div className="add-tool-capture">
      <div
        className={`mock-camera ${captured ? 'mock-camera--captured' : ''}`}
        role="img"
        aria-label={captured ? 'Mock tool photo captured' : 'Mock camera frame'}
      >
        <span>{captured ? 'Photo captured' : 'Fill the frame with the tool'}</span>
      </div>
      <p>
        {captured
          ? 'This demo photo stays local and is attached as evidence.'
          : 'Capture is simulated; no camera or upload permission is requested.'}
      </p>
      <div className="add-tool-actions">
        <Button variant="secondary" onClick={onCapture}>
          {captured ? 'Retake photo' : 'Capture photo'}
        </Button>
        <Button variant="primary" disabled={!captured} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
