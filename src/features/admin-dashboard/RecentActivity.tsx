import type { AuditEventView } from '../../domain/read-models/activity';
import '../../styles/activity-indicator.css';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export function RecentActivity({ events }: { events: AuditEventView[] }) {
  return (
    <SurfaceCard className="activity-card">
      <div className="card-heading">
        <div>
          <span className="eyebrow">Audit feed</span>
          <h2>Recent movement</h2>
        </div>
        <span className="section-count">Live</span>
      </div>
      <div className="activity-list">
        {events.length ? (
          events.map((event) => (
            <div className="activity-row" key={event.id}>
              <span className={`activity-dot activity-dot--${event.kind}`} />
              <div>
                <strong>{event.action}</strong>
                <span>
                  {event.actor} · {event.toolName ?? 'General audit'}
                </span>
              </div>
              <time>{event.time}</time>
            </div>
          ))
        ) : (
          <p className="admin-empty">No recent movement recorded.</p>
        )}
      </div>
    </SurfaceCard>
  );
}
