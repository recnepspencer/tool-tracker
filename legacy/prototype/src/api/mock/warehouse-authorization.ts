import { isActiveMember, isAdminMember } from '../../domain/people';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabaseState, SeedSnapshot } from './seed-state';

export const requireWarehouseActor = (
  state: MockDatabaseState | SeedSnapshot,
  actorId: string,
  warehouseId?: string,
) => {
  const actor = state.users.find((candidate) => candidate.id === actorId);
  if (!actor || !isActiveMember(actor) || (actor.role !== 'admin' && actor.role !== 'warehouse-manager')) {
    throw new WorkflowError('forbidden', 'An active warehouse operator is required');
  }
  const allowedWarehouseIds = isAdminMember(actor)
    ? state.warehouses.map((warehouse) => warehouse.id)
    : state.warehouses.filter((warehouse) => warehouse.managerId === actor.id).map((warehouse) => warehouse.id);
  if (warehouseId !== undefined && !allowedWarehouseIds.includes(warehouseId)) {
    throw new WorkflowError('forbidden', 'This operator cannot manage that warehouse');
  }
  return { actor, allowedWarehouseIds };
};

export const ensureWarehouseScope = (allowedWarehouseIds: readonly string[], warehouseId: string) => {
  if (!allowedWarehouseIds.includes(warehouseId)) {
    throw new WorkflowError('forbidden', 'This operator cannot manage that warehouse');
  }
};
