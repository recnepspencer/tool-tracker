// @vitest-environment node
import { expect, it } from 'vitest';
import { clampCrop, fillZoom, placement } from './logo-crop';

it('fits a wide logo whole at zoom 1 and fills the square at its fill zoom', () => {
  expect(placement({ zoom: 1, x: 0, y: 0 }, 400, 100)).toEqual({ left: 0, top: 0.375, width: 1, height: 0.25 });
  const filled = placement({ zoom: fillZoom(400, 100), x: 0, y: 0 }, 400, 100);
  expect(filled.height).toBe(1);
  expect(filled.width).toBe(4);
});

it('never leaves a gap in a filled square or pushes a fitted logo outside it', () => {
  // Filled: the 4-wide image may slide 1.5 either way, but not vertically.
  expect(clampCrop({ zoom: 4, x: 9, y: 9 }, 400, 100)).toEqual({ zoom: 4, x: 1.5, y: 0 });
  // Fitted: the quarter-high image may move up or down within the square, not sideways.
  expect(clampCrop({ zoom: 1, x: -9, y: -9 }, 400, 100)).toEqual({ zoom: 1, x: 0, y: -0.375 });
});

it('keeps the size between half the fitted size and three times the filled size', () => {
  expect(clampCrop({ zoom: 0.1, x: 0, y: 0 }, 200, 200).zoom).toBe(0.5);
  expect(clampCrop({ zoom: 99, x: 0, y: 0 }, 200, 100).zoom).toBe(6);
});
