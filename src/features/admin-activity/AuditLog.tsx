import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatActivityTimestamp } from '../../domain/activity';
import type { AuditEventView } from '../../domain/read-models/activity';

export function AuditLog({ events }: { events: AuditEventView[] }) {
  return (
    <SurfaceCard className="audit-card">
      {events.length ? (
        <div className="audit-list">
          {events.map((event) => (
            <article className="audit-row" key={event.id}>
              <div className="audit-row__time">{formatActivityTimestamp(event.timestamp)}</div>
              <div className="audit-row__body">
                <strong>{event.action}</strong>
                <p>
                  {event.actor}
                  {event.toolName ? ` · ${event.toolName}${event.toolUnitId ? ` (${event.toolUnitId})` : ''}` : ''}
                  {event.warehouseName ? ` · ${event.warehouseName}` : ''}
                </p>
              </div>
              <span className="admin-meta-kind">{event.kind}</span>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty">No audit events match these filters.</p>
      )}
    </SurfaceCard>
  );
}
