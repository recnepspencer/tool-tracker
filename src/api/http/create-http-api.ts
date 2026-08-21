import type { NelsonApi } from '../contracts';
import { createHttpActivityApi } from './create-http-activity-api';
import { createHttpAdminApi } from './create-http-admin-api';
import { createHttpAuthApi } from './create-http-auth-api';
import { createHttpCustodyApi } from './create-http-custody-api';
import { createHttpToolsApi } from './create-http-tools-api';
import { createHttpWarehouseApi } from './create-http-warehouse-api';
import { createHttpReconciliationApi } from './create-http-reconciliation-api';
import { createHttpSettingsApi } from './create-http-settings-api';
import type { HttpApiOptions } from './http-options';

export type { HttpApiOptions, HttpTransport } from './http-options';

export const createHttpApi = (options: HttpApiOptions): NelsonApi => ({
  auth: createHttpAuthApi(options),
  tools: createHttpToolsApi(options),
  custody: createHttpCustodyApi(options),
  activity: createHttpActivityApi(options),
  admin: createHttpAdminApi(options),
  warehouse: createHttpWarehouseApi(options),
  reconciliation: createHttpReconciliationApi(options),
  settings: createHttpSettingsApi(options),
});
