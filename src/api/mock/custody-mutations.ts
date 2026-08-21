import type {
  CustodyMutationResult,
  HandoffReviewInput,
  RequestToolInput,
  StartTransferInput,
} from '../contracts/custody-api';
import {
  canAcceptTransfer,
  canCancelTransfer,
  canDeclineTransfer,
  canRequestWarehouseTool,
  canStartTransfer,
  canWithdrawRequest,
} from '../../domain/custody-policy';
import type { HandoffRequest } from '../../domain/custody';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { custodyOrThrow, pendingForUnit } from './custody-record-state';
import { userOrThrow } from './actor-state';
import { holderExists, warehouseFor } from './holder-state';
import { toolName, unitOrThrow } from './tool-state';
import { appendAuditEvent } from './audit-events';
import { toCustodyMutationResult } from './mutation-results';
import { isActiveMember } from '../../domain/people';
import { bumpToolRevision } from '../../domain/tool';
import { applyHandoffResolution, assertPendingHandoff } from './handoff-resolution-state';

const ensureNoPending = (state: MockDatabaseState, toolUnitId: string) => {
  if (pendingForUnit(state, toolUnitId))
    throw new WorkflowError('conflict', 'A handoff is already pending for this tool');
};

const workerActorOrThrow = (
  state: MockDatabaseState,
  actorId: string,
  action: 'request tools' | 'start transfers' | 'resolve handoffs',
) => {
  const actor = userOrThrow(state, actorId);
  if (actor.role !== 'worker' || !isActiveMember(actor)) {
    throw new WorkflowError('forbidden', 'Only workers can ' + action + '; actor must be active');
  }
  return actor;
};

const buildWarehouseRequest = (
  database: MockDatabase,
  input: RequestToolInput,
  actorId: string,
  holder: HandoffRequest['from'],
  occurredAt: string,
): HandoffRequest => ({
  id: database.nextId('HO'),
  kind: 'warehouse-request',
  toolUnitId: input.toolUnitId,
  from: { ...holder },
  to: { type: 'worker', userId: actorId },
  requestedBy: actorId,
  requestedAt: occurredAt,
  status: 'pending',
  ...(normalizeCustodyEvidence(input.evidence) ? { evidence: normalizeCustodyEvidence(input.evidence) } : {}),
});

const buildTransferRequest = (
  database: MockDatabase,
  input: StartTransferInput,
  actorId: string,
  holder: HandoffRequest['from'],
  occurredAt: string,
): HandoffRequest => ({
  id: database.nextId('HO'),
  kind: 'transfer',
  toolUnitId: input.toolUnitId,
  from: { ...holder },
  to: { ...input.to },
  requestedBy: actorId,
  requestedAt: occurredAt,
  status: 'pending',
  ...(normalizeCustodyEvidence(input.evidence) ? { evidence: normalizeCustodyEvidence(input.evidence) } : {}),
});

const decisionAllowed = (
  handoff: HandoffRequest,
  actorId: string,
  decision: 'accepted' | 'declined' | 'cancelled' | 'withdrawn',
) =>
  decision === 'accepted'
    ? canAcceptTransfer(handoff, actorId)
    : decision === 'declined'
      ? canDeclineTransfer(handoff, actorId)
      : decision === 'cancelled'
        ? canCancelTransfer(handoff, actorId)
        : canWithdrawRequest(handoff, actorId);

const assertResolution = (
  state: MockDatabaseState,
  input: HandoffReviewInput,
  decision: 'accepted' | 'declined' | 'cancelled' | 'withdrawn',
) => {
  const actor = workerActorOrThrow(state, input.actorId, 'resolve handoffs');
  const candidate = state.handoffs.find((handoff) => handoff.id === input.handoffId);
  if (candidate && !decisionAllowed(candidate, actor.id, decision)) {
    throw new WorkflowError('forbidden', 'This handoff cannot be ' + decision);
  }
  const { handoff, custody } = assertPendingHandoff(state, input.handoffId, input.toolUnitId);
  unitOrThrow(state, handoff.toolUnitId);
  if (!decisionAllowed(handoff, actor.id, decision)) {
    throw new WorkflowError('forbidden', 'This handoff cannot be ' + decision);
  }
  if (decision === 'accepted' && (handoff.to.type !== 'worker' || !holderExists(state, handoff.to))) {
    throw new WorkflowError('forbidden', 'Only a worker can accept a transfer');
  }
  return { actor, handoff, custody };
};

export const requestTool = (database: MockDatabase, input: RequestToolInput): CustodyMutationResult => {
  const occurredAt = database.clock();
  let mutation: CustodyMutationResult | undefined;
  database.update((state) => {
    const actor = workerActorOrThrow(state, input.actorId, 'request tools');
    const unit = unitOrThrow(state, input.toolUnitId);
    const custody = custodyOrThrow(state, input.toolUnitId);
    ensureNoPending(state, input.toolUnitId);
    if (!canRequestWarehouseTool(unit, custody, actor.id) || custody.holder.type !== 'warehouse') {
      throw new WorkflowError('unavailable', 'Only serviceable warehouse stock can be requested');
    }
    const handoff = buildWarehouseRequest(database, input, actor.id, custody.holder, occurredAt);
    state.handoffs.push(handoff);
    const warehouseId = custody.holder.warehouseId;
    const eventId = appendAuditEvent(state, database, {
      actorId: actor.id,
      action: `Requested ${toolName(state, input.toolUnitId)} from ${state.warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? 'warehouse'}`,
      toolUnitId: input.toolUnitId,
      kind: 'request',
      scope: 'worker',
      participantIds: [actor.id],
      warehouseId,
      occurredAt,
      evidence: normalizeCustodyEvidence(input.evidence),
    });
    mutation = toCustodyMutationResult(input.toolUnitId, eventId, 'pending', handoff.id);
    return state;
  });
  return mutation!;
};

export const startTransfer = (database: MockDatabase, input: StartTransferInput): CustodyMutationResult => {
  const occurredAt = database.clock();
  let mutation: CustodyMutationResult | undefined;
  database.update((state) => {
    const actor = workerActorOrThrow(state, input.actorId, 'start transfers');
    const unit = unitOrThrow(state, input.toolUnitId);
    const custody = custodyOrThrow(state, input.toolUnitId);
    ensureNoPending(state, input.toolUnitId);
    if (!holderExists(state, input.to) || !canStartTransfer(unit, custody, actor.id, input.to)) {
      throw new WorkflowError('forbidden', 'This tool cannot be transferred to that destination');
    }
    const handoff = buildTransferRequest(database, input, actor.id, custody.holder, occurredAt);
    state.handoffs.push(handoff);
    const warehouseId = warehouseFor(state, custody.holder, input.toolUnitId);
    const eventId = appendAuditEvent(state, database, {
      actorId: actor.id,
      action: `Started a transfer of ${toolName(state, input.toolUnitId)}`,
      toolUnitId: input.toolUnitId,
      kind: 'custody',
      scope: 'worker',
      participantIds: [actor.id, ...(input.to.type === 'worker' ? [input.to.userId] : [])],
      warehouseId: warehouseId!,
      occurredAt,
      evidence: normalizeCustodyEvidence(input.evidence),
    });
    mutation = toCustodyMutationResult(input.toolUnitId, eventId, 'pending', handoff.id);
    return state;
  });
  return mutation!;
};

const resolveHandoff = (
  database: MockDatabase,
  input: HandoffReviewInput,
  decision: 'accepted' | 'declined' | 'cancelled' | 'withdrawn',
): CustodyMutationResult => {
  const occurredAt = database.clock();
  let mutation: CustodyMutationResult | undefined;
  database.update((state) => {
    const { actor, handoff, custody } = assertResolution(state, input, decision);
    const evidence = normalizeCustodyEvidence(input.evidence);
    applyHandoffResolution({ handoff, custody }, actor.id, decision, occurredAt, evidence);
    if (decision === 'accepted') {
      const unit = state.units.find((candidate) => candidate.id === handoff.toolUnitId);
      if (unit) {
        const definition = state.definitions.find((candidate) => candidate.id === unit.definitionId);
        bumpToolRevision(unit, definition);
      }
    }
    const warehouseId = warehouseFor(state, decision === 'accepted' ? handoff.to : custody.holder, handoff.toolUnitId);
    const eventId = appendAuditEvent(state, database, {
      actorId: actor.id,
      action: `${decision[0].toUpperCase() + decision.slice(1)} ${toolName(state, handoff.toolUnitId)} handoff`,
      toolUnitId: handoff.toolUnitId,
      kind: decision === 'accepted' ? 'custody' : 'request',
      scope: 'worker',
      participantIds: [
        actor.id,
        ...(handoff.to.type === 'worker' ? [handoff.to.userId] : []),
        ...(handoff.from.type === 'worker' ? [handoff.from.userId] : []),
      ],
      warehouseId: warehouseId!,
      occurredAt,
      evidence,
    });
    mutation = toCustodyMutationResult(handoff.toolUnitId, eventId, decision, handoff.id);
    return state;
  });
  return mutation!;
};

export const acceptTransfer = (database: MockDatabase, input: HandoffReviewInput) =>
  resolveHandoff(database, input, 'accepted');
export const declineTransfer = (database: MockDatabase, input: HandoffReviewInput) =>
  resolveHandoff(database, input, 'declined');
export const cancelTransfer = (database: MockDatabase, input: HandoffReviewInput) =>
  resolveHandoff(database, input, 'cancelled');
export const withdrawRequest = (database: MockDatabase, input: HandoffReviewInput) =>
  resolveHandoff(database, input, 'withdrawn');
