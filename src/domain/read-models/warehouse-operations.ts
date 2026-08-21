import type { ToolCondition, ToolLifecycle, ToolStatus } from '../tool';
import type { ToolHolderView } from './holder';
import type { WarehouseQueueKind } from '../warehouse-queue';

export type { WarehouseQueueKind } from '../warehouse-queue';

export interface WarehouseScopeView {
  id: string;
  name: string;
  address: string;
}

export interface WarehouseQueueItemView {
  id: string;
  kind: WarehouseQueueKind;
  toolUnitId: string;
  toolName: string;
  imageSrc: string;
  warehouseId: string;
  warehouseName: string;
  personId: string;
  personName: string;
  personRole: string;
  requestedAt: string;
  requestedAtInstant: string;
  from: ToolHolderView;
  to: ToolHolderView;
  note?: string;
}

export interface WarehouseInventoryItemView {
  toolUnitId: string;
  revision: number;
  toolName: string;
  brand: string;
  model: string;
  categoryId: string;
  category: string;
  imageSrc: string;
  warehouseId: string;
  warehouseName: string;
  status: ToolStatus;
  condition: ToolCondition;
  lifecycle: ToolLifecycle;
  holder: ToolHolderView;
  lastMoved: string;
  lastMovedAt: string;
  serial?: string;
  price?: string;
}

export interface WarehouseOperationsSummary {
  queueCount: number;
  requestCount: number;
  returnCount: number;
  inventoryCount: number;
  flaggedCount: number;
  archivedCount: number;
}
