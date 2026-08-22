import type { ToolCatalogItem } from '../../domain/read-models/tools';

export type CatalogAvailability = 'all' | 'available' | 'checked-out' | 'damaged' | 'lost';

export interface CatalogFilters {
  search: string;
  warehouseId: string;
  category: string;
  availability: CatalogAvailability;
}

export const defaultCatalogFilters: CatalogFilters = {
  search: '',
  warehouseId: 'all',
  category: 'all',
  availability: 'available',
};

const matchesAvailability = (status: ToolCatalogItem['units'][number]['status'], availability: CatalogAvailability) =>
  availability === 'all' ||
  (availability === 'available' && status === 'in-stock') ||
  (availability === 'checked-out' && status === 'checked-out') ||
  (availability === 'damaged' && status === 'damaged') ||
  (availability === 'lost' && status === 'lost');

export function matchingCatalogUnits(item: ToolCatalogItem, filters: CatalogFilters) {
  return item.units.filter(
    (unit) =>
      (filters.warehouseId === 'all' || unit.warehouseId === filters.warehouseId) &&
      matchesAvailability(unit.status, filters.availability),
  );
}

export function filterCatalog(items: ToolCatalogItem[], filters: CatalogFilters) {
  const search = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    const searchable = `${item.name} ${item.brand} ${item.model} ${item.category}`.toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    const matchingUnits = matchingCatalogUnits(item, filters);
    const matchesWarehouse = matchingUnits.length > 0;
    const matchesCategory = filters.category === 'all' || item.category === filters.category;
    return matchesSearch && matchesWarehouse && matchesCategory;
  });
}

export function scopeCatalogItem(item: ToolCatalogItem, filters: CatalogFilters): ToolCatalogItem {
  const units = matchingCatalogUnits(item, filters);
  const warehouseCounts = new Map<string, number>();
  units.forEach((unit) => warehouseCounts.set(unit.warehouseId, (warehouseCounts.get(unit.warehouseId) ?? 0) + 1));
  return {
    ...item,
    unitIds: units.map((unit) => unit.id),
    units,
    totalCount: units.length,
    availableCount: units.filter((unit) => unit.status === 'in-stock').length,
    checkedOutCount: units.filter((unit) => unit.status === 'checked-out').length,
    damagedCount: units.filter((unit) => unit.status === 'damaged').length,
    lostCount: units.filter((unit) => unit.status === 'lost').length,
    warehouses: [...warehouseCounts.entries()].map(([id, unitCount]) => ({
      id,
      name: item.warehouses.find((warehouse) => warehouse.id === id)?.name ?? id,
      unitCount,
    })),
  };
}

export function catalogCategories(items: ToolCatalogItem[]) {
  return [...new Set(items.map((item) => item.category))].sort();
}

export function catalogWarehouses(items: ToolCatalogItem[]) {
  const warehouses = new Map<string, string>();
  items.forEach((item) => item.warehouses.forEach((warehouse) => warehouses.set(warehouse.id, warehouse.name)));
  return [...warehouses.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
