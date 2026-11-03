import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './kit';
import {
  clampCrop,
  fillZoom,
  LOGO_HEIGHT,
  MAX_SHAPE,
  maxZoom,
  MIN_SHAPE,
  MIN_ZOOM,
  naturalShape,
  placement,
  type Crop,
} from './logo-crop';

type Loaded = { image: HTMLImageElement; width: number; height: number };

const shapeStyle = (crop: Crop) => ({ '--logo-shape': crop.shape }) as CSSProperties;

/** The logo cropped to a frame of the chosen shape; CSS sizes the frame from `--logo-shape`. */
function CropView({ loaded, crop, className }: { loaded: Loaded; crop: Crop; className: string }) {
  const at = placement(crop, loaded.width, loaded.height);
  return (
    <span className={className} style={shapeStyle(crop)}>
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
  canvas.height = LOGO_HEIGHT;
  canvas.width = Math.round(LOGO_HEIGHT * crop.shape);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare the logo.');
  context.imageSmoothingQuality = 'high';
  const at = placement(crop, width, height);
  context.drawImage(
    image,
    at.left * canvas.width,
    at.top * canvas.height,
    at.width * canvas.width,
    at.height * canvas.height,
  );
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The logo could not be prepared. Try another image.');
  return new File([blob], 'logo.png', { type: 'image/png' });
}

/** Choose a logo's shape, size and position for its fixed-height slots, then save it at a fixed height. */
export function LogoCropper({
  source,
  onCancel,
  onDone,
}: {
  source: string;
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const shapeId = useId();
  const sizeId = useId();
  const [loaded, setLoaded] = useState<Loaded>();
  const [error, setError] = useState('');
  const [crop, setCrop] = useState<Crop>({ shape: 1, zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ pointer: number; x: number; y: number; frame: number } | null>(null);
  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setLoaded({ image, width: image.naturalWidth, height: image.naturalHeight });
      // Start with the logo's own shape, whole and edge to edge where the slot allows.
      setCrop({ shape: naturalShape(image.naturalWidth, image.naturalHeight), zoom: 1, x: 0, y: 0 });
    };
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
      frame: event.currentTarget.getBoundingClientRect().height,
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
      <span
        className="logo-cropper-frame"
        style={shapeStyle(crop)}
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
          <CropView loaded={loaded} crop={crop} className="logo-cropper-view logo-cropper-slot--header" />
          Header
        </span>
        <span>
          <CropView loaded={loaded} crop={crop} className="logo-cropper-view logo-cropper-slot--form" />
          Forms
        </span>
      </div>
      <label className="logo-cropper-size" htmlFor={shapeId}>
        <span>Width</span>
        <input
          id={shapeId}
          type="range"
          min={MIN_SHAPE}
          max={MAX_SHAPE}
          step={0.01}
          value={crop.shape}
          onChange={(event) => update({ ...crop, shape: Number(event.currentTarget.value) })}
        />
      </label>
      <label className="logo-cropper-size" htmlFor={sizeId}>
        <span>Size</span>
        <input
          id={sizeId}
          type="range"
          min={MIN_ZOOM}
          max={maxZoom(crop.shape, width, height)}
          step={0.01}
          value={crop.zoom}
          onChange={(event) => update({ ...crop, zoom: Number(event.currentTarget.value) })}
        />
      </label>
      <div className="auth-logo-actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => update({ shape: naturalShape(width, height), zoom: 1, x: 0, y: 0 })}
        >
          Match logo shape
        </Button>
        <Button type="button" variant="ghost" onClick={() => update({ shape: 1, zoom: 1, x: 0, y: 0 })}>
          Square
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => update({ ...crop, zoom: fillZoom(crop.shape, width, height), x: 0, y: 0 })}
        >
          Fill frame
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
