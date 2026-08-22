import { SurfaceCard } from '../../components/ui/SurfaceCard';
import { formatActivityTimestamp } from '../../domain/activity';
import type { AuditEventView } from '../../domain/read-models/activity';

export function AuditLog({ events }: { events: AuditEventView[] }) {
  const groups = groupEvents(events);
  return (
    <SurfaceCard className="audit-card">
      {events.length ? (
        <div className="audit-list">
          {groups.map((group) => (
            <section className="audit-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.events.map((event) => (
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
            </section>
          ))}
        </div>
      ) : (
        <p className="admin-empty">No audit events match these filters.</p>
      )}
    </SurfaceCard>
  );
}

function groupEvents(events: AuditEventView[]) {
  const groups = new Map<string, AuditEventView[]>();
  events.forEach((event) => {
    const label = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(
      new Date(event.timestamp),
    );
    groups.set(label, [...(groups.get(label) ?? []), event]);
  });
  return [...groups.entries()].map(([label, groupedEvents]) => ({ label, events: groupedEvents }));
}
