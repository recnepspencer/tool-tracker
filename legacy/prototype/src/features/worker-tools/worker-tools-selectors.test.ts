import { describe, expect, it } from 'vitest';
import type { ToolView } from '../../domain/read-models/tools';
import {
  availableWarehouseCount,
  toolsAvailableNow,
  toolsHeldBy,
  toolsNeedingAttention,
} from './worker-tools-selectors';

const tool = (id: string, status: ToolView['status'], holder: ToolView['holder']): ToolView => ({
  id,
  revision: 1,
  name: 'Tool',
  brand: 'Brand',
  model: 'Model',
  category: 'Category',
  imageSrc: './tool-images/tool.png',
  status,
  holder,
  lastMoved: 'Today',
  lastMovedAt: '2026-08-17T15:00:00Z',
});

describe('worker tool selectors', () => {
  const tools = [
    tool('TL-1', 'checked-out', { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' }),
    tool('TL-2', 'lost', { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' }),
    tool('TL-5', 'damaged', { type: 'worker', userId: 'ray-torres', name: 'Ray Torres' }),
    tool('TL-3', 'in-stock', { type: 'warehouse', warehouseId: 'north-yard', name: 'North Yard' }),
    tool('TL-4', 'in-stock', { type: 'warehouse', warehouseId: 'south-shop', name: 'South Shop' }),
  ];

  it('derives custody and attention from status and holder facts', () => {
    expect(toolsHeldBy(tools, 'ray-torres').map((item) => item.id)).toEqual(['TL-1', 'TL-2', 'TL-5']);
    expect(toolsNeedingAttention(tools).map((item) => item.id)).toEqual(['TL-2', 'TL-5']);
    expect(toolsAvailableNow(tools).map((item) => item.id)).toEqual(['TL-3', 'TL-4']);
    expect(availableWarehouseCount(tools)).toBe(2);
  });
});
