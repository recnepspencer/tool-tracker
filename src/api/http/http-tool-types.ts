import type { ToolCondition, ToolLifecycle } from '../../domain/tool';
import type { ToolView } from '../../domain/read-models/tools';
import type { HolderDto } from './http-holder-types';

export interface ToolDto {
  tool_id: string;
  revision: number;
  display_name: string;
  manufacturer: string;
  model: string;
  category: string;
  image_url: string;
  display_status: ToolView['status'];
  holder: HolderDto;
  last_moved_at: string;
  serial_number?: string;
}

export interface CatalogWarehouseDto {
  warehouse_id: string;
  name: string;
  unit_count: number;
}

export interface WarehouseReferenceDto {
  warehouse_id: string;
  name: string;
}

export interface CatalogUnitDto {
  unit_id: string;
  warehouse_id: string;
  display_status: ToolView['status'];
}

export interface CatalogDto {
  definition_id: string;
  display_name: string;
  manufacturer: string;
  model: string;
  category: string;
  image_url: string;
  unit_ids: string[];
  total_count: number;
  available_count: number;
  checked_out_count: number;
  damaged_count: number;
  lost_count: number;
  units: CatalogUnitDto[];
  warehouses: CatalogWarehouseDto[];
}

export interface DetailDto {
  tool: ToolDto;
  origin_warehouse: WarehouseReferenceDto;
  condition: ToolCondition;
  lifecycle: ToolLifecycle;
  timeline: import('./http-activity-types').ActivityDto[];
}
