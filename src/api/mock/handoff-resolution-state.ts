import type { CustodyRecord, HandoffRequest } from '../../domain/custody';
import { sameHolder } from '../../domain/custody-policy';
import type { CustodyEvidence } from '../../domain/evidence';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabaseState } from './seed-state';

export type HandoffResolutionDecision = 'accepted' | 'declined' | 'cancelled' | 'withdrawn';

export interface PendingHandoffResolution {
  handoff: HandoffRequest;
  custody: CustodyRecord;
}

export const assertPendingHandoff = (
  state: MockDatabaseState,
  handoffId: string,
  toolUnitId: string,
): PendingHandoffResolution => {
  const handoff = state.handoffs.find((candidate) => candidate.id === handoffId);
  if (!handoff) throw new WorkflowError('not-found', 'Handoff not found: ' + handoffId);
  if (handoff.status !== 'pending') throw new WorkflowError('conflict', 'This handoff is already resolved');
  if (handoff.toolUnitId !== toolUnitId) {
    throw new WorkflowError('conflict', 'Handoff tool does not match the requested unit');
  }
  const custody = state.custody.find((record) => record.toolUnitId === toolUnitId);
  if (!custody || !sameHolder(custody.holder, handoff.from)) {
    throw new WorkflowError('conflict', 'Tool custody changed before this decision');
  }
  return { handoff, custody };
};

export const applyHandoffResolution = (
  resolution: PendingHandoffResolution,
  actorId: string,
  decision: HandoffResolutionDecision,
  occurredAt: string,
  evidence?: CustodyEvidence,
) => {
  const { handoff, custody } = resolution;
  handoff.status = decision;
  handoff.resolvedBy = actorId;
  handoff.resolvedAt = occurredAt;
  if (evidence) handoff.resolutionEvidence = evidence;
  if (decision === 'accepted') {
    custody.holder = { ...handoff.to };
    custody.sinceAt = occurredAt;
  }
};
