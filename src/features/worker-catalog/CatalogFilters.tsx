import { createPortal } from 'react-dom';
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { ToolCatalogItem } from '../../domain/read-models/tools';
import { catalogCategories, catalogWarehouses, type CatalogFilters as CatalogFiltersState } from './catalog-selectors';

export function CatalogFilters({
  items,
  filters,
  setFilters,
  onClear,
  onClose,
}: {
  items: ToolCatalogItem[];
  filters: CatalogFiltersState;
  setFilters: Dispatch<SetStateAction<CatalogFiltersState>>;
  onClear(): void;
  onClose(): void;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const categories = catalogCategories(items);
  const warehouses = catalogWarehouses(items);
  const availableOnly = filters.availability === 'available';
  return createPortal(
    <div className="worker-filter-layer" role="presentation">
      <button
        type="button"
        className="worker-scrim worker-scrim--strong"
        aria-label="Close filters"
        onClick={onClose}
      />
      <section className="worker-filter-sheet" role="dialog" aria-modal="true" aria-label="Catalog filters">
        <span className="worker-sheet-handle" />
        <div className="worker-filter-heading">
          <h2>Filter</h2>
          <button type="button" onClick={onClear}>
            Reset filters
          </button>
        </div>
        <div className="worker-filter-scroll">
          <button
            type="button"
            className={`worker-filter-toggle${availableOnly ? ' worker-filter-toggle--on' : ''}`}
            onClick={() => setFilters((current) => ({ ...current, availability: availableOnly ? 'all' : 'available' }))}
            aria-pressed={availableOnly}
            aria-label="Available only"
          >
            <span>
              <strong>Available only</strong>
              <small>{availableOnly ? 'Showing units ready to check out' : 'Show every unit in the catalog'}</small>
            </span>
            <span className="worker-filter-switch">
              <span />
            </span>
          </button>
          <FilterChipGroup
            label="Warehouse"
            options={[{ id: 'all', name: 'All warehouses' }, ...warehouses]}
            selected={filters.warehouseId}
            onPick={(id) => setFilters((current) => ({ ...current, warehouseId: id }))}
          />
          <FilterChipGroup
            label="Category"
            options={[
              { id: 'all', name: 'All categories' },
              ...categories.map((category) => ({ id: category, name: category })),
            ]}
            selected={filters.category}
            onPick={(id) => setFilters((current) => ({ ...current, category: id }))}
          />
        </div>
        <button type="button" className="worker-filter-done" onClick={onClose}>
          Done
        </button>
      </section>
    </div>,
    document.body,
  );
}

function FilterChipGroup({
  label,
  options,
  selected,
  onPick,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  selected: string;
  onPick(id: string): void;
}) {
  return (
    <div className="worker-filter-group">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            className={selected === option.id ? 'worker-filter-chip worker-filter-chip--active' : 'worker-filter-chip'}
            aria-pressed={selected === option.id}
            onClick={() => onPick(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
