import type { WarehouseToolCommandInput } from '../contracts/warehouse-api';
import type { WarehouseMutationReceipt } from '../../domain/warehouse-operation';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { appendAuditEvent } from './audit-events';
import { requireWarehouseActor, ensureWarehouseScope } from './warehouse-authorization';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import { custodyOrThrow, pendingForUnit } from './custody-record-state';
import { toolName } from './tool-state';
import { assertExpectedRevision } from './tool-state';
import { bumpToolRevision } from '../../domain/tool';

const authorize = (state: MockDatabaseState, input: WarehouseToolCommandInput) => {
  const unit = state.units.find((candidate) => candidate.id === input.toolUnitId);
  if (!unit) throw new WorkflowError('not-found', 'Tool unit not found: ' + input.toolUnitId);
  if (unit.lifecycle !== 'active') throw new WorkflowError('archived', 'Tool unit is archived: ' + input.toolUnitId);
  const custody = custodyOrThrow(state, input.toolUnitId);
  const definition = state.definitions.find((candidate) => candidate.id === unit.definitionId);
  if (!definition) throw new WorkflowError('invalid', 'Tool definition is missing: ' + input.toolUnitId);
  const warehouseId = currentWarehouseForUnit(unit, custody.holder);
  const authorization = requireWarehouseActor(state, input.actorId);
  ensureWarehouseScope(authorization.allowedWarehouseIds, warehouseId);
  if (pendingForUnit(state, input.toolUnitId)) {
    throw new WorkflowError('conflict', 'Resolve the pending handoff before changing this tool');
  }
  assertExpectedRevision(unit, input.expectedRevision, definition);
  return { actor: authorization.actor, unit, custody, warehouseId, definition };
};

const receipt = (
  operation: WarehouseMutationReceipt['operation'],
  eventId: string,
  toolUnitId: string,
): WarehouseMutationReceipt => ({
  operation,
  correlationId: 'WH-' + eventId,
  eventId,
  toolUnitId,
  affectedToolUnitIds: [toolUnitId],
  affectedHandoffIds: [],
});

export const returnTool = (database: MockDatabase, input: WarehouseToolCommandInput) => {
  const occurredAt = database.clock();
  let result: WarehouseMutationReceipt | undefined;
  database.update((state) => {
    const context = authorize(state, input);
    if (context.custody.holder.type !== 'worker') {
      throw new WorkflowError('conflict', 'This tool is already held by a warehouse');
    }
    const holder = context.custody.holder;
    const worker = state.users.find((candidate) => candidate.id === holder.userId);
    context.custody.holder = { type: 'warehouse', warehouseId: context.unit.assignedWarehouseId };
    context.custody.sinceAt = occurredAt;
    bumpToolRevision(context.unit, context.definition);
    const evidence = normalizeCustodyEvidence(input.evidence);
    const eventId = appendAuditEvent(state, database, {
      actorId: context.actor.id,
      action: `Returned ${toolName(state, input.toolUnitId)} from ${worker?.name ?? 'worker'}`,
      toolUnitId: input.toolUnitId,
      kind: 'custody',
      scope: 'warehouse',
      participantIds: [context.actor.id, ...(worker ? [worker.id] : [])],
      warehouseId: context.warehouseId,
      occurredAt,
      ...(evidence ? { evidence } : {}),
    });
    result = receipt('return-tool', eventId, input.toolUnitId);
    return state;
  });
  return result!;
};

export const decommissionTool = (database: MockDatabase, input: WarehouseToolCommandInput) => {
  const occurredAt = database.clock();
  let result: WarehouseMutationReceipt | undefined;
  database.update((state) => {
    const context = authorize(state, input);
    if (context.custody.holder.type !== 'warehouse') {
      throw new WorkflowError('conflict', 'Return the tool to a warehouse before decommissioning it');
    }
    context.unit.lifecycle = 'archived';
    bumpToolRevision(context.unit, context.definition);
    const evidence = normalizeCustodyEvidence(input.evidence);
    const eventId = appendAuditEvent(state, database, {
      actorId: context.actor.id,
      action: `Decommissioned ${toolName(state, input.toolUnitId)}`,
      toolUnitId: input.toolUnitId,
      kind: 'admin',
      scope: 'warehouse',
      participantIds: [context.actor.id],
      warehouseId: context.warehouseId,
      occurredAt,
      ...(evidence ? { evidence } : {}),
    });
    result = receipt('decommission-tool', eventId, input.toolUnitId);
    return state;
  });
  return result!;
};
