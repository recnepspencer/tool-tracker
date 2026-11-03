import type { Model } from './client';
import { toolStatus } from './tool-status';

type Asset = Model<'AssetView'>;

/** The demo's `ToolCatalogItem`: live units grouped by shared tool model. */
export interface CatalogItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  photoId: string | null;
  units: Asset[];
  availableCount: number;
  checkedOutCount: number;
  attentionCount: number;
  lostCount: number;
}

export interface CatalogFilterState {
  search: string;
  warehouse: string;
  category: string;
  availableOnly: boolean;
}

export interface CatalogOption {
  id: string;
  name: string;
}

/** Only active units belong in the checkout catalog. */
const catalogUnits = (tools: Asset[]) => tools.filter((tool) => tool.lifecycle === 'active');

const unitMatches = (unit: Asset, filters: CatalogFilterState) =>
  (!filters.warehouse || unit.responsible_warehouse_id === filters.warehouse) &&
  (!filters.category || unit.category_id === filters.category) &&
  (!filters.availableOnly || unit.requestable);

/**
 * Group matching units by model and recompute the counts from the units that
 * survive the warehouse, category and availability filters (the demo's
 * `filterCatalog` + `scopeCatalogItem`).
 */
export function catalogItems(tools: Asset[], filters: CatalogFilterState): CatalogItem[] {
  const search = filters.search.trim().toLowerCase();
  const groups = new Map<string, Asset[]>();
  for (const unit of catalogUnits(tools)) {
    if (!unitMatches(unit, filters)) continue;
    groups.set(unit.tool_model_id, [...(groups.get(unit.tool_model_id) ?? []), unit]);
  }
  return [...groups.entries()]
    .map(([id, units]): CatalogItem => {
      const first = units[0]!;
      const statuses = units.map(toolStatus);
      return {
        id,
        name: first.name,
        brand: first.manufacturer,
        model: first.model_number,
        category: first.category_name,
        photoId: units.find((unit) => unit.registration_photo_id)?.registration_photo_id ?? null,
        units,
        availableCount: units.filter((unit) => unit.requestable).length,
        checkedOutCount: statuses.filter((status) => status === 'checked-out').length,
        attentionCount: statuses.filter((status) => status === 'damaged').length,
        lostCount: statuses.filter((status) => status === 'lost').length,
      };
    })
    .filter((item) =>
      `${item.name} ${item.brand} ${item.model} ${item.category} ${item.units
        .map((unit) => `${unit.asset_tag} ${unit.serial_number ?? ''}`)
        .join(' ')}`
        .toLowerCase()
        .includes(search),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

const options = (pairs: Iterable<[string, string]>): CatalogOption[] =>
  [...new Map(pairs).entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

export const catalogWarehouses = (tools: Asset[]) =>
  options(catalogUnits(tools).map((unit) => [unit.responsible_warehouse_id, unit.responsible_warehouse_name]));

export const catalogCategories = (tools: Asset[]) =>
  options(catalogUnits(tools).map((unit) => [unit.category_id, unit.category_name]));

/** The unit a card opens: the first requestable one, otherwise the first unit. */
export function catalogTarget(item: CatalogItem) {
  const requestable = item.units.filter((unit) => unit.requestable);
  return {
    unit: requestable[0] ?? item.units[0]!,
    requestUnits: requestable.map((unit) => ({
      unitId: unit.id,
      warehouseId: unit.warehouse_id ?? unit.responsible_warehouse_id,
      warehouseName: unit.warehouse_name ?? unit.responsible_warehouse_name,
    })),
  };
}
