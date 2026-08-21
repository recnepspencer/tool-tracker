import type { CustodyRecord, HandoffAction, HandoffRequest, HolderRef } from './custody';
import type { MemberRole } from './people';
import { evaluateConditionReportPolicy } from './condition-policy';
import type { ToolCondition, ToolLifecycle } from './tool';

export const sameHolder = (left: HolderRef, right: HolderRef): boolean => {
  if (left.type === 'worker' && right.type === 'worker') return left.userId === right.userId;
  if (left.type === 'warehouse' && right.type === 'warehouse') return left.warehouseId === right.warehouseId;
  return false;
};

export const isWorker = (holder: HolderRef, profileId: string) =>
  holder.type === 'worker' && holder.userId === profileId;

export const canRequestWarehouseTool = (
  unit: { lifecycle: ToolLifecycle; condition: ToolCondition },
  custody: CustodyRecord,
  actorId: string,
) =>
  unit.lifecycle === 'active' &&
  unit.condition === 'serviceable' &&
  custody.holder.type === 'warehouse' &&
  actorId.trim().length > 0;

export const canStartTransfer = (
  unit: { lifecycle: ToolLifecycle; condition: ToolCondition },
  custody: CustodyRecord,
  actorId: string,
  target: HolderRef,
) => {
  if (unit.lifecycle !== 'active' || !isWorker(custody.holder, actorId) || sameHolder(custody.holder, target))
    return false;
  if (unit.condition === 'serviceable') return true;
  return unit.condition === 'damaged' && target.type === 'warehouse';
};

export interface WorkerCustodyActionInput {
  actorRole: MemberRole | null;
  actorId: string | null;
  lifecycle: ToolLifecycle;
  condition: ToolCondition;
  status: 'in-stock' | 'checked-out' | 'damaged' | 'lost';
  holder: HolderRef;
}

/** Read-side affordance policy mirrors the command guards and closes archived/role-invalid actions. */
export const workerCustodyActionPolicy = ({
  actorRole,
  actorId,
  lifecycle,
  condition,
  status,
  holder,
}: WorkerCustodyActionInput) => {
  const worker = actorRole === 'worker' && Boolean(actorId);
  const currentWorker = worker && holder.type === 'worker' && holder.userId === actorId;
  const conditionPolicy = evaluateConditionReportPolicy({
    actorRole,
    actorId,
    lifecycle,
    holder,
    currentCondition: condition,
  });
  return {
    canRequest:
      worker &&
      lifecycle === 'active' &&
      condition === 'serviceable' &&
      status === 'in-stock' &&
      holder.type === 'warehouse',
    canTransfer: currentWorker && lifecycle === 'active' && status !== 'lost',
    canReportCondition: conditionPolicy.allowed,
  };
};

export const canAcceptTransfer = (handoff: HandoffRequest, actorId: string) =>
  handoff.status === 'pending' && handoff.kind === 'transfer' && isWorker(handoff.to, actorId);

export const canDeclineTransfer = canAcceptTransfer;

export const canCancelTransfer = (handoff: HandoffRequest, actorId: string) =>
  handoff.status === 'pending' && handoff.kind === 'transfer' && isWorker(handoff.from, actorId);

export const canWithdrawRequest = (handoff: HandoffRequest, actorId: string) =>
  handoff.status === 'pending' && handoff.kind === 'warehouse-request' && handoff.requestedBy === actorId;

type PendingHandoffPolicyInput = Pick<HandoffRequest, 'kind' | 'from' | 'to' | 'requestedBy' | 'status'>;

export const canSeePendingHandoff = (handoff: PendingHandoffPolicyInput, profileId: string) =>
  handoff.status === 'pending' &&
  (handoff.requestedBy === profileId || isWorker(handoff.to, profileId) || isWorker(handoff.from, profileId));

export const pendingHandoffDirection = (handoff: PendingHandoffPolicyInput, profileId: string) =>
  handoff.kind === 'transfer' && isWorker(handoff.to, profileId) ? 'incoming' : 'outgoing';

export const pendingHandoffActions = (handoff: PendingHandoffPolicyInput, profileId: string): HandoffAction[] => {
  if (handoff.kind === 'transfer' && isWorker(handoff.to, profileId)) return ['accept', 'decline'];
  if (handoff.kind === 'transfer' && isWorker(handoff.from, profileId)) return ['cancel'];
  if (handoff.kind === 'warehouse-request' && handoff.requestedBy === profileId) return ['withdraw'];
  return [];
};
