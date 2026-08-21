import type {
  CreateCategoryInput,
  DeleteCategoryInput,
  RenameCategoryInput,
  ResetDemoDataInput,
  UpdateCompanyInput,
} from '../contracts/settings-api';
import {
  ADMIN_MUTATION_OPERATIONS,
  settingsMutationCorrelation,
  type AdminMutationReceipt,
} from '../../domain/admin-mutation';
import { categoryIdForName, normalizeCategoryName, normalizeOrganizationName } from '../../domain/organization';
import { WorkflowError } from '../../domain/workflow-error';
import { requireAdminActor } from './admin-authorization';
import { appendAuditEvent } from './audit-events';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import type { MockState } from './mock-state';

const text = (value: string, label: string) => {
  const result = normalizeOrganizationName(value);
  if (!result) throw new WorkflowError('invalid', label + ' is required');
  return result;
};

const receipt = (
  operation: AdminMutationReceipt['operation'],
  eventId: string,
  affectedToolUnitIds: string[] = [],
): AdminMutationReceipt => ({
  operation,
  correlationId: settingsMutationCorrelation(eventId),
  eventId,
  affectedToolUnitIds: [...new Set(affectedToolUnitIds)].sort(),
  affectedHandoffIds: [],
});

const admin = (state: MockDatabaseState | MockState, actorId: string) => requireAdminActor(state, actorId);

const event = (
  state: MockDatabaseState,
  database: MockDatabase,
  actorId: string,
  action: string,
  warehouseId: string,
  evidence?: { note?: string },
) =>
  appendAuditEvent(state, database, {
    actorId,
    action,
    kind: 'admin',
    scope: 'admin',
    participantIds: [actorId],
    warehouseId,
    occurredAt: database.clock(),
    ...(evidence ? { evidence } : {}),
  });

export const updateCompany = (database: MockDatabase, input: UpdateCompanyInput): AdminMutationReceipt => {
  let result!: AdminMutationReceipt;
  database.update((state) => {
    admin(state, input.actorId);
    if (state.company.revision !== input.expectedRevision)
      throw new WorkflowError('conflict', 'Company settings changed; refresh first');
    const name = text(input.name, 'Company name');
    const address = text(input.address, 'Company address');
    state.company.name = name;
    state.company.address = address;
    state.company.revision += 1;
    const eventId = event(
      state,
      database,
      input.actorId,
      'Updated company profile',
      state.users.find((user) => user.id === input.actorId)?.homeWarehouseId ?? state.warehouses[0].id,
      { note: name },
    );
    result = receipt(ADMIN_MUTATION_OPERATIONS.updateCompany, eventId);
    return state;
  });
  return result;
};

export const createCategory = (database: MockDatabase, input: CreateCategoryInput): AdminMutationReceipt => {
  let result!: AdminMutationReceipt;
  database.update((state) => {
    admin(state, input.actorId);
    const name = text(input.name, 'Category name');
    const normalizedName = normalizeCategoryName(name);
    if (state.categories.some((category) => category.normalizedName === normalizedName))
      throw new WorkflowError('conflict', 'A category with this name already exists');
    const category = {
      id: categoryIdForName(name) + '-' + database.nextId('CAT').slice(3),
      name,
      normalizedName,
      revision: 1,
    };
    state.categories.push(category);
    const eventId = event(
      state,
      database,
      input.actorId,
      'Created tool category ' + name,
      state.users.find((user) => user.id === input.actorId)?.homeWarehouseId ?? state.warehouses[0].id,
    );
    result = receipt(ADMIN_MUTATION_OPERATIONS.createCategory, eventId);
    return state;
  });
  return result;
};

export const renameCategory = (database: MockDatabase, input: RenameCategoryInput): AdminMutationReceipt => {
  let result!: AdminMutationReceipt;
  database.update((state) => {
    admin(state, input.actorId);
    const category = state.categories.find((candidate) => candidate.id === input.categoryId);
    if (!category) throw new WorkflowError('not-found', 'Category not found');
    if (category.revision !== input.expectedRevision)
      throw new WorkflowError('conflict', 'Category changed; refresh first');
    const name = text(input.name, 'Category name');
    const normalizedName = normalizeCategoryName(name);
    if (
      state.categories.some((candidate) => candidate.id !== category.id && candidate.normalizedName === normalizedName)
    )
      throw new WorkflowError('conflict', 'A category with this name already exists');
    category.name = name;
    category.normalizedName = normalizedName;
    category.revision += 1;
    state.definitions.forEach((definition) => {
      if (definition.categoryId === category.id) definition.category = category.name;
    });
    const affectedToolUnitIds = state.units
      .filter(
        (unit) =>
          state.definitions.find((definition) => definition.id === unit.definitionId)?.categoryId === category.id,
      )
      .map((unit) => unit.id);
    const eventId = event(
      state,
      database,
      input.actorId,
      'Renamed tool category ' + name,
      state.users.find((user) => user.id === input.actorId)?.homeWarehouseId ?? state.warehouses[0].id,
    );
    result = receipt(ADMIN_MUTATION_OPERATIONS.renameCategory, eventId, affectedToolUnitIds);
    return state;
  });
  return result;
};

export const deleteCategory = (database: MockDatabase, input: DeleteCategoryInput): AdminMutationReceipt => {
  let result!: AdminMutationReceipt;
  database.update((state) => {
    admin(state, input.actorId);
    const category = state.categories.find((candidate) => candidate.id === input.categoryId);
    if (!category) throw new WorkflowError('not-found', 'Category not found');
    if (category.revision !== input.expectedRevision)
      throw new WorkflowError('conflict', 'Category changed; refresh first');
    const used = state.definitions.some((definition) => definition.categoryId === category.id);
    if (used) throw new WorkflowError('conflict', 'Used categories cannot be deleted');
    state.categories = state.categories.filter((candidate) => candidate.id !== category.id);
    const eventId = event(
      state,
      database,
      input.actorId,
      'Deleted tool category ' + category.name,
      state.users.find((user) => user.id === input.actorId)?.homeWarehouseId ?? state.warehouses[0].id,
    );
    result = receipt(ADMIN_MUTATION_OPERATIONS.deleteCategory, eventId);
    return state;
  });
  return result;
};

export const resetDemoData = (database: MockDatabase, input: ResetDemoDataInput) => {
  const state = database.read();
  admin(state, input.actorId);
  if (input.confirmation !== 'RESET DEMO DATA') throw new WorkflowError('invalid', 'Type RESET DEMO DATA to confirm');
  database.reset();
  return { operation: 'reset-demo-data' as const, seedRevision: 'seed-v1' };
};
