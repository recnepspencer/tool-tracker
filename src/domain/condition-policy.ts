import type { MemberRole } from './people';
import type { HolderRef } from './custody';
import type { ToolCondition, ToolLifecycle } from './tool';

export type ConditionReportDenial = 'archived' | 'worker-only' | 'current-holder-only' | 'already-reported';

export interface ConditionReportPolicyInput {
  actorRole: MemberRole | null;
  actorId: string | null;
  lifecycle: ToolLifecycle;
  holder: HolderRef;
  currentCondition: ToolCondition;
}

export type ConditionReportPolicy = { allowed: true } | { allowed: false; reason: ConditionReportDenial };

/** One domain policy for both command authorization and read-side action affordances. */
export const evaluateConditionReportPolicy = ({
  actorRole,
  actorId,
  lifecycle,
  holder,
  currentCondition,
}: ConditionReportPolicyInput): ConditionReportPolicy => {
  if (lifecycle !== 'active') return { allowed: false, reason: 'archived' };
  if (actorRole !== 'worker') return { allowed: false, reason: 'worker-only' };
  if (holder.type !== 'worker' || holder.userId !== actorId) {
    return { allowed: false, reason: 'current-holder-only' };
  }
  if (currentCondition !== 'serviceable') return { allowed: false, reason: 'already-reported' };
  return { allowed: true };
};
