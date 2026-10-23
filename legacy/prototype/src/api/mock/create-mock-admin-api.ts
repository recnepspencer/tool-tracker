import type { AdminApi } from '../contracts/admin-api';
import type { MockDatabase } from './mock-database';
import { getPerson, getPermissionMatrix, getSummary, listAuditLog, listPeople, listWarehouses } from './admin-queries';
import {
  createWarehouse,
  invitePerson,
  removePerson,
  setPersonAccess,
  updatePersonRole,
  updateWarehouse,
} from './admin-mutations';

export const createMockAdminApi = (database: MockDatabase): AdminApi => ({
  getSummary: async (input) => getSummary(database, input.actorId),
  listPeople: async (input) => listPeople(database, input.actorId),
  getPerson: async (input) => getPerson(database, input.actorId, input.personId),
  getPermissionMatrix: async (input) => getPermissionMatrix(database, input.actorId),
  listWarehouses: async (input) => listWarehouses(database, input.actorId),
  listAuditLog: async (input) => listAuditLog(database, input.actorId),
  invitePerson: async (input) => invitePerson(database, input),
  updatePersonRole: async (input) => updatePersonRole(database, input),
  setPersonAccess: async (input) => setPersonAccess(database, input),
  removePerson: async (input) => removePerson(database, input),
  createWarehouse: async (input) => createWarehouse(database, input),
  updateWarehouse: async (input) => updateWarehouse(database, input),
});
