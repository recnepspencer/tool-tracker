import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi catalog projections', () => {
  it('projects two active units from one definition independently', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: [
        ...state.units,
        {
          id: 'TL-201',
          definitionId: 'def-hammer-drill',
          condition: 'serviceable',
          lifecycle: 'active',
          originWarehouseId: 'north-yard',
          assignedWarehouseId: 'north-yard',
        },
      ],
      custody: [
        ...state.custody,
        {
          toolUnitId: 'TL-201',
          holder: { type: 'warehouse', warehouseId: 'north-yard' },
          sinceAt: '2026-08-17T10:00:00-06:00',
        },
      ],
    }));
    const api = createMockApi(database);
    expect((await api.tools.listTools()).filter((tool) => tool.name === 'Hammer drill')).toHaveLength(5);
    const hammerCatalog = (await api.tools.listCatalog()).find((item) => item.id === 'def-hammer-drill');
    expect(hammerCatalog?.units).toEqual([
      { id: 'TL-101', warehouseId: 'north-yard', status: 'checked-out' },
      { id: 'TL-103', warehouseId: 'north-yard', status: 'checked-out' },
      { id: 'TL-117', warehouseId: 'south-shop', status: 'in-stock' },
      { id: 'TL-118', warehouseId: 'riverside-depot', status: 'in-stock' },
      { id: 'TL-201', warehouseId: 'north-yard', status: 'in-stock' },
    ]);
    await expect(api.tools.getToolDetail('TL-201')).resolves.toMatchObject({
      tool: { id: 'TL-201', holder: { type: 'warehouse', warehouseId: 'north-yard' } },
    });
    expect((await api.admin.getSummary({ actorId: 'sam-ochoa' })).totalTools).toBe(19);
  });

  it('derives mixed catalog status aggregates from every projected unit', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      units: [
        ...state.units,
        {
          id: 'TL-201',
          definitionId: 'def-hammer-drill',
          condition: 'serviceable',
          lifecycle: 'active',
          originWarehouseId: 'north-yard',
          assignedWarehouseId: 'north-yard',
        },
        {
          id: 'TL-202',
          definitionId: 'def-hammer-drill',
          condition: 'serviceable',
          lifecycle: 'active',
          originWarehouseId: 'north-yard',
          assignedWarehouseId: 'north-yard',
        },
        {
          id: 'TL-203',
          definitionId: 'def-hammer-drill',
          condition: 'damaged',
          lifecycle: 'active',
          originWarehouseId: 'south-shop',
          assignedWarehouseId: 'south-shop',
        },
        {
          id: 'TL-204',
          definitionId: 'def-hammer-drill',
          condition: 'lost',
          lifecycle: 'active',
          originWarehouseId: 'south-shop',
          assignedWarehouseId: 'south-shop',
        },
      ],
      custody: [
        ...state.custody,
        {
          toolUnitId: 'TL-201',
          holder: { type: 'warehouse', warehouseId: 'north-yard' },
          sinceAt: '2026-08-17T10:00:00-06:00',
        },
        {
          toolUnitId: 'TL-202',
          holder: { type: 'worker', userId: 'ray-torres' },
          sinceAt: '2026-08-17T11:00:00-06:00',
        },
        {
          toolUnitId: 'TL-203',
          holder: { type: 'warehouse', warehouseId: 'south-shop' },
          sinceAt: '2026-08-17T12:00:00-06:00',
        },
        {
          toolUnitId: 'TL-204',
          holder: { type: 'warehouse', warehouseId: 'south-shop' },
          sinceAt: '2026-08-17T13:00:00-06:00',
        },
      ],
    }));
    const item = (await createMockApi(database).tools.listCatalog()).find(
      (candidate) => candidate.id === 'def-hammer-drill',
    );
    expect(item).toMatchObject({
      totalCount: 8,
      availableCount: 3,
      checkedOutCount: 3,
      damagedCount: 1,
      lostCount: 1,
      units: [
        { id: 'TL-101', status: 'checked-out' },
        { id: 'TL-103', status: 'checked-out' },
        { id: 'TL-117', status: 'in-stock' },
        { id: 'TL-118', status: 'in-stock' },
        { id: 'TL-201', status: 'in-stock' },
        { id: 'TL-202', status: 'checked-out' },
        { id: 'TL-203', status: 'damaged' },
        { id: 'TL-204', status: 'lost' },
      ],
    });
  });
});
