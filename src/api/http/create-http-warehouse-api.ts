import type { WarehouseApi } from '../contracts/warehouse-api';
import type { HttpApiOptions } from './http-options';
import type {
  WarehouseInventoryItemDto,
  WarehouseMutationReceiptDto,
  WarehouseQueueItemDto,
  WarehouseScopeDto,
  WarehouseSummaryDto,
} from './http-warehouse-types';
import {
  mapWarehouseInventory,
  mapWarehouseQueue,
  mapWarehouseScopes,
  mapWarehouseSummary,
} from './http-warehouse-mappers';
import { mapWarehouseMutation } from './http-warehouse-command-mappers';
import { pathWithBase, responseArray } from './http-transport';
import { toEvidenceDto } from './http-evidence';
import {
  normalizeWarehouseHandoffCommandInput,
  normalizeWarehouseToolCommandInput,
} from '../warehouse-command-normalization';

const scopeQuery = (actorId: string, warehouseId?: string) =>
  '?actor_id=' + encodeURIComponent(actorId) + (warehouseId ? '&warehouse_id=' + encodeURIComponent(warehouseId) : '');

type WarehouseMutationPost = {
  path: string;
  body: unknown;
  operation: Parameters<typeof mapWarehouseMutation>[1];
  toolUnitId?: string;
  handoffId?: string;
};

export const createHttpWarehouseApi = ({ transport, basePath = '/api' }: HttpApiOptions): WarehouseApi => {
  const postAndMapWarehouseMutation = async ({ path, body, operation, toolUnitId, handoffId }: WarehouseMutationPost) =>
    mapWarehouseMutation(
      await transport.post<WarehouseMutationReceiptDto>(pathWithBase(basePath, path), body),
      operation,
      toolUnitId,
      handoffId,
    );
  return {
    listScopes: async ({ actorId }) =>
      mapWarehouseScopes(
        responseArray<WarehouseScopeDto>(
          await transport.get(pathWithBase(basePath, '/warehouse/scopes?actor_id=' + encodeURIComponent(actorId))),
          'warehouse scopes',
        ),
      ),
    listQueue: async ({ actorId, warehouseId }) =>
      mapWarehouseQueue(
        responseArray<WarehouseQueueItemDto>(
          await transport.get(pathWithBase(basePath, '/warehouse/queue' + scopeQuery(actorId, warehouseId))),
          'warehouse queue',
        ),
      ),
    listInventory: async ({ actorId, warehouseId, includeArchived }) =>
      mapWarehouseInventory(
        responseArray<WarehouseInventoryItemDto>(
          await transport.get(
            pathWithBase(
              basePath,
              '/warehouse/inventory' +
                scopeQuery(actorId, warehouseId) +
                '&include_archived=' +
                String(Boolean(includeArchived)),
            ),
          ),
          'warehouse inventory',
        ),
      ),
    getSummary: async ({ actorId, warehouseId }) =>
      mapWarehouseSummary(
        await transport.get<WarehouseSummaryDto>(
          pathWithBase(basePath, '/warehouse/summary' + scopeQuery(actorId, warehouseId)),
        ),
      ),
    approveRequest: (input) => {
      const { actorId, handoffId, toolUnitId, evidence } = normalizeWarehouseHandoffCommandInput(input);
      return postAndMapWarehouseMutation({
        path: '/warehouse/queue/' + encodeURIComponent(handoffId) + '/approve',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        operation: 'approve-request',
        toolUnitId,
        handoffId,
      });
    },
    acceptReturn: (input) => {
      const { actorId, handoffId, toolUnitId, evidence } = normalizeWarehouseHandoffCommandInput(input);
      return postAndMapWarehouseMutation({
        path: '/warehouse/queue/' + encodeURIComponent(handoffId) + '/accept-return',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        operation: 'accept-return',
        toolUnitId,
        handoffId,
      });
    },
    declineQueueItem: (input) => {
      const { actorId, handoffId, toolUnitId, evidence } = normalizeWarehouseHandoffCommandInput(input);
      return postAndMapWarehouseMutation({
        path: '/warehouse/queue/' + encodeURIComponent(handoffId) + '/decline',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        operation: 'decline-queue-item',
        toolUnitId,
        handoffId,
      });
    },
    returnTool: async (input) => {
      const { actorId, toolUnitId, expectedRevision, evidence } = normalizeWarehouseToolCommandInput(input);
      return postAndMapWarehouseMutation({
        path: '/warehouse/tools/' + encodeURIComponent(toolUnitId) + '/return',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          expected_revision: expectedRevision,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        operation: 'return-tool',
        toolUnitId,
      });
    },
    decommissionTool: async (input) => {
      const { actorId, toolUnitId, expectedRevision, evidence } = normalizeWarehouseToolCommandInput(input);
      return postAndMapWarehouseMutation({
        path: '/warehouse/tools/' + encodeURIComponent(toolUnitId) + '/decommission',
        body: {
          actor_id: actorId,
          tool_unit_id: toolUnitId,
          expected_revision: expectedRevision,
          ...(toEvidenceDto(evidence) ? { evidence: toEvidenceDto(evidence) } : {}),
        },
        operation: 'decommission-tool',
        toolUnitId,
      });
    },
  };
};
