import { Link, Outlet } from 'react-router-dom';
import { EquipmentReports } from './equipment-reports';
import { Plus } from 'lucide-react';
import { AddToolLink } from './add-tool-photo';
import { ToolCatalogCard } from './checkout-card';
import { CatalogFilters } from './checkout-filters';
import { useCheckout, useMyTools } from './field-state';
import { InventoryPage } from './inventory';
import { ErrorState, LoadingState, SearchField } from './kit';
import { ToolRow } from './my-tools-row';
import { PendingGroup } from './pending-card';
import { PendingHandoffReviewSheet } from './pending-review';
import { useRegistrationPolicy } from './registration-policy';

const CATALOG_PRIORITY_IMAGE_COUNT = 4;

export function MyToolsPage() {
  const { c, tools, pending, transferStatus, openTool, startTransfer } = useMyTools();
  const { canRegister } = useRegistrationPolicy();
  if (tools.isPending) return <LoadingState label="Loading your tools…" />;
  if (tools.error || !tools.data)
    return <ErrorState message="Your tools could not be loaded." onRetry={() => void tools.refetch()} />;
  return (
    <div className="worker-screen">
      <div className="worker-screen-heading">
        <h1>My tools</h1>
      </div>
      <section className="worker-pending-section" aria-label="Pending tool movements">
        {pending.isPending && <LoadingState label="Checking pending handoffs…" />}
        {pending.error && <ErrorState message="Pending handoffs could not be loaded." onRetry={pending.retry} />}
        <PendingGroup title="Needs your response" items={pending.needsResponse} onReview={pending.openReview} />
        <PendingGroup title="Waiting on someone else" items={pending.waiting} onReview={pending.openReview} />
      </section>
      <EquipmentReports />
      <section className="worker-possession-section">
        <div className="worker-section-heading">
          <div>
            <span className="worker-eyebrow">In my possession</span>
          </div>
          <span className="worker-section-count">{tools.data.length}</span>
        </div>
        {!tools.data.length && (
          <p className="worker-empty-copy">No tools in your custody yet. Browse checkout to find what you need.</p>
        )}
        <div className="worker-tool-list">
          {tools.data.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              companyId={c.company_id}
              transferState={
                tool.pending_handoff_id || pending.pendingAssetIds.has(tool.id)
                  ? 'pending'
                  : tool.lifecycle !== 'active' || tool.missing
                    ? 'unavailable'
                    : transferStatus
              }
              onSelect={openTool}
              onTransfer={startTransfer}
            />
          ))}
        </div>
      </section>
      <Link className="worker-checkout-pill" to="/app/checkout" aria-label="Browse checkout catalog">
        Need something else? Browse checkout
      </Link>
      {canRegister && (
        <AddToolLink className="button button--primary floating-action" to="/app/mine/new">
          <Plus aria-hidden="true" />
          Add tool
        </AddToolLink>
      )}
      {pending.reviewing && (
        <PendingHandoffReviewSheet key={pending.reviewing.key} item={pending.reviewing} onClose={pending.closeReview} />
      )}
    </div>
  );
}

export function CheckoutPage() {
  const checkout = useCheckout();
  const { c, tools, items, filters, mode } = checkout;
  if (tools.isPending) return <LoadingState label="Loading the checkout catalog…" />;
  if (tools.error || !tools.data)
    return <ErrorState message="The checkout catalog could not be loaded." onRetry={() => void tools.refetch()} />;
  return (
    <div className="worker-screen worker-checkout-screen">
      <div className="worker-screen-heading worker-checkout-heading">
        <h1 aria-label="Browse tools">Checkout</h1>
        <div className="worker-checkout-controls">
          <button
            type="button"
            className={`worker-filter-button${checkout.filtersOpen ? ' worker-filter-button--active' : ''}`}
            onClick={checkout.openFilters}
            aria-expanded={checkout.filtersOpen}
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
              onClick={() => checkout.setMode('grid')}
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
              onClick={() => checkout.setMode('list')}
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
        onChange={checkout.setSearch}
      />
      {items.length ? (
        <div className={`catalog-grid catalog-grid--${mode}`}>
          {items.map((item, index) => (
            <ToolCatalogCard
              key={item.id}
              item={item}
              companyId={c.company_id}
              mode={mode}
              priority={index < CATALOG_PRIORITY_IMAGE_COUNT}
              onSelect={checkout.openItem}
            />
          ))}
        </div>
      ) : (
        <div className="catalog-empty worker-catalog-empty">
          <h2 aria-label="No tools match those filters.">Nothing matches that.</h2>
          <span>Try another warehouse or clear the filters.</span>
          <button type="button" className="worker-secondary-button" onClick={checkout.clearFilters}>
            Clear filters
          </button>
        </div>
      )}
      {checkout.filtersOpen && (
        <CatalogFilters
          filters={filters}
          warehouses={checkout.warehouses}
          categories={checkout.categories}
          onToggleAvailable={checkout.toggleAvailable}
          onWarehouse={checkout.setWarehouse}
          onCategory={checkout.setCategory}
          onClear={checkout.clearFilters}
          onClose={checkout.closeFilters}
        />
      )}
    </div>
  );
}
export function ToolSurface({ field = 'inventory' }: { field?: 'mine' | 'checkout' | 'inventory' | 'flagged' }) {
  return (
    <>
      {field === 'mine' ? (
        <MyToolsPage />
      ) : field === 'checkout' ? (
        <CheckoutPage />
      ) : (
        <InventoryPage flagged={field === 'flagged'} />
      )}
      <Outlet />
    </>
  );
}
export { ToolSheet } from './tools';
