import type { ToolCondition, ToolLifecycle, ToolStatus } from '../../domain/tool';
import type { WarehouseQueueKind } from '../../domain/warehouse-queue';
import type { HolderDto } from './http-holder-types';

export interface WarehouseQueueItemDto {
  handoff_id: string;
  kind: WarehouseQueueKind;
  tool_unit_id: string;
  tool_name: string;
  image_url: string;
  warehouse_id: string;
  warehouse_name: string;
  person_id: string;
  person_name: string;
  person_role: string;
  requested_at: string;
  from: HolderDto;
  to: HolderDto;
  note?: string;
}

export interface WarehouseScopeDto {
  warehouse_id: string;
  name: string;
  address: string;
}

export interface WarehouseInventoryItemDto {
  tool_unit_id: string;
  revision: number;
  tool_name: string;
  brand: string;
  model: string;
  category_id: string;
  category: string;
  image_url: string;
  warehouse_id: string;
  warehouse_name: string;
  display_status: ToolStatus;
  condition: ToolCondition;
  lifecycle: ToolLifecycle;
  holder: HolderDto;
  last_moved_at: string;
  serial?: string;
  price?: string;
}

export interface WarehouseSummaryDto {
  queue_count: number;
  request_count: number;
  return_count: number;
  inventory_count: number;
  flagged_count: number;
  archived_count: number;
}

export interface WarehouseMutationReceiptDto {
  operation: string;
  correlation_id: string;
  event_id: string;
  tool_unit_id?: string;
  handoff_id?: string;
  affected_tool_unit_ids: string[];
  affected_handoff_ids: string[];
}
