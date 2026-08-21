import type { WarehouseMutationReceipt } from '../../domain/warehouse-operation';
import type {
  WarehouseInventoryItemView,
  WarehouseOperationsSummary,
  WarehouseQueueItemView,
  WarehouseScopeView,
} from '../../domain/read-models/warehouse-operations';
import type { CustodyEvidence } from '../../domain/evidence';

export interface WarehouseActorInput {
  actorId: string;
  warehouseId?: string;
}

export type WarehouseQueueInput = WarehouseActorInput;

export interface WarehouseInventoryInput extends WarehouseActorInput {
  includeArchived?: boolean;
}

export interface WarehouseHandoffCommandInput {
  actorId: string;
  handoffId: string;
  toolUnitId: string;
  evidence?: CustodyEvidence;
}

export interface WarehouseToolCommandInput {
  actorId: string;
  toolUnitId: string;
  expectedRevision: number;
  evidence?: CustodyEvidence;
}

export interface WarehouseApi {
  listScopes(input: { actorId: string }): Promise<WarehouseScopeView[]>;
  listQueue(input: WarehouseQueueInput): Promise<WarehouseQueueItemView[]>;
  listInventory(input: WarehouseInventoryInput): Promise<WarehouseInventoryItemView[]>;
  getSummary(input: WarehouseActorInput): Promise<WarehouseOperationsSummary>;
  approveRequest(input: WarehouseHandoffCommandInput): Promise<WarehouseMutationReceipt>;
  acceptReturn(input: WarehouseHandoffCommandInput): Promise<WarehouseMutationReceipt>;
  declineQueueItem(input: WarehouseHandoffCommandInput): Promise<WarehouseMutationReceipt>;
  returnTool(input: WarehouseToolCommandInput): Promise<WarehouseMutationReceipt>;
  decommissionTool(input: WarehouseToolCommandInput): Promise<WarehouseMutationReceipt>;
}
