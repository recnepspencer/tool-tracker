import type { MockDatabase } from './mock-database';
import { requireAdminActor } from './admin-authorization';
import { projectReconciliation } from './mock-reconciliation-projections';

export const listIssues = (database: MockDatabase, actorId: string) => {
  const state = database.read();
  requireAdminActor(state, actorId);
  return projectReconciliation(state);
};
