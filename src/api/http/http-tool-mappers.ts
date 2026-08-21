import { compareActivityTimestamps, formatActivityTimestamp } from '../../domain/activity';
import { TOOL_CONDITIONS, TOOL_LIFECYCLES, TOOL_STATUSES } from '../../domain/tool';
import type { CatalogWarehouseView } from '../../domain/read-models/catalog';
import type { ToolCatalogItem, ToolCatalogUnitView, ToolDetailView, ToolView } from '../../domain/read-models/tools';
import type { WarehouseReferenceView } from '../../domain/read-models/warehouse-reference';
import type {
  CatalogDto,
  CatalogUnitDto,
  CatalogWarehouseDto,
  DetailDto,
  ToolDto,
  WarehouseReferenceDto,
} from './http-tool-types';
import { mapActivity } from './http-activity-mappers';
import { mapHolder } from './http-holder-mapper';
import { assertUniqueIds } from './http-transport';
import {
  arrayValue,
  instantValue,
  nonBlankStringValue,
  nonNegativeIntegerValue,
  positiveIntegerValue,
  oneOf,
  required,
} from './http-validation';

export const mapTool = (dto: ToolDto): ToolView => {
  const status = oneOf(dto.display_status, TOOL_STATUSES, 'tool status');
  const holder = mapHolder(required(dto.holder, 'tool holder'), 'tool');
  const lastMovedAt = instantValue(dto.last_moved_at, 'tool movement time');
  const holderMatchesStatus =
    (status === 'in-stock' && holder.type === 'warehouse') ||
    (status === 'checked-out' && holder.type === 'worker') ||
    status === 'damaged' ||
    status === 'lost';
  if (!holderMatchesStatus) throw new Error('Invalid API response: tool status/holder');
  return {
    id: nonBlankStringValue(dto.tool_id, 'tool id'),
    revision: positiveIntegerValue(dto.revision, 'tool revision'),
    name: nonBlankStringValue(dto.display_name, 'tool name'),
    brand: nonBlankStringValue(dto.manufacturer, 'tool manufacturer'),
    model: nonBlankStringValue(dto.model, 'tool model'),
    category: nonBlankStringValue(dto.category, 'tool category'),
    imageSrc: nonBlankStringValue(dto.image_url, 'tool image'),
    status,
    holder,
    lastMoved: formatActivityTimestamp(lastMovedAt),
    lastMovedAt,
    serial: dto.serial_number === undefined ? undefined : nonBlankStringValue(dto.serial_number, 'tool serial'),
  };
};

export const mapCatalogWarehouse = (warehouse: CatalogWarehouseDto): CatalogWarehouseView => ({
  id: nonBlankStringValue(warehouse.warehouse_id, 'catalog warehouse id'),
  name: nonBlankStringValue(warehouse.name, 'catalog warehouse name'),
  unitCount: nonNegativeIntegerValue(warehouse.unit_count, 'catalog warehouse count'),
});

export const mapWarehouseReference = (warehouse: WarehouseReferenceDto): WarehouseReferenceView => ({
  id: nonBlankStringValue(warehouse.warehouse_id, 'origin warehouse id'),
  name: nonBlankStringValue(warehouse.name, 'origin warehouse name'),
});

const catalogUnitReferencesAreConsistent = (unitIds: string[], units: ToolCatalogUnitView[]) => {
  const unitIdSet = new Set(unitIds);
  const projectedUnitIds = new Set(units.map((unit) => unit.id));
  return (
    unitIdSet.size === unitIds.length &&
    projectedUnitIds.size === units.length &&
    unitIds.length === units.length &&
    unitIds.every((id) => projectedUnitIds.has(id))
  );
};

const catalogCountsMatchUnits = (
  units: ToolCatalogUnitView[],
  counts: { total: number; available: number; checkedOut: number; damaged: number; lost: number },
) =>
  counts.total === units.length &&
  counts.available === units.filter((unit) => unit.status === 'in-stock').length &&
  counts.checkedOut === units.filter((unit) => unit.status === 'checked-out').length &&
  counts.damaged === units.filter((unit) => unit.status === 'damaged').length &&
  counts.lost === units.filter((unit) => unit.status === 'lost').length;

const catalogWarehouseCountsMatchUnits = (units: ToolCatalogUnitView[], warehouses: CatalogWarehouseView[]) => {
  const warehouseCounts = new Map<string, number>();
  units.forEach((unit) => warehouseCounts.set(unit.warehouseId, (warehouseCounts.get(unit.warehouseId) ?? 0) + 1));
  const projectedWarehouseIds = new Set(warehouses.map((warehouse) => warehouse.id));
  return (
    projectedWarehouseIds.size === warehouses.length &&
    projectedWarehouseIds.size === warehouseCounts.size &&
    warehouses.every((warehouse) => warehouse.unitCount === warehouseCounts.get(warehouse.id))
  );
};

export const mapCatalog = (dto: CatalogDto): ToolCatalogItem => {
  const unitIds = arrayValue<string>(dto.unit_ids, 'catalog unit ids', (unitId, index) =>
    nonBlankStringValue(unitId, 'catalog unit id ' + index),
  );
  const units = arrayValue<CatalogUnitDto>(dto.units, 'catalog units').map((unit): ToolCatalogUnitView => ({
    id: nonBlankStringValue(unit.unit_id, 'catalog unit id'),
    warehouseId: nonBlankStringValue(unit.warehouse_id, 'catalog unit warehouse'),
    status: oneOf(unit.display_status, TOOL_STATUSES, 'catalog unit status'),
  }));
  if (units.length === 0) throw new Error('Invalid API response: catalog units');
  const totalCount = nonNegativeIntegerValue(dto.total_count, 'catalog total count');
  const availableCount = nonNegativeIntegerValue(dto.available_count, 'catalog available count');
  const checkedOutCount = nonNegativeIntegerValue(dto.checked_out_count, 'catalog checked out count');
  const damagedCount = nonNegativeIntegerValue(dto.damaged_count, 'catalog damaged count');
  const lostCount = nonNegativeIntegerValue(dto.lost_count, 'catalog lost count');
  if (!catalogUnitReferencesAreConsistent(unitIds, units)) {
    throw new Error('Invalid API response: catalog unit references');
  }
  const counts = {
    total: totalCount,
    available: availableCount,
    checkedOut: checkedOutCount,
    damaged: damagedCount,
    lost: lostCount,
  };
  if (!catalogCountsMatchUnits(units, counts)) {
    throw new Error('Invalid API response: catalog aggregate counts');
  }
  const warehouses = arrayValue<CatalogWarehouseDto>(dto.warehouses, 'catalog warehouses').map(mapCatalogWarehouse);
  if (!catalogWarehouseCountsMatchUnits(units, warehouses)) {
    throw new Error('Invalid API response: catalog warehouse counts');
  }
  return {
    id: nonBlankStringValue(dto.definition_id, 'catalog definition id'),
    name: nonBlankStringValue(dto.display_name, 'catalog name'),
    brand: nonBlankStringValue(dto.manufacturer, 'catalog manufacturer'),
    model: nonBlankStringValue(dto.model, 'catalog model'),
    category: nonBlankStringValue(dto.category, 'catalog category'),
    imageSrc: nonBlankStringValue(dto.image_url, 'catalog image'),
    unitIds,
    units,
    totalCount,
    availableCount,
    checkedOutCount,
    damagedCount,
    lostCount,
    warehouses,
  };
};

export const mapDetail = (dto: DetailDto, expectedToolUnitId: string): ToolDetailView => {
  const tool = mapTool(dto.tool);
  if (tool.id !== expectedToolUnitId) throw new Error('Invalid API response: tool detail id');
  const condition = oneOf(dto.condition, TOOL_CONDITIONS, 'tool detail condition');
  const statusMatchesCondition =
    (condition === 'serviceable' && (tool.status === 'in-stock' || tool.status === 'checked-out')) ||
    (condition === 'damaged' && tool.status === 'damaged') ||
    (condition === 'lost' && tool.status === 'lost');
  if (!statusMatchesCondition) throw new Error('Invalid API response: tool detail condition/status');
  const timeline = assertUniqueIds(
    arrayValue<DetailDto['timeline'][number]>(dto.timeline, 'tool detail timeline').map(mapActivity),
    'tool detail timeline event',
  ).sort((left, right) => compareActivityTimestamps(left.timestamp, right.timestamp));
  if (timeline.some((event) => event.toolUnitId !== expectedToolUnitId)) {
    throw new Error('Invalid API response: tool detail timeline unit');
  }
  return {
    tool,
    originWarehouse: mapWarehouseReference(dto.origin_warehouse),
    condition,
    lifecycle: oneOf(dto.lifecycle, TOOL_LIFECYCLES, 'tool detail lifecycle'),
    timeline,
  };
};
