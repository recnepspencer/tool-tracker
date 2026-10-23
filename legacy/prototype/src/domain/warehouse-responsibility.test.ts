import { describe, expect, it } from 'vitest';
import { currentWarehouseForUnit } from './warehouse-responsibility';

describe('warehouse responsibility policy', () => {
  it('uses an explicit warehouse holder while a unit is in warehouse custody', () => {
    expect(
      currentWarehouseForUnit({ assignedWarehouseId: 'north-yard' }, { type: 'warehouse', warehouseId: 'south-shop' }),
    ).toBe('south-shop');
  });

  it('uses the assigned warehouse for worker custody and missing custody', () => {
    expect(
      currentWarehouseForUnit({ assignedWarehouseId: 'north-yard' }, { type: 'worker', userId: 'ray-torres' }),
    ).toBe('north-yard');
    expect(currentWarehouseForUnit({ assignedWarehouseId: 'north-yard' })).toBe('north-yard');
  });
});
