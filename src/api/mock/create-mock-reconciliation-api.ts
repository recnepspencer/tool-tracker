import type { ReconciliationApi } from '../contracts/reconciliation-api';
import type { MockDatabase } from './mock-database';
import { listIssues } from './reconciliation-queries';
import { dismissDuplicate, mergeDuplicate, resolveCustodyMismatch } from './reconciliation-mutations';

export const createMockReconciliationApi = (database: MockDatabase): ReconciliationApi => ({
  listIssues: async ({ actorId }) => listIssues(database, actorId),
  dismissDuplicate: async (input) => dismissDuplicate(database, input),
  mergeDuplicate: async (input) => mergeDuplicate(database, input),
  resolveCustodyMismatch: async (input) => resolveCustodyMismatch(database, input),
});
