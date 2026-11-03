import { pendingDirectionLabel, pendingStatusLabel, type PendingItem } from './pending-state';

const reviewLabel = (item: PendingItem) =>
  item.variant === 'request' ? 'Review request' : item.variant === 'incoming' ? 'Review and accept' : 'Review transfer';

/** The demo's `PendingHandoffCard`; the review sheet opens through the `review` search param. */
export function PendingHandoffCard({ item, onReview }: { item: PendingItem; onReview(key: string): void }) {
  return (
    <article
      className={`worker-pending-card worker-pending-card--${item.variant}`}
      data-handoff-id={item.id}
      aria-label={`${item.toolName} pending handoff`}
    >
      <span className="worker-pending-direction">{pendingDirectionLabel(item)}</span>
      <strong className="worker-pending-title">{item.toolName}</strong>
      <span className="worker-pending-subtitle">{pendingStatusLabel(item)}</span>
      {item.actions.length > 0 && (
        <button type="button" className="worker-pending-review" onClick={() => onReview(item.key)}>
          {reviewLabel(item)}
        </button>
      )}
    </article>
  );
}

export function PendingGroup({
  title,
  items,
  onReview,
}: {
  title: string;
  items: PendingItem[];
  onReview(key: string): void;
}) {
  if (!items.length) return null;
  return (
    <div className="worker-pending-group">
      <h2>{title}</h2>
      <div className="worker-pending-grid">
        {items.map((item) => (
          <PendingHandoffCard key={item.key} item={item} onReview={onReview} />
        ))}
      </div>
    </div>
  );
}
