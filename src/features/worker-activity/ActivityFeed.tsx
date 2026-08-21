import type { ActivityView } from '../../domain/read-models/activity';
import '../../styles/activity-indicator.css';

export function ActivityFeed({ events, onSelect }: { events: ActivityView[]; onSelect(toolUnitId: string): void }) {
  return (
    <div className="activity-feed">
      {events.map((event) => (
        <button
          type="button"
          className="worker-activity-row worker-activity-card"
          key={event.id}
          onClick={() => onSelect(event.toolUnitId)}
          aria-label={`Open ${event.toolName} details`}
        >
          <span className="worker-activity-photo">
            <img src={event.imageSrc} alt="" loading="lazy" />
          </span>
          <span className="worker-activity-copy">
            <strong>{event.action}</strong>
            <span className="worker-activity-tags">
              <span className={`worker-activity-tag worker-activity-tag--${event.kind}`}>
                {activityLabel(event.kind)}
              </span>
              <time>{event.time}</time>
            </span>
          </span>
          <span className={`activity-dot activity-dot--${event.kind}`} />
        </button>
      ))}
    </div>
  );
}

function activityLabel(kind: ActivityView['kind']) {
  if (kind === 'request') return 'Request';
  if (kind === 'flag') return 'Condition';
  if (kind === 'custody') return 'Custody';
  return 'Record';
}
