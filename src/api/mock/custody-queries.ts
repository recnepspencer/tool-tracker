import { canStartTransfer, sameHolder } from '../../domain/custody-policy';
import type { HolderRef } from '../../domain/custody';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabase } from './mock-database';
import { custodyOrThrow, pendingForUnit } from './custody-record-state';
import { userOrThrow } from './actor-state';
import { unitOrThrow } from './tool-state';
import { toHolderView } from './mock-holder-projection';
import { isActiveMember } from '../../domain/people';

export const listTransferTargets = (database: MockDatabase, actorId: string, toolUnitId: string) => {
  const state = database.read();
  const actor = userOrThrow(state, actorId);
  if (actor.role !== 'worker' || !isActiveMember(actor)) {
    throw new WorkflowError('forbidden', 'Only workers can select transfer targets; actor must be active');
  }
  const unit = unitOrThrow(state, toolUnitId);
  const custody = custodyOrThrow(state, toolUnitId);
  if (pendingForUnit(state, toolUnitId)) return [];
  if (!canStartTransfer(unit, custody, actor.id, { type: 'warehouse', warehouseId: state.warehouses[0]?.id ?? '' }))
    return [];
  const userNames = new Map(state.users.map((user) => [user.id, user.name]));
  const warehouseNames = new Map(state.warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  const targets: HolderRef[] = [
    ...state.warehouses.map((warehouse) => ({ type: 'warehouse' as const, warehouseId: warehouse.id })),
    ...state.users
      .filter((user) => user.id !== actor.id && user.role === 'worker' && isActiveMember(user))
      .map((user) => ({ type: 'worker' as const, userId: user.id })),
  ];
  return targets
    .filter((target) => !sameHolder(target, custody.holder))
    .filter((target) => unit.condition !== 'damaged' || target.type === 'warehouse')
    .map((target) => toHolderView(target, userNames, warehouseNames));
};
