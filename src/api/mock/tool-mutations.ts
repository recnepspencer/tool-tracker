import type { CreateToolInput } from '../contracts/tools-api';
import type { ToolDefinition, ToolUnit } from '../../domain/tool';
import { WorkflowError } from '../../domain/workflow-error';
import type { ToolView } from '../../domain/read-models/tools';
import type { MockDatabase } from './mock-database';
import { toToolView } from './mock-tool-projections';
import type { MockDatabaseState } from './seed-state';
import { normalizeCustodyEvidence } from '../../domain/evidence';
import { appendAuditEvent } from './audit-events';
import { normalizeCreateToolInput } from '../tool-command-normalization';
import { isActiveMember } from '../../domain/people';

const text = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized) throw new WorkflowError('invalid', label + ' is required');
  return normalized;
};

const normalized = (value: string) => value.trim().toLocaleLowerCase();

const categoryForInput = (state: MockDatabaseState, categoryId: string) => {
  const category = state.categories.find((candidate) => candidate.id === categoryId);
  if (!category) throw new WorkflowError('invalid', 'Unknown tool category: ' + categoryId);
  return category;
};

const findDefinition = (state: MockDatabaseState, input: CreateToolInput) => {
  const candidate = input.definition;
  const category = categoryForInput(state, candidate.categoryId);
  return state.definitions.find(
    (definition) =>
      normalized(definition.name) === normalized(candidate.name) &&
      normalized(definition.brand) === normalized(candidate.brand) &&
      normalized(definition.model) === normalized(candidate.model) &&
      definition.categoryId === category.id,
  );
};

const authorizeToolCreation = (state: MockDatabaseState, input: CreateToolInput) => {
  const actor = state.users.find((user) => user.id === input.actorId);
  if (!actor || actor.role !== 'worker' || !isActiveMember(actor)) {
    throw new WorkflowError('forbidden', 'Only a worker can add a tool; actor must be active');
  }
  if (!state.warehouses.some((warehouse) => warehouse.id === input.warehouseId)) {
    throw new WorkflowError('not-found', 'Warehouse not found: ' + input.warehouseId);
  }
  return actor;
};

const normalizeDefinitionInput = (input: CreateToolInput): Omit<ToolDefinition, 'id' | 'categoryId'> => ({
  name: text(input.definition.name, 'Tool name'),
  brand: text(input.definition.brand, 'Brand'),
  model: text(input.definition.model, 'Model'),
  category: input.definition.category?.trim() ?? '',
  imageKey: text(input.definition.imageKey, 'Photo'),
});

const findOrCreateDefinition = (state: MockDatabaseState, database: MockDatabase, input: CreateToolInput) => {
  const definitionInput = normalizeDefinitionInput(input);
  let definition = findDefinition(state, {
    ...input,
    definition: { ...definitionInput, categoryId: input.definition.categoryId },
  });
  if (!definition) {
    const category = categoryForInput(state, input.definition.categoryId);
    definition = {
      ...definitionInput,
      id: database.nextId('DEF'),
      category: category.name,
      categoryId: category.id,
    } satisfies ToolDefinition;
    state.definitions.push(definition);
  }
  return { definition, definitionInput };
};

const createToolUnit = (
  state: MockDatabaseState,
  database: MockDatabase,
  input: CreateToolInput,
  definition: ToolDefinition,
) => {
  const unit: ToolUnit = {
    id: database.nextId('TL'),
    definitionId: definition.id,
    condition: 'serviceable',
    lifecycle: 'active',
    originWarehouseId: input.warehouseId,
    assignedWarehouseId: input.warehouseId,
    photoKey: definition.imageKey,
    ...(input.serial?.trim() ? { serial: input.serial.trim() } : {}),
    ...(input.price?.trim() ? { price: input.price.trim() } : {}),
  };
  state.units.push(unit);
  return unit;
};

const appendToolCreationEvent = (
  state: MockDatabaseState,
  database: MockDatabase,
  input: CreateToolInput,
  actor: { id: string; name: string },
  definition: ToolDefinition,
  unit: ToolUnit,
  occurredAt: string,
) => {
  appendAuditEvent(state, database, {
    actorId: actor.id,
    action: `Added ${definition.name} to ${actor.name}'s tools`,
    toolUnitId: unit.id,
    kind: 'admin',
    scope: 'worker',
    participantIds: [actor.id],
    warehouseId: input.warehouseId,
    occurredAt,
    evidence: normalizeCustodyEvidence(input.evidence),
  });
};

export const createTool = (database: MockDatabase, input: CreateToolInput): ToolView => {
  const normalizedInput = normalizeCreateToolInput(input);
  if (!normalizedInput.photoCaptured) throw new WorkflowError('invalid', 'A mock tool photo is required');
  const occurredAt = database.clock();
  let createdUnitId = '';
  database.update((state) => {
    const actor = authorizeToolCreation(state, normalizedInput);
    const { definition } = findOrCreateDefinition(state, database, normalizedInput);
    const unit = createToolUnit(state, database, normalizedInput, definition);
    state.custody.push({ toolUnitId: unit.id, holder: { type: 'worker', userId: actor.id }, sinceAt: occurredAt });
    appendToolCreationEvent(state, database, normalizedInput, actor, definition, unit, occurredAt);
    createdUnitId = unit.id;
    return state;
  });
  return toToolView(database.read(), createdUnitId);
};
