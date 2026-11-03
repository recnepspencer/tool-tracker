import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CatalogFilterState, CatalogOption } from './checkout-catalog';
import { useModalFocusTrap } from './experience/use-modal-focus-trap';

/** The demo's `CatalogFilters` bottom sheet, driven by the URL-backed checkout filters. */
export function CatalogFilters({
  filters,
  warehouses,
  categories,
  onToggleAvailable,
  onWarehouse,
  onCategory,
  onClear,
  onClose,
}: {
  filters: CatalogFilterState;
  warehouses: CatalogOption[];
  categories: CatalogOption[];
  onToggleAvailable(): void;
  onWarehouse(id: string): void;
  onCategory(id: string): void;
  onClear(): void;
  onClose(): void;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  useModalFocusTrap(true, onClose, sheetRef);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  const availableOnly = filters.availableOnly;
  return createPortal(
    <div className="worker-filter-layer" role="presentation">
      <button
        type="button"
        className="worker-scrim worker-scrim--strong"
        aria-label="Close filters"
        onClick={onClose}
      />
      <section
        ref={sheetRef}
        className="worker-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Catalog filters"
      >
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
            onClick={onToggleAvailable}
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
            options={[{ id: '', name: 'All warehouses' }, ...warehouses]}
            selected={filters.warehouse}
            onPick={onWarehouse}
          />
          <FilterChipGroup
            label="Category"
            options={[{ id: '', name: 'All categories' }, ...categories]}
            selected={filters.category}
            onPick={onCategory}
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
  options: CatalogOption[];
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
            key={option.id || 'all'}
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
