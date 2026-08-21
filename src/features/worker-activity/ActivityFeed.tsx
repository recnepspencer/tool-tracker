import type { ActivityView } from '../../domain/read-models/activity';
import '../../styles/activity-indicator.css';

export function ActivityFeed({ events, onSelect }: { events: ActivityView[]; onSelect(toolUnitId: string): void }) {
  return (
    <div className="activity-feed">
      {events.map((event) => (
        <button
          type="button"
          className="worker-activity-row"
          key={event.id}
          onClick={() => onSelect(event.toolUnitId)}
          aria-label={`Open ${event.toolName} details`}
        >
          <span className={`activity-dot activity-dot--${event.kind}`} />
          <span className="worker-activity-copy">
            <strong>{event.action}</strong>
            <span>
              {event.actor} · {event.toolName}
            </span>
          </span>
          <time>{event.time}</time>
        </button>
      ))}
    </div>
  );
}
