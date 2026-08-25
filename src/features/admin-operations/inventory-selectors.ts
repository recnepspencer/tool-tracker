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

export interface InventoryToolGroup {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  imageSrc: string;
  items: WarehouseInventoryItemView[];
}

const normalizedGroupPart = (value: string) => value.trim().toLocaleLowerCase();

export const groupInventoryItems = (items: WarehouseInventoryItemView[]): InventoryToolGroup[] => {
  const groups = new Map<string, InventoryToolGroup>();
  items.forEach((item) => {
    const id = [item.categoryId, item.toolName, item.brand, item.model].map(normalizedGroupPart).join('::');
    const existing = groups.get(id);
    if (existing) {
      existing.items.push(item);
      return;
    }
    groups.set(id, {
      id,
      name: item.toolName,
      brand: item.brand,
      model: item.model,
      category: item.category,
      imageSrc: item.imageSrc,
      items: [item],
    });
  });
  return [...groups.values()];
};
