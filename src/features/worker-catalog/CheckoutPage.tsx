import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { Button } from '../../components/ui/Button';
import { PageHeading } from '../../components/layout/PageHeading';
import { SearchField } from '../../components/ui/TextField';
import { WorkerToolDetailSheet } from '../tool-detail/WorkerToolDetailSheet';
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

export function CheckoutPage() {
  const catalog = useToolCatalog();
  const [filters, setFilters] = useState<CatalogFiltersState>(defaultCatalogFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<'grid' | 'list'>('grid');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const filtered = useMemo(
    () => filterCatalog(catalog.data ?? [], filters).map((item) => scopeCatalogItem(item, filters)),
    [catalog.data, filters],
  );

  if (catalog.isPending) return <LoadingState label="Loading the checkout catalog…" />;
  if (catalog.isError || !catalog.data) return <ErrorState message="The checkout catalog could not be loaded." />;

  return (
    <div className="page-content">
      <PageHeading
        eyebrow="Worker view · Checkout"
        title="Browse tools"
        description="Find an available unit by name, yard, category, or current availability. Open any card for its custody record."
        status="Catalog synced"
      />
      <div className="catalog-toolbar">
        <SearchField
          className="catalog-search"
          label="Search tools"
          placeholder="Search tools, brands, or models"
          value={filters.search}
          onChange={(search) => setFilters((current) => ({ ...current, search }))}
        />
        <Button variant="secondary" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}>
          {filtersOpen ? 'Hide filters' : 'Filter catalog'}
        </Button>
        <div className="view-toggle" aria-label="Catalog view">
          <button
            type="button"
            className={mode === 'grid' ? 'view-toggle--active' : ''}
            onClick={() => setMode('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className={mode === 'list' ? 'view-toggle--active' : ''}
            onClick={() => setMode('list')}
          >
            List
          </button>
        </div>
      </div>
      {filtersOpen ? (
        <CatalogFilters
          items={catalog.data}
          filters={filters}
          setFilters={setFilters}
          onClear={() => setFilters(defaultCatalogFilters)}
        />
      ) : null}
      <div className="catalog-results-heading">
        <span className="eyebrow">
          {filtered.length} of {catalog.data.length} tool types
        </span>
        <Link className="text-link" to="/worker/tools">
          Back to my tools
        </Link>
      </div>
      {filtered.length ? (
        <div className={`catalog-grid catalog-grid--${mode}`}>
          {filtered.map((item) => (
            <ToolCatalogCard key={item.id} item={item} mode={mode} onSelect={setSelectedToolId} />
          ))}
        </div>
      ) : (
        <div className="catalog-empty">
          <h2>No tools match those filters.</h2>
          <p>Try clearing a filter or searching for another tool name.</p>
          <Button variant="secondary" onClick={() => setFilters(defaultCatalogFilters)}>
            Clear filters
          </Button>
        </div>
      )}
      <WorkerToolDetailSheet toolUnitId={selectedToolId} onClose={() => setSelectedToolId(null)} />
    </div>
  );
}
