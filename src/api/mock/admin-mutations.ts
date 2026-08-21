import type {
  CreateWarehouseInput,
  InvitePersonInput,
  RemovePersonInput,
  SetPersonAccessInput,
  UpdatePersonRoleInput,
  UpdateWarehouseInput,
} from '../contracts/admin-api';
import {
  ADMIN_MUTATION_OPERATIONS,
  adminMutationCorrelation,
  type AdminMutationReceipt,
} from '../../domain/admin-mutation';
import { normalizeCustodyEvidence, type CustodyEvidence } from '../../domain/evidence';
import { isAdminMember, MEMBER_ROLES, PERSON_ACCESS_STATES, type MemberLifecycle } from '../../domain/people';
import { isEligibleWarehouseManager } from '../../domain/warehouse';
import type { MockDatabase } from './mock-database';
import type { MockDatabaseState } from './seed-state';
import { appendAuditEvent } from './audit-events';
import { WorkflowError } from '../../domain/workflow-error';
import { requireAdminActor } from './admin-authorization';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import { bumpUnitRevision } from './tool-state';

const text = (value: string, label: string) => {
  const normalized = value.trim();
  if (!normalized) throw new WorkflowError('invalid', label + ' is required');
  return normalized;
};

const normalizedEmail = (value: string) => text(value, 'Email').toLocaleLowerCase();

const adminActor = (state: MockDatabaseState, actorId: string) => {
  return requireAdminActor(state, actorId);
};

const ensureRole = (role: string) => {
  if (!MEMBER_ROLES.includes(role as (typeof MEMBER_ROLES)[number]))
    throw new WorkflowError('invalid', 'Invalid member role');
  return role as (typeof MEMBER_ROLES)[number];
};

const ensureWarehouse = (state: MockDatabaseState, warehouseId: string) => {
  const warehouse = state.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!warehouse) throw new WorkflowError('not-found', 'Warehouse not found: ' + warehouseId);
  return warehouse;
};

const ensureManager = (state: MockDatabaseState, managerId: string) => {
  const manager = state.users.find((user) => user.id === managerId);
  if (!manager || !isEligibleWarehouseManager(manager)) {
    throw new WorkflowError('invalid', 'An active warehouse manager or administrator is required');
  }
  return manager;
};

const activeAdminCount = (state: MockDatabaseState) => state.users.filter((user) => isAdminMember(user)).length;

const ensureNotFinalAdmin = (state: MockDatabaseState, personId: string) => {
  const target = state.users.find((user) => user.id === personId);
  if (target?.role === 'admin' && isAdminMember(target) && activeAdminCount(state) <= 1) {
    throw new WorkflowError('conflict', 'The final active administrator cannot be removed or suspended');
  }
};

const ensureNotAssignedManager = (state: MockDatabaseState, personId: string) => {
  if (state.warehouses.some((warehouse) => warehouse.managerId === personId)) {
    throw new WorkflowError('conflict', 'Reassign this person from every warehouse first');
  }
};

const ensureNotDemoProfile = (state: MockDatabaseState, personId: string) => {
  if (state.demoProfileIds.includes(personId)) {
    throw new WorkflowError('conflict', 'Demo sign-in profiles cannot be deactivated or reassigned');
  }
};

const pendingForPerson = (state: MockDatabaseState, personId: string) =>
  state.handoffs.filter(
    (handoff) =>
      handoff.status === 'pending' &&
      (handoff.requestedBy === personId ||
        (handoff.from.type === 'worker' && handoff.from.userId === personId) ||
        (handoff.to.type === 'worker' && handoff.to.userId === personId)),
  );

const handoffWarehouseId = (state: MockDatabaseState, handoff: MockDatabaseState['handoffs'][number]) => {
  if (handoff.from.type === 'warehouse') return handoff.from.warehouseId;
  if (handoff.to.type === 'warehouse') return handoff.to.warehouseId;
  const unit = state.units.find((candidate) => candidate.id === handoff.toolUnitId);
  const custody = state.custody.find((record) => record.toolUnitId === handoff.toolUnitId);
  if (!unit || !custody) throw new WorkflowError('invalid', 'Handoff custody is incomplete: ' + handoff.id);
  return currentWarehouseForUnit(unit, custody.holder);
};

const voidPendingForPerson = (
  state: MockDatabaseState,
  database: MockDatabase,
  personId: string,
  actorId: string,
  occurredAt: string,
) => {
  const affectedHandoffIds: string[] = [];
  const affectedToolUnitIds: string[] = [];
  pendingForPerson(state, personId).forEach((handoff) => {
    handoff.status = 'cancelled';
    handoff.resolvedBy = actorId;
    handoff.resolvedAt = occurredAt;
    affectedHandoffIds.push(handoff.id);
    if (!affectedToolUnitIds.includes(handoff.toolUnitId)) affectedToolUnitIds.push(handoff.toolUnitId);
    appendAuditEvent(state, database, {
      actorId,
      action: `Voided handoff ${handoff.id}`,
      toolUnitId: handoff.toolUnitId,
      kind: 'admin',
      scope: 'admin',
      participantIds: [actorId, personId, handoff.requestedBy],
      warehouseId: handoffWarehouseId(state, handoff),
      occurredAt,
    });
  });
  return { affectedHandoffIds, affectedToolUnitIds };
};

const moveHeldToolsHome = (state: MockDatabaseState, personId: string, homeWarehouseId: string, occurredAt: string) => {
  const affectedToolUnitIds: string[] = [];
  state.custody.forEach((record) => {
    const unit = state.units.find((candidate) => candidate.id === record.toolUnitId);
    if (unit?.lifecycle === 'active' && record.holder.type === 'worker' && record.holder.userId === personId) {
      record.holder = { type: 'warehouse', warehouseId: homeWarehouseId };
      record.sinceAt = occurredAt;
      if (unit) unit.assignedWarehouseId = homeWarehouseId;
      if (unit) bumpUnitRevision(state, unit);
      affectedToolUnitIds.push(record.toolUnitId);
    }
  });
  return affectedToolUnitIds;
};

const receipt = (
  operation: AdminMutationReceipt['operation'],
  eventId: string,
  values: { personId?: string; warehouseId?: string; affectedToolUnitIds?: string[]; affectedHandoffIds?: string[] },
): AdminMutationReceipt => ({
  operation,
  correlationId: adminMutationCorrelation(eventId),
  eventId,
  ...(values.personId ? { personId: values.personId } : {}),
  ...(values.warehouseId ? { warehouseId: values.warehouseId } : {}),
  affectedToolUnitIds: values.affectedToolUnitIds ?? [],
  affectedHandoffIds: values.affectedHandoffIds ?? [],
});

const adminEvent = (
  state: MockDatabaseState,
  database: MockDatabase,
  input: {
    actorId: string;
    action: string;
    warehouseId: string;
    occurredAt: string;
    participantIds?: string[];
    evidence?: CustodyEvidence;
  },
) =>
  appendAuditEvent(state, database, {
    actorId: input.actorId,
    action: input.action,
    kind: 'admin',
    scope: 'admin',
    participantIds: input.participantIds ?? [input.actorId],
    warehouseId: input.warehouseId,
    occurredAt: input.occurredAt,
    ...(input.evidence ? { evidence: input.evidence } : {}),
  });

export const invitePerson = (database: MockDatabase, input: InvitePersonInput): AdminMutationReceipt => {
  const occurredAt = database.clock();
  let result: AdminMutationReceipt | undefined;
  database.update((state) => {
    const actor = adminActor(state, input.actorId);
    const name = text(input.name, 'Name');
    const email = normalizedEmail(input.email);
    const title = text(input.title, 'Title');
    const role = ensureRole(input.role);
    const warehouse = ensureWarehouse(state, input.homeWarehouseId);
    if (state.users.some((user) => user.email.toLocaleLowerCase() === email)) {
      throw new WorkflowError('conflict', 'A person with this email already exists');
    }
    const personId = database.nextId('USR');
    state.users.push({
      id: personId,
      name,
      email,
      title,
      role,
      lifecycle: 'invited',
      homeWarehouseId: warehouse.id,
    });
    const eventId = adminEvent(state, database, {
      actorId: actor.id,
      action: `Invited ${name}`,
      warehouseId: warehouse.id,
      occurredAt,
      participantIds: [actor.id, personId],
    });
    result = receipt(ADMIN_MUTATION_OPERATIONS.invitePerson, eventId, { personId });
    return state;
  });
  return result!;
};

const personOrThrow = (state: MockDatabaseState, personId: string) => {
  const person = state.users.find((user) => user.id === personId);
  if (!person) throw new WorkflowError('not-found', 'Person not found: ' + personId);
  return person;
};

export const updatePersonRole = (database: MockDatabase, input: UpdatePersonRoleInput): AdminMutationReceipt => {
  const occurredAt = database.clock();
  let result: AdminMutationReceipt | undefined;
  database.update((state) => {
    const actor = adminActor(state, input.actorId);
    const target = personOrThrow(state, input.personId);
    if (target.id === actor.id) throw new WorkflowError('conflict', 'You cannot change your own role');
    ensureNotDemoProfile(state, target.id);
    if (target.lifecycle === 'removed') throw new WorkflowError('conflict', 'Removed people require a new invitation');
    const role = ensureRole(input.role);
    if (target.role === role) throw new WorkflowError('conflict', 'Person already has this role');
    if (target.role === 'admin') ensureNotFinalAdmin(state, target.id);
    if (state.warehouses.some((warehouse) => warehouse.managerId === target.id) && role === 'worker') {
      throw new WorkflowError('conflict', 'Reassign this person from every warehouse first');
    }
    if (state.custody.some((record) => record.holder.type === 'worker' && record.holder.userId === target.id)) {
      throw new WorkflowError('conflict', 'A person holding tools must remain a worker until custody is resolved');
    }
    if (role !== 'worker' && pendingForPerson(state, target.id).length) {
      throw new WorkflowError('conflict', 'Resolve pending handoffs before changing this worker role');
    }
    target.role = role;
    const eventId = adminEvent(state, database, {
      actorId: actor.id,
      action: `Changed ${target.name}'s role to ${role}`,
      warehouseId: target.homeWarehouseId,
      occurredAt,
      participantIds: [actor.id, target.id],
    });
    result = receipt(ADMIN_MUTATION_OPERATIONS.updatePersonRole, eventId, { personId: target.id });
    return state;
  });
  return result!;
};

export const setPersonAccess = (database: MockDatabase, input: SetPersonAccessInput): AdminMutationReceipt => {
  const occurredAt = database.clock();
  let result: AdminMutationReceipt | undefined;
  database.update((state) => {
    const actor = adminActor(state, input.actorId);
    const target = personOrThrow(state, input.personId);
    if (target.id === actor.id) throw new WorkflowError('conflict', 'You cannot change your own access');
    ensureNotDemoProfile(state, target.id);
    if (!PERSON_ACCESS_STATES.includes(input.access)) throw new WorkflowError('invalid', 'Invalid access state');
    if (target.lifecycle === 'removed') {
      throw new WorkflowError('conflict', 'Removed people require a new invitation');
    }
    if (target.lifecycle === input.access) {
      throw new WorkflowError('conflict', 'Person already has this access state');
    }
    if (input.access === 'suspended') {
      ensureNotFinalAdmin(state, target.id);
      ensureNotAssignedManager(state, target.id);
    }
    target.lifecycle = input.access as MemberLifecycle;
    const voided =
      input.access === 'suspended'
        ? voidPendingForPerson(state, database, target.id, actor.id, occurredAt)
        : { affectedHandoffIds: [], affectedToolUnitIds: [] };
    const eventId = adminEvent(state, database, {
      actorId: actor.id,
      action: `${input.access === 'active' ? 'Restored' : 'Suspended'} ${target.name}`,
      warehouseId: target.homeWarehouseId,
      occurredAt,
      participantIds: [actor.id, target.id],
    });
    result = receipt(ADMIN_MUTATION_OPERATIONS.setPersonAccess, eventId, {
      personId: target.id,
      affectedToolUnitIds: voided.affectedToolUnitIds,
      affectedHandoffIds: voided.affectedHandoffIds,
    });
    return state;
  });
  return result!;
};

export const removePerson = (database: MockDatabase, input: RemovePersonInput): AdminMutationReceipt => {
  const occurredAt = database.clock();
  let result: AdminMutationReceipt | undefined;
  database.update((state) => {
    const actor = adminActor(state, input.actorId);
    const target = personOrThrow(state, input.personId);
    const reason = text(input.reason, 'Removal reason');
    const note = normalizeCustodyEvidence(input.note === undefined ? undefined : { note: input.note })?.note;
    if (target.id === actor.id) throw new WorkflowError('conflict', 'You cannot remove your own access');
    ensureNotDemoProfile(state, target.id);
    if (target.lifecycle === 'removed') throw new WorkflowError('conflict', 'Person is already removed');
    ensureNotFinalAdmin(state, target.id);
    ensureNotAssignedManager(state, target.id);
    const voided = voidPendingForPerson(state, database, target.id, actor.id, occurredAt);
    const affectedHandoffIds = voided.affectedHandoffIds;
    const movedToolUnitIds = moveHeldToolsHome(state, target.id, target.homeWarehouseId, occurredAt);
    const affectedToolUnitIds = [...new Set([...voided.affectedToolUnitIds, ...movedToolUnitIds])];
    movedToolUnitIds.forEach((toolUnitId) => {
      appendAuditEvent(state, database, {
        actorId: actor.id,
        action: `Returned ${toolUnitId} from ${target.name}`,
        toolUnitId,
        kind: 'custody',
        scope: 'warehouse',
        participantIds: [actor.id, target.id],
        warehouseId: target.homeWarehouseId,
        occurredAt,
      });
    });
    target.lifecycle = 'removed';
    const eventId = adminEvent(state, database, {
      actorId: actor.id,
      action: `Removed ${target.name}: ${reason}`,
      warehouseId: target.homeWarehouseId,
      occurredAt,
      participantIds: [actor.id, target.id],
      ...(note ? { evidence: { note } } : {}),
    });
    result = receipt(ADMIN_MUTATION_OPERATIONS.removePerson, eventId, {
      personId: target.id,
      affectedToolUnitIds,
      affectedHandoffIds,
    });
    return state;
  });
  return result!;
};

export const createWarehouse = (database: MockDatabase, input: CreateWarehouseInput): AdminMutationReceipt => {
  const occurredAt = database.clock();
  let result: AdminMutationReceipt | undefined;
  database.update((state) => {
    const actor = adminActor(state, input.actorId);
    const name = text(input.name, 'Warehouse name');
    const address = text(input.address, 'Warehouse address');
    const manager = ensureManager(state, input.managerId);
    if (state.warehouses.some((warehouse) => warehouse.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new WorkflowError('conflict', 'A warehouse with this name already exists');
    }
    const warehouseId = database.nextId('WH');
    state.warehouses.push({ id: warehouseId, name, address, managerId: manager.id });
    const eventId = adminEvent(state, database, {
      actorId: actor.id,
      action: `Created warehouse ${name}`,
      warehouseId,
      occurredAt,
    });
    result = receipt(ADMIN_MUTATION_OPERATIONS.createWarehouse, eventId, { warehouseId });
    return state;
  });
  return result!;
};

export const updateWarehouse = (database: MockDatabase, input: UpdateWarehouseInput): AdminMutationReceipt => {
  const occurredAt = database.clock();
  let result: AdminMutationReceipt | undefined;
  database.update((state) => {
    const actor = adminActor(state, input.actorId);
    const warehouse = ensureWarehouse(state, input.warehouseId);
    const name = text(input.name, 'Warehouse name');
    const address = text(input.address, 'Warehouse address');
    const manager = ensureManager(state, input.managerId);
    if (warehouse.name === name && warehouse.address === address && warehouse.managerId === manager.id) {
      throw new WorkflowError('conflict', 'Warehouse already has these details');
    }
    if (
      state.warehouses.some(
        (candidate) => candidate.id !== warehouse.id && candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      throw new WorkflowError('conflict', 'A warehouse with this name already exists');
    }
    warehouse.name = name;
    warehouse.address = address;
    warehouse.managerId = manager.id;
    const eventId = adminEvent(state, database, {
      actorId: actor.id,
      action: `Updated warehouse ${name}`,
      warehouseId: warehouse.id,
      occurredAt,
    });
    result = receipt(ADMIN_MUTATION_OPERATIONS.updateWarehouse, eventId, { warehouseId: warehouse.id });
    return state;
  });
  return result!;
};
