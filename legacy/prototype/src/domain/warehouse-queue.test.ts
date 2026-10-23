import { describe, expect, it } from 'vitest';
import { classifyWarehouseQueueItem } from './warehouse-queue';

describe('warehouse queue policy', () => {
  it.each([
    [
      {
        kind: 'warehouse-request',
        from: { type: 'warehouse', warehouseId: 'north-yard' },
        to: { type: 'worker', userId: 'ray-torres' },
      },
      'request',
    ],
    [
      {
        kind: 'transfer',
        from: { type: 'worker', userId: 'ray-torres' },
        to: { type: 'warehouse', warehouseId: 'south-shop' },
      },
      'return',
    ],
    [
      {
        kind: 'transfer',
        from: { type: 'worker', userId: 'ray-torres' },
        to: { type: 'worker', userId: 'avery-cole' },
      },
      null,
    ],
    [
      {
        kind: 'warehouse-request',
        from: { type: 'worker', userId: 'ray-torres' },
        to: { type: 'worker', userId: 'avery-cole' },
      },
      null,
    ],
  ] as const)('classifies %j as %s', (handoff, expected) => {
    expect(classifyWarehouseQueueItem(handoff)).toBe(expected);
  });
});
