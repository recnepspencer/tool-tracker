// Company logos live in square slots: the 30px header mark and the 56px form preview,
// both with corners rounded to a fifth of their width. A logo is cropped to that square
// and saved at a size that stays sharp in the larger slot on a 4x screen.
export const LOGO_SIZE = 256;
export const MIN_ZOOM = 0.5;

/** Where the image sits in the square, in units of the square's width. */
export type Crop = { zoom: number; x: number; y: number };
export type Placement = { left: number; top: number; width: number; height: number };

/** At zoom 1 the whole logo fits the square; the zoom that fills it edge to edge. */
export function fillZoom(width: number, height: number) {
  return Math.max(width, height) / Math.min(width, height);
}

export function maxZoom(width: number, height: number) {
  return fillZoom(width, height) * 3;
}

/** Keep the logo inside the square when smaller, and the square covered when larger. */
export function clampCrop(crop: Crop, width: number, height: number): Crop {
  const zoom = Math.min(Math.max(crop.zoom, MIN_ZOOM), maxZoom(width, height));
  const { width: w, height: h } = placement({ zoom, x: 0, y: 0 }, width, height);
  const limit = (size: number) => Math.abs(size - 1) / 2;
  // Adding 0 turns a -0 from a zero limit into 0.
  const clamp = (value: number, size: number) => Math.min(Math.max(value, -limit(size)), limit(size)) + 0;
  return { zoom, x: clamp(crop.x, w), y: clamp(crop.y, h) };
}

export function placement(crop: Crop, width: number, height: number): Placement {
  const scale = crop.zoom / Math.max(width, height);
  const w = width * scale;
  const h = height * scale;
  return { left: 0.5 + crop.x - w / 2, top: 0.5 + crop.y - h / 2, width: w, height: h };
}
