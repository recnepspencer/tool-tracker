import { isFlaggedToolStatus } from '../../domain/tool';
import type { WarehouseInventoryItemView } from '../../domain/read-models/warehouse-operations';

export type InventoryFilter = 'all' | 'in-stock' | 'checked-out' | 'flagged' | 'archived';

const matchesFilter = (item: WarehouseInventoryItemView, filter: InventoryFilter) => {
  if (filter === 'archived') return item.lifecycle === 'archived';
  if (item.lifecycle === 'archived') return false;
  if (filter === 'flagged') return isFlaggedToolStatus(item.status);
  return filter === 'all' || item.status === filter;
};

const matchesSearch = (item: WarehouseInventoryItemView, search: string) => {
  const query = search.trim().toLocaleLowerCase();
  return (
    !query ||
    `${item.toolName} ${item.toolUnitId} ${item.category} ${item.warehouseName}`.toLocaleLowerCase().includes(query)
  );
};

export const filterInventoryItems = (items: WarehouseInventoryItemView[], filter: InventoryFilter, search = '') =>
  items.filter((item) => matchesFilter(item, filter) && matchesSearch(item, search));

export const countInventoryFilter = (items: WarehouseInventoryItemView[], filter: InventoryFilter) =>
  items.filter((item) => matchesFilter(item, filter)).length;

export const flaggedInventoryItems = (items: WarehouseInventoryItemView[], search = '') =>
  filterInventoryItems(items, 'flagged', search);
