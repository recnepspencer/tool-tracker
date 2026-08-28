import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';

/**
 * Shared application query-boundary invalidation for mutations that change
 * tool custody projections. Adapters remain mechanism-neutral; feature
 * mutations own when this boundary is invoked.
 */
export const invalidateToolProjections = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.tools, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSummary, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPeopleRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPersonRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminWarehousesRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.authSessionRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.transferTargetsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.toolDetailRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseQueueRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseScopesRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventoryRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseOperationsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditRoot, refetchType: 'all' }),
  ]);
};

export const invalidateAdminProjections = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSummary, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPeopleRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPersonRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminWarehousesRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.authSessionRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tools, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingHandoffsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.transferTargetsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.demoProfiles, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.toolDetailRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseQueueRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseScopesRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventoryRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseOperationsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditRoot, refetchType: 'all' }),
  ]);
};

export const invalidateWarehouseProjections = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseQueueRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseScopesRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventoryRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseOperationsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.toolDetailRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tools, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSummary, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPeopleRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminPersonRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminWarehousesRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingHandoffsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.transferTargetsRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.authSessionRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditRoot, refetchType: 'all' }),
  ]);
};

export const invalidateSettingsProjections = async (queryClient: QueryClient) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.companyProfile, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.toolCategories, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminAuditRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.adminSummary, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tools, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.catalog, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.toolDetailRoot, refetchType: 'all' }),
    queryClient.invalidateQueries({ queryKey: queryKeys.warehouseInventoryRoot, refetchType: 'all' }),
  ]);
};

export const invalidateAllProjections = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ refetchType: 'all' });
};
