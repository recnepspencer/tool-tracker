import { describe, expect, it } from 'vitest';
import type { AuthSession } from '../../domain/auth';
import { createMockApi } from './create-mock-api';
import { createMockDatabase } from './mock-database';

describe('createMockApi auth projections', () => {
  it('projects complete Ray and Sam identities and restores both sessions', async () => {
    const api = createMockApi();
    const profiles = await api.auth.listDemoProfiles();
    expect(profiles).toEqual([
      {
        id: 'ray-torres',
        name: 'Ray Torres',
        email: 'ray@nelsonelectric.com',
        role: 'worker',
        title: 'Journeyman electrician',
        homeWarehouseId: 'north-yard',
        homeWarehouse: 'North Yard',
      },
      {
        id: 'sam-ochoa',
        name: 'Sam Ochoa',
        email: 'sam@nelsonelectric.com',
        role: 'admin',
        title: 'Administrator',
        homeWarehouseId: 'north-yard',
        homeWarehouse: 'North Yard',
      },
    ]);
    const expected: AuthSession[] = [
      {
        profileId: 'ray-torres',
        name: 'Ray Torres',
        email: 'ray@nelsonelectric.com',
        role: 'worker',
        title: 'Journeyman electrician',
        homeWarehouseId: 'north-yard',
        homeWarehouse: 'North Yard',
      },
      {
        profileId: 'sam-ochoa',
        name: 'Sam Ochoa',
        email: 'sam@nelsonelectric.com',
        role: 'admin',
        title: 'Administrator',
        homeWarehouseId: 'north-yard',
        homeWarehouse: 'North Yard',
      },
    ];
    await expect(api.auth.signInAs('ray-torres')).resolves.toEqual(expected[0]);
    await expect(api.auth.signInAs('sam-ochoa')).resolves.toEqual(expected[1]);
    await expect(api.auth.restoreSession('ray-torres')).resolves.toEqual(expected[0]);
    await expect(api.auth.restoreSession('sam-ochoa')).resolves.toEqual(expected[1]);
  });

  it('rejects unknown and ordinary users from demo authentication', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      users: [
        ...state.users,
        {
          id: 'jordan-lee',
          name: 'Jordan Lee',
          email: 'jordan@nelsonelectric.com',
          role: 'worker',
          lifecycle: 'active',
          title: 'Apprentice electrician',
          homeWarehouseId: 'north-yard',
        },
      ],
    }));
    const api = createMockApi(database);
    expect((await api.auth.listDemoProfiles()).map((profile) => profile.id)).toEqual(['ray-torres', 'sam-ochoa']);
    await expect(api.auth.signInAs('unknown')).rejects.toThrow('not available');
    await expect(api.auth.signInAs('jordan-lee')).rejects.toThrow('not available');
    await expect(api.auth.restoreSession('jordan-lee')).resolves.toBeNull();
  });

  it('keeps authenticated profile projections connected to warehouse identity', async () => {
    const database = createMockDatabase();
    database.update((state) => ({
      ...state,
      warehouses: state.warehouses.map((warehouse) =>
        warehouse.id === 'north-yard' ? { ...warehouse, name: 'North Operations' } : warehouse,
      ),
    }));
    const api = createMockApi(database);
    expect((await api.auth.listDemoProfiles())[0].homeWarehouse).toBe('North Operations');
  });
});
