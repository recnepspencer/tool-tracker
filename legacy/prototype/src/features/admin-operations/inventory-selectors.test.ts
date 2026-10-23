import { describe, expect, it } from 'vitest';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';
import { countInventoryFilter, filterInventoryItems, groupInventoryItems } from './inventory-selectors';

const item = (
  id: string,
  status: WarehouseInventoryItemView['status'],
  lifecycle: WarehouseInventoryItemView['lifecycle'],
): WarehouseInventoryItemView => ({
  toolUnitId: id,
  revision: 1,
  toolName: id === 'TL-1' ? 'Bandsaw' : 'Cable cutter',
  brand: 'Brand',
  model: 'Model',
  categoryId: 'category-power-tools',
  category: 'Power tools',
  imageSrc: './tool-images/tool.png',
  warehouseId: 'north-yard',
  warehouseName: 'North Yard',
  status,
  condition: status === 'damaged' ? 'damaged' : status === 'lost' ? 'lost' : 'serviceable',
  lifecycle,
  holder: { type: 'warehouse', warehouseId: 'north-yard', name: 'North Yard' },
  lastMoved: 'Today',
  lastMovedAt: '2026-08-20T09:00:00-06:00',
});

describe('inventory selectors', () => {
  const items = [
    item('TL-1', 'damaged', 'active'),
    item('TL-2', 'in-stock', 'active'),
    item('TL-3', 'lost', 'archived'),
  ];

  it('keeps lifecycle and flagged policy consistent for rows and counts', () => {
    expect(filterInventoryItems(items, 'flagged').map((row) => row.toolUnitId)).toEqual(['TL-1']);
    expect(filterInventoryItems(items, 'archived').map((row) => row.toolUnitId)).toEqual(['TL-3']);
    expect(countInventoryFilter(items, 'all')).toBe(2);
    expect(countInventoryFilter(items, 'flagged')).toBe(1);
    expect(countInventoryFilter(items, 'archived')).toBe(1);
    expect(filterInventoryItems(items, 'all', 'bandsaw').map((row) => row.toolUnitId)).toEqual(['TL-1']);
  });

  it('keeps individual units nested under their shared definition', () => {
    const first = item('TL-1', 'in-stock', 'active');
    const second = { ...item('TL-2', 'checked-out', 'active'), toolName: first.toolName };
    const groups = groupInventoryItems([first, second, item('TL-3', 'in-stock', 'active')]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.items.map(({ toolUnitId }) => toolUnitId)).toEqual(['TL-1', 'TL-2']);
  });
});
