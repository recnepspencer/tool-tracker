import type { AuthApi } from '../contracts/auth-api';
import { canAuthenticate } from '../../domain/people';
import { toProfileView, toSession } from './mock-auth-projections';
import type { MockDatabase } from './mock-database';

export const createMockAuthApi = (database: MockDatabase): AuthApi => ({
  listDemoProfiles: async () => {
    const state = database.read();
    const demoProfileIds = new Set(state.demoProfileIds);
    const warehouseNames = new Map(state.warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
    return state.users
      .filter((user) => demoProfileIds.has(user.id))
      .filter(canAuthenticate)
      .map((user) => toProfileView(user, warehouseNames.get(user.homeWarehouseId) ?? 'Unassigned'));
  },
  signInAs: async (profileId) => {
    const state = database.read();
    const user = state.demoProfileIds.includes(profileId)
      ? state.users.find((candidate) => candidate.id === profileId)
      : undefined;
    if (!user || !canAuthenticate(user)) throw new Error('That profile is not available.');
    const warehouse = state.warehouses.find((candidate) => candidate.id === user.homeWarehouseId);
    return toSession(user, warehouse?.name ?? 'Unassigned');
  },
  restoreSession: async (profileId) => {
    const state = database.read();
    const user = state.demoProfileIds.includes(profileId)
      ? state.users.find((candidate) => candidate.id === profileId)
      : undefined;
    if (!user || !canAuthenticate(user)) return null;
    const warehouse = state.warehouses.find((candidate) => candidate.id === user.homeWarehouseId);
    return toSession(user, warehouse?.name ?? 'Unassigned');
  },
  signOut: async () => undefined,
});
