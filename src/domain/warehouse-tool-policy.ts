import type { HolderRef } from './custody';
import type { ToolCondition, ToolLifecycle, ToolStatus } from './tool';

export interface WarehouseToolDecisionPolicyInput {
  lifecycle: ToolLifecycle;
  condition: ToolCondition;
  status: ToolStatus;
  holder: HolderRef;
}

export interface WarehouseToolDecisionPolicy {
  canEdit: boolean;
  canFlag: boolean;
  canRestore: boolean;
  canForceReturn: boolean;
  canDecommission: boolean;
}

/** One read-side affordance policy; command authorities re-check it transactionally. */
export const warehouseToolDecisionPolicy = ({
  lifecycle,
  condition,
  status,
  holder,
}: WarehouseToolDecisionPolicyInput): WarehouseToolDecisionPolicy => {
  const active = lifecycle === 'active';
  const flagged = condition !== 'serviceable' || status === 'damaged' || status === 'lost';
  const warehouseHeld = holder.type === 'warehouse';
  const workerHeld = holder.type === 'worker';
  return {
    canEdit: active,
    canFlag: active && condition === 'serviceable' && status !== 'damaged' && status !== 'lost',
    canRestore: active && flagged && warehouseHeld,
    canForceReturn: active && flagged && workerHeld,
    canDecommission: active && warehouseHeld,
  };
};
