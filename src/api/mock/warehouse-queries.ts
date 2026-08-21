import { compareActivityTimestamps, formatActivityTimestamp } from '../../domain/activity';
import type {
  WarehouseInventoryItemView,
  WarehouseOperationsSummary,
  WarehouseQueueItemView,
  WarehouseScopeView,
} from '../../domain/read-models/warehouse-operations';
import { toHolderView } from './mock-holder-projection';
import { toToolView } from './mock-tool-projections';
import type { MockDatabase } from './mock-database';
import type { MockState } from './mock-state';
import { requireWarehouseActor } from './warehouse-authorization';
import { classifyWarehouseQueueItem } from '../../domain/warehouse-queue';
import { currentWarehouseForUnit } from '../../domain/warehouse-responsibility';
import { warehouseFor } from './holder-state';
import { toolRevision } from '../../domain/tool';

export const toQueueItem = (state: MockState, handoffId: string): WarehouseQueueItemView => {
  const handoff = state.handoffs.find((candidate) => candidate.id === handoffId);
  if (!handoff) throw new Error('Queue handoff not found: ' + handoffId);
  const kind = classifyWarehouseQueueItem(handoff);
  if (!kind) throw new Error('Unsupported warehouse handoff: ' + handoff.id);
  const tool = toToolView(state, handoff.toolUnitId);
  const personId =
    kind === 'request'
      ? (handoff.to as { type: 'worker'; userId: string }).userId
      : (handoff.from as { type: 'worker'; userId: string }).userId;
  const person = state.users.find((candidate) => candidate.id === personId);
  const warehouseId = warehouseFor(state, kind === 'request' ? handoff.from : handoff.to, handoff.toolUnitId);
  const warehouse = state.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!person || !warehouse) throw new Error('Queue reference is incomplete: ' + handoff.id);
  return {
    id: handoff.id,
    kind,
    toolUnitId: handoff.toolUnitId,
    toolName: tool.name,
    imageSrc: tool.imageSrc,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    personId: person.id,
    personName: person.name,
    personRole: person.title,
    requestedAt: formatActivityTimestamp(handoff.requestedAt),
    requestedAtInstant: handoff.requestedAt,
    from: toHolderView(
      handoff.from,
      new Map(state.users.map((user) => [user.id, user.name])),
      new Map(state.warehouses.map((candidate) => [candidate.id, candidate.name])),
    ),
    to: toHolderView(
      handoff.to,
      new Map(state.users.map((user) => [user.id, user.name])),
      new Map(state.warehouses.map((candidate) => [candidate.id, candidate.name])),
    ),
    ...(handoff.evidence?.note ? { note: handoff.evidence.note } : {}),
  };
};

export const listQueue = (database: MockDatabase, actorId: string, warehouseId?: string) => {
  const state = database.read();
  const { allowedWarehouseIds } = requireWarehouseActor(state, actorId, warehouseId);
  return state.handoffs
    .filter((handoff) => handoff.status === 'pending' && classifyWarehouseQueueItem(handoff) !== null)
    .map((handoff) => toQueueItem(state, handoff.id))
    .filter(
      (item) => allowedWarehouseIds.includes(item.warehouseId) && (!warehouseId || item.warehouseId === warehouseId),
    )
    .sort(
      (left, right) =>
        compareActivityTimestamps(left.requestedAtInstant, right.requestedAtInstant) || left.id.localeCompare(right.id),
    );
};

export const listScopes = (database: MockDatabase, actorId: string): WarehouseScopeView[] => {
  const state = database.read();
  const { allowedWarehouseIds } = requireWarehouseActor(state, actorId);
  return state.warehouses
    .filter((warehouse) => allowedWarehouseIds.includes(warehouse.id))
    .map(({ id, name, address }) => ({ id, name, address }));
};

const currentWarehouseId = (state: MockState, toolUnitId: string) => {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  const custody = state.custody.find((record) => record.toolUnitId === toolUnitId);
  if (!unit || !custody) throw new Error('Inventory reference is incomplete: ' + toolUnitId);
  return currentWarehouseForUnit(unit, custody.holder);
};

const inventoryItem = (state: MockState, toolUnitId: string): WarehouseInventoryItemView => {
  const unit = state.units.find((candidate) => candidate.id === toolUnitId);
  const custody = state.custody.find((record) => record.toolUnitId === toolUnitId);
  if (!unit || !custody) throw new Error('Inventory reference is incomplete: ' + toolUnitId);
  const definition = state.definitions.find((candidate) => candidate.id === unit.definitionId);
  const warehouseId = currentWarehouseId(state, toolUnitId);
  const warehouse = state.warehouses.find((candidate) => candidate.id === warehouseId);
  if (!definition || !warehouse) throw new Error('Inventory definition is incomplete: ' + toolUnitId);
  const tool = toToolView(state, toolUnitId);
  return {
    toolUnitId: unit.id,
    revision: toolRevision(unit, definition),
    toolName: definition.name,
    brand: definition.brand,
    model: definition.model,
    categoryId: definition.categoryId,
    category: tool.category,
    imageSrc: tool.imageSrc,
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    status: tool.status,
    condition: unit.condition,
    lifecycle: unit.lifecycle,
    holder: tool.holder,
    lastMoved: tool.lastMoved,
    lastMovedAt: tool.lastMovedAt,
    ...(unit.serial ? { serial: unit.serial } : {}),
    ...(unit.price ? { price: unit.price } : {}),
  };
};

export const listInventory = (
  database: MockDatabase,
  actorId: string,
  warehouseId?: string,
  includeArchived = false,
) => {
  const state = database.read();
  const { allowedWarehouseIds } = requireWarehouseActor(state, actorId, warehouseId);
  return state.units
    .filter((unit) => includeArchived || unit.lifecycle === 'active')
    .map((unit) => inventoryItem(state, unit.id))
    .filter(
      (item) => allowedWarehouseIds.includes(item.warehouseId) && (!warehouseId || item.warehouseId === warehouseId),
    )
    .sort(
      (left, right) => left.toolName.localeCompare(right.toolName) || left.toolUnitId.localeCompare(right.toolUnitId),
    );
};

export const getSummary = (
  database: MockDatabase,
  actorId: string,
  warehouseId?: string,
): WarehouseOperationsSummary => {
  const queue = listQueue(database, actorId, warehouseId);
  const inventory = listInventory(database, actorId, warehouseId, true);
  return {
    queueCount: queue.length,
    requestCount: queue.filter((item) => item.kind === 'request').length,
    returnCount: queue.filter((item) => item.kind === 'return').length,
    inventoryCount: inventory.filter((item) => item.lifecycle === 'active').length,
    flaggedCount: inventory.filter(
      (item) => item.lifecycle === 'active' && (item.status === 'damaged' || item.status === 'lost'),
    ).length,
    archivedCount: inventory.filter((item) => item.lifecycle === 'archived').length,
  };
};
