import type { ReportConditionInput, CustodyMutationResult } from '../contracts/custody-api';
import type { ConditionReport } from '../../domain/condition-report';
import { evaluateConditionReportPolicy, type ConditionReportDenial } from '../../domain/condition-policy';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { appendAuditEvent } from './audit-events';
import { toCustodyMutationResult } from './mutation-results';
import { userOrThrow } from './actor-state';
import { custodyOrThrow } from './custody-record-state';
import { warehouseFor } from './holder-state';
import { toolName, unitOrThrow } from './tool-state';
import { isActiveMember } from '../../domain/people';
import { bumpToolRevision } from '../../domain/tool';

const conditionPolicyError = (reason: ConditionReportDenial, unitId: string) => {
  if (reason === 'archived') throw new WorkflowError('archived', 'Tool unit is archived: ' + unitId);
  if (reason === 'worker-only') throw new WorkflowError('forbidden', 'Only a worker can report a condition');
  if (reason === 'current-holder-only') {
    throw new WorkflowError('forbidden', 'Only the current worker holder can report a condition');
  }
  throw new WorkflowError('conflict', 'This condition has already been reported');
};

const authorizeConditionReport = (state: MockDatabaseState, input: ReportConditionInput) => {
  const actor = userOrThrow(state, input.actorId);
  const unit = unitOrThrow(state, input.toolUnitId);
  const custody = custodyOrThrow(state, input.toolUnitId);
  if (!isActiveMember(actor)) throw new WorkflowError('forbidden', 'Only active workers can report a condition');
  const policy = evaluateConditionReportPolicy({
    actorRole: actor.role,
    actorId: actor.id,
    lifecycle: unit.lifecycle,
    holder: custody.holder,
    currentCondition: unit.condition,
  });
  if (!policy.allowed) conditionPolicyError(policy.reason, unit.id);
  return { actor, unit, custody };
};

const cancelPendingHandoffs = (
  state: MockDatabaseState,
  toolUnitId: string,
  actorId: string,
  occurredAt: string,
  evidence: ConditionReport['evidence'],
) => {
  state.handoffs.forEach((handoff) => {
    if (handoff.toolUnitId === toolUnitId && handoff.status === 'pending') {
      handoff.status = 'cancelled';
      handoff.resolvedBy = actorId;
      handoff.resolvedAt = occurredAt;
      if (evidence) handoff.resolutionEvidence = evidence;
    }
  });
};

export const reportToolCondition = (database: MockDatabase, input: ReportConditionInput): CustodyMutationResult => {
  const occurredAt = database.clock();
  let mutation: CustodyMutationResult | undefined;
  database.update((state) => {
    const { actor, unit, custody } = authorizeConditionReport(state, input);
    const evidence = normalizeCustodyEvidence(input.evidence);
    unit.condition = input.condition;
    const definition = state.definitions.find((candidate) => candidate.id === unit.definitionId);
    bumpToolRevision(unit, definition);
    const report: ConditionReport = {
      id: database.nextId('CR'),
      toolUnitId: unit.id,
      reporterId: actor.id,
      condition: input.condition,
      reportedAt: occurredAt,
      ...(evidence ? { evidence } : {}),
    };
    state.conditionReports.push(report);
    cancelPendingHandoffs(state, unit.id, actor.id, occurredAt, evidence);
    const warehouseId = warehouseFor(state, custody.holder, unit.id);
    const eventId = appendAuditEvent(state, database, {
      actorId: actor.id,
      action: `Reported ${toolName(state, unit.id)} ${input.condition}`,
      toolUnitId: unit.id,
      kind: 'flag',
      scope: 'damage',
      participantIds: [actor.id],
      warehouseId: warehouseId!,
      occurredAt,
      evidence,
    });
    mutation = toCustodyMutationResult(unit.id, eventId, 'reported');
    return state;
  });
  return mutation!;
};
