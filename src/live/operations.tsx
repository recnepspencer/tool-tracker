import { HandoffReviewDialog } from './handoff-review';
import { ErrorState, LoadingState, PageHeading, SearchField, SelectField, SurfaceCard } from './kit';
import { useOperationsPageState, useQueueDecision, type QueueFilter, type QueueItem } from './operations-state';
import { QueueGroup } from './queue-list';
import { RequestReviewDialog } from './queue-review';

export { ReconciliationsPage } from './reconciliation-page';

const filters: ReadonlyArray<readonly [QueueFilter, string]> = [
  ['', 'All waiting'],
  ['request', 'Requests'],
  ['return', 'Returns'],
];

/** Demo WarehouseQueuePage over the live requests and handoffs. */
export function OperationsPage() {
  const queue = useOperationsPageState();
  const quick = useQueueDecision();
  if (!queue.loaded && !queue.error) return <LoadingState label="Loading warehouse queue…" />;
  if (!queue.loaded) return <ErrorState message="The warehouse queue could not be loaded." onRetry={queue.retry} />;
  const resolve = (item: QueueItem, decision: 'approve' | 'decline') => {
    if (item.request) {
      const action = decision === 'approve' ? item.approve : item.decline;
      if (action === 'approve' || action === 'reject') void quick.decideRequest(item.request, action);
    } else if (item.handoff) {
      const action = decision === 'approve' ? item.approve : item.decline;
      if (action === 'accept' || action === 'decline') void quick.decideHandoff(item.handoff, action);
    }
  };
  const groupProps = {
    busy: quick.busy,
    onReview: (item: QueueItem) => queue.openReview(item.key),
    onResolve: resolve,
  };
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        eyebrow="Warehouse operations"
        title="Queue"
        description="Review requests and returns at the gate before custody changes."
      />
      <div className="operations-toolbar">
        <div className="operations-tabs" role="tablist" aria-label="Queue filter">
          {filters.map(([value, label]) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={!queue.history && queue.kind === value}
              className={
                !queue.history && queue.kind === value ? 'operations-tab operations-tab--active' : 'operations-tab'
              }
              onClick={() => queue.setKind(value)}
            >
              {label}
              <span>{queue.counts[value]}</span>
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={queue.history}
            className={queue.history ? 'operations-tab operations-tab--active' : 'operations-tab'}
            onClick={queue.showHistory}
          >
            History
          </button>
        </div>
        <div className="operations-filters operations-filters--compact">
          <SearchField
            compact
            label="Search queue"
            placeholder="Search queue…"
            value={queue.search}
            onChange={queue.setSearch}
          />
          <SelectField
            compact
            hideLabel
            searchable={false}
            label="Warehouse"
            value={queue.warehouse || 'all'}
            onChange={(value) => queue.setWarehouse(value === 'all' ? '' : value)}
            options={[
              { value: 'all', label: 'All warehouses' },
              ...(queue.refs.warehouses.data ?? []).map((warehouse) => ({
                value: warehouse.id,
                label: warehouse.name,
              })),
            ]}
          />
        </div>
      </div>
      {queue.error && <ErrorState message="The queue could not be refreshed." onRetry={queue.retry} />}
      {!queue.review && quick.error && (
        <p className="form-error operations-inline-error" role="alert">
          {quick.error}
        </p>
      )}
      <SurfaceCard className="queue-card">
        {!queue.empty ? (
          <>
            <QueueGroup label="Requests to release" items={queue.groups.request} {...groupProps} />
            <QueueGroup label="Returns to accept" items={queue.groups.return} {...groupProps} />
            <QueueGroup label="Transfers between people" items={queue.groups.transfer} {...groupProps} />
          </>
        ) : (
          <p className="admin-empty">Nothing waiting in this view. Requests and returns land here.</p>
        )}
      </SurfaceCard>
      {queue.reviewRequest && (
        <RequestReviewDialog
          key={queue.review}
          request={queue.reviewRequest}
          item={queue.reviewItem}
          onClose={() => queue.openReview('')}
        />
      )}
      {queue.reviewHandoff && (
        <HandoffReviewDialog
          key={queue.review}
          handoff={queue.reviewHandoff}
          asset={queue.asset(queue.reviewHandoff.asset_id)}
          item={queue.reviewItem}
          onClose={() => queue.openReview('')}
        />
      )}
    </div>
  );
}
