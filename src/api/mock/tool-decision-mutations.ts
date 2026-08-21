import type { FlagToolInput, RestoreToolInput, UpdateToolInput } from '../contracts/tools-api';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { WorkflowError } from '../../domain/workflow-error';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { appendAuditEvent } from './audit-events';
import { requireWarehouseActor, ensureWarehouseScope } from './warehouse-authorization';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import { pendingForUnit, custodyOrThrow } from './custody-record-state';
import { toToolView } from './mock-tool-projections';
import type { ToolDefinition } from '../../domain/tool';
import { deriveToolStatus, bumpToolRevision } from '../../domain/tool';
import { sameHolder } from '../../domain/custody-policy';
import type { HolderRef } from '../../domain/custody';
import { assertExpectedRevision } from './tool-state';

const text = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized) throw new WorkflowError('invalid', label + ' is required');
  return normalized;
};

const unitContext = (state: MockDatabaseState, toolUnitId: string, actorId: string) => {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  if (!unit) throw new WorkflowError('not-found', 'Tool unit not found: ' + toolUnitId);
  if (unit.lifecycle !== 'active') throw new WorkflowError('archived', 'Tool unit is archived: ' + toolUnitId);
  const custody = custodyOrThrow(state, toolUnitId);
  const warehouseId = currentWarehouseForUnit(unit, custody.holder);
  const authorization = requireWarehouseActor(state, actorId);
  ensureWarehouseScope(authorization.allowedWarehouseIds, warehouseId);
  return { actor: authorization.actor, unit, custody, warehouseId };
};

const ensureNoPending = (state: MockDatabaseState, toolUnitId: string) => {
  if (pendingForUnit(state, toolUnitId)) {
    throw new WorkflowError('conflict', 'Resolve the pending handoff before changing this tool');
  }
};

const definitionInput = (input: UpdateToolInput): Omit<ToolDefinition, 'id' | 'categoryId'> => ({
  name: text(input.definition.name, 'Tool name'),
  brand: text(input.definition.brand, 'Brand'),
  model: text(input.definition.model, 'Model'),
  category: input.definition.category?.trim() ?? '',
  imageKey: text(input.definition.imageKey, 'Photo'),
});

const categoryForInput = (state: MockDatabaseState, categoryId: string) => {
  const category = state.categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new WorkflowError('invalid', 'Unknown tool category: ' + categoryId);
  return category;
};

const assertExpectedHolder = (actual: HolderRef, expected: HolderRef) => {
  if (!sameHolder(actual, expected)) {
    throw new WorkflowError('conflict', 'Tool custody changed before this decision');
  }
};

type DecisionAuditInput = {
  state: MockDatabaseState;
  database: MockDatabase;
  actorId: string;
  toolUnitId: string;
  warehouseId: string;
  action: string;
  occurredAt: string;
  evidence: ReturnType<typeof normalizeCustodyEvidence>;
};

const appendDefinitionEditAudit = (input: DecisionAuditInput) =>
  appendAuditEvent(input.state, input.database, {
    actorId: input.actorId,
    action: input.action,
    toolUnitId: input.toolUnitId,
    kind: 'admin',
    scope: 'warehouse',
    participantIds: [input.actorId],
    warehouseId: input.warehouseId,
    occurredAt: input.occurredAt,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  });

const appendConditionDecisionAudit = (input: DecisionAuditInput) =>
  appendAuditEvent(input.state, input.database, {
    actorId: input.actorId,
    action: input.action,
    toolUnitId: input.toolUnitId,
    kind: 'flag',
    scope: 'damage',
    participantIds: [input.actorId],
    warehouseId: input.warehouseId,
    occurredAt: input.occurredAt,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  });

export const updateTool = (database: MockDatabase, input: UpdateToolInput) => {
  const occurredAt = database.clock();
  database.update((state) => {
    const context = unitContext(state, input.toolUnitId, input.actorId);
    ensureNoPending(state, input.toolUnitId);
    const definition = state.definitions.find((candidate) => candidate.id === context.unit.definitionId);
    if (!definition) throw new WorkflowError('invalid', 'Tool definition is missing: ' + input.toolUnitId);
    assertExpectedRevision(context.unit, input.expectedRevision, definition);
    if (
      deriveToolStatus(context.unit, context.custody.holder) !== input.expectedStatus ||
      !sameHolder(context.custody.holder, input.expectedHolder)
    ) {
      throw new WorkflowError('conflict', 'Tool status or custody changed before this decision');
    }
    const nextDefinition = definitionInput(input);
    const category = categoryForInput(state, input.definition.categoryId);
    Object.assign(definition, nextDefinition, { category: category.name, categoryId: category.id });
    context.unit.serial = input.serial?.trim() || undefined;
    context.unit.price = input.price?.trim() || undefined;
    bumpToolRevision(context.unit, definition);
    appendDefinitionEditAudit({
      state,
      database,
      actorId: context.actor.id,
      toolUnitId: input.toolUnitId,
      warehouseId: context.warehouseId,
      action: `Edited ${definition.name}`,
      occurredAt,
      evidence: normalizeCustodyEvidence(input.evidence),
    });
    return state;
  });
  return toToolView(database.read(), input.toolUnitId);
};

export const flagTool = (database: MockDatabase, input: FlagToolInput) => {
  const occurredAt = database.clock();
  database.update((state) => {
    const context = unitContext(state, input.toolUnitId, input.actorId);
    ensureNoPending(state, input.toolUnitId);
    const definition = state.definitions.find((candidate) => candidate.id === context.unit.definitionId);
    if (!definition) throw new WorkflowError('invalid', 'Tool definition is missing: ' + input.toolUnitId);
    assertExpectedRevision(context.unit, input.expectedRevision, definition);
    if (context.unit.condition !== 'serviceable') {
      throw new WorkflowError('conflict', 'This tool is already flagged');
    }
    assertExpectedHolder(context.custody.holder, input.expectedHolder);
    context.unit.condition = input.condition;
    bumpToolRevision(context.unit, definition);
    state.conditionReports.push({
      id: database.nextId('CR'),
      toolUnitId: input.toolUnitId,
      reporterId: context.actor.id,
      condition: input.condition,
      reportedAt: occurredAt,
      ...(normalizeCustodyEvidence(input.evidence) ? { evidence: normalizeCustodyEvidence(input.evidence) } : {}),
    });
    appendConditionDecisionAudit({
      state,
      database,
      actorId: context.actor.id,
      toolUnitId: input.toolUnitId,
      warehouseId: context.warehouseId,
      action: `Flagged ${state.definitions.find((definition) => definition.id === context.unit.definitionId)?.name ?? 'tool'} ${input.condition}`,
      occurredAt,
      evidence: normalizeCustodyEvidence(input.evidence),
    });
    return state;
  });
  return toToolView(database.read(), input.toolUnitId);
};

export const restoreTool = (database: MockDatabase, input: RestoreToolInput) => {
  const occurredAt = database.clock();
  database.update((state) => {
    const context = unitContext(state, input.toolUnitId, input.actorId);
    ensureNoPending(state, input.toolUnitId);
    const definition = state.definitions.find((candidate) => candidate.id === context.unit.definitionId);
    if (!definition) throw new WorkflowError('invalid', 'Tool definition is missing: ' + input.toolUnitId);
    assertExpectedRevision(context.unit, input.expectedRevision, definition);
    if (context.custody.holder.type !== 'warehouse') {
      throw new WorkflowError('conflict', 'Return the tool to a warehouse before restoring it');
    }
    assertExpectedHolder(context.custody.holder, input.expectedHolder);
    if (context.unit.condition === 'serviceable') {
      throw new WorkflowError('conflict', 'This tool is already in serviceable condition');
    }
    context.unit.condition = 'serviceable';
    bumpToolRevision(context.unit, definition);
    appendConditionDecisionAudit({
      state,
      database,
      actorId: context.actor.id,
      toolUnitId: input.toolUnitId,
      warehouseId: context.warehouseId,
      action: `Restored ${state.definitions.find((definition) => definition.id === context.unit.definitionId)?.name ?? 'tool'} to stock`,
      occurredAt,
      evidence: normalizeCustodyEvidence(input.evidence),
    });
    return state;
  });
  return toToolView(database.read(), input.toolUnitId);
};
