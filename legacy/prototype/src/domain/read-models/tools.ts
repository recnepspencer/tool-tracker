import type { ActivityView } from './activity';
import type { CatalogWarehouseView } from './catalog';
import type { ToolHolderView } from './holder';
import type { ToolCondition, ToolLifecycle, ToolStatus } from '../tool';
import type { WarehouseReferenceView } from './warehouse-reference';

export interface ToolView {
  id: string;
  revision: number;
  name: string;
  brand: string;
  model: string;
  category: string;
  imageSrc: string;
  status: ToolStatus;
  holder: ToolHolderView;
  lastMoved: string;
  lastMovedAt: string;
  serial?: string;
}

export interface ToolCatalogUnitView {
  id: string;
  warehouseId: string;
  status: ToolStatus;
}

export interface ToolCatalogItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  imageSrc: string;
  unitIds: string[];
  units: ToolCatalogUnitView[];
  totalCount: number;
  availableCount: number;
  checkedOutCount: number;
  damagedCount: number;
  lostCount: number;
  warehouses: CatalogWarehouseView[];
}

export interface ToolDetailView {
  tool: ToolView;
  originWarehouse: WarehouseReferenceView;
  condition: ToolCondition;
  lifecycle: ToolLifecycle;
  timeline: ActivityView[];
}
