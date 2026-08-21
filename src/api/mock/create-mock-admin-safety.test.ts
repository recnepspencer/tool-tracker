import { describe, expect, it } from 'vitest';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('admin lifecycle command safety', () => {
  it('rejects repeated access and warehouse commands as no-ops', async () => {
    const database = createMockDatabase();
    const api = createMockApi(database);
    await expect(
      api.admin.setPersonAccess!({ actorId: 'sam-ochoa', personId: 'taylor-nguyen', access: 'suspended' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.updateWarehouse!({
        actorId: 'sam-ochoa',
        warehouseId: 'north-yard',
        name: 'North Yard',
        address: '1420 Kerr Ave',
        managerId: 'sam-ochoa',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('blocks self changes, final-admin loss, assigned-manager deactivation, and holder role changes', async () => {
    const api = createMockApi();
    await expect(
      api.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', role: 'worker' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.setPersonAccess!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', access: 'suspended' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      api.admin.removePerson!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', reason: 'Leaving' }),
    ).rejects.toMatchObject({ code: 'conflict' });

    const finalAdminDatabase = createMockDatabase();
    finalAdminDatabase.update((state) => ({ ...state, demoProfileIds: ['ray-torres'] }));
    const finalAdminApi = createMockApi(finalAdminDatabase);
    await expect(
      finalAdminApi.admin.setPersonAccess!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', access: 'suspended' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      finalAdminApi.admin.removePerson!({ actorId: 'sam-ochoa', personId: 'sam-ochoa', reason: 'Leaving' }),
    ).rejects.toMatchObject({ code: 'conflict' });

    const managerDatabase = createMockDatabase();
    managerDatabase.update((state) => ({
      ...state,
      warehouses: state.warehouses.map((warehouse) =>
        warehouse.id === 'south-shop' ? { ...warehouse, managerId: 'morgan-price' } : warehouse,
      ),
    }));
    const managerApi = createMockApi(managerDatabase);
    await expect(
      managerApi.admin.setPersonAccess!({ actorId: 'sam-ochoa', personId: 'morgan-price', access: 'suspended' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      managerApi.admin.removePerson!({ actorId: 'sam-ochoa', personId: 'morgan-price', reason: 'Leaving' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(
      managerApi.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'morgan-price', role: 'worker' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(managerDatabase.read().users.find((person) => person.id === 'morgan-price')).toMatchObject({
      role: 'warehouse-manager',
    });
    expect(managerDatabase.read().warehouses.find((warehouse) => warehouse.id === 'south-shop')).toMatchObject({
      managerId: 'morgan-price',
    });

    const holderDatabase = createMockDatabase();
    holderDatabase.update((state) => ({
      ...state,
      custody: state.custody.map((record) =>
        record.toolUnitId === 'TL-115' ? { ...record, holder: { type: 'worker', userId: 'avery-cole' } } : record,
      ),
    }));
    const holderApi = createMockApi(holderDatabase);
    await expect(
      holderApi.admin.updatePersonRole!({ actorId: 'sam-ochoa', personId: 'avery-cole', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});
