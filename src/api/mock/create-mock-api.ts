import type { NelsonApi } from '../contracts';
import { createMockActivityApi } from './create-mock-activity-api';
import { createMockAdminApi } from './create-mock-admin-api';
import { createMockAuthApi } from './create-mock-auth-api';
import { createMockCustodyApi } from './create-mock-custody-api';
import { createMockToolsApi } from './create-mock-tools-api';
import { createMockWarehouseApi } from './create-mock-warehouse-api';
import { createMockReconciliationApi } from './create-mock-reconciliation-api';
import { createMockSettingsApi } from './create-mock-settings-api';
import { createMockDatabase, type MockDatabase } from './mock-database';

export const createMockApi = (database: MockDatabase = createMockDatabase()): NelsonApi => ({
  auth: createMockAuthApi(database),
  tools: createMockToolsApi(database),
  custody: createMockCustodyApi(database),
  activity: createMockActivityApi(database),
  admin: createMockAdminApi(database),
  warehouse: createMockWarehouseApi(database),
  reconciliation: createMockReconciliationApi(database),
  settings: createMockSettingsApi(database),
});
