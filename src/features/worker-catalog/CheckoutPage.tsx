import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { SearchField } from '../../components/ui/TextField';
import { WorkerToolDetailSheet } from '../tool-detail/WorkerToolDetailSheet';
import type { DetailAction } from '../tool-detail/detail-action-types';
import type { CheckoutUnitOption } from '../tool-detail/checkout-unit-option';
import { CatalogFilters } from './CatalogFilters';
import {
  defaultCatalogFilters,
  filterCatalog,
  scopeCatalogItem,
  type CatalogFilters as CatalogFiltersState,
} from './catalog-selectors';
import { ToolCatalogCard } from './ToolCatalogCard';
import { useToolCatalog } from './use-tool-catalog';
import '../../styles/catalog.css';

const CATALOG_PRIORITY_IMAGE_COUNT = 4;

export function CheckoutPage() {
  const catalog = useToolCatalog();
  const [filters, setFilters] = useState<CatalogFiltersState>(defaultCatalogFilters);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [mode, setMode] = useState<'grid' | 'list'>('grid');
  const [selectedTool, setSelectedTool] = useState<{
    id: string;
    action?: DetailAction;
    requestUnits?: CheckoutUnitOption[];
  } | null>(null);
  const filtered = useMemo(
    () => filterCatalog(catalog.data ?? [], filters).map((item) => scopeCatalogItem(item, filters)),
    [catalog.data, filters],
  );

  if (catalog.isPending) return <LoadingState label="Loading the checkout catalog…" />;
  if (catalog.isError || !catalog.data) return <ErrorState message="The checkout catalog could not be loaded." />;

  return (
    <div className="worker-screen worker-checkout-screen">
      <div className="worker-screen-heading worker-checkout-heading">
        <h1 aria-label="Browse tools">Checkout</h1>
        <div className="worker-checkout-controls">
          <button
            type="button"
            className={`worker-filter-button${filtersOpen ? ' worker-filter-button--active' : ''}`}
            onClick={() => setFiltersOpen(true)}
            aria-expanded={filtersOpen}
            aria-label="Filter catalog"
          >
            <span className="worker-filter-icon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Filter</span>
          </button>
          <div className="worker-view-toggle" aria-label="Catalog view">
            <button
              type="button"
              className={mode === 'grid' ? 'worker-view-toggle--active' : ''}
              aria-label="Grid"
              aria-pressed={mode === 'grid'}
              onClick={() => setMode('grid')}
            >
              <span className="worker-grid-icon" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            </button>
            <button
              type="button"
              className={mode === 'list' ? 'worker-view-toggle--active' : ''}
              aria-label="List"
              aria-pressed={mode === 'list'}
              onClick={() => setMode('list')}
            >
              <span className="worker-list-icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </div>
      <SearchField
        className="worker-search-field"
        label="Search tools"
        placeholder="Search tools"
        value={filters.search}
        onChange={(search) => setFilters((current) => ({ ...current, search }))}
      />
      {filtered.length ? (
        <div className={`catalog-grid catalog-grid--${mode}`}>
          {filtered.map((item, index) => (
            <ToolCatalogCard
              key={item.id}
              item={item}
              mode={mode}
              priority={index < CATALOG_PRIORITY_IMAGE_COUNT}
              onSelect={(id, action, requestUnits) => setSelectedTool({ id, action, requestUnits })}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-empty worker-catalog-empty">
          <h2 aria-label="No tools match those filters.">Nothing matches that.</h2>
          <span>Try another warehouse or clear the filters.</span>
          <button type="button" className="worker-secondary-button" onClick={() => setFilters(defaultCatalogFilters)}>
            Clear filters
          </button>
        </div>
      )}
      {filtersOpen ? (
        <CatalogFilters
          items={catalog.data}
          filters={filters}
          setFilters={setFilters}
          onClear={() => setFilters(defaultCatalogFilters)}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}
      <WorkerToolDetailSheet
        toolUnitId={selectedTool?.id ?? null}
        initialAction={selectedTool?.action ?? null}
        requestUnits={selectedTool?.requestUnits}
        onRequestUnitChange={(id) => setSelectedTool((current) => (current ? { ...current, id } : current))}
        onClose={() => setSelectedTool(null)}
      />
    </div>
  );
}
