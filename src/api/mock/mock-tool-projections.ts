import { compareActivityTimestamps, formatActivityTimestamp } from '../../domain/activity';
import type { ActivityView } from '../../domain/read-models/activity';
import type { CatalogWarehouseView } from '../../domain/read-models/catalog';
import type { ToolCatalogItem, ToolCatalogUnitView, ToolDetailView, ToolView } from '../../domain/read-models/tools';
import { deriveToolStatus, toolRevision } from '../../domain/tool';
import { toActivityView } from './mock-activity-projections';
import { toHolderView } from './mock-holder-projection';
import { warehouseFor } from './holder-state';
import type { MockState } from './mock-state';

export const toToolView = (state: MockState, unitId: string): ToolView => {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) throw new Error('Tool unit not found: ' + unitId);
  const definition = state.definitions.find((candidate) => candidate.id === unit.definitionId);
  const custody = state.custody.find((candidate) => candidate.toolUnitId === unit.id);
  if (!definition || !custody) throw new Error('Tool projection is incomplete: ' + unit.id);
  const userNames = new Map(state.users.map((user) => [user.id, user.name]));
  const warehouseNames = new Map(state.warehouses.map((warehouse) => [warehouse.id, warehouse.name]));
  const status = deriveToolStatus(unit, custody.holder);
  const category = state.categories.find((candidate) => candidate.id === definition.categoryId)?.name;
  if (!category) throw new Error('Tool category authority is missing: ' + definition.categoryId);
  return {
    id: unit.id,
    revision: toolRevision(unit, definition),
    name: definition.name,
    brand: definition.brand,
    model: definition.model,
    category,
    imageSrc: './tool-images/' + (unit.photoKey ?? definition.imageKey),
    status,
    holder: toHolderView(custody.holder, userNames, warehouseNames),
    lastMoved: formatActivityTimestamp(custody.sinceAt),
    lastMovedAt: custody.sinceAt,
    serial: unit.serial,
  };
};

export const toCatalogItem = (state: MockState, definitionId: string): ToolCatalogItem => {
  const definition = state.definitions.find((candidate) => candidate.id === definitionId);
  const units = state.units.filter((unit) => unit.lifecycle === 'active' && unit.definitionId === definitionId);
  if (!definition || !units.length) throw new Error('Catalog definition not found: ' + definitionId);
  const views = units.map((unit) => toToolView(state, unit.id));
  const category = state.categories.find((candidate) => candidate.id === definition.categoryId)?.name;
  if (!category) throw new Error('Tool category authority is missing: ' + definition.categoryId);
  const catalogUnits: ToolCatalogUnitView[] = units.map((unit, index) => {
    const custody = state.custody.find((record) => record.toolUnitId === unit.id);
    if (!custody) throw new Error('Tool projection is incomplete: ' + unit.id);
    return { id: unit.id, warehouseId: warehouseFor(state, custody.holder, unit.id), status: views[index].status };
  });
  const warehouseCounts = new Map<string, number>();
  catalogUnits.forEach((unit) =>
    warehouseCounts.set(unit.warehouseId, (warehouseCounts.get(unit.warehouseId) ?? 0) + 1),
  );
  const warehouses: CatalogWarehouseView[] = [...warehouseCounts.entries()].map(([id, unitCount]) => ({
    id,
    name: state.warehouses.find((warehouse) => warehouse.id === id)?.name ?? 'Unknown warehouse',
    unitCount,
  }));
  return {
    id: definition.id,
    name: definition.name,
    brand: definition.brand,
    model: definition.model,
    category,
    imageSrc: './tool-images/' + definition.imageKey,
    unitIds: units.map((unit) => unit.id),
    units: catalogUnits,
    totalCount: views.length,
    availableCount: views.filter((tool) => tool.status === 'in-stock').length,
    checkedOutCount: views.filter((tool) => tool.status === 'checked-out').length,
    damagedCount: views.filter((tool) => tool.status === 'damaged').length,
    lostCount: views.filter((tool) => tool.status === 'lost').length,
    warehouses,
  };
};

export const toToolDetail = (state: MockState, toolUnitId: string): ToolDetailView => {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  if (!unit) throw new Error('Tool unit is not available: ' + toolUnitId);
  const warehouse = state.warehouses.find((candidate) => candidate.id === unit.originWarehouseId);
  if (!warehouse) throw new Error('Tool warehouse not found: ' + toolUnitId);
  const timeline: ActivityView[] = state.events
    .filter((event) => event.toolUnitId === toolUnitId)
    .sort((left, right) => compareActivityTimestamps(left.occurredAt, right.occurredAt))
    .map((event) => toActivityView(state, event.id));
  return {
    tool: toToolView(state, toolUnitId),
    originWarehouse: { id: warehouse.id, name: warehouse.name },
    condition: unit.condition,
    lifecycle: unit.lifecycle,
    timeline,
  };
};
