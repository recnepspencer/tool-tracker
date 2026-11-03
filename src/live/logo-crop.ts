// Company logos sit in a fixed-height slot (30px in the header, 56px on forms) and take the
// width their shape needs, from square up to four times as wide as tall. A logo is cropped to
// a frame of that shape and saved tall enough to stay sharp in the larger slot on a 4x screen.
export const LOGO_HEIGHT = 224;
export const MIN_SHAPE = 1;
export const MAX_SHAPE = 4;
export const MIN_ZOOM = 0.5;

/**
 * `shape` is the frame's width over its height. `zoom` 1 fits the whole logo in the frame.
 * `x` and `y` move the logo's centre from the frame's centre, in units of the frame's height.
 */
export type Crop = { shape: number; zoom: number; x: number; y: number };
/** Where the logo sits, as fractions of the frame's width and height. */
export type Placement = { left: number; top: number; width: number; height: number };

const between = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** The frame that matches the logo's own shape, as far as the slot allows. */
export function naturalShape(width: number, height: number) {
  return between(width / height, MIN_SHAPE, MAX_SHAPE);
}

/** The zoom at which the logo covers the frame edge to edge. */
export function fillZoom(shape: number, width: number, height: number) {
  const across = shape / width;
  const down = 1 / height;
  return Math.max(across, down) / Math.min(across, down);
}

export function maxZoom(shape: number, width: number, height: number) {
  return fillZoom(shape, width, height) * 3;
}

/** Logo size in frame-height units. */
function size(crop: Crop, width: number, height: number) {
  const scale = crop.zoom * Math.min(crop.shape / width, 1 / height);
  return { w: width * scale, h: height * scale };
}

/** Keep the logo inside the frame where it is smaller, and the frame covered where it is larger. */
export function clampCrop(crop: Crop, width: number, height: number): Crop {
  const shape = between(crop.shape, MIN_SHAPE, MAX_SHAPE);
  const zoom = between(crop.zoom, MIN_ZOOM, maxZoom(shape, width, height));
  const { w, h } = size({ ...crop, shape, zoom }, width, height);
  // Adding 0 turns a -0 from a zero limit into 0.
  const limit = (value: number, extent: number, frame: number) =>
    between(value, -Math.abs(extent - frame) / 2, Math.abs(extent - frame) / 2) + 0;
  return { shape, zoom, x: limit(crop.x, w, shape), y: limit(crop.y, h, 1) };
}

export function placement(crop: Crop, width: number, height: number): Placement {
  const { w, h } = size(crop, width, height);
  return {
    left: (crop.shape / 2 + crop.x - w / 2) / crop.shape,
    top: 0.5 + crop.y - h / 2,
    width: w / crop.shape,
    height: h,
  };
}
