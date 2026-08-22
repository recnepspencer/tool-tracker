import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../../components/ui/AsyncState';
import { PageHeading } from '../../components/layout/PageHeading';
import { SelectField } from '../../components/ui/SelectField';
import { SearchField } from '../../components/ui/TextField';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { useWarehouseQueue } from './use-warehouse-queue';
import { useWarehouseScopes } from './use-warehouse-scopes';
import { useWarehouseOperationsSummary } from './use-warehouse-summary';
import { WarehouseQueueItem } from './WarehouseQueueItem';
import { WarehouseQueueReviewDialog } from './WarehouseQueueReviewDialog';
import { useWarehouseQueueReviewController } from './use-warehouse-queue-review-controller';
import './admin-operations.css';
import type { WarehouseQueueItemView } from '../../domain/read-models/warehouse-operations';

type QueueFilter = 'all' | 'request' | 'return';

export function WarehouseQueuePage() {
  const [warehouseId, setWarehouseId] = useState('all');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const warehouses = useWarehouseScopes();
  const queue = useWarehouseQueue(warehouseId);
  const summary = useWarehouseOperationsSummary(warehouseId);
  const items = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (queue.data ?? []).filter(
      (item) =>
        (filter === 'all' || item.kind === filter) &&
        (!query || `${item.toolName} ${item.personName} ${item.warehouseName}`.toLocaleLowerCase().includes(query)),
    );
  }, [filter, queue.data, search]);
  const requests = items.filter((item) => item.kind === 'request');
  const returns = items.filter((item) => item.kind === 'return');
  const queryBlocked =
    queue.isFetching ||
    queue.isPaused ||
    queue.isError ||
    warehouses.isFetching ||
    warehouses.isPaused ||
    warehouses.isError;
  const reviewController = useWarehouseQueueReviewController({ items: queue.data, queryBlocked });
  if (queue.isPending && !queue.data) return <LoadingState label="Loading warehouse queue…" />;
  if (!queue.data)
    return <ErrorState message="The warehouse queue could not be loaded." onRetry={() => void queue.refetch()} />;
  return (
    <div className="page-content admin-operations-page">
      <PageHeading
        eyebrow="Admin view · Warehouse operations"
        title="Queue"
        description="Review requests and returns at the gate before custody changes."
      />
      <div className="operations-toolbar">
        <div className="operations-tabs" role="tablist" aria-label="Queue filter">
          {(
            [
              ['all', 'All waiting'],
              ['request', 'Requests'],
              ['return', 'Returns'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? 'operations-tab operations-tab--active' : 'operations-tab'}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>
                {!summary.data
                  ? '—'
                  : value === 'all'
                    ? summary.data.queueCount
                    : value === 'request'
                      ? summary.data.requestCount
                      : summary.data.returnCount}
              </span>
            </button>
          ))}
        </div>
        <div className="operations-filters operations-filters--compact">
          <SearchField compact label="Search queue" placeholder="Search queue…" value={search} onChange={setSearch} />
          <SelectField
            compact
            hideLabel
            searchable={false}
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={[
              { value: 'all', label: 'All warehouses' },
              ...(warehouses.data ?? []).map((warehouse) => ({ value: warehouse.id, label: warehouse.name })),
            ]}
          />
        </div>
      </div>
      {queue.isError && <ErrorState message="The queue could not be refreshed." onRetry={() => void queue.refetch()} />}
      {summary.isError && (
        <ErrorState
          message="The queue summary could not be refreshed. Queue decisions remain available."
          onRetry={() => void summary.refetch()}
        />
      )}
      {warehouses.isPending && !warehouses.data && <LoadingState label="Loading warehouse scopes…" />}
      {warehouses.isError && (
        <ErrorState
          message="Warehouse scopes could not be loaded. Decisions are paused until it recovers."
          onRetry={() => void warehouses.refetch()}
        />
      )}
      <SurfaceCard className="queue-card">
        {items.length ? (
          <>
            <QueueGroup
              label="Requests to release"
              items={requests}
              busy={reviewController.busy}
              onReview={reviewController.setReview}
            />
            <QueueGroup
              label="Returns to accept"
              items={returns}
              busy={reviewController.busy}
              onReview={reviewController.setReview}
            />
          </>
        ) : (
          <p className="admin-empty">Nothing waiting in this view. Requests and returns land here.</p>
        )}
      </SurfaceCard>
      {reviewController.review && (
        <WarehouseQueueReviewDialog
          review={reviewController.review}
          note={reviewController.note}
          busy={reviewController.busy}
          decisionError={reviewController.decisionError}
          onNoteChange={reviewController.setNote}
          onClose={reviewController.closeReview}
          onResolve={(decision) => void reviewController.resolve(decision)}
        />
      )}
    </div>
  );
}

function QueueGroup({
  label,
  items,
  busy,
  onReview,
}: {
  label: string;
  items: WarehouseQueueItemView[];
  busy: boolean;
  onReview(item: WarehouseQueueItemView): void;
}) {
  if (!items.length) return null;
  return (
    <section className="operations-queue-group">
      <div className="operations-queue-group__heading">
        <h2>{label}</h2>
        <span>{items.length}</span>
      </div>
      <div className="queue-list">
        {items.map((item) => (
          <WarehouseQueueItem item={item} busy={busy} onReview={onReview} key={item.id} />
        ))}
      </div>
    </section>
  );
}
