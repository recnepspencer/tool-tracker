import { compareActivityTimestamps, formatActivityTimestamp } from '../../domain/activity';
import { TOOL_CONDITIONS, TOOL_LIFECYCLES, TOOL_STATUSES } from '../../domain/tool';
import type {
  WarehouseInventoryItemView,
  WarehouseOperationsSummary,
  WarehouseQueueItemView,
  WarehouseScopeView,
} from '../../domain/read-models/warehouse-operations';
import { assertUniqueIds } from './http-transport';
import {
  instantValue,
  nonBlankStringValue,
  nonNegativeIntegerValue,
  positiveIntegerValue,
  oneOf,
  required,
  arrayValue,
} from './http-validation';
import { mapHolder } from './http-holder-mapper';
import type {
  WarehouseInventoryItemDto,
  WarehouseQueueItemDto,
  WarehouseScopeDto,
  WarehouseSummaryDto,
} from './http-warehouse-types';

const mapQueueItem = (dto: WarehouseQueueItemDto): WarehouseQueueItemView => {
  const requestedAtInstant = instantValue(dto.requested_at, 'warehouse queue time');
  const from = mapHolder(required(dto.from, 'warehouse queue from'), 'warehouse queue from');
  const to = mapHolder(required(dto.to, 'warehouse queue to'), 'warehouse queue to');
  const kind = oneOf(dto.kind, ['request', 'return'] as const, 'warehouse queue kind');
  const personId = nonBlankStringValue(dto.person_id, 'warehouse queue person id');
  const warehouseId = nonBlankStringValue(dto.warehouse_id, 'warehouse queue warehouse id');
  const shapeIsValid =
    (kind === 'request' && from.type === 'warehouse' && to.type === 'worker' && to.userId === personId) ||
    (kind === 'return' && from.type === 'worker' && to.type === 'warehouse' && from.userId === personId);
  if (!shapeIsValid) throw new Error('Invalid API response: warehouse queue holder shape');
  if (to.type === 'warehouse' && to.warehouseId !== warehouseId) {
    throw new Error('Invalid API response: warehouse queue warehouse reference');
  }
  if (from.type === 'warehouse' && from.warehouseId !== warehouseId && kind === 'request') {
    throw new Error('Invalid API response: warehouse queue warehouse reference');
  }
  return {
    id: nonBlankStringValue(dto.handoff_id, 'warehouse queue handoff id'),
    kind,
    toolUnitId: nonBlankStringValue(dto.tool_unit_id, 'warehouse queue tool id'),
    toolName: nonBlankStringValue(dto.tool_name, 'warehouse queue tool name'),
    imageSrc: nonBlankStringValue(dto.image_url, 'warehouse queue image'),
    warehouseId,
    warehouseName: nonBlankStringValue(dto.warehouse_name, 'warehouse queue warehouse name'),
    personId,
    personName: nonBlankStringValue(dto.person_name, 'warehouse queue person name'),
    personRole: nonBlankStringValue(dto.person_role, 'warehouse queue person role'),
    requestedAt: formatActivityTimestamp(requestedAtInstant),
    requestedAtInstant,
    from,
    to,
    ...(dto.note === undefined ? {} : { note: nonBlankStringValue(dto.note, 'warehouse queue note') }),
  };
};

export const mapWarehouseQueue = (value: unknown): WarehouseQueueItemView[] =>
  assertUniqueIds(
    arrayValue<WarehouseQueueItemDto>(value, 'warehouse queue').map(mapQueueItem),
    'warehouse queue',
  ).sort(
    (left, right) =>
      compareActivityTimestamps(left.requestedAtInstant, right.requestedAtInstant) || left.id.localeCompare(right.id),
  );

export const mapWarehouseScopes = (value: unknown): WarehouseScopeView[] => {
  const scopes = arrayValue<WarehouseScopeDto>(value, 'warehouse scopes').map((scope) => ({
    id: nonBlankStringValue(scope.warehouse_id, 'warehouse scope id'),
    name: nonBlankStringValue(scope.name, 'warehouse scope name'),
    address: nonBlankStringValue(scope.address, 'warehouse scope address'),
  }));
  if (new Set(scopes.map((scope) => scope.id)).size !== scopes.length) {
    throw new Error('Invalid API response: warehouse scope ids');
  }
  return scopes;
};

const mapInventoryItem = (dto: WarehouseInventoryItemDto): WarehouseInventoryItemView => {
  const status = oneOf(dto.display_status, TOOL_STATUSES, 'warehouse inventory status');
  const condition = oneOf(dto.condition, TOOL_CONDITIONS, 'warehouse inventory condition');
  const lifecycle = oneOf(dto.lifecycle, TOOL_LIFECYCLES, 'warehouse inventory lifecycle');
  const holder = mapHolder(required(dto.holder, 'warehouse inventory holder'), 'warehouse inventory');
  const statusMatchesHolder =
    (status === 'in-stock' && holder.type === 'warehouse') ||
    (status === 'checked-out' && holder.type === 'worker') ||
    status === 'damaged' ||
    status === 'lost';
  const conditionMatchesStatus =
    (condition === 'serviceable' && (status === 'in-stock' || status === 'checked-out')) ||
    (condition === 'damaged' && status === 'damaged') ||
    (condition === 'lost' && status === 'lost');
  if (!statusMatchesHolder || !conditionMatchesStatus)
    throw new Error('Invalid API response: warehouse inventory state');
  const lastMovedAt = instantValue(dto.last_moved_at, 'warehouse inventory movement time');
  if (holder.type === 'warehouse' && holder.warehouseId !== dto.warehouse_id) {
    throw new Error('Invalid API response: warehouse inventory holder reference');
  }
  return {
    toolUnitId: nonBlankStringValue(dto.tool_unit_id, 'warehouse inventory tool id'),
    revision: positiveIntegerValue(dto.revision, 'warehouse inventory revision'),
    toolName: nonBlankStringValue(dto.tool_name, 'warehouse inventory tool name'),
    brand: nonBlankStringValue(dto.brand, 'warehouse inventory brand'),
    model: nonBlankStringValue(dto.model, 'warehouse inventory model'),
    categoryId: nonBlankStringValue(dto.category_id, 'warehouse inventory category id'),
    category: nonBlankStringValue(dto.category, 'warehouse inventory category'),
    imageSrc: nonBlankStringValue(dto.image_url, 'warehouse inventory image'),
    warehouseId: nonBlankStringValue(dto.warehouse_id, 'warehouse inventory warehouse id'),
    warehouseName: nonBlankStringValue(dto.warehouse_name, 'warehouse inventory warehouse name'),
    status,
    condition,
    lifecycle,
    holder,
    lastMoved: formatActivityTimestamp(lastMovedAt),
    lastMovedAt,
    ...(dto.serial === undefined ? {} : { serial: nonBlankStringValue(dto.serial, 'warehouse inventory serial') }),
    ...(dto.price === undefined ? {} : { price: nonBlankStringValue(dto.price, 'warehouse inventory price') }),
  };
};

export const mapWarehouseInventory = (value: unknown): WarehouseInventoryItemView[] =>
  (() => {
    const items = arrayValue<WarehouseInventoryItemDto>(value, 'warehouse inventory').map(mapInventoryItem);
    if (new Set(items.map((item) => item.toolUnitId)).size !== items.length) {
      throw new Error('Invalid API response: warehouse inventory ids');
    }
    return items;
  })();

export const mapWarehouseSummary = (dto: WarehouseSummaryDto): WarehouseOperationsSummary => {
  const queueCount = nonNegativeIntegerValue(dto.queue_count, 'warehouse queue count');
  const requestCount = nonNegativeIntegerValue(dto.request_count, 'warehouse request count');
  const returnCount = nonNegativeIntegerValue(dto.return_count, 'warehouse return count');
  const inventoryCount = nonNegativeIntegerValue(dto.inventory_count, 'warehouse inventory count');
  const flaggedCount = nonNegativeIntegerValue(dto.flagged_count, 'warehouse flagged count');
  const archivedCount = nonNegativeIntegerValue(dto.archived_count, 'warehouse archived count');
  if (requestCount + returnCount !== queueCount || flaggedCount > inventoryCount || archivedCount < 0) {
    throw new Error('Invalid API response: warehouse summary aggregates');
  }
  return { queueCount, requestCount, returnCount, inventoryCount, flaggedCount, archivedCount };
};
