// @vitest-environment node
import { expect, it } from 'vitest';
import { clampCrop, fillZoom, naturalShape, placement } from './logo-crop';

it('starts a logo in a frame of its own shape, within square to four-to-one', () => {
  expect(naturalShape(300, 100)).toBe(3);
  expect(naturalShape(1000, 100)).toBe(4);
  expect(naturalShape(100, 300)).toBe(1);
});

it('fills a frame of the logo’s own shape exactly at zoom 1', () => {
  expect(placement({ shape: 3, zoom: 1, x: 0, y: 0 }, 300, 100)).toEqual({ left: 0, top: 0, width: 1, height: 1 });
  expect(fillZoom(3, 300, 100)).toBe(1);
});

it('fits a wide logo whole in a square and fills the square at its fill zoom', () => {
  expect(placement({ shape: 1, zoom: 1, x: 0, y: 0 }, 400, 100)).toEqual({
    left: 0,
    top: 0.375,
    width: 1,
    height: 0.25,
  });
  const filled = placement({ shape: 1, zoom: fillZoom(1, 400, 100), x: 0, y: 0 }, 400, 100);
  expect(filled).toEqual({ left: -1.5, top: 0, width: 4, height: 1 });
});

it('never leaves a gap in a filled frame or pushes a fitted logo outside it', () => {
  expect(clampCrop({ shape: 1, zoom: 4, x: 9, y: 9 }, 400, 100)).toEqual({ shape: 1, zoom: 4, x: 1.5, y: 0 });
  expect(clampCrop({ shape: 1, zoom: 1, x: -9, y: -9 }, 400, 100)).toEqual({ shape: 1, zoom: 1, x: 0, y: -0.375 });
  // A tall logo in a 2:1 frame may slide sideways inside it, but not up or down.
  expect(clampCrop({ shape: 2, zoom: 1, x: 9, y: 9 }, 100, 200)).toEqual({ shape: 2, zoom: 1, x: 0.75, y: 0 });
});

it('keeps the shape and size within their limits', () => {
  expect(clampCrop({ shape: 9, zoom: 0.1, x: 0, y: 0 }, 200, 200)).toMatchObject({ shape: 4, zoom: 0.5 });
  expect(clampCrop({ shape: 1, zoom: 99, x: 0, y: 0 }, 200, 100).zoom).toBe(6);
});
