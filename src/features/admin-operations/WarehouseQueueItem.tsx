import { ChevronRight } from 'lucide-react';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import type { WarehouseQueueItemView } from '../../domain/read-models/warehouse-operations';

export function WarehouseQueueItem({
  item,
  busy,
  onReview,
}: {
  item: WarehouseQueueItemView;
  busy: boolean;
  onReview: (item: WarehouseQueueItemView) => void;
}) {
  return (
    <article className="queue-item">
      <button
        type="button"
        className="queue-item__open"
        disabled={busy}
        onClick={() => onReview(item)}
        aria-label={`Review ${item.kind} for ${item.toolName}`}
      >
        <ToolPhoto src={item.imageSrc} alt="" size="small" />
        <span className="queue-item__body">
          <span className="queue-item__heading">
            <span>
              <span className="eyebrow">{item.kind === 'request' ? 'Request to release' : 'Return to accept'}</span>
              <strong className="queue-item__name">{item.toolName}</strong>
            </span>
            <span className="queue-item__time">{item.requestedAt}</span>
          </span>
          <span className="queue-item__person">
            <strong>{item.personName}</strong> · {item.personRole}
          </span>
          <span className="queue-item__route">
            {item.from.name} <span aria-hidden="true">→</span> {item.to.name}
          </span>
          {item.note && <span className="queue-item__note">“{item.note}”</span>}
        </span>
        <span className="queue-item__review">
          <span className="queue-item__review-label">Review</span>
          <ChevronRight aria-hidden="true" />
        </span>
      </button>
    </article>
  );
}
