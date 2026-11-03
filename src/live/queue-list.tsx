import { ChevronRight } from 'lucide-react';
import { Button, ToolPhoto } from './kit';
import type { QueueItem } from './operations-state';

/** Demo QueueGroup: a headed, counted list inside the single queue card. */
export function QueueGroup({
  label,
  items,
  busy,
  onReview,
  onResolve,
}: {
  label: string;
  items: QueueItem[];
  busy: boolean;
  onReview(item: QueueItem): void;
  onResolve(item: QueueItem, decision: 'approve' | 'decline'): void;
}) {
  if (!items.length) return null;
  return (
    <section className="operations-queue-group" aria-label={label}>
      <div className="operations-queue-group__heading">
        <h2>{label}</h2>
        <span>{items.length}</span>
      </div>
      <div className="queue-list">
        {items.map((item) => (
          <WarehouseQueueItem item={item} busy={busy} onReview={onReview} onResolve={onResolve} key={item.key} />
        ))}
      </div>
    </section>
  );
}

const kindLabel = (item: QueueItem) =>
  item.kind === 'request' ? 'request' : item.kind === 'return' ? 'return' : 'transfer';

/** Demo WarehouseQueueItem. */
function WarehouseQueueItem({
  item,
  busy,
  onReview,
  onResolve,
}: {
  item: QueueItem;
  busy: boolean;
  onReview(item: QueueItem): void;
  onResolve(item: QueueItem, decision: 'approve' | 'decline'): void;
}) {
  const note = item.decisionNote || item.note;
  return (
    <article className="queue-item">
      <button
        type="button"
        className="queue-item__open"
        disabled={busy}
        onClick={() => onReview(item)}
        aria-label={`Review ${kindLabel(item)} for ${item.toolName}`}
      >
        <ToolPhoto src={item.imageSrc} alt="" size="small" />
        <span className="queue-item__body">
          <span className="queue-item__heading">
            <span>
              <span className="eyebrow">{item.eyebrow}</span>
              <strong className="queue-item__name">{item.toolName}</strong>
            </span>
            <span className="queue-item__time">{item.time}</span>
          </span>
          <span className="queue-item__person">
            <strong>{item.personName}</strong>
            {item.personRole && ` · ${item.personRole}`}
          </span>
          <span className="queue-item__route">
            {item.from} <span aria-hidden="true">→</span> {item.to}
          </span>
          {note && <span className="queue-item__note">“{note}”</span>}
        </span>
        <span className="queue-item__review">
          <span className="queue-item__review-label">Review</span>
          <ChevronRight aria-hidden="true" />
        </span>
      </button>
      {(item.decline || item.approve) && (
        <div className="queue-item__decisions">
          {item.decline && (
            <Button
              variant="secondary"
              disabled={busy}
              aria-label={`Decline ${kindLabel(item)} for ${item.toolName}`}
              onClick={() => onResolve(item, 'decline')}
            >
              Decline
            </Button>
          )}
          {item.approve && (
            <Button
              disabled={busy}
              aria-label={`${item.kind === 'request' ? 'Release' : 'Accept return'} for ${item.toolName}`}
              onClick={() => onResolve(item, 'approve')}
            >
              {item.kind === 'request' ? 'Release' : 'Accept'}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
