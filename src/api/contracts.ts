import type { AdminApi } from './contracts/admin-api';
import type { ActivityApi } from './contracts/activity-api';
import type { AuthApi } from './contracts/auth-api';
import type { CustodyApi } from './contracts/custody-api';
import type { ToolsApi } from './contracts/tools-api';
import type { WarehouseApi } from './contracts/warehouse-api';
import type { ReconciliationApi } from './contracts/reconciliation-api';
import type { SettingsApi } from './contracts/settings-api';

export type { AdminApi } from './contracts/admin-api';
export type { ActivityApi } from './contracts/activity-api';
export type { AuthApi } from './contracts/auth-api';
export type { CustodyApi } from './contracts/custody-api';
export type { ToolsApi } from './contracts/tools-api';
export type { WarehouseApi } from './contracts/warehouse-api';
export type { ReconciliationApi } from './contracts/reconciliation-api';
export type { SettingsApi } from './contracts/settings-api';

export interface NelsonApi {
  auth: AuthApi;
  tools: ToolsApi;
  custody: CustodyApi;
  activity: ActivityApi;
  admin: AdminApi;
  warehouse: WarehouseApi;
  reconciliation: ReconciliationApi;
  settings: SettingsApi;
}
