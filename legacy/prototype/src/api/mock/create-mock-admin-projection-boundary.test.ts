import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('admin long-held projection boundaries', () => {
  it('includes the exact threshold and equivalent offset, with deterministic ID ties', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
    database.update((state) => ({
      ...state,
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-114'
          ? { ...record, holder: { type: 'worker', userId: 'avery-cole' }, sinceAt: '2026-08-11T06:00:00-06:00' }
          : record.toolUnitId === 'TL-115'
            ? { ...record, holder: { type: 'worker', userId: 'avery-cole' }, sinceAt: '2026-08-11T12:00:00Z' }
            : record,
      ),
    }));
    const ids = (await createMockApi(database).admin.getSummary({ actorId: 'sam-ochoa' })).longHeldTools.map(
      (tool) => tool.toolUnitId,
    );
    expect(ids.filter((id) => id === 'TL-114' || id === 'TL-115')).toEqual(['TL-114', 'TL-115']);
  });

  it('excludes future and warehouse-held custody from long-held review', async () => {
    const database = createMockDatabase({ clock: () => '2026-08-18T12:00:00Z' });
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-115' ? { ...unit, assignedWarehouseId: 'south-shop' } : unit)),
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-114'
          ? { ...record, holder: { type: 'worker', userId: 'avery-cole' }, sinceAt: '2026-08-19T12:00:00Z' }
          : record.toolUnitId === 'TL-115'
            ? { ...record, holder: { type: 'warehouse', warehouseId: 'south-shop' }, sinceAt: '2026-08-01T12:00:00Z' }
            : record,
      ),
    }));
    const ids = (await createMockApi(database).admin.getSummary({ actorId: 'sam-ochoa' })).longHeldTools.map(
      (tool) => tool.toolUnitId,
    );
    expect(ids).not.toEqual(expect.arrayContaining(['TL-114', 'TL-115']));
  });

  it('uses the current assigned warehouse for worker-held admin detail', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: state.units.map((unit) => (unit.id === 'TL-115' ? { ...unit, assignedWarehouseId: 'south-shop' } : unit)),
    }));

    const detail = await createMockApi(database).admin.getPerson({ actorId: 'sam-ochoa', personId: 'ray-torres' });
    expect(detail.heldTools.find((tool) => tool.toolUnitId === 'TL-115')).toMatchObject({
      warehouseId: 'south-shop',
      warehouseName: 'South Shop',
    });
  });
});
