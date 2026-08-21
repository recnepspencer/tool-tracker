import type { WarehouseHandoffCommandInput } from '../contracts/warehouse-api';
import type { WarehouseMutationReceipt } from '../../domain/warehouse-operation';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { appendAuditEvent } from './audit-events';
import { requireWarehouseActor, ensureWarehouseScope } from './warehouse-authorization';
import { toolName } from './tool-state';
import { classifyWarehouseQueueItem } from '../../domain/warehouse-queue';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import { applyHandoffResolution, assertPendingHandoff } from './handoff-resolution-state';
import { bumpToolRevision } from '../../domain/tool';

const operationReceipt = (
  operation: WarehouseMutationReceipt['operation'],
  eventId: string,
  toolUnitId: string,
  handoffId: string,
): WarehouseMutationReceipt => ({
  operation,
  correlationId: 'WH-' + eventId,
  eventId,
  toolUnitId,
  handoffId,
  affectedToolUnitIds: [toolUnitId],
  affectedHandoffIds: [handoffId],
});

const queueWarehouseId = (handoff: MockDatabaseState['handoffs'][number]) => {
  if (handoff.kind === 'warehouse-request' && handoff.from.type === 'warehouse') return handoff.from.warehouseId;
  if (handoff.kind === 'transfer' && handoff.to.type === 'warehouse') return handoff.to.warehouseId;
  throw new WorkflowError('invalid', 'Handoff is not a warehouse queue item');
};

const pendingQueueHandoff = (state: MockDatabaseState, input: WarehouseHandoffCommandInput) => {
  const { handoff, custody } = assertPendingHandoff(state, input.handoffId, input.toolUnitId);
  const unit = state.units.find((candidate) => candidate.id === handoff.toolUnitId);
  if (!unit || unit.lifecycle !== 'active')
    throw new WorkflowError('archived', 'Tool unit is archived: ' + input.toolUnitId);
  const kind = classifyWarehouseQueueItem(handoff);
  if (!kind) throw new WorkflowError('invalid', 'Handoff is not a warehouse queue item');
  if (
    kind === 'request' &&
    (handoff.from.type !== 'warehouse' || handoff.from.warehouseId !== currentWarehouseForUnit(unit))
  ) {
    throw new WorkflowError('conflict', 'Request warehouse is no longer assigned to this tool');
  }
  return { handoff, custody, unit, kind, warehouseId: queueWarehouseId(handoff) };
};

const authorizeQueueCommand = (state: MockDatabaseState, input: WarehouseHandoffCommandInput) => {
  const { allowedWarehouseIds, actor } = requireWarehouseActor(state, input.actorId);
  const queue = pendingQueueHandoff(state, input);
  ensureWarehouseScope(allowedWarehouseIds, queue.warehouseId);
  if (queue.handoff.to.type === 'worker') {
    const person = state.users.find(
      (candidate) => candidate.id === (queue.handoff.to as { type: 'worker'; userId: string }).userId,
    );
    if (!person || person.role !== 'worker' || person.lifecycle !== 'active') {
      throw new WorkflowError('forbidden', 'The receiving worker is not active');
    }
  }
  return { actor, ...queue };
};

const queueDecision = (
  database: MockDatabase,
  input: WarehouseHandoffCommandInput,
  decision: 'accepted' | 'declined',
  expectedKind: 'request' | 'return' | 'any',
): WarehouseMutationReceipt => {
  const occurredAt = database.clock();
  let result: WarehouseMutationReceipt | undefined;
  database.update((state) => {
    const resolved = authorizeQueueCommand(state, input);
    if (expectedKind !== 'any' && resolved.kind !== expectedKind) {
      throw new WorkflowError('conflict', 'This queue decision does not match the item type');
    }
    if (resolved.kind === 'request' && resolved.unit.condition !== 'serviceable') {
      throw new WorkflowError('unavailable', 'Only serviceable tools can be released');
    }
    const evidence = normalizeCustodyEvidence(input.evidence);
    applyHandoffResolution(
      { handoff: resolved.handoff, custody: resolved.custody },
      resolved.actor.id,
      decision,
      occurredAt,
      evidence,
    );
    if (decision === 'accepted' && resolved.handoff.to.type === 'warehouse') {
      resolved.unit.assignedWarehouseId = resolved.handoff.to.warehouseId;
    }
    if (decision === 'accepted') {
      const definition = state.definitions.find((candidate) => candidate.id === resolved.unit.definitionId);
      bumpToolRevision(resolved.unit, definition);
    }
    const person = state.users.find((candidate) => candidate.id === resolved.handoff.requestedBy);
    const action =
      decision === 'accepted'
        ? resolved.kind === 'request'
          ? `Approved ${toolName(state, input.toolUnitId)} request for ${person?.name ?? 'worker'}`
          : `Accepted return of ${toolName(state, input.toolUnitId)}`
        : `Declined ${toolName(state, input.toolUnitId)} ${resolved.kind}`;
    const eventId = appendAuditEvent(state, database, {
      actorId: resolved.actor.id,
      action,
      toolUnitId: input.toolUnitId,
      kind: decision === 'accepted' ? 'custody' : 'request',
      scope: 'warehouse',
      participantIds: [resolved.actor.id, ...(person ? [person.id] : [])],
      warehouseId: resolved.warehouseId,
      occurredAt,
      ...(evidence ? { evidence } : {}),
    });
    const operation =
      decision === 'declined'
        ? 'decline-queue-item'
        : resolved.kind === 'request'
          ? 'approve-request'
          : 'accept-return';
    result = operationReceipt(operation, eventId, input.toolUnitId, input.handoffId);
    return state;
  });
  return result!;
};

export const approveRequest = (database: MockDatabase, input: WarehouseHandoffCommandInput) =>
  queueDecision(database, input, 'accepted', 'request');

export const acceptReturn = (database: MockDatabase, input: WarehouseHandoffCommandInput) =>
  queueDecision(database, input, 'accepted', 'return');

export const declineQueueItem = (database: MockDatabase, input: WarehouseHandoffCommandInput) =>
  queueDecision(database, input, 'declined', 'any');
