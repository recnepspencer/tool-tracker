import { Button } from '../../components/ui/Button';
import { ToolPhoto } from '../../components/ui/ToolPhoto';
import type { WarehouseQueueItemView } from '../../domain/read-models/warehouse-operations';

const actionLabel = (item: WarehouseQueueItemView) => (item.kind === 'request' ? 'Release to worker' : 'Accept return');

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
      <ToolPhoto src={item.imageSrc} alt="" size="small" />
      <div className="queue-item__body">
        <div className="queue-item__heading">
          <div>
            <span className="eyebrow">{item.kind === 'request' ? 'Request to release' : 'Return to accept'}</span>
            <h2>{item.toolName}</h2>
          </div>
          <span className="queue-item__time">{item.requestedAt}</span>
        </div>
        <p>
          <strong>{item.personName}</strong> · {item.personRole} · {item.warehouseName}
        </p>
        <p className="queue-item__route">
          {item.from.name} <span aria-hidden="true">→</span> {item.to.name}
        </p>
        {item.note && <p className="queue-item__note">“{item.note}”</p>}
        <div className="queue-item__actions">
          <Button disabled={busy} onClick={() => onReview(item)}>
            {actionLabel(item)}
          </Button>
        </div>
      </div>
    </article>
  );
}
