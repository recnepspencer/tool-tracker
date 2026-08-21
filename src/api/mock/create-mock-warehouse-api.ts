import type { WarehouseApi } from '../contracts/warehouse-api';
import type { MockDatabase } from './mock-database';
import { listInventory, listQueue, listScopes, getSummary } from './warehouse-queries';
import { acceptReturn, approveRequest, declineQueueItem } from './warehouse-mutations';
import { decommissionTool, returnTool } from './warehouse-tool-mutations';
import {
  normalizeWarehouseHandoffCommandInput,
  normalizeWarehouseToolCommandInput,
} from '../warehouse-command-normalization';

export const createMockWarehouseApi = (database: MockDatabase): WarehouseApi => ({
  listScopes: async ({ actorId }) => listScopes(database, actorId),
  listQueue: async ({ actorId, warehouseId }) => listQueue(database, actorId, warehouseId),
  listInventory: async ({ actorId, warehouseId, includeArchived }) =>
    listInventory(database, actorId, warehouseId, includeArchived),
  getSummary: async ({ actorId, warehouseId }) => getSummary(database, actorId, warehouseId),
  approveRequest: async (input) => approveRequest(database, normalizeWarehouseHandoffCommandInput(input)),
  acceptReturn: async (input) => acceptReturn(database, normalizeWarehouseHandoffCommandInput(input)),
  declineQueueItem: async (input) => declineQueueItem(database, normalizeWarehouseHandoffCommandInput(input)),
  returnTool: async (input) => returnTool(database, normalizeWarehouseToolCommandInput(input)),
  decommissionTool: async (input) => decommissionTool(database, normalizeWarehouseToolCommandInput(input)),
});
