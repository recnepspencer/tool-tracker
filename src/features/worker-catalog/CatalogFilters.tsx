import type { Dispatch, SetStateAction } from 'react';
import { SelectField } from '../../components/ui/SelectField';
import type { ToolCatalogItem } from '../../domain/read-models/tools';
import {
  catalogCategories,
  catalogWarehouses,
  type CatalogAvailability,
  type CatalogFilters as CatalogFiltersState,
} from './catalog-selectors';

const availabilityOptions = [
  { value: 'all', label: 'All tools' },
  { value: 'available', label: 'Available now' },
  { value: 'checked-out', label: 'Checked out' },
  { value: 'damaged', label: 'Needs attention' },
  { value: 'lost', label: 'Lost' },
] as const;

export function CatalogFilters({
  items,
  filters,
  setFilters,
  onClear,
}: {
  items: ToolCatalogItem[];
  filters: CatalogFiltersState;
  setFilters: Dispatch<SetStateAction<CatalogFiltersState>>;
  onClear(): void;
}) {
  const categories = catalogCategories(items);
  const warehouses = catalogWarehouses(items);
  return (
    <div className="catalog-filter-panel" role="region" aria-label="Catalog filters">
      <SelectField
        compact
        label="Availability"
        value={filters.availability}
        onChange={(next) => setFilters((current) => ({ ...current, availability: next as CatalogAvailability }))}
        options={[...availabilityOptions]}
      />
      <SelectField
        compact
        label="Warehouse"
        value={filters.warehouseId}
        onChange={(next) => setFilters((current) => ({ ...current, warehouseId: next }))}
        options={[
          { value: 'all', label: 'All warehouses' },
          ...warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
        ]}
      />
      <SelectField
        compact
        label="Category"
        value={filters.category}
        onChange={(next) => setFilters((current) => ({ ...current, category: next }))}
        options={[
          { value: 'all', label: 'All categories' },
          ...categories.map((category) => ({ value: category, label: category })),
        ]}
      />
      <button type="button" className="text-button" onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}
