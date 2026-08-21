import type { HolderRef } from '../../domain/custody';
import type { SeedSnapshot } from './seed-state';
import { isActiveMember } from '../../domain/people';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';

export const holderExists = (state: SeedSnapshot, holder: HolderRef) =>
  holder.type === 'worker'
    ? state.users.some((user) => user.id === holder.userId && user.role === 'worker' && isActiveMember(user))
    : state.warehouses.some((warehouse) => warehouse.id === holder.warehouseId);

export const warehouseFor = (state: SeedSnapshot, holder: HolderRef, toolUnitId: string) => {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  if (!unit) throw new Error('Tool unit not found: ' + toolUnitId);
  return currentWarehouseForUnit(unit, holder);
};
