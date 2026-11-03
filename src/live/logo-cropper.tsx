import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './kit';
import { clampCrop, fillZoom, LOGO_SIZE, maxZoom, MIN_ZOOM, placement, type Crop } from './logo-crop';

type Loaded = { image: HTMLImageElement; width: number; height: number };

/** The logo as one of its square slots shows it. */
function CropView({ loaded, crop, className }: { loaded: Loaded; crop: Crop; className: string }) {
  const at = placement(crop, loaded.width, loaded.height);
  return (
    <span className={className}>
      <img
        src={loaded.image.src}
        alt=""
        draggable={false}
        style={{
          left: `${at.left * 100}%`,
          top: `${at.top * 100}%`,
          width: `${at.width * 100}%`,
          height: `${at.height * 100}%`,
        }}
      />
    </span>
  );
}

async function render({ image, width, height }: Loaded, crop: Crop) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = LOGO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the logo.');
  context.imageSmoothingQuality = 'high';
  const at = placement(crop, width, height);
  context.drawImage(image, at.left * LOGO_SIZE, at.top * LOGO_SIZE, at.width * LOGO_SIZE, at.height * LOGO_SIZE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The logo could not be prepared. Try another image.');
  return new File([blob], 'logo.png', { type: 'image/png' });
}

/** Size and position a logo inside the square it will be shown in, then save it at a fixed size. */
export function LogoCropper({
  source,
  onCancel,
  onDone,
}: {
  source: string;
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const sizeId = useId();
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState('');
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ pointer: number; x: number; y: number; frame: number } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => setLoaded({ image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => setError('This image could not be opened. Try another file.');
    image.src = source;
  }, [source]);
  if (!loaded)
    return error ? (
      <p className="auth-hint" role="alert">
        {error}
      </p>
    ) : null;
  const { width, height } = loaded;
  const update = (next: Crop) => setCrop(clampCrop(next, width, height));
  function start(event: PointerEvent<HTMLSpanElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      frame: event.currentTarget.getBoundingClientRect().width,
    };
  }
  function move(event: PointerEvent<HTMLSpanElement>) {
    const from = drag.current;
    if (!from || from.pointer !== event.pointerId) return;
    update({
      ...crop,
      x: crop.x + (event.clientX - from.x) / from.frame,
      y: crop.y + (event.clientY - from.y) / from.frame,
    });
    drag.current = { ...from, x: event.clientX, y: event.clientY };
  }
  function nudge(event: KeyboardEvent<HTMLSpanElement>) {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const by = moves[event.key];
    if (!by) return;
    event.preventDefault();
    update({ ...crop, x: crop.x + by[0], y: crop.y + by[1] });
  }
  return (
    <div className="logo-cropper" role="group" aria-label="Adjust company logo">
      <div className="logo-cropper-stage">
        <span
          className="logo-cropper-frame"
          tabIndex={0}
          role="img"
          aria-label="Logo position. Drag, or use the arrow keys, to move it."
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={nudge}
        >
          <CropView loaded={loaded} crop={crop} className="logo-cropper-view" />
        </span>
        <div className="logo-cropper-slots" aria-hidden="true">
          <span>
            <CropView loaded={loaded} crop={crop} className="logo-cropper-view brand-mark brand-mark--logo" />
            Header
          </span>
          <span>
            <CropView loaded={loaded} crop={crop} className="logo-cropper-view auth-logo-preview" />
            Forms
          </span>
        </div>
      </div>
      <label className="logo-cropper-size" htmlFor={sizeId}>
        <span>Size</span>
        <input
          id={sizeId}
          type="range"
          min={MIN_ZOOM}
          max={maxZoom(width, height)}
          step={0.01}
          value={crop.zoom}
          onChange={(event) => update({ ...crop, zoom: Number(event.currentTarget.value) })}
        />
      </label>
      <div className="auth-logo-actions">
        <Button type="button" variant="ghost" onClick={() => update({ zoom: 1, x: 0, y: 0 })}>
          Fit whole logo
        </Button>
        <Button type="button" variant="ghost" onClick={() => update({ zoom: fillZoom(width, height), x: 0, y: 0 })}>
          Fill the square
        </Button>
      </div>
      {error && (
        <p className="auth-hint" role="alert">
          {error}
        </p>
      )}
      <div className="auth-logo-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void render(loaded, crop).then(onDone, (reason: Error) => setError(reason.message))}
        >
          Use logo
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
