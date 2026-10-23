import type {
  AdminPersonDetail,
  AdminPersonView,
  AdminSummary,
  AdminWarehouseView,
  PermissionMatrixRow,
} from '../../domain/read-models/admin';
import type { MockDatabase } from './mock-database';
import { WorkflowError } from '../../domain/workflow-error';
import {
  projectPeople,
  projectPerson,
  projectPermissions,
  projectSummary,
  projectWarehouses,
} from './mock-admin-projections';
import { requireAdminActor } from './admin-authorization';
import { compareActivityTimestamps } from '../../domain/activity';
import { toEventView } from './mock-event-projections';

const authorizedState = (database: MockDatabase, actorId: string) => {
  const state = database.read();
  requireAdminActor(state, actorId);
  return state;
};

export const getSummary = (database: MockDatabase, actorId: string): AdminSummary => {
  const state = authorizedState(database, actorId);
  return projectSummary(state, database.clock());
};

export const listPeople = (database: MockDatabase, actorId: string): AdminPersonView[] => {
  return projectPeople(authorizedState(database, actorId));
};

export const getPerson = (database: MockDatabase, actorId: string, personId: string): AdminPersonDetail => {
  const state = authorizedState(database, actorId);
  if (!state.users.some((user) => user.id === personId)) throw new WorkflowError('not-found', 'Person not found');
  return projectPerson(state, personId);
};

export const getPermissionMatrix = (database: MockDatabase, actorId: string): PermissionMatrixRow[] => {
  authorizedState(database, actorId);
  return projectPermissions();
};

export const listWarehouses = (database: MockDatabase, actorId: string): AdminWarehouseView[] => {
  return projectWarehouses(authorizedState(database, actorId));
};

export const listAuditLog = (database: MockDatabase, actorId: string) => {
  const state = authorizedState(database, actorId);
  return state.events
    .map((event) => toEventView(state, event.id))
    .sort(
      (left, right) => compareActivityTimestamps(left.timestamp, right.timestamp) || left.id.localeCompare(right.id),
    );
};
